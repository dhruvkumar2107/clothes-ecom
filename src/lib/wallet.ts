import { db, tx, type PrismaTx } from './db';
import { writeJson } from './json';
import { clampToZero } from './money';
import {
  WALLET_TYPE_DIRECTION,
  type WalletDirection,
  type WalletTxnStatus,
  type WalletTxnType,
} from './enums';
import { getSetting } from './settings';

/**
 * The wallet ledger.
 *
 * One rule, and everything else follows from it: **the balance is a cache of the
 * ledger, and only this module is allowed to write either.** Nothing else calls
 * `db.wallet.update`. If a feature needs to move money it calls `credit`,
 * `debit`, `hold`, `release`, or `reverse` here, inside a transaction, and gets a
 * `WalletTransaction` row with `balanceAfter` stamped on it.
 *
 * That stamping is what makes the ledger auditable rather than merely present: a
 * statement that shows a running balance can be reconciled against the wallet
 * row, and any divergence is a bug you can *see* instead of a number nobody can
 * explain. `verifyIntegrity` is the check.
 *
 * ── Two balances, and why ───────────────────────────────────────────────────
 *
 *   `balance`       spendable right now
 *   `lockedBalance` credited but not yet spendable
 *
 * Money sits in `lockedBalance` for two distinct reasons, which is exactly why a
 * single number would not do:
 *
 *   1. **Referral commission inside its hold window.** The referred order can
 *      still be returned. Paying the commission out immediately means clawing it
 *      back from a wallet that may already be empty — so it is locked until the
 *      return window closes (`referral.holdDays`).
 *   2. **A pending withdrawal.** The moment a withdrawal is requested the money
 *      must stop being spendable, or the customer can spend it at checkout while
 *      the payout is in flight and we pay twice.
 *
 * Locked money is *not* debited — it is still theirs, it is just not available.
 * A withdrawal debits from locked at the moment the payout succeeds, and a
 * failed payout releases it back to spendable.
 *
 * ── Overdraft is impossible by construction ─────────────────────────────────
 *
 * Every debit re-reads the wallet inside the transaction and refuses if the
 * balance is short. Checking the balance before opening the transaction is the
 * classic double-spend: two concurrent checkouts both read ₹500, both pass, both
 * debit. `tx()` serialises, and the re-read inside it is the actual guard.
 */

export class WalletError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'WalletError';
    this.code = code;
    this.status = status;
  }
}

export interface WalletSnapshot {
  id: string;
  userId: string;
  /** Spendable now. */
  balance: number;
  /** Credited but not spendable — held commission plus pending withdrawals. */
  lockedBalance: number;
  /** balance + lockedBalance. What the customer thinks of as "my wallet". */
  totalBalance: number;
  currency: string;
  totalEarned: number;
  totalWithdrawn: number;
}

function snapshot(wallet: {
  id: string;
  userId: string;
  balance: number;
  lockedBalance: number;
  currency: string;
  totalEarned: number;
  totalWithdrawn: number;
}): WalletSnapshot {
  return { ...wallet, totalBalance: wallet.balance + wallet.lockedBalance };
}

/**
 * Fetch or create. Created lazily rather than at signup so a user row imported
 * by any path still resolves — but the seed and signup both call it eagerly so
 * the admin can see a wallet before the first credit.
 */
export async function ensureWallet(
  userId: string,
  client: PrismaTx | typeof db = db,
): Promise<WalletSnapshot> {
  const existing = await client.wallet.findUnique({ where: { userId } });
  if (existing) return snapshot(existing);

  const currency = await getSetting('store.defaultCurrency').catch(() => 'INR');
  const created = await client.wallet.create({ data: { userId, currency } });
  return snapshot(created);
}

export async function getWallet(userId: string): Promise<WalletSnapshot | null> {
  const wallet = await db.wallet.findUnique({ where: { userId } });
  return wallet ? snapshot(wallet) : null;
}

// ── movements ───────────────────────────────────────────────────────────────

export interface MovementInput {
  userId: string;
  type: WalletTxnType;
  amount: number;
  description: string;
  refType?: string | null;
  refId?: string | null;
  meta?: Record<string, unknown>;
  /** Only for `adjustment`, which can go either way. */
  direction?: WalletDirection;
  /**
   * Guards against double-crediting on webhook replay. When supplied, a second
   * call with the same (type, refType, refId) returns the existing row instead
   * of creating another.
   */
  idempotent?: boolean;
}

