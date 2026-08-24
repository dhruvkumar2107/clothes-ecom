import { db, type DbClient } from './db';
import type { Paise } from './money';
import { clampToZero, percentOf, sumBy } from './money';
import { readCsv } from './json';
import type { CouponKind } from './enums';

/**
 * Coupons.
 *
 * `validate` is deliberately pure-ish and read-only: it answers "would this code
 * work, and for how much" without recording anything. The cart calls it on every
 * recalculation, so it must be safe to call repeatedly. Redemption is recorded
 * once, at order creation, by `recordRedemption`.
 *
 * Every rejection returns a specific reason. "Invalid coupon code" for an expired
 * code, a first-order-only code on a repeat customer, and a genuine typo are
 * three different support conversations, and collapsing them into one message
 * guarantees all three become tickets.
 */

export interface CouponCartLine {
  /** Stable key — a cart item id or variant id. */
  key: string;
  productId: string;
  categoryId: string;
  collectionIds: string[];
  unitPrice: Paise;
  qty: number;
}

export interface CouponContext {
  userId: string | null;
  lines: readonly CouponCartLine[];
  /** Cart subtotal before any discount. */
  subtotal: Paise;
  shippingTotal: Paise;
  /** True when this user has no prior paid order. */
  isFirstOrder: boolean;
}

export type CouponRejection =
  | 'not_found'
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'min_cart_value'
  | 'first_order_only'
  | 'per_user_limit'
  | 'total_limit'
  | 'no_eligible_items'
  | 'no_discount'
  | 'login_required';

export interface CouponSuccess {
  ok: true;
  code: string;
  name: string;
  kind: CouponKind;
  /** Discount applied to goods, in paise. */
  discount: Paise;
  /** Shipping waived, in paise. Separate because it isn't taxed like goods. */
  shippingDiscount: Paise;
  /** Which cart lines the discount actually landed on. */
  eligibleKeys: string[];
  couponId: string;
  message: string;
}

export interface CouponFailure {
  ok: false;
  code: string;
  reason: CouponRejection;
  message: string;
  /** For `min_cart_value` — how much more the customer needs to spend. */
  shortfall?: Paise;
}

export type CouponResult = CouponSuccess | CouponFailure;

const REJECTION_COPY: Record<CouponRejection, string> = {
  not_found: 'That code isn’t recognised. Check the spelling and try again.',
  inactive: 'This code is no longer active.',
  not_started: 'This code isn’t live yet.',
  expired: 'This code has expired.',
  min_cart_value: 'Your bag hasn’t reached the minimum for this code.',
  first_order_only: 'This code is for first orders only.',
  per_user_limit: 'You’ve already used this code.',
  total_limit: 'This code has been fully claimed.',
  no_eligible_items: 'This code doesn’t apply to anything in your bag.',
  no_discount: 'This code gives no discount on your current bag.',
  login_required: 'Sign in to use this code.',
};

function reject(code: string, reason: CouponRejection, extra?: { shortfall?: Paise }): CouponFailure {
  return { ok: false, code, reason, message: REJECTION_COPY[reason], ...extra };
}

// ── Validation ──────────────────────────────────────────────────────────────

