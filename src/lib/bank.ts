import { Prisma } from '@prisma/client';
import { db } from './db';
import {
  decryptField,
  encryptField,
  idempotencyKey,
  maskAccountNumber,
} from './crypto';
import { getSetting, getSettings } from './settings';
import { getBankVerifier } from './adapters/registry';
import { GatewayError, type BankVerificationResult, type IfscDetails } from './adapters/types';
import { readJson, writeJson } from './json';
import type { VerificationStatus } from './enums';

/**
 * Bank accounts and penny-drop verification.
 *
 * This is the module the brief singled out: *"Bank verification should call a
 * real penny-drop/IFSC-validation API — do not fake this as static UI, build
 * actual verify → status → enable-withdrawal state flow."* So the flow here is
 * genuinely asynchronous end to end, and the mock driver models the same
 * asynchrony rather than returning `verified` on the first call.
 *
 * ── The state machine ──────────────────────────────────────────────────────
 *
 *   unverified ──submit──▸ pending ──poll/webhook──▸ verified
 *        ▲                    │                          │
 *        └────── failed ◂─────┘                    withdrawals enabled
 *
 * `pending` is a first-class state, not a loading spinner. A real penny-drop
 * takes seconds to minutes: we deposit ₹1, the bank tells us the name on the
 * account, and only then can we compare it to what the customer typed. Any UI
 * that treats this as synchronous is wrong, and any backend that treats a
 * timeout as a failure will mark good accounts bad.
 *
 * ── Why the name match is the point ────────────────────────────────────────
 *
 * A penny-drop proves the account *exists and accepts money*. That is table
 * stakes. What makes it worth the API call is `registeredName` — the name the
 * bank has on file. Comparing it to the account holder name the customer entered
 * is what stops wallet balance being routed to somebody else's account, whether
 * by typo or by design. Below the configured threshold the account is not
 * verified, regardless of the penny landing.
 *
 * ── Storage ────────────────────────────────────────────────────────────────
 *
 * The account number is encrypted with AES-256-GCM (`accountNumberEnc`) and a
 * plaintext last-4 is kept for display. It has to be reversible rather than
 * hashed, because the payout gateway needs the real number at withdrawal time.
 * The decrypted value never leaves this module or `payouts.ts` — nothing returns
 * it to a route, a page, or a log line.
 */

export class BankError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'BankError';
    this.code = code;
    this.status = status;
  }
}

// ── shapes ──────────────────────────────────────────────────────────────────

/** Everything safe to hand to a page or an API response. Never the account number. */
export interface BankAccountView {
  id: string;
  kind: 'bank' | 'upi';
  accountHolderName: string;
  /** `••••••1234` for a bank account, the VPA itself for UPI. */
  displayIdentifier: string;
  last4: string | null;
  ifsc: string | null;
  bankName: string | null;
  branch: string | null;
  accountType: string | null;
  vpa: string | null;
  verificationStatus: VerificationStatus;
  nameMatchScore: number | null;
  registeredName: string | null;
  verifiedAt: Date | null;
  failureReason: string | null;
  verificationAttempts: number;
  isDefault: boolean;
  /** True when a withdrawal may be requested against this account. */
  withdrawable: boolean;
  createdAt: Date;
}

export interface AddBankAccountInput {
  userId: string;
  kind: 'bank' | 'upi';
  accountHolderName: string;
  accountNumber?: string;
  confirmAccountNumber?: string;
  ifsc?: string;
  vpa?: string;
  accountType?: 'savings' | 'current';
  makeDefault?: boolean;
}

// ── read ────────────────────────────────────────────────────────────────────

