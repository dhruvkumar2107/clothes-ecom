/**
 * Every "enum" in the system.
 *
 * SQLite has no native enum type, so status columns are plain strings in the
 * database. That means the *only* thing standing between a typo and corrupt
 * data is this file — so it is the single source of truth: DB writes go through
 * these constants, API input is validated against them with zod
 * (`zEnum` helper), and UI labels/colours are derived from them.
 *
 * Adding a state? Add it here first, then follow the type errors.
 */

import { z } from 'zod';

/**
 * Turn a readonly const tuple into a zod enum without restating the literals.
 *
 *   zEnum(ORDER_STATUS).parse(input)  // → OrderStatus, or throws
 *
 * The cast drops `readonly`, which zod 3's signature requires but never
 * mutates.
 */
export function zEnum<T extends string>(values: readonly [T, ...T[]]) {
  return z.enum(values as unknown as [T, ...T[]]);
}

// ── Identity ────────────────────────────────────────────────────────────────

export const USER_STATUS = ['active', 'flagged', 'banned'] as const;
export type UserStatus = (typeof USER_STATUS)[number];

export const OTP_CHANNEL = ['sms', 'email', 'whatsapp'] as const;
export type OtpChannel = (typeof OTP_CHANNEL)[number];

export const OTP_PURPOSE = [
  'login',
  'signup',
  'reset',
  'verify_phone',
  'verify_email',
] as const;
export type OtpPurpose = (typeof OTP_PURPOSE)[number];

export const SOCIAL_PROVIDER = ['google', 'apple'] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDER)[number];

// ── Catalogue ───────────────────────────────────────────────────────────────

export const PRODUCT_STATUS = ['draft', 'active', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUS)[number];

export const OCCASIONS = ['casual', 'party', 'formal', 'festive', 'resort'] as const;
export type Occasion = (typeof OCCASIONS)[number];

export const FITS = ['slim', 'regular', 'oversized', 'relaxed'] as const;
export type Fit = (typeof FITS)[number];

export const GENDERS = ['men', 'women', 'unisex'] as const;
export type Gender = (typeof GENDERS)[number];

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
export type Size = (typeof SIZES)[number];

export const INVENTORY_REASON = [
  'purchase',
  'sale',
  'return',
  'cancel',
  'manual',
  'csv_import',
  'correction',
  'reservation',
  'release',
] as const;
export type InventoryReason = (typeof INVENTORY_REASON)[number];

// ── Orders ──────────────────────────────────────────────────────────────────

/**
 * The order lifecycle. Transitions are enforced by ORDER_TRANSITIONS below —
 * nothing may jump straight from `pending` to `delivered`.
 */
export const ORDER_STATUS = [
  'pending',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

/** Legal next-states for each order status. Empty array = terminal. */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
};

export function canTransitionOrder(from: string, to: string): boolean {
  const allowed = ORDER_TRANSITIONS[from as OrderStatus];
  return Array.isArray(allowed) && (allowed as readonly string[]).includes(to);
}

export const PAYMENT_STATUS = [
  'unpaid',
  'authorized',
  'paid',
  'partially_paid',
  'failed',
  'refunded',
  'partially_refunded',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[number];

export const FULFILLMENT_STATUS = ['unfulfilled', 'partial', 'fulfilled'] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUS)[number];

export const PAYMENT_METHOD = [
  'cod',
  'card',
  'upi',
  'netbanking',
  'wallet',
  'emi',
  'bnpl',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHOD)[number];

/** Methods that settle through a gateway (i.e. everything except COD). */
export const ONLINE_METHODS = PAYMENT_METHOD.filter((m) => m !== 'cod');

export const PAYMENT_INTENT_STATUS = [
  'created',
  'pending',
  'authorized',
  'captured',
  'failed',
  'cancelled',
  'expired',
] as const;
export type PaymentIntentStatus = (typeof PAYMENT_INTENT_STATUS)[number];

