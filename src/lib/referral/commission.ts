import { db, tx } from '../db';
import { addDays } from '../utils';
import { clamp, percentOf } from '../money';
import { getSettings } from '../settings';
import { hold } from '../wallet';
import { activeRule } from './attribution';
import { isReferralPayable } from './fraud';

/**
 * The commission engine.
 *
 * Accrual happens when an order is *paid*, not when it is placed — an unpaid COD
 * order that never gets delivered would otherwise accrue commission on revenue
 * that never existed.
 *
 * ── What the commission is calculated on ────────────────────────────────────
 *
 * The base is `subtotal - discountTotal`. Not `grandTotal`, and that matters:
 *
 *   • **Tax is excluded** because GST is collected on behalf of the government.
 *     Paying commission on it means paying out a percentage of money that was
 *     never ours.
 *   • **Shipping and COD fees are excluded** because they are pass-through cost,
 *     not margin. A ₹99 shipping fee earning commission is a straight loss.
 *   • **Discounts are subtracted** because the discounted price is what the
 *     customer actually paid us. Commission on the pre-discount price can exceed
 *     the entire margin on a heavily discounted item.
 *
 * ── The hold window ────────────────────────────────────────────────────────
 *
 * A commission is credited to `lockedBalance`, not `balance`, and only becomes
 * spendable after `holdDays` — set to cover the return window. Without this, the
 * sequence is: friend orders ₹5,000, referrer's commission lands, referrer
 * withdraws it, friend returns everything, and we are chasing a wallet that is
 * already empty. The hold makes the clawback a bookkeeping entry instead of a
 * collections problem.
 *
 * ── Idempotency ────────────────────────────────────────────────────────────
 *
 * `@@unique([referralId, orderId])` on the model plus a pre-check here. Payment
 * webhooks retry, and the same `payment.captured` event arriving three times must
 * not pay three commissions.
 */

export interface AccrualResult {
  accrued: boolean;
  commissionId?: string;
  amount?: number;
  holdUntil?: Date;
  reason?: string;
}

/**
 * Accrue commission for one paid order.
 *
 * Safe to call repeatedly — that is the design, since it is wired to the payment
 * webhook and the admin "recalculate" action.
 */