export async function listBankAccounts(userId: string): Promise<BankAccountView[]> {
  const [rows, requireVerified] = await Promise.all([
    db.bankAccount.findMany({
      where: { userId, archivedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    }),
    getSetting('wallet.requireVerifiedBank'),
  ]);

  return rows.map((row) => toView(row, requireVerified));
}

export async function getBankAccount(
  userId: string,
  bankAccountId: string,
): Promise<BankAccountView | null> {
  const [row, requireVerified] = await Promise.all([
    db.bankAccount.findFirst({ where: { id: bankAccountId, userId, archivedAt: null } }),
    getSetting('wallet.requireVerifiedBank'),
  ]);
  return row ? toView(row, requireVerified) : null;
}

function toView(
  row: {
    id: string; kind: string; accountHolderName: string; accountNumberLast4: string | null;
    ifsc: string | null; bankName: string | null; branch: string | null;
    accountType: string | null; vpa: string | null; verificationStatus: string;
    nameMatchScore: number | null; registeredName: string | null; verifiedAt: Date | null;
    failureReason: string | null; verificationAttempts: number; isDefault: boolean;
    createdAt: Date;
  },
  requireVerified: boolean,
): BankAccountView {
  const status = row.verificationStatus as VerificationStatus;
  return {
    id: row.id,
    kind: row.kind as 'bank' | 'upi',
    accountHolderName: row.accountHolderName,
    displayIdentifier:
      row.kind === 'upi'
        ? (row.vpa ?? '—')
        : row.accountNumberLast4
          ? `••••••${row.accountNumberLast4}`
          : '—',
    last4: row.accountNumberLast4,
    ifsc: row.ifsc,
    bankName: row.bankName,
    branch: row.branch,
    accountType: row.accountType,
    vpa: row.vpa,
    verificationStatus: status,
    nameMatchScore: row.nameMatchScore,
    registeredName: row.registeredName,
    verifiedAt: row.verifiedAt,
    failureReason: row.failureReason,
    verificationAttempts: row.verificationAttempts,
    isDefault: row.isDefault,
    withdrawable: requireVerified ? status === 'verified' : status !== 'failed',
    createdAt: row.createdAt,
  };
}

// ── write ───────────────────────────────────────────────────────────────────

const MAX_ACCOUNTS = 5;

export async function addBankAccount(input: AddBankAccountInput): Promise<BankAccountView> {
  const holder = input.accountHolderName.trim();
  if (holder.length < 3) {
    throw new BankError('invalid_name', 'Enter the account holder name as it appears at the bank.');
  }

  const active = await db.bankAccount.count({ where: { userId: input.userId, archivedAt: null } });
  if (active >= MAX_ACCOUNTS) {
    throw new BankError(
      'too_many',
      `You can keep up to ${MAX_ACCOUNTS} payout methods. Remove one to add another.`,
    );
  }

  if (input.kind === 'upi') {
    return addUpi({ ...input, accountHolderName: holder }, active);
  }
  return addBank({ ...input, accountHolderName: holder }, active);
}

async function addBank(input: AddBankAccountInput, active: number): Promise<BankAccountView> {
  const accountNumber = (input.accountNumber ?? '').replace(/\s/g, '');
  const ifsc = (input.ifsc ?? '').trim().toUpperCase();

  if (!/^\d{6,20}$/.test(accountNumber)) {
    throw new BankError('invalid_account', 'That account number does not look right.');
  }
  // Asking twice and comparing is worth the friction: a mistyped digit sends the
  // money to a real account belonging to somebody else, and the penny-drop will
  // happily verify it in that person's name.
  if (input.confirmAccountNumber !== undefined) {
    if (input.confirmAccountNumber.replace(/\s/g, '') !== accountNumber) {
      throw new BankError('mismatch', 'The two account numbers do not match.');
    }
  }
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
    throw new BankError('invalid_ifsc', 'That IFSC code is not valid. It looks like HDFC0001234.');
  }

  // IFSC lookup is a free, key-less API, so the branch is resolved before the
  // paid penny-drop. An invalid IFSC caught here costs nothing.
  const branchDetails = await lookupIfsc(ifsc);
  if (!branchDetails) {
    throw new BankError('unknown_ifsc', 'We could not find a bank branch for that IFSC code.');
  }

  const duplicate = await findDuplicate(input.userId, accountNumber, ifsc);
  if (duplicate) {
    throw new BankError('duplicate', 'You have already added that account.', 409);
  }

  const created = await db.bankAccount.create({
    data: {
      userId: input.userId,
      kind: 'bank',
      accountHolderName: input.accountHolderName,
      accountNumberEnc: encryptField(accountNumber),
      accountNumberLast4: accountNumber.slice(-4),
      ifsc,
      bankName: branchDetails.bank,
      branch: branchDetails.branch,
      accountType: input.accountType ?? 'savings',
      verificationStatus: 'unverified',
    },
  });

  // The first method added is the default whether or not it was asked for —
  // otherwise a customer with exactly one payout account has none selected.
  if (input.makeDefault || active === 0) {
    await setDefaultBankAccount(input.userId, created.id);
  }

  const requireVerified = await getSetting('wallet.requireVerifiedBank');
  const fresh = await db.bankAccount.findUniqueOrThrow({ where: { id: created.id } });
  return toView(fresh, requireVerified);
}