export const SHIPMENT_STATUS = [
  'created',
  'pickup_scheduled',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'rto',
  'lost',
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUS)[number];

export const COURIERS = ['shiprocket', 'delhivery', 'bluedart', 'manual'] as const;
export type Courier = (typeof COURIERS)[number];

// ── Returns & refunds ───────────────────────────────────────────────────────

export const RETURN_KIND = ['return', 'exchange'] as const;
export type ReturnKind = (typeof RETURN_KIND)[number];

export const RETURN_STATUS = [
  'requested',
  'approved',
  'rejected',
  'pickup_scheduled',
  'in_transit',
  'received',
  'qc_passed',
  'qc_failed',
  'refunded',
  'completed',
] as const;
export type ReturnStatus = (typeof RETURN_STATUS)[number];

export const RETURN_TRANSITIONS: Record<ReturnStatus, readonly ReturnStatus[]> = {
  requested: ['approved', 'rejected'],
  approved: ['pickup_scheduled'],
  rejected: [],
  pickup_scheduled: ['in_transit'],
  in_transit: ['received'],
  received: ['qc_passed', 'qc_failed'],
  qc_passed: ['refunded'],
  qc_failed: ['completed'],
  refunded: ['completed'],
  completed: [],
};

export const RETURN_REASONS = [
  'size_too_small',
  'size_too_large',
  'not_as_described',
  'quality_issue',
  'damaged_on_arrival',
  'wrong_item',
  'changed_mind',
  'late_delivery',
] as const;

export const REFUND_MODE = ['source', 'wallet'] as const;
export type RefundMode = (typeof REFUND_MODE)[number];

export const REFUND_STATUS = ['pending', 'processing', 'completed', 'failed'] as const;
export type RefundStatus = (typeof REFUND_STATUS)[number];

// ── Wallet ──────────────────────────────────────────────────────────────────

/**
 * Wallet transaction taxonomy. `direction` is stored separately because a few
 * types can go either way (`adjustment` can be a credit or a debit), but most
 * have a fixed direction — see WALLET_TYPE_DIRECTION.
 */
export const WALLET_TXN_TYPE = [
  'referral_commission',
  'cashback',
  'refund',
  'order_payment',
  'withdrawal',
  'withdrawal_reversal',
  'adjustment',
  'signup_bonus',
] as const;
export type WalletTxnType = (typeof WALLET_TXN_TYPE)[number];

export const WALLET_DIRECTION = ['credit', 'debit'] as const;
export type WalletDirection = (typeof WALLET_DIRECTION)[number];

/** null = caller must specify (adjustments can go either way). */
export const WALLET_TYPE_DIRECTION: Record<WalletTxnType, WalletDirection | null> = {
  referral_commission: 'credit',
  cashback: 'credit',
  refund: 'credit',
  signup_bonus: 'credit',
  withdrawal_reversal: 'credit',
  order_payment: 'debit',
  withdrawal: 'debit',
  adjustment: null,
};

export const WALLET_TXN_STATUS = [
  'pending',
  'held',
  'completed',
  'failed',
  'reversed',
] as const;
export type WalletTxnStatus = (typeof WALLET_TXN_STATUS)[number];

/** Human labels + accent tokens for the ledger UI. */
export const WALLET_TYPE_META: Record<
  WalletTxnType,
  { label: string; tone: 'positive' | 'negative' | 'neutral' }
> = {
  referral_commission: { label: 'Referral commission', tone: 'positive' },
  cashback: { label: 'Cashback', tone: 'positive' },
  refund: { label: 'Refund', tone: 'positive' },
  signup_bonus: { label: 'Signup bonus', tone: 'positive' },
  withdrawal_reversal: { label: 'Withdrawal reversed', tone: 'positive' },
  order_payment: { label: 'Paid for order', tone: 'negative' },
  withdrawal: { label: 'Withdrawal to bank', tone: 'negative' },
  adjustment: { label: 'Adjustment', tone: 'neutral' },
};