export async function validateCoupon(
  rawCode: string,
  ctx: CouponContext,
): Promise<CouponResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return reject(code, 'not_found');

  const coupon = await db.coupon.findUnique({ where: { code } });
  if (!coupon) return reject(code, 'not_found');
  if (!coupon.active) return reject(code, 'inactive');

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) return reject(code, 'not_started');
  if (coupon.endsAt && coupon.endsAt < now) return reject(code, 'expired');

  if (coupon.totalLimit !== null && coupon.usedCount >= coupon.totalLimit) {
    return reject(code, 'total_limit');
  }

  if (ctx.subtotal < coupon.minCartValue) {
    return reject(code, 'min_cart_value', { shortfall: coupon.minCartValue - ctx.subtotal });
  }

  // Per-user rules need an identity. A guest can hold the code in their cart,
  // but it can't be honoured until they sign in — telling them that up front is
  // better than a surprise at the payment step.
  if (coupon.firstOrderOnly || coupon.perUserLimit !== null) {
    if (!ctx.userId) return reject(code, 'login_required');
    if (coupon.firstOrderOnly && !ctx.isFirstOrder) return reject(code, 'first_order_only');

    if (coupon.perUserLimit !== null) {
      const used = await db.couponRedemption.count({
        where: { couponId: coupon.id, userId: ctx.userId },
      });
      if (used >= coupon.perUserLimit) return reject(code, 'per_user_limit');
    }
  }

  // ── Scope ──
  const eligible = eligibleLines(coupon, ctx.lines);
  if (eligible.length === 0) return reject(code, 'no_eligible_items');

  const eligibleSubtotal = sumBy(eligible, (l) => l.unitPrice * l.qty);

  let discount: Paise = 0;
  let shippingDiscount: Paise = 0;

  switch (coupon.kind as CouponKind) {
    case 'percent': {
      const raw = percentOf(eligibleSubtotal, coupon.value);
      discount = coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;
      break;
    }
    case 'flat':
      // A flat discount can't exceed the goods it applies to, or the order
      // total goes negative and the gateway rejects a zero-value capture.
      discount = Math.min(coupon.value, eligibleSubtotal);
      break;
    case 'free_shipping':
      shippingDiscount = ctx.shippingTotal;
      break;
  }

  discount = clampToZero(discount);
  if (discount === 0 && shippingDiscount === 0) return reject(code, 'no_discount');

  return {
    ok: true,
    code,
    name: coupon.name,
    kind: coupon.kind as CouponKind,
    discount,
    shippingDiscount,
    eligibleKeys: eligible.map((l) => l.key),
    couponId: coupon.id,
    message: successCopy(coupon.kind as CouponKind, discount, shippingDiscount),
  };
}

function successCopy(kind: CouponKind, discount: Paise, shipping: Paise): string {
  if (kind === 'free_shipping' || (shipping > 0 && discount === 0)) {
    return 'Shipping is on us.';
  }
  return 'Code applied.';
}

/** Narrow the cart to the lines a coupon's scope actually covers. */
function eligibleLines(
  coupon: {
    appliesTo: string;
    targetIdsCsv: string | null;
  },
  lines: readonly CouponCartLine[],
): CouponCartLine[] {
  if (coupon.appliesTo === 'all') return [...lines];

  const targets = new Set(readCsv(coupon.targetIdsCsv));
  if (targets.size === 0) return [...lines];

  switch (coupon.appliesTo) {
    case 'product':
      return lines.filter((l) => targets.has(l.productId));
    case 'category':
      return lines.filter((l) => targets.has(l.categoryId));
    case 'collection':
      return lines.filter((l) => l.collectionIds.some((id) => targets.has(id)));
    default:
      return [...lines];
  }
}

// ── Auto-apply ──────────────────────────────────────────────────────────────

/**
 * Find the best auto-apply coupon for a cart.
 *
 * Runs when the customer hasn't entered a code themselves. Picks the largest
 * total benefit rather than the first match, so adding a more generous promo
 * doesn't require re-ordering rows.
 */