async function addUpi(input: AddBankAccountInput, active: number): Promise<BankAccountView> {
  const vpa = (input.vpa ?? '').trim().toLowerCase();
  if (!/^[a-z0-9.\-_]{2,64}@[a-z]{2,32}$/.test(vpa)) {
    throw new BankError('invalid_vpa', 'That UPI ID does not look right. It looks like name@bank.');
  }

  const duplicate = await db.bankAccount.findFirst({
    where: { userId: input.userId, kind: 'upi', vpa, archivedAt: null },
    select: { id: true },
  });
  if (duplicate) throw new BankError('duplicate', 'You have already added that UPI ID.', 409);

  const created = await db.bankAccount.create({
    data: {
      userId: input.userId,
      kind: 'upi',
      accountHolderName: input.accountHolderName,
      vpa,
      verificationStatus: 'unverified',
    },
  });

  if (input.makeDefault || active === 0) {
    await setDefaultBankAccount(input.userId, created.id);
  }

  const requireVerified = await getSetting('wallet.requireVerifiedBank');
  const fresh = await db.bankAccount.findUniqueOrThrow({ where: { id: created.id } });
  return toView(fresh, requireVerified);
}

/**
 * Duplicate detection has to work without decrypting every row, which rules out
 * comparing ciphertext — AES-GCM uses a fresh IV per encryption, so the same
 * account number encrypts differently every time. Narrowing by last-4 + IFSC
 * first keeps the decrypt count to one or two rows.
 */
async function findDuplicate(
  userId: string,
  accountNumber: string,
  ifsc: string,
): Promise<string | null> {
  const candidates = await db.bankAccount.findMany({
    where: {
      userId,
      kind: 'bank',
      ifsc,
      accountNumberLast4: accountNumber.slice(-4),
      archivedAt: null,
    },
    select: { id: true, accountNumberEnc: true },
  });

  for (const candidate of candidates) {
    if (!candidate.accountNumberEnc) continue;
    // A row we cannot decrypt (rotated key, corrupted value) returns null rather
    // than throwing, and null is not a match.
    if (decryptField(candidate.accountNumberEnc) === accountNumber) return candidate.id;
  }
  return null;
}

export async function setDefaultBankAccount(userId: string, bankAccountId: string): Promise<void> {
  const owned = await db.bankAccount.findFirst({
    where: { id: bankAccountId, userId, archivedAt: null },
    select: { id: true },
  });
  if (!owned) throw new BankError('not_found', 'That payout method no longer exists.', 404);

  await db.$transaction([
    db.bankAccount.updateMany({ where: { userId }, data: { isDefault: false } }),
    db.bankAccount.update({ where: { id: bankAccountId }, data: { isDefault: true } }),
  ]);
}

/**
 * Archive rather than delete.
 *
 * A completed withdrawal references the account it paid into, and that reference
 * has to survive for the customer's statement and for any dispute. A hard delete
 * would either break the foreign key or orphan the payout record.
 */
export async function removeBankAccount(userId: string, bankAccountId: string): Promise<void> {
  const row = await db.bankAccount.findFirst({
    where: { id: bankAccountId, userId, archivedAt: null },
    select: { id: true, isDefault: true },
  });
  if (!row) throw new BankError('not_found', 'That payout method no longer exists.', 404);

  const inFlight = await db.withdrawalRequest.count({
    where: {
      bankAccountId,
      status: { in: ['pending', 'approved', 'processing'] },
    },
  });
  if (inFlight > 0) {
    throw new BankError(
      'in_use',
      'A withdrawal to this account is still in progress. You can remove it once that completes.',
      409,
    );
  }

  await db.bankAccount.update({
    where: { id: bankAccountId },
    data: { archivedAt: new Date(), isDefault: false },
  });

  if (row.isDefault) {
    const next = await db.bankAccount.findFirst({
      where: { userId, archivedAt: null },
      orderBy: [{ verificationStatus: 'asc' }, { createdAt: 'desc' }],
      select: { id: true },
    });
    if (next) await db.bankAccount.update({ where: { id: next.id }, data: { isDefault: true } });
  }
}

// ── verification: submit ────────────────────────────────────────────────────

const MAX_VERIFICATION_ATTEMPTS = 3;