// ── Bank verification & payouts ─────────────────────────────────────────────

export const BANK_ACCOUNT_KIND = ['bank', 'upi'] as const;
export type BankAccountKind = (typeof BANK_ACCOUNT_KIND)[number];

export const VERIFICATION_STATUS = [
  'unverified',
  'pending',
  'verified',
  'failed',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUS)[number];

export const VERIFICATION_MODE = [
  'penny_drop',
  'ifsc_name_match',
  'vpa_validate',
] as const;
export type VerificationMode = (typeof VERIFICATION_MODE)[number];

export const NAME_MATCH_RESULT = ['exact', 'partial', 'mismatch'] as const;
export type NameMatchResult = (typeof NAME_MATCH_RESULT)[number];

export const WITHDRAWAL_STATUS = [
  'pending',
  'approved',
  'rejected',
  'processing',
  'completed',
  'failed',
  'cancelled',
] as const;
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUS)[number];

export const WITHDRAWAL_TRANSITIONS: Record<
  WithdrawalStatus,
  readonly WithdrawalStatus[]
> = {
  pending: ['approved', 'rejected', 'cancelled'],
  approved: ['processing', 'failed'],
  processing: ['completed', 'failed'],
  // A failed payout can be retried, which sends it back through processing.
  failed: ['processing', 'cancelled'],
  rejected: [],
  completed: [],
  cancelled: [],
};

export const PAYOUT_MODE = ['IMPS', 'NEFT', 'RTGS', 'UPI'] as const;
export type PayoutMode = (typeof PAYOUT_MODE)[number];

export const PAYOUT_STATUS = [
  'queued',
  'processing',
  'processed',
  'reversed',
  'failed',
] as const;
export type PayoutStatus = (typeof PAYOUT_STATUS)[number];

// ── Referrals ───────────────────────────────────────────────────────────────

export const REFERRAL_STATUS = [
  'invited',
  'signed_up',
  'converted',
  'rejected',
] as const;
export type ReferralStatus = (typeof REFERRAL_STATUS)[number];

export const COMMISSION_STATUS = [
  'pending',
  'held',
  'available',
  'paid',
  'reversed',
  'rejected',
] as const;
export type CommissionStatus = (typeof COMMISSION_STATUS)[number];

export const COMMISSION_KIND = ['percent', 'flat'] as const;
export type CommissionKind = (typeof COMMISSION_KIND)[number];

export const FRAUD_FLAG_TYPE = [
  'self_referral',
  'same_device',
  'same_ip',
  'velocity',
  'disposable_email',
  'payout_abuse',
] as const;
export type FraudFlagType = (typeof FRAUD_FLAG_TYPE)[number];

export const FRAUD_SEVERITY = ['low', 'medium', 'high'] as const;
export type FraudSeverity = (typeof FRAUD_SEVERITY)[number];

export const FRAUD_FLAG_META: Record<
  FraudFlagType,
  { label: string; blocks: boolean; description: string }
> = {
  self_referral: {
    label: 'Self referral',
    blocks: true,
    description: 'Referrer and referee resolve to the same identity.',
  },
  same_device: {
    label: 'Same device',
    blocks: true,
    description: 'Both accounts signed up from an identical device fingerprint.',
  },
  same_ip: {
    label: 'Shared IP',
    blocks: false,
    description: 'Shared network — common on office/campus NAT, so flag not block.',
  },
  velocity: {
    label: 'Signup velocity',
    blocks: false,
    description: 'Unusual number of referrals accepted in a short window.',
  },
  disposable_email: {
    label: 'Disposable email',
    blocks: false,
    description: 'Referee used a throwaway email domain.',
  },
  payout_abuse: {
    label: 'Payout abuse',
    blocks: true,
    description: 'Withdrawal pattern consistent with commission farming.',
  },
};

// ── Discounts & loyalty ─────────────────────────────────────────────────────

export const COUPON_KIND = ['percent', 'flat', 'free_shipping'] as const;
export type CouponKind = (typeof COUPON_KIND)[number];