export interface Movement {
  transactionId: string;
  wallet: WalletSnapshot;
  /** False when an idempotent call matched an existing transaction. */
  created: boolean;
}

function resolveDirection(type: WalletTxnType, explicit?: WalletDirection): WalletDirection {
  const fixed = WALLET_TYPE_DIRECTION[type];
  if (fixed) {
    if (explicit && explicit !== fixed) {
      throw new WalletError(
        'direction_conflict',
        `A ${type} is always a ${fixed}; refusing to record it as a ${explicit}.`,
      );
    }
    return fixed;
  }
  if (!explicit) {
    throw new WalletError('direction_required', `An ${type} must state credit or debit.`);
  }
  return explicit;
}

function assertAmount(amount: number): void {
  if (!Number.isInteger(amount)) {
    throw new WalletError('amount_not_integer', 'Wallet amounts are integer paise.');
  }
  if (amount <= 0) {
    throw new WalletError('amount_not_positive', 'Wallet amounts must be greater than zero.');
  }
}

async function findExisting(
  client: PrismaTx,
  input: MovementInput,
): Promise<{ id: string } | null> {
  if (!input.idempotent || !input.refId) return null;
  return client.walletTransaction.findFirst({
    where: {
      userId: input.userId,
      type: input.type,
      refType: input.refType ?? null,
      refId: input.refId,
      status: { not: 'reversed' },
    },
    select: { id: true },
  });
}

/**
 * Add spendable money.
 *
 * Refunds, cashback, signup bonus, and released commission all land here. Held
 * commission does *not* — it goes through `hold`.
 */
export async function credit(
  input: MovementInput,
  client?: PrismaTx,
): Promise<Movement> {
  assertAmount(input.amount);
  const direction = resolveDirection(input.type, input.direction);
  if (direction !== 'credit') {
    throw new WalletError('wrong_helper', `Use debit() for a ${input.type}.`);
  }

  // Same reasoning as debit(): order cancellation has to return the wallet money
  // and mark the order cancelled in one atom, and Prisma transactions do not
  // nest, so an outer client must be enlistable.
  const run = async (client: PrismaTx): Promise<Movement> => {
    const existing = await findExisting(client, input);
    if (existing) {
      const wallet = await client.wallet.findUniqueOrThrow({ where: { userId: input.userId } });
      return { transactionId: existing.id, wallet: snapshot(wallet), created: false };
    }

    const wallet = await lockWallet(client, input.userId);
    const balance = wallet.balance + input.amount;

    const txn = await client.walletTransaction.create({
      data: {
        walletId: wallet.id,
        userId: input.userId,
        type: input.type,
        direction: 'credit',
        amount: input.amount,
        status: 'completed',
        balanceAfter: balance,
        lockedAfter: wallet.lockedBalance,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        description: input.description,
        metaJson: input.meta ? writeJson(input.meta) : null,
      },
      select: { id: true },
    });

    const updated = await client.wallet.update({
      where: { id: wallet.id },
      data: {
        balance,
        // `totalEarned` tracks money that arrived from us, not money that came
        // back. A refund is the customer's own money returning, so counting it
        // as earnings would inflate every lifetime-value figure in the admin.
        ...(isEarning(input.type) ? { totalEarned: { increment: input.amount } } : {}),
      },
    });

    return { transactionId: txn.id, wallet: snapshot(updated), created: true };
  };

  return client ? run(client) : tx(run);
}

function isEarning(type: WalletTxnType): boolean {
  return type === 'referral_commission' || type === 'cashback' || type === 'signup_bonus';
}

/**
 * Spend from the spendable balance.
 *
 * `order_payment` at checkout, and `withdrawal` when a payout completes — the
 * latter passes `fromLocked` because the money was already moved to locked when
 * the withdrawal was requested.
 *
 * Takes an optional `client` so a caller that is already inside a transaction can
 * enlist this debit in it. Order creation needs that: the wallet deduction and
 * the order row must commit together, or a half-failure either gives away goods
 * or silently eats the customer's balance. Prisma interactive transactions do not
 * nest, so passing the outer client is the only way to get one atom.
 */