export interface VerificationView {
  bankAccountId: string;
  status: VerificationStatus;
  provider: string;
  mode: string;
  registeredName: string | null;
  nameMatchScore: number | null;
  nameMatchResult: string | null;
  failureReason: string | null;
  utr: string | null;
  attemptNo: number;
  /** True when the caller should poll again. */
  pollable: boolean;
  withdrawable: boolean;
  message: string;
}

/**
 * Start a penny-drop.
 *
 * Returns as soon as the provider accepts the request — usually `pending`. The
 * caller polls `pollVerification`, or a webhook completes it, whichever arrives
 * first. Both paths funnel into `applyVerificationResult`, so there is exactly
 * one place that decides an account is verified.
 */
export async function startVerification(input: {
  userId: string;
  bankAccountId: string;
  triggeredBy?: 'customer' | 'admin' | 'system';
}): Promise<VerificationView> {
  const account = await db.bankAccount.findFirst({
    where: { id: input.bankAccountId, userId: input.userId, archivedAt: null },
  });
  if (!account) throw new BankError('not_found', 'That payout method no longer exists.', 404);

  if (account.verificationStatus === 'verified') {
    return viewFor(account, 'This account is already verified.');
  }
  if (account.verificationStatus === 'pending') {
    // Already in flight. Poll instead of paying for a second penny-drop.
    return pollVerification({ userId: input.userId, bankAccountId: input.bankAccountId });
  }
  if (
    account.verificationAttempts >= MAX_VERIFICATION_ATTEMPTS &&
    input.triggeredBy !== 'admin'
  ) {
    throw new BankError(
      'too_many_attempts',
      `Verification has failed ${account.verificationAttempts} times for this account. Contact support, or add the account again with corrected details.`,
      429,
    );
  }

  const verifier = getBankVerifier();
  const attemptNo = account.verificationAttempts + 1;

  // The row is written *before* the call, so a provider response that arrives
  // after a crash still has somewhere to land, and a double-submit is visible.
  const verification = await db.bankVerification.create({
    data: {
      bankAccountId: account.id,
      userId: input.userId,
      provider: verifier.name,
      mode: account.kind === 'upi' ? 'vpa' : 'penny_drop',
      status: 'pending',
      attemptNo,
      triggeredBy: input.triggeredBy ?? 'customer',
      requestPayloadJson: writeJson({
        kind: account.kind,
        ifsc: account.ifsc,
        last4: account.accountNumberLast4,
        vpa: account.vpa,
        accountHolderName: account.accountHolderName,
      }),
    },
  });

  await db.bankAccount.update({
    where: { id: account.id },
    data: {
      verificationStatus: 'pending',
      verificationAttempts: attemptNo,
      provider: verifier.name,
      failureReason: null,
    },
  });

  let result: BankVerificationResult;
  try {
    if (account.kind === 'upi') {
      result = await verifier.verifyVpa({
        vpa: account.vpa!,
        accountHolderName: account.accountHolderName,
        referenceId: verification.id,
      });
    } else {
      if (!account.accountNumberEnc || !account.ifsc) {
        throw new BankError('incomplete', 'This account is missing details needed to verify it.');
      }
      const accountNumber = decryptField(account.accountNumberEnc);
      if (!accountNumber) {
        throw new BankError(
          'undecryptable',
          'We could not read the stored account number. Please remove this account and add it again.',
        );
      }
      result = await verifier.verifyBankAccount({
        accountNumber,
        ifsc: account.ifsc,
        accountHolderName: account.accountHolderName,
        referenceId: verification.id,
        // Keyed on the attempt, not the account: a deliberate re-verification
        // after a failure must actually reach the bank rather than replay the
        // previous response.
        idempotencyKey: idempotencyKey('bankverify', account.id, String(attemptNo)),
      });
    }
  } catch (error) {
    const failure =
      error instanceof GatewayError
        ? error
        : new GatewayError({
            code: 'verification_error',
            message: error instanceof Error ? error.message : String(error),
            provider: verifier.name,
            userMessage: 'We could not reach the bank verification service. Please try again.',
          });

    // A transport failure is not the bank rejecting the account, so the attempt
    // counter is rolled back — otherwise three flaky networks lock a customer
    // out of their own money.
    await db.bankVerification.update({
      where: { id: verification.id },
      data: {
        status: 'failed',
        failureReason: failure.message,
        completedAt: new Date(),
        responsePayloadJson: writeJson({ code: failure.code, retryable: failure.retryable }),
      },
    });
    await db.bankAccount.update({
      where: { id: account.id },
      data: {
        verificationStatus: failure.retryable ? 'unverified' : 'failed',
        verificationAttempts: failure.retryable ? account.verificationAttempts : attemptNo,
        failureReason: failure.userMessage,
      },
    });

    throw new BankError('provider_error', failure.userMessage, 502);
  }

  return applyVerificationResult(verification.id, result);
}