export const COUPON_APPLIES_TO = ['all', 'category', 'collection', 'product'] as const;
export type CouponAppliesTo = (typeof COUPON_APPLIES_TO)[number];

export const LOYALTY_TIERS = ['bronze', 'silver', 'gold'] as const;
export type LoyaltyTier = (typeof LOYALTY_TIERS)[number];

export const LOYALTY_REASON = [
  'order',
  'review',
  'referral',
  'redemption',
  'expiry',
  'adjustment',
] as const;

// ── Reviews & Q&A ───────────────────────────────────────────────────────────

export const MODERATION_STATUS = ['pending', 'approved', 'rejected'] as const;
export type ModerationStatus = (typeof MODERATION_STATUS)[number];

export const FIT_FEEDBACK = ['small', 'true_to_size', 'large'] as const;
export type FitFeedback = (typeof FIT_FEEDBACK)[number];

// ── CMS ─────────────────────────────────────────────────────────────────────

export const SECTION_KIND = [
  'hero',
  'collection_strip',
  'product_carousel',
  'editorial',
  'lookbook',
  'marquee',
  'quiz_cta',
  'usp_row',
  'testimonial',
  'newsletter',
] as const;
export type SectionKind = (typeof SECTION_KIND)[number];

export const SECTION_KIND_META: Record<
  SectionKind,
  { label: string; description: string; icon: string }
> = {
  hero: { label: 'Hero', description: 'Full-bleed banner with oversized type', icon: 'Monitor' },
  collection_strip: { label: 'Collection strip', description: 'Horizontal collection tiles', icon: 'LayoutGrid' },
  product_carousel: { label: 'Product carousel', description: 'Swipeable product rail', icon: 'GalleryHorizontalEnd' },
  editorial: { label: 'Editorial', description: 'Image + long-form copy split', icon: 'Newspaper' },
  lookbook: { label: 'Lookbook', description: 'Scroll-driven lookbook slides', icon: 'Images' },
  marquee: { label: 'Marquee', description: 'Infinite scrolling text ticker', icon: 'Type' },
  quiz_cta: { label: 'Style quiz CTA', description: 'Prompt to take the style match quiz', icon: 'Sparkles' },
  usp_row: { label: 'USP row', description: 'Icon + label trust badges', icon: 'BadgeCheck' },
  testimonial: { label: 'Testimonials', description: 'Customer quotes carousel', icon: 'Quote' },
  newsletter: { label: 'Newsletter', description: 'Email/WhatsApp capture block', icon: 'Mail' },
};

export const BANNER_PLACEMENT = [
  'home_hero',
  'strip',
  'category',
  'plp',
  'checkout',
] as const;

// ── Marketing ───────────────────────────────────────────────────────────────

export const CAMPAIGN_CHANNEL = ['email', 'push', 'whatsapp'] as const;
export type CampaignChannel = (typeof CAMPAIGN_CHANNEL)[number];

export const CAMPAIGN_STATUS = [
  'draft',
  'scheduled',
  'sending',
  'sent',
  'failed',
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUS)[number];

export const OUTBOX_CHANNEL = ['email', 'sms', 'whatsapp', 'push'] as const;
export type OutboxChannel = (typeof OUTBOX_CHANNEL)[number];

// ── Style quiz ──────────────────────────────────────────────────────────────

export const STYLE_PROFILES = [
  'minimalist',
  'maximalist',
  'street',
  'classic',
  'avant_garde',
] as const;
export type StyleProfile = (typeof STYLE_PROFILES)[number];

// ── Staff permissions ───────────────────────────────────────────────────────

/**
 * Granular permission catalogue. Roles hold a CSV of these; `hasPermission`
 * in src/lib/auth/permissions.ts also honours the `*` wildcard and
 * `resource.*` prefixes, so a role can be broad without listing every verb.
 */