export async function debit(
  input: MovementInput & { fromLocked?: boolean },
  client?: PrismaTx,
): Promise<Movement> {
  assertAmount(input.amount);
  const direction = resolveDirection(input.type, input.direction);
  if (direction !== 'debit') {
    throw new WalletError('wrong_helper', `Use credit() for a ${input.type}.`);
  }

  const run = async (client: PrismaTx): Promise<Movement> => {
    const existing = await findExisting(client, input);
    if (existing) {
      const wallet = await client.wallet.findUniqueOrThrow({ where: { userId: input.userId } });
      return { transactionId: existing.id, wallet: snapshot(wallet), created: false };
    }

    const wallet = await lockWallet(client, input.userId);

    const pool = input.fromLocked ? wallet.lockedBalance : wallet.balance;
    if (pool < input.amount) {
      throw new WalletError(
        'insufficient_balance',
        input.fromLocked
          ? 'That withdrawal is no longer held against this wallet.'
          : 'Your wallet balance is not enough for that.',
        409,
      );
    }

    const balance = input.fromLocked ? wallet.balance : wallet.balance - input.amount;
    const locked = input.fromLocked ? wallet.lockedBalance - input.amount : wallet.lockedBalance;

    const txn = await client.walletTransaction.create({
      data: {
        walletId: wallet.id,
        userId: input.userId,
        type: input.type,
        direction: 'debit',
        amount: input.amount,
        status: 'completed',
        balanceAfter: balance,
        lockedAfter: locked,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        description: input.description,
        metaJson: input.meta ? writeJson(input.meta) : null,
      },
      select: { id: true },
    });

    const updated = await client.wallet.update({
      where: { id: wallet.id },
      data: {
        balance,
        lockedBalance: locked,
        ...(input.type === 'withdrawal' ? { totalWithdrawn: { increment: input.amount } } : {}),
      },
    });

    return { transactionId: txn.id, wallet: snapshot(updated), created: true };
  };

  return client ? run(client) : tx(run);
}

/**
 * Credit straight into locked — money that is theirs but not yet spendable.
 *
 * Used for referral commission during its hold window. `availableAt` is what
 * `releaseDue` scans for, and the transaction stays `held` until then, so the
 * ledger shows the customer *why* the number is not spendable rather than just
 * showing a smaller one.
 */
export async function hold(
  input: MovementInput & { availableAt: Date },
): Promise<Movement> {
  assertAmount(input.amount);

  return tx(async (client) => {
    const existing = await findExisting(client, input);
    if (existing) {
      const wallet = await client.wallet.findUniqueOrThrow({ where: { userId: input.userId } });
      return { transactionId: existing.id, wallet: snapshot(wallet), created: false };
    }

    const wallet = await lockWallet(client, input.userId);
    const locked = wallet.lockedBalance + input.amount;

    const txn = await client.walletTransaction.create({
      data: {
        walletId: wallet.id,
        userId: input.userId,
        type: input.type,
        direction: 'credit',
        amount: input.amount,
        status: 'held',
        balanceAfter: wallet.balance,
        lockedAfter: locked,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        description: input.description,
        availableAt: input.availableAt,
        metaJson: input.meta ? writeJson(input.meta) : null,
      },
      select: { id: true },
    });

    const updated = await client.wallet.update({
      where: { id: wallet.id },
      data: {
        lockedBalance: locked,
        ...(isEarning(input.type) ? { totalEarned: { increment: input.amount } } : {}),
      },
    });

    return { transactionId: txn.id, wallet: snapshot(updated), created: true };
  });
}

/**
 * Move locked → spendable. Called when a hold window closes, and when a failed
 * payout returns the money.
 *
 * Deliberately mutates the original `held` row to `completed` rather than
 * writing a second transaction. A hold and its release are one event from the
 * customer's point of view; two rows would make every statement read as if the
 * commission were paid twice.
 */
export async function releaseHold(
  transactionId: string,
  client?: PrismaTx,
): Promise<WalletSnapshot> {
  const run = async (c: PrismaTx): Promise<WalletSnapshot> => {
    const txn = await c.walletTransaction.findUnique({ where: { id: transactionId } });
    if (!txn) throw new WalletError('txn_not_found', 'That wallet entry no longer exists.', 404);
    if (txn.status !== 'held') {
      // Idempotent: a second release attempt is a no-op, not an error, because
      // the scheduled releaser and a manual admin release can race.
      const wallet = await c.wallet.findUniqueOrThrow({ where: { id: txn.walletId } });
      return snapshot(wallet);
    }

    const wallet = await c.wallet.findUniqueOrThrow({ where: { id: txn.walletId } });
    const locked = clampToZero(wallet.lockedBalance - txn.amount);
    const balance = wallet.balance + txn.amount;

    await c.walletTransaction.update({
      where: { id: txn.id },
      data: { status: 'completed', releasedAt: new Date(), balanceAfter: balance, lockedAfter: locked },
    });

    const updated = await c.wallet.update({
      where: { id: wallet.id },
      data: { balance, lockedBalance: locked },
    });

    return snapshot(updated);
  };

  return client ? run(client) : tx(run);
}