// ── verification: poll ──────────────────────────────────────────────────────

/**
 * Ask the provider where a pending verification got to.
 *
 * This exists because webhooks are not guaranteed: they are dropped, delayed, or
 * never configured on a fresh account. Polling makes the flow work with no
 * webhook at all, and the webhook simply makes it faster when it does arrive.
 */
export async function pollVerification(input: {
  userId: string;
  bankAccountId: string;
}): Promise<VerificationView> {
  const account = await db.bankAccount.findFirst({
    where: { id: input.bankAccountId, userId: input.userId, archivedAt: null },
  });
  if (!account) throw new BankError('not_found', 'That payout method no longer exists.', 404);

  const latest = await db.bankVerification.findFirst({
    where: { bankAccountId: account.id },
    orderBy: { createdAt: 'desc' },
  });
  if (!latest) return viewFor(account, 'This account has not been submitted for verification yet.');

  if (latest.status === 'verified' || latest.status === 'failed') {
    return viewFor(account, messageFor(account.verificationStatus as VerificationStatus, account));
  }
  if (!latest.providerRefId) {
    return viewFor(account, 'Verification is being set up. This usually takes a few seconds.');
  }

  const verifier = getBankVerifier();
  try {
    const result = await verifier.fetchVerification(latest.providerRefId);
    return applyVerificationResult(latest.id, result);
  } catch (error) {
    // A failed poll leaves the state alone. The next poll may succeed, and
    // flipping a pending verification to failed on a network blip is exactly the
    // bug this whole design avoids.
    console.error('[bank] verification poll failed:', error);
    return viewFor(account, 'Still checking with the bank. Try again in a moment.');
  }
}

// ── verification: apply ─────────────────────────────────────────────────────

/**
 * The single writer of verification state.
 *
 * Submit, poll, and webhook all end up here, so there is exactly one place that
 * decides whether an account becomes withdrawable — and exactly one place to read
 * when asking why one did.
 */
export async function applyVerificationResult(
  verificationId: string,
  result: BankVerificationResult,
): Promise<VerificationView> {
  const verification = await db.bankVerification.findUniqueOrThrow({
    where: { id: verificationId },
    include: { bankAccount: true },
  });
  const account = verification.bankAccount;

  const settings = await getSettings(['wallet.nameMatchThreshold']);
  const threshold = settings['wallet.nameMatchThreshold'];

  const score = result.nameMatchScore ?? null;
  const nameOk = result.status === 'verified' && (score === null || score >= threshold);

  // The bank confirming the account exists is not enough. If the name on file
  // does not match what the customer entered, the account belongs to someone
  // else — a typo or a deliberate redirect — and paying into it is the failure
  // mode this check exists to prevent.
  const finalStatus: VerificationStatus =
    result.status === 'verified'
      ? nameOk
        ? 'verified'
        : 'failed'
      : result.status === 'failed'
        ? 'failed'
        : 'pending';

  const failureReason =
    finalStatus === 'failed'
      ? result.status === 'verified' && !nameOk
        ? `The name at the bank (${result.registeredName ?? 'unknown'}) does not match "${account.accountHolderName}" closely enough (${score ?? 0}% match, ${threshold}% required).`
        : (result.failureReason ?? 'The bank could not verify this account.')
      : null;

  await db.bankVerification.update({
    where: { id: verification.id },
    data: {
      status: finalStatus === 'pending' ? 'processing' : finalStatus,
      providerRefId: result.providerRefId ?? verification.providerRefId,
      registeredName: result.registeredName ?? null,
      nameMatchScore: score,
      nameMatchResult: result.nameMatchResult ?? null,
      amountDeposited: result.amountDeposited ?? verification.amountDeposited,
      utr: result.utr ?? null,
      failureReason,
      responsePayloadJson: writeJson(result.raw ?? {}),
      completedAt: finalStatus === 'pending' ? null : new Date(),
    },
  });

  const updated = await db.bankAccount.update({
    where: { id: account.id },
    data: {
      verificationStatus: finalStatus,
      registeredName: result.registeredName ?? account.registeredName,
      nameMatchScore: score ?? account.nameMatchScore,
      verifiedAt: finalStatus === 'verified' ? new Date() : null,
      failureReason,
      bankName: result.bankName ?? account.bankName,
      branch: result.branch ?? account.branch,
      providerRefId: result.providerRefId ?? account.providerRefId,
    },
  });

  return viewFor(updated, messageFor(finalStatus, updated));
}