export async function accrueForOrder(orderId: string): Promise<AccrualResult> {
  const settings = await getSettings([
    'referral.enabled',
    'referral.holdDays',
    'referral.minOrderValue',
  ]);
  if (!settings['referral.enabled']) return { accrued: false, reason: 'Referral programme is off.' };

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, userId: true, subtotal: true, discountTotal: true,
      paymentStatus: true, status: true, placedAt: true,
    },
  });
  if (!order) return { accrued: false, reason: 'Order not found.' };

  // Only paid orders accrue. `partially_paid` is excluded deliberately: a
  // part-paid COD order can still be refused at the door.
  if (order.paymentStatus !== 'paid') {
    return { accrued: false, reason: `Order is ${order.paymentStatus}, not paid.` };
  }
  if (order.status === 'cancelled') {
    return { accrued: false, reason: 'Order was cancelled.' };
  }

  const referral = await db.referral.findUnique({
    where: { referredUserId: order.userId },
    select: { id: true, referrerId: true, status: true, firstOrderId: true },
  });
  if (!referral) return { accrued: false, reason: 'Buyer was not referred.' };
  if (referral.status === 'rejected') {
    return { accrued: false, reason: 'Referral was rejected by fraud checks.' };
  }

  const existing = await db.referralCommission.findUnique({
    where: { referralId_orderId: { referralId: referral.id, orderId: order.id } },
    select: { id: true, commissionAmount: true, holdUntil: true },
  });
  if (existing) {
    return {
      accrued: true,
      commissionId: existing.id,
      amount: existing.commissionAmount,
      holdUntil: existing.holdUntil ?? undefined,
      reason: 'Already accrued.',
    };
  }

  const rule = await activeRule();
  if (!rule) return { accrued: false, reason: 'No active commission rule.' };

  // `firstOrderOnly` is judged against the referral edge's own record of the
  // first order rather than the buyer's order count — a buyer may have ordered
  // before being referred (a referral code applied to an existing account), and
  // that earlier order is not the referral's first.
  const priorCount = await db.referralCommission.count({
    where: { referralId: referral.id, status: { notIn: ['reversed', 'rejected'] } },
  });
  if (rule.firstOrderOnly && priorCount > 0) {
    return { accrued: false, reason: 'Rule pays on first order only.' };
  }
  if (!rule.firstOrderOnly && !rule.recurring && priorCount > 0) {
    return { accrued: false, reason: 'Rule is not recurring.' };
  }
  if (rule.recurring && rule.maxPerReferral && priorCount >= rule.maxPerReferral) {
    return { accrued: false, reason: `Referral has hit its cap of ${rule.maxPerReferral}.` };
  }

  const base = Math.max(0, order.subtotal - order.discountTotal);

  const minOrderValue = Math.max(rule.minOrderValue, settings['referral.minOrderValue']);
  if (base < minOrderValue) {
    return {
      accrued: false,
      reason: `Order base is below the ₹${(minOrderValue / 100).toFixed(0)} minimum.`,
    };
  }

  const computed = computeCommission({
    base,
    kind: rule.kind as 'percent' | 'flat',
    value: rule.value,
    maxCommission: rule.maxCommission,
  });
  if (computed.amount <= 0) return { accrued: false, reason: 'Computed commission is zero.' };

  // Tier bonus, based on how many referrals have actually converted — not how
  // many signed up, or the slabs would be gamed with throwaway accounts.
  const conversions = await db.referral.count({
    where: { referrerId: referral.referrerId, status: 'converted' },
  });
  const tier = pickTier(rule.tiers, conversions);
  const tierBonus = tier
    ? tier.bonusKind === 'percent'
      ? percentOf(computed.amount, tier.bonusValue)
      : Math.round(tier.bonusValue)
    : 0;

  const totalAmount = computed.amount + tierBonus;
  const holdDays = rule.holdDays ?? settings['referral.holdDays'];
  const holdUntil = addDays(new Date(), holdDays);

  const { payable, reason: blockReason } = await isReferralPayable(referral.id);

  const commission = await tx(async (client) => {
    const row = await client.referralCommission.create({
      data: {
        referralId: referral.id,
        referrerId: referral.referrerId,
        orderId: order.id,
        ruleId: rule.id,
        orderAmount: base,
        kind: rule.kind,
        rateApplied: rule.value,
        commissionAmount: totalAmount,
        tierBonus,
        // A blocked referral accrues but sits `pending` — visible to the admin,
        // resolvable, and never silently lost.
        status: payable ? 'held' : 'pending',
        holdUntil: payable ? holdUntil : null,
      },
      select: { id: true },
    });

    // Mark the edge converted. `firstOrderId` is only set once, so it records
    // the order that actually triggered conversion.
    await client.referral.update({
      where: { id: referral.id },
      data: {
        status: 'converted',
        convertedAt: new Date(),
        ...(referral.firstOrderId ? {} : { firstOrderId: order.id }),
      },
    });

    return row;
  });

  if (payable) {
    // Wallet movement happens outside the commission transaction on purpose: the
    // wallet has its own serialised transaction, and nesting them on SQLite
    // deadlocks. The link is repaired below, and `pending` → `held` is the state
    // that tells us the money side has not landed yet if this fails.
    const movement = await hold({
      userId: referral.referrerId,
      type: 'referral_commission',
      amount: totalAmount,
      description: `Referral commission on order ${orderId.slice(-8).toUpperCase()}`,
      refType: 'ReferralCommission',
      refId: commission.id,
      availableAt: holdUntil,
      idempotent: true,
      meta: { orderId, referralId: referral.id, tierBonus },
    });

    await db.referralCommission.update({
      where: { id: commission.id },
      data: { walletTransactionId: movement.transactionId },
    });
  }

  return {
    accrued: true,
    commissionId: commission.id,
    amount: totalAmount,
    holdUntil: payable ? holdUntil : undefined,
    reason: payable ? undefined : blockReason,
  };
}