/**
 * Undo a completed movement — a reversed payout, a clawed-back commission on a
 * returned order.
 *
 * This writes a *compensating* transaction and marks the original `reversed`,
 * rather than deleting anything. A ledger you can delete from is not a ledger,
 * and the compensating row is what the customer sees when they ask why their
 * balance changed.
 */
export async function reverse(input: {
  transactionId: string;
  reason: string;
  type?: WalletTxnType;
}): Promise<Movement> {
  return tx(async (client) => {
    const original = await client.walletTransaction.findUnique({
      where: { id: input.transactionId },
    });
    if (!original) throw new WalletError('txn_not_found', 'That wallet entry no longer exists.', 404);
    if (original.status === 'reversed') {
      const wallet = await client.wallet.findUniqueOrThrow({ where: { id: original.walletId } });
      return { transactionId: original.id, wallet: snapshot(wallet), created: false };
    }

    const wallet = await lockWallet(client, original.userId);

    // A held row never became spendable, so reversing it only unwinds `locked`.
    const wasHeld = original.status === 'held';
    const opposite: WalletDirection = original.direction === 'credit' ? 'debit' : 'credit';

    let balance = wallet.balance;
    let locked = wallet.lockedBalance;

    if (wasHeld) {
      locked = clampToZero(locked - original.amount);
    } else if (opposite === 'debit') {
      // Clawing back a credit can legitimately drive the wallet negative if the
      // customer already spent it. Refusing here would leave the ledger claiming
      // money we know is gone, so the balance is allowed to go under and the
      // admin sees it as a recoverable.
      balance = balance - original.amount;
    } else {
      balance = balance + original.amount;
    }

    const compensating = await client.walletTransaction.create({
      data: {
        walletId: wallet.id,
        userId: original.userId,
        type: input.type ?? (original.type as WalletTxnType),
        direction: opposite,
        amount: original.amount,
        status: 'completed',
        balanceAfter: balance,
        lockedAfter: locked,
        refType: original.refType,
        refId: original.refId,
        description: `Reversal: ${input.reason}`,
        metaJson: writeJson({ reversalOf: original.id, reason: input.reason }),
      },
      select: { id: true },
    });

    await client.walletTransaction.update({
      where: { id: original.id },
      data: { status: 'reversed' },
    });

    const updated = await client.wallet.update({
      where: { id: wallet.id },
      data: {
        balance,
        lockedBalance: locked,
        ...(isEarning(original.type as WalletTxnType) && original.direction === 'credit'
          ? { totalEarned: { decrement: original.amount } }
          : {}),
        ...(original.type === 'withdrawal'
          ? { totalWithdrawn: { decrement: original.amount } }
          : {}),
      },
    });

    return { transactionId: compensating.id, wallet: snapshot(updated), created: true };
  });
}

/**
 * Move spendable → locked without a new credit. This is the withdrawal request
 * path: the money is already theirs, it just stops being spendable while the
 * payout is in flight.
 */
export async function lockForWithdrawal(input: {
  userId: string;
  amount: number;
  withdrawalId: string;
  description: string;
}): Promise<{ wallet: WalletSnapshot }> {
  assertAmount(input.amount);

  return tx(async (client) => {
    const wallet = await lockWallet(client, input.userId);
    if (wallet.balance < input.amount) {
      throw new WalletError(
        'insufficient_balance',
        'Your available balance is not enough for that withdrawal.',
        409,
      );
    }

    const balance = wallet.balance - input.amount;
    const locked = wallet.lockedBalance + input.amount;

    await client.walletTransaction.create({
      data: {
        walletId: wallet.id,
        userId: input.userId,
        type: 'withdrawal',
        direction: 'debit',
        amount: input.amount,
        // `pending`, not `completed`: the money has not left yet. The statement
        // shows it as in-flight, which is what the customer needs to see.
        status: 'pending',
        balanceAfter: balance,
        lockedAfter: locked,
        refType: 'WithdrawalRequest',
        refId: input.withdrawalId,
        description: input.description,
      },
    });

    const updated = await client.wallet.update({
      where: { id: wallet.id },
      data: { balance, lockedBalance: locked },
    });

    return { wallet: snapshot(updated) };
  });
}