/**
 * Webhook entry point.
 *
 * Resolves the verification by provider reference rather than by anything in the
 * URL, because a webhook body is attacker-controllable until its signature has
 * been checked — and the signature check belongs to the route, not here.
 */
export async function applyVerificationWebhook(
  result: BankVerificationResult,
): Promise<{ applied: boolean; bankAccountId?: string }> {
  const verification = await db.bankVerification.findFirst({
    where: {
      OR: [{ providerRefId: result.providerRefId }, { id: result.providerRefId }],
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, bankAccountId: true, status: true },
  });
  if (!verification) return { applied: false };

  // Terminal states are not revisited. A duplicate webhook, or one that arrives
  // after a poll already resolved the verification, must not flip a verified
  // account back to pending.
  if (verification.status === 'verified' || verification.status === 'failed') {
    return { applied: false, bankAccountId: verification.bankAccountId };
  }

  await applyVerificationResult(verification.id, result);
  return { applied: true, bankAccountId: verification.bankAccountId };
}

// ── IFSC ────────────────────────────────────────────────────────────────────

/** Cached in-process: the branch behind an IFSC does not change during a boot. */
const ifscCache = new Map<string, IfscDetails | null>();

export async function lookupIfsc(ifsc: string): Promise<IfscDetails | null> {
  const key = ifsc.trim().toUpperCase();
  if (ifscCache.has(key)) return ifscCache.get(key) ?? null;

  try {
    const details = await getBankVerifier().lookupIfsc(key);
    ifscCache.set(key, details);
    return details;
  } catch (error) {
    console.error('[bank] IFSC lookup failed:', error);
    return null;
  }
}

// ── admin ───────────────────────────────────────────────────────────────────

/** The Bank Verification Logs module. */
export async function listVerificationLogs(filter: {
  status?: VerificationStatus | 'all';
  userId?: string;
  search?: string;
  page?: number;
  perPage?: number;
} = {}) {
  const perPage = Math.min(filter.perPage ?? 25, 100);
  const page = Math.max(filter.page ?? 1, 1);

  const where: Prisma.BankVerificationWhereInput = {};
  if (filter.status && filter.status !== 'all') where.status = filter.status;
  if (filter.userId) where.userId = filter.userId;
  if (filter.search?.trim()) {
    const term = filter.search.trim();
    where.OR = [
      { providerRefId: { contains: term } },
      { utr: { contains: term } },
      { registeredName: { contains: term } },
      { user: { name: { contains: term } } },
      { user: { email: { contains: term } } },
    ];
  }

  const [rows, total] = await Promise.all([
    db.bankVerification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        bankAccount: {
          select: {
            id: true, kind: true, accountNumberLast4: true, ifsc: true,
            bankName: true, vpa: true, accountHolderName: true, verificationStatus: true,
          },
        },
      },
    }),
    db.bankVerification.count({ where }),
  ]);

  return {
    rows: rows.map((row) => ({
      ...row,
      // The stored payloads are shown in the admin drawer for debugging a
      // rejection. Parsed here so a malformed value renders as null rather than
      // crashing the page.
      request: readJson<Record<string, unknown>>(row.requestPayloadJson, {}),
      response: readJson<Record<string, unknown>>(row.responsePayloadJson, {}),
    })),
    total,
    page,
    perPage,
    pages: Math.max(1, Math.ceil(total / perPage)),
  };
}

/**
 * Admin re-verification. Bypasses the attempt cap — support unblocking a
 * customer is the reason the cap has an escape hatch — but not the name match.
 */
export async function adminRetryVerification(bankAccountId: string): Promise<VerificationView> {
  const account = await db.bankAccount.findUniqueOrThrow({
    where: { id: bankAccountId },
    select: { userId: true },
  });
  return startVerification({
    userId: account.userId,
    bankAccountId,
    triggeredBy: 'admin',
  });
}