export async function bestAutoCoupon(ctx: CouponContext): Promise<CouponSuccess | null> {
  const now = new Date();
  const candidates = await db.coupon.findMany({
    where: {
      autoApply: true,
      active: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    select: { code: true },
  });

  let best: CouponSuccess | null = null;
  for (const candidate of candidates) {
    const result = await validateCoupon(candidate.code, ctx);
    if (!result.ok) continue;
    const benefit = result.discount + result.shippingDiscount;
    const bestBenefit = best ? best.discount + best.shippingDiscount : -1;
    if (benefit > bestBenefit) best = result;
  }

  return best;
}

/** The welcome coupon a referred customer gets, if it's still valid for them. */
export async function referralWelcomeCoupon(ctx: CouponContext): Promise<CouponSuccess | null> {
  const coupon = await db.coupon.findFirst({
    where: { isReferralWelcome: true, active: true },
    select: { code: true },
  });
  if (!coupon) return null;

  const result = await validateCoupon(coupon.code, ctx);
  return result.ok ? result : null;
}

// ── Redemption ──────────────────────────────────────────────────────────────

/**
 * Record that a coupon was used on an order.
 *
 * Called inside the order-creation transaction so the usage counter and the
 * order commit together — otherwise a rolled-back checkout burns a
 * single-use code.
 *
 * The unique constraint on (couponId, orderId) makes this idempotent, which
 * matters because a retried webhook must not double-count usage.
 */
export async function recordRedemption(
  input: {
    couponId: string;
    userId: string;
    orderId: string;
    discountAmount: Paise;
  },
  // Takes the caller's transaction client so the counter and the order share one
  // atom. Typed as DbClient rather than a hand-written structural shape: Prisma's
  // generated delegates are too precise for a duck type to satisfy.
  client: DbClient = db,
): Promise<void> {
  await client.couponRedemption.create({
    data: {
      couponId: input.couponId,
      userId: input.userId,
      orderId: input.orderId,
      discountAmount: input.discountAmount,
    },
  });
  await client.coupon.update({
    where: { id: input.couponId },
    data: { usedCount: { increment: 1 } },
  });
}

/**
 * Give back a redemption when an order is cancelled before fulfilment.
 *
 * A customer whose order was cancelled — especially by us, for a stock issue —
 * should not have burned their one-time code.
 */
export async function reverseRedemption(orderId: string): Promise<void> {
  const redemption = await db.couponRedemption.findFirst({
    where: { orderId },
    select: { id: true, couponId: true },
  });
  if (!redemption) return;

  await db.$transaction([
    db.couponRedemption.delete({ where: { id: redemption.id } }),
    db.coupon.update({
      where: { id: redemption.couponId },
      data: { usedCount: { decrement: 1 } },
    }),
  ]);
}

// ── Display ─────────────────────────────────────────────────────────────────

export interface CouponTeaser {
  code: string;
  name: string;
  description: string | null;
  kind: CouponKind;
  value: number;
  minCartValue: Paise;
  endsAt: Date | null;
  /** True when the current cart already qualifies. */
  qualifies: boolean;
  shortfall: Paise;
}

/**
 * Publicly listable coupons for the "available offers" drawer.
 *
 * Auto-apply and referral-welcome codes are excluded: the first is invisible by
 * design, and the second belongs to a specific customer rather than the public.
 */
export async function listPublicCoupons(subtotal: Paise): Promise<CouponTeaser[]> {
  const now = new Date();
  const coupons = await db.coupon.findMany({
    where: {
      active: true,
      autoApply: false,
      isReferralWelcome: false,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        { OR: [{ totalLimit: null }, { NOT: { totalLimit: { lte: 0 } } }] },
      ],
    },
    orderBy: [{ minCartValue: 'asc' }],
    take: 12,
    select: {
      code: true,
      name: true,
      description: true,
      kind: true,
      value: true,
      minCartValue: true,
      endsAt: true,
      totalLimit: true,
      usedCount: true,
    },
  });

  return coupons
    .filter((c) => c.totalLimit === null || c.usedCount < c.totalLimit)
    .map((c) => ({
      code: c.code,
      name: c.name,
      description: c.description,
      kind: c.kind as CouponKind,
      value: c.value,
      minCartValue: c.minCartValue,
      endsAt: c.endsAt,
      qualifies: subtotal >= c.minCartValue,
      shortfall: clampToZero(c.minCartValue - subtotal),
    }));
}

/** "20% off up to ₹500" / "₹300 off" / "Free shipping" */
export function describeCoupon(coupon: {
  kind: string;
  value: number;
  maxDiscount?: number | null;
}): string {
  switch (coupon.kind) {
    case 'percent':
      return coupon.maxDiscount
        ? `${coupon.value}% off up to ₹${Math.round(coupon.maxDiscount / 100)}`
        : `${coupon.value}% off`;
    case 'flat':
      return `₹${Math.round(coupon.value / 100)} off`;
    case 'free_shipping':
      return 'Free shipping';
    default:
      return 'Discount';
  }
}

export interface CheckoutCouponInput {
  code: string;
  cartValue: number;
  items: Array<{
    productId: string;
    variantId: string;
    qty: number;
    price: number;
    categoryId?: string;
    collectionIds?: string[];
  }>;
  userId?: string;
}

export interface CheckoutCouponOutput {
  valid: boolean;
  reason?: string;
  discount?: number;
  shippingDiscount?: number;
  couponId?: string;
  coupon?: any;
}

export async function validateCouponForCheckout(input: CheckoutCouponInput): Promise<CheckoutCouponOutput> {
  const ctx = {
    userId: input.userId || null,
    lines: input.items.map(item => ({
      key: item.variantId,
      productId: item.productId,
      categoryId: item.categoryId || '',
      collectionIds: item.collectionIds || [],
      unitPrice: item.price,
      qty: item.qty,
    })),
    subtotal: input.cartValue,
    shippingTotal: 0,
    isFirstOrder: false,
  };

  const result = await validateCoupon(input.code, ctx);
  if (!result.ok) {
    return { valid: false, reason: result.reason };
  }
  return {
    valid: true,
    discount: result.discount,
    shippingDiscount: result.shippingDiscount,
    couponId: result.couponId,
    coupon: { code: result.code, name: result.name, kind: result.kind },
  };
}