/**
 * A withdrawal completed at the bank: the locked money is now genuinely gone.
 * Flips the pending row to completed and drains locked.
 */
export async function settleWithdrawal(input: {
  withdrawalId: string;
  utr?: string | null;
}): Promise<WalletSnapshot> {
  return tx(async (client) => {
    const pending = await client.walletTransaction.findFirst({
      where: { refType: 'WithdrawalRequest', refId: input.withdrawalId, type: 'withdrawal', status: 'pending' },
    });
    if (!pending) {
      const withdrawal = await client.withdrawalRequest.findUniqueOrThrow({
        where: { id: input.withdrawalId },
        select: { userId: true },
      });
      const wallet = await client.wallet.findUniqueOrThrow({ where: { userId: withdrawal.userId } });
      return snapshot(wallet);
    }

    const wallet = await client.wallet.findUniqueOrThrow({ where: { id: pending.walletId } });
    const locked = clampToZero(wallet.lockedBalance - pending.amount);

    await client.walletTransaction.update({
      where: { id: pending.id },
      data: {
        status: 'completed',
        lockedAfter: locked,
        releasedAt: new Date(),
        ...(input.utr ? { metaJson: writeJson({ utr: input.utr }) } : {}),
      },
    });

    const updated = await client.wallet.update({
      where: { id: wallet.id },
      data: { lockedBalance: locked, totalWithdrawn: { increment: pending.amount } },
    });

    return snapshot(updated);
  });
}

/**
 * A withdrawal failed or was rejected: unlock the money so it is spendable again
 * and mark the pending debit as failed.
 */
export async function unlockWithdrawal(input: {
  withdrawalId: string;
  reason: string;
}): Promise<WalletSnapshot> {
  return tx(async (client) => {
    const pending = await client.walletTransaction.findFirst({
      where: {
        refType: 'WithdrawalRequest',
        refId: input.withdrawalId,
        type: 'withdrawal',
        status: { in: ['pending', 'held'] },
      },
    });
    if (!pending) {
      const withdrawal = await client.withdrawalRequest.findUniqueOrThrow({
        where: { id: input.withdrawalId },
        select: { userId: true },
      });
      const wallet = await client.wallet.findUniqueOrThrow({ where: { userId: withdrawal.userId } });
      return snapshot(wallet);
    }

    const wallet = await client.wallet.findUniqueOrThrow({ where: { id: pending.walletId } });
    const locked = clampToZero(wallet.lockedBalance - pending.amount);
    const balance = wallet.balance + pending.amount;

    await client.walletTransaction.update({
      where: { id: pending.id },
      data: { status: 'failed', balanceAfter: balance, lockedAfter: locked },
    });

    await client.walletTransaction.create({
      data: {
        walletId: wallet.id,
        userId: pending.userId,
        type: 'withdrawal_reversal',
        direction: 'credit',
        amount: pending.amount,
        status: 'completed',
        balanceAfter: balance,
        lockedAfter: locked,
        refType: 'WithdrawalRequest',
        refId: input.withdrawalId,
        description: `Withdrawal returned to wallet — ${input.reason}`,
      },
    });

    const updated = await client.wallet.update({
      where: { id: wallet.id },
      data: { balance, lockedBalance: locked },
    });

    return snapshot(updated);
  });
}

// ── release scheduler ───────────────────────────────────────────────────────

/**
 * Release every hold whose `availableAt` has passed.
 *
 * Called by the admin "release due commission" action and by the wallet page on
 * load, which is deliberate: without a cron, a customer opening their wallet is
 * the most reliable trigger for the money they are waiting on. Cheap — the query
 * is indexed and usually returns nothing.
 */
export async function releaseDueHolds(now = new Date()): Promise<{ released: number; total: number }> {
  const due = await db.walletTransaction.findMany({
    where: { status: 'held', availableAt: { lte: now } },
    select: { id: true, amount: true },
    take: 500,
  });

  let released = 0;
  let total = 0;
  for (const row of due) {
    try {
      await releaseHold(row.id);
      released += 1;
      total += row.amount;
    } catch (error) {
      console.error(`[wallet] could not release hold ${row.id}:`, error);
    }
  }
  return { released, total };
}