export const PERMISSIONS = [
  'dashboard.view',
  'products.read',
  'products.write',
  'products.delete',
  'inventory.write',
  'orders.read',
  'orders.write',
  'orders.cancel',
  'shipping.write',
  'customers.read',
  'customers.write',
  'customers.ban',
  'discounts.read',
  'discounts.write',
  'cms.read',
  'cms.write',
  'marketing.read',
  'marketing.send',
  'returns.read',
  'returns.write',
  'reviews.moderate',
  'payments.read',
  'payments.refund',
  'referrals.read',
  'referrals.write',
  'wallet.read',
  'wallet.adjust',
  'payouts.read',
  'payouts.approve',
  'payouts.retry',
  'reports.view',
  'reports.export',
  'analytics.read',
  'staff.read',
  'staff.write',
  'settings.read',
  'settings.write',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Grouped for rendering the role editor's permission matrix. */
export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  { label: 'Dashboard', permissions: ['dashboard.view', 'analytics.read'] },
  {
    label: 'Catalogue',
    permissions: ['products.read', 'products.write', 'products.delete', 'inventory.write'],
  },
  {
    label: 'Orders',
    permissions: ['orders.read', 'orders.write', 'orders.cancel', 'shipping.write'],
  },
  { label: 'Customers', permissions: ['customers.read', 'customers.write', 'customers.ban'] },
  { label: 'Discounts', permissions: ['discounts.read', 'discounts.write'] },
  { label: 'Content', permissions: ['cms.read', 'cms.write'] },
  { label: 'Marketing', permissions: ['marketing.read', 'marketing.send'] },
  { label: 'Returns', permissions: ['returns.read', 'returns.write'] },
  { label: 'Reviews', permissions: ['reviews.moderate'] },
  { label: 'Payments', permissions: ['payments.read', 'payments.refund'] },
  { label: 'Referrals', permissions: ['referrals.read', 'referrals.write'] },
  {
    label: 'Wallet & payouts',
    permissions: ['wallet.read', 'wallet.adjust', 'payouts.read', 'payouts.approve', 'payouts.retry'],
  },
  { label: 'Reports', permissions: ['reports.view', 'reports.export'] },
  { label: 'Staff', permissions: ['staff.read', 'staff.write'] },
  { label: 'Settings', permissions: ['settings.read', 'settings.write'] },
];

// ── Status → UI tone mapping ────────────────────────────────────────────────

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

/**
 * One place that decides what colour a status chip is, everywhere in the app.
 * Unknown keys fall back to 'neutral' via `toneFor`.
 */
const STATUS_TONES: Record<string, Tone> = {
  // orders
  pending: 'warning',
  confirmed: 'info',
  packed: 'info',
  shipped: 'accent',
  delivered: 'success',
  cancelled: 'danger',
  returned: 'danger',
  // payments
  unpaid: 'warning',
  authorized: 'info',
  paid: 'success',
  partially_paid: 'warning',
  captured: 'success',
  failed: 'danger',
  refunded: 'neutral',
  partially_refunded: 'neutral',
  created: 'neutral',
  expired: 'neutral',
  // fulfilment
  unfulfilled: 'warning',
  partial: 'info',
  fulfilled: 'success',
  // verification / payouts
  unverified: 'neutral',
  verified: 'success',
  processing: 'info',
  approved: 'success',
  rejected: 'danger',
  completed: 'success',
  queued: 'neutral',
  processed: 'success',
  reversed: 'warning',
  // wallet / commission
  held: 'warning',
  available: 'success',
  // moderation
  draft: 'neutral',
  published: 'success',
  active: 'success',
  archived: 'neutral',
  flagged: 'warning',
  banned: 'danger',
  // referral
  invited: 'neutral',
  signed_up: 'info',
  converted: 'success',
};

export function toneFor(status: string | null | undefined): Tone {
  if (!status) return 'neutral';
  return STATUS_TONES[status] ?? 'neutral';
}

/** `partially_refunded` → `Partially refunded` */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  const spaced = value.replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