export function computeCommission(input: {
  base: number;
  kind: 'percent' | 'flat';
  value: number;
  maxCommission?: number | null;
}): { amount: number; capped: boolean } {
  if (input.kind === 'flat') {
    // A flat commission larger than the order is a misconfiguration, not a
    // generous offer — clamp rather than pay out more than came in.
    const amount = clamp(Math.round(input.value), 0, input.base);
    return { amount, capped: amount !== Math.round(input.value) };
  }

  const raw = percentOf(input.base, input.value);
  if (input.maxCommission && raw > input.maxCommission) {
    return { amount: input.maxCommission, capped: true };
  }
  return { amount: raw, capped: false };
}

function pickTier<T extends { minConversions: number }>(
  tiers: readonly T[],
  conversions: number,
): T | null {
  let best: T | null = null;
  for (const tier of tiers) {
    if (conversions >= tier.minConversions) {
      if (!best || tier.minConversions > best.minConversions) best = tier;
    }
  }
  return best;
}

/**
 * Claw back commission when the source order is returned or cancelled.
 *
 * Reverses the wallet movement if the commission was already released, or simply
 * drops the hold if it was not. The distinction is handled by `wallet.reverse`,
 * which knows whether the row was `held` or `completed`.
 */
export async function reverseForOrder(
  orderId: string,
  reason: string,
): Promise<{ reversed: number; amount: number }> {
  const commissions = await db.referralCommission.findMany({
    where: { orderId, status: { in: ['pending', 'held', 'available', 'paid'] } },
    select: { id: true, commissionAmount: true, walletTransactionId: true },
  });

  const { reverse } = await import('../wallet');
  let count = 0;
  let amount = 0;

  for (const commission of commissions) {
    if (commission.walletTransactionId) {
      await reverse({
        transactionId: commission.walletTransactionId,
        reason: `Referral commission reversed — ${reason}`,
        type: 'referral_commission',
      }).catch((error) => {
        console.error(`[referral] wallet reversal failed for ${commission.id}:`, error);
      });
    }

    await db.referralCommission.update({
      where: { id: commission.id },
      data: { status: 'reversed', reversedAt: new Date(), reversalReason: reason },
    });

    count += 1;
    amount += commission.commissionAmount;
  }

  return { reversed: count, amount };
}

/** Admin override — adjust an amount by hand, with a mandatory note. */
export async function overrideCommission(input: {
  commissionId: string;
  amount: number;
  note: string;
  staffId: string;
}): Promise<{ id: string; previousAmount: number; amount: number }> {
  const commission = await db.referralCommission.findUniqueOrThrow({
    where: { id: input.commissionId },
    select: { id: true, commissionAmount: true, status: true, walletTransactionId: true, referrerId: true },
  });

  if (commission.status === 'paid' || commission.status === 'reversed') {
    throw new Error(`A ${commission.status} commission cannot be overridden.`);
  }
  if (!Number.isInteger(input.amount) || input.amount < 0) {
    throw new Error('Commission amount must be a whole number of paise, zero or more.');
  }
  if (!input.note.trim()) {
    throw new Error('An override needs a note explaining why.');
  }

  const previousAmount = commission.commissionAmount;
  const delta = input.amount - previousAmount;

  await db.referralCommission.update({
    where: { id: commission.id },
    data: {
      commissionAmount: input.amount,
      isManualOverride: true,
      overrideNote: input.note.trim(),
      overriddenBy: input.staffId,
    },
  });

  // The wallet has to follow, or the ledger and the commission table disagree.
  if (delta !== 0 && commission.walletTransactionId) {
    const { credit, debit } = await import('../wallet');
    const movement = delta > 0 ? credit : debit;
    await movement({
      userId: commission.referrerId,
      type: 'adjustment',
      direction: delta > 0 ? 'credit' : 'debit',
      amount: Math.abs(delta),
      description: `Commission adjusted by admin — ${input.note.trim()}`,
      refType: 'ReferralCommission',
      refId: commission.id,
    });
  }

  return { id: commission.id, previousAmount, amount: input.amount };
}