/** Same, scoped to one user — what the wallet page calls. */
export async function releaseDueHoldsForUser(
  userId: string,
  now = new Date(),
): Promise<{ released: number; total: number }> {
  const due = await db.walletTransaction.findMany({
    where: { userId, status: 'held', availableAt: { lte: now } },
    select: { id: true, amount: true },
  });

  let released = 0;
  let total = 0;
  for (const row of due) {
    await releaseHold(row.id).then(
      () => {
        released += 1;
        total += row.amount;
      },
      (error) => console.error(`[wallet] could not release hold ${row.id}:`, error),
    );
  }
  return { released, total };
}

// ── statement & integrity ───────────────────────────────────────────────────

export interface StatementRow {
  id: string;
  type: WalletTxnType;
  direction: WalletDirection;
  amount: number;
  status: WalletTxnStatus;
  balanceAfter: number;
  description: string;
  refType: string | null;
  refId: string | null;
  availableAt: Date | null;
  createdAt: Date;
}

export async function getStatement(
  userId: string,
  options: { take?: number; skip?: number; type?: WalletTxnType; from?: Date; to?: Date } = {},
): Promise<{ rows: StatementRow[]; total: number }> {
  const where = {
    userId,
    ...(options.type ? { type: options.type } : {}),
    ...(options.from || options.to
      ? { createdAt: { ...(options.from ? { gte: options.from } : {}), ...(options.to ? { lte: options.to } : {}) } }
      : {}),
  };

  const [rows, total] = await Promise.all([
    db.walletTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.take ?? 25,
      skip: options.skip ?? 0,
      select: {
        id: true, type: true, direction: true, amount: true, status: true,
        balanceAfter: true, description: true, refType: true, refId: true,
        availableAt: true, createdAt: true,
      },
    }),
    db.walletTransaction.count({ where }),
  ]);

  return { rows: rows as StatementRow[], total };
}

/**
 * Recompute the balance from the ledger and compare it to the cached one.
 *
 * This exists because a cached balance is a liability unless something checks
 * it. Surfaced on the admin wallet page per user, and over all wallets in
 * Reports — a non-empty result is a bug in this file, not in the data.
 */
export async function verifyIntegrity(userId: string): Promise<{
  ok: boolean;
  storedBalance: number;
  computedBalance: number;
  storedLocked: number;
  computedLocked: number;
  transactionCount: number;
}> {
  const [wallet, txns] = await Promise.all([
    db.wallet.findUniqueOrThrow({ where: { userId } }),
    db.walletTransaction.findMany({
      where: { userId },
      select: { direction: true, amount: true, status: true },
    }),
  ]);

  let computedBalance = 0;
  let computedLocked = 0;

  for (const t of txns) {
    if (t.status === 'reversed' || t.status === 'failed') continue;
    if (t.status === 'held') {
      computedLocked += t.amount;
      continue;
    }
    if (t.status === 'pending') {
      // An in-flight withdrawal: already out of `balance`, sitting in `locked`.
      if (t.direction === 'debit') computedLocked += t.amount;
      continue;
    }
    computedBalance += t.direction === 'credit' ? t.amount : -t.amount;
  }

  return {
    ok: computedBalance === wallet.balance && computedLocked === wallet.lockedBalance,
    storedBalance: wallet.balance,
    computedBalance,
    storedLocked: wallet.lockedBalance,
    computedLocked,
    transactionCount: txns.length,
  };
}

// ── internals ───────────────────────────────────────────────────────────────

/**
 * Re-read the wallet inside the transaction.
 *
 * The name is aspirational on SQLite — there is no `SELECT … FOR UPDATE`. What
 * actually serialises writes is `tx()`'s Serializable isolation plus SQLite's
 * single-writer model. The re-read is still essential: it guarantees the balance
 * used for arithmetic is the one committed at transaction start, not a stale
 * value read before the transaction opened. On Postgres this is where a
 * `FOR UPDATE` goes.
 */
async function lockWallet(
  client: PrismaTx,
  userId: string,
): Promise<{
  id: string; userId: string; balance: number; lockedBalance: number;
  currency: string; totalEarned: number; totalWithdrawn: number;
}> {
  const existing = await client.wallet.findUnique({ where: { userId } });
  if (existing) return existing;
  const currency = await getSetting('store.defaultCurrency').catch(() => 'INR');
  return client.wallet.create({ data: { userId, currency } });
}