/**
 * Manual verification override.
 *
 * Exists because the alternative is worse: a customer with a genuine account that
 * a provider cannot verify — a co-operative bank outside the penny-drop network,
 * a name legitimately spelled differently on the passbook — otherwise has no
 * route to their own money. It is recorded as a manual decision with the staff
 * member attached, so it is auditable rather than invisible.
 */
export async function adminForceVerify(input: {
  bankAccountId: string;
  staffId: string;
  note: string;
}): Promise<void> {
  if (!input.note.trim()) {
    throw new BankError('note_required', 'A manual verification needs a note explaining why.');
  }

  const account = await db.bankAccount.findUniqueOrThrow({
    where: { id: input.bankAccountId },
    select: { id: true, userId: true, accountHolderName: true },
  });

  await db.$transaction([
    db.bankVerification.create({
      data: {
        bankAccountId: account.id,
        userId: account.userId,
        provider: 'manual',
        mode: 'manual',
        status: 'verified',
        registeredName: account.accountHolderName,
        nameMatchScore: 100,
        nameMatchResult: 'exact',
        triggeredBy: 'admin',
        completedAt: new Date(),
        responsePayloadJson: writeJson({ manual: true, staffId: input.staffId, note: input.note }),
      },
    }),
    db.bankAccount.update({
      where: { id: account.id },
      data: {
        verificationStatus: 'verified',
        verifiedAt: new Date(),
        failureReason: null,
        provider: 'manual',
      },
    }),
  ]);
}

// ── internal: payouts only ──────────────────────────────────────────────────

/**
 * Decrypt an account number for a payout.
 *
 * Kept internal-ish on purpose: `payouts.ts` is the only intended caller, at the
 * moment it hands details to the payout gateway. The returned value must never
 * reach a response body, a log, or an audit diff.
 */
export async function revealForPayout(bankAccountId: string): Promise<{
  kind: 'bank' | 'upi';
  accountHolderName: string;
  accountNumber?: string;
  ifsc?: string;
  vpa?: string;
  masked: string;
}> {
  const row = await db.bankAccount.findUniqueOrThrow({
    where: { id: bankAccountId },
    select: {
      kind: true, accountHolderName: true, accountNumberEnc: true,
      accountNumberLast4: true, ifsc: true, vpa: true,
    },
  });

  if (row.kind === 'upi') {
    return {
      kind: 'upi',
      accountHolderName: row.accountHolderName,
      vpa: row.vpa ?? undefined,
      masked: row.vpa ?? '—',
    };
  }

  if (!row.accountNumberEnc) {
    throw new BankError('incomplete', 'That account is missing its stored account number.');
  }

  const accountNumber = decryptField(row.accountNumberEnc);
  if (!accountNumber) {
    throw new BankError(
      'undecryptable',
      'We could not read the stored account number for that payout method.',
    );
  }

  return {
    kind: 'bank',
    accountHolderName: row.accountHolderName,
    accountNumber,
    ifsc: row.ifsc ?? undefined,
    masked: maskAccountNumber(accountNumber),
  };
}

// ── helpers ─────────────────────────────────────────────────────────────────

function viewFor(
  account: {
    id: string; verificationStatus: string; registeredName: string | null;
    nameMatchScore: number | null; failureReason: string | null;
    verificationAttempts: number; provider: string | null;
  },
  message: string,
): VerificationView {
  const status = account.verificationStatus as VerificationStatus;
  const verifier = getBankVerifier();
  return {
    bankAccountId: account.id,
    status,
    provider: account.provider ?? verifier.name,
    mode: verifier.mode,
    registeredName: account.registeredName,
    nameMatchScore: account.nameMatchScore,
    nameMatchResult: null,
    failureReason: account.failureReason,
    utr: null,
    attemptNo: account.verificationAttempts,
    pollable: status === 'pending',
    withdrawable: status === 'verified',
    message,
  };
}

function messageFor(
  status: VerificationStatus,
  account: { registeredName: string | null; failureReason: string | null },
): string {
  switch (status) {
    case 'verified':
      return account.registeredName
        ? `Verified — the bank confirmed this account belongs to ${account.registeredName}. Withdrawals are now enabled.`
        : 'Verified. Withdrawals are now enabled.';
    case 'pending':
      return 'We have sent ₹1 to this account to confirm it. This usually takes under a minute.';
    case 'failed':
      return account.failureReason ?? 'We could not verify this account.';
    default:
      return 'This account has not been verified yet.';
  }
}
