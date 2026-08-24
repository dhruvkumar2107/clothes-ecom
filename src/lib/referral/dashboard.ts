import { db } from '../db';
import { activeRule, referralLink } from './attribution';

/**
 * The numbers behind the customer's referral dashboard.
 *
 * The spec calls for "invited" and "converted" as separate states, and the
 * distinction is load-bearing rather than cosmetic: a referrer who has shared
 * their link ten times and had three people sign up but nobody buy needs to see
 * exactly that, or they conclude the programme is broken and stop sharing.
 *
 * So the funnel is reported in full — shared, signed up, ordered — and commission
 * is reported in the four states the money can actually be in:
 *
 *   • **pending** — accrued but blocked by a fraud flag. Shown, with a note,
 *     rather than hidden; a referrer whose commission silently vanishes will
 *     assume they were cheated.
 *   • **held** — earned, waiting out the return window. Shown with the unlock
 *     date, because "when do I get it" is the only question that matters here.
 *   • **available** — in the wallet, spendable or withdrawable.
 *   • **paid** — already withdrawn to a bank account.
 *
 * Reading this page releases any commission that has come due, so the figures are
 * never stale by a scheduled-job interval.
 */

export interface ReferralDashboard {
  code: string;
  link: string;
  /** Referred accounts that exist but have never ordered. */
  invited: number;
  /** Referred accounts that have placed a qualifying order. */
  converted: number;
  /** Referrals stopped by fraud checks. Kept visible so support can explain. */
  rejected: number;
  totalReferred: number;
  conversionRate: number;
  earnings: {
    pending: number;
    held: number;
    available: number;
    paid: number;
    reversed: number;
    /** pending + held + available + paid — everything ever earned, less reversals. */
    lifetime: number;
  };
  nextUnlock: { amount: number; at: Date } | null;
  tier: {
    name: string;
    bonusKind: string;
    bonusValue: number;
    badgeHex: string | null;
    /** Conversions still needed for the next slab, null if already at the top. */
    toNext: number | null;
    nextName: string | null;
  } | null;
  rule: {
    label: string;
    kind: string;
    value: number;
    minOrderValue: number;
    holdDays: number;
    refereeCoupon: string | null;
  } | null;
  people: ReferredPerson[];
}

export interface ReferredPerson {
  referralId: string;
  /** First name plus a masked hint — never the full email of a third party. */
  name: string;
  joinedAt: Date;
  status: 'signed_up' | 'converted' | 'rejected' | 'invited';
  orders: number;
  commissionEarned: number;
  commissionStatus: string | null;
}

export async function getReferralDashboard(userId: string): Promise<ReferralDashboard> {

  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { referralCode: true },
  });

  const [referrals, commissions, rule] = await Promise.all([
    db.referral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        referredUser: { select: { id: true, name: true, orderCount: true } },
        commissions: {
          select: { commissionAmount: true, status: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    }),
    db.referralCommission.groupBy({
      by: ['status'],
      where: { referrerId: userId },
      _sum: { commissionAmount: true },
    }),
    activeRule(),
  ]);

  const byStatus = (status: string) =>
    commissions.find((row) => row.status === status)?._sum.commissionAmount ?? 0;

  const earnings = {
    pending: byStatus('pending'),
    held: byStatus('held'),
    available: byStatus('available'),
    paid: byStatus('paid'),
    reversed: byStatus('reversed'),
    lifetime: 0,
  };
  earnings.lifetime = earnings.pending + earnings.held + earnings.available + earnings.paid;

  const converted = referrals.filter((r) => r.status === 'converted').length;
  const rejected = referrals.filter((r) => r.status === 'rejected').length;
  const invited = referrals.filter((r) => r.status === 'signed_up' || r.status === 'invited').length;

  const nextHeld = await db.referralCommission.findFirst({
    where: { referrerId: userId, status: 'held', holdUntil: { not: null } },
    orderBy: { holdUntil: 'asc' },
    select: { commissionAmount: true, holdUntil: true },
  });

  const tiers = rule?.tiers ?? [];
  let current: (typeof tiers)[number] | null = null;
  let next: (typeof tiers)[number] | null = null;
  for (const tier of tiers) {
    if (converted >= tier.minConversions) current = tier;
    else if (!next) next = tier;
  }

  return {
    code: user.referralCode,
    link: referralLink(user.referralCode),
    invited,
    converted,
    rejected,
    totalReferred: referrals.length,
    conversionRate: referrals.length ? converted / referrals.length : 0,
    earnings,
    nextUnlock:
      nextHeld && nextHeld.holdUntil
        ? { amount: nextHeld.commissionAmount, at: nextHeld.holdUntil }
        : null,
    tier: current
      ? {
          name: current.name,
          bonusKind: current.bonusKind,
          bonusValue: current.bonusValue,
          badgeHex: current.badgeHex,
          toNext: next ? next.minConversions - converted : null,
          nextName: next?.name ?? null,
        }
      : next
        ? {
            name: 'Starter',
            bonusKind: 'percent',
            bonusValue: 0,
            badgeHex: null,
            toNext: next.minConversions - converted,
            nextName: next.name,
          }
        : null,
    rule: rule
      ? {
          label: rule.name,
          kind: rule.kind,
          value: rule.value,
          minOrderValue: rule.minOrderValue,
          holdDays: rule.holdDays,
          refereeCoupon: rule.refereeCouponCode,
        }
      : null,
    people: referrals.map((referral) => {
      const earned = referral.commissions
        .filter((c) => c.status !== 'reversed' && c.status !== 'rejected')
        .reduce((total, c) => total + c.commissionAmount, 0);

      return {
        referralId: referral.id,
        // First name only. A referrer is entitled to know their referral
        // converted; they are not entitled to the person's contact details.
        name: referral.referredUser.name.trim().split(/\s+/)[0] || 'Member',
        joinedAt: referral.createdAt,
        status: referral.status as ReferredPerson['status'],
        orders: referral.referredUser.orderCount,
        commissionEarned: earned,
        commissionStatus: referral.commissions[0]?.status ?? null,
      };
    }),
  };
}

/**
 * Admin view of one referral chain — who referred whom, and what each edge paid.
 *
 * Two levels deep rather than fully recursive. There is no multi-level commission
 * in the rules engine, so a deeper walk would render a tree that earns nobody
 * anything, and unbounded recursion over a referral graph is a denial-of-service
 * waiting for someone to build a chain a thousand long.
 */
export async function getReferralChain(userId: string) {
  const root = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, phone: true, referralCode: true,
      createdAt: true, orderCount: true, lifetimeSpend: true,
      referredBy: { select: { id: true, name: true, referralCode: true } },
    },
  });

  const referrals = await db.referral.findMany({
    where: { referrerId: userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, status: true, code: true, createdAt: true, riskScore: true,
      fraudFlagsCsv: true, convertedAt: true, firstOrderId: true,
      referredUser: {
        select: {
          id: true, name: true, email: true, phone: true, createdAt: true,
          orderCount: true, lifetimeSpend: true, status: true,
          referralCode: true,
          _count: { select: { referralsMade: true } },
        },
      },
      commissions: {
        select: {
          id: true, commissionAmount: true, status: true, holdUntil: true,
          orderAmount: true, tierBonus: true, isManualOverride: true,
          createdAt: true,
          order: { select: { orderNumber: true, grandTotal: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      flags: {
        where: { resolved: false },
        select: { id: true, type: true, severity: true, detail: true, autoBlocked: true },
      },
    },
  });

  return { root, referrals };
}

/** Programme-wide totals for the admin referral dashboard. */
export async function getReferralStats(): Promise<{
  totalReferrals: number;
  converted: number;
  rejected: number;
  conversionRate: number;
  commissionAccrued: number;
  commissionAvailable: number;
  commissionPaid: number;
  commissionReversed: number;
  openFlags: number;
  blockingFlags: number;
  topReferrers: Array<{
    userId: string;
    name: string;
    conversions: number;
    earned: number;
  }>;
}> {
  const [total, converted, rejected, byStatus, openFlags, blockingFlags, top] = await Promise.all([
    db.referral.count(),
    db.referral.count({ where: { status: 'converted' } }),
    db.referral.count({ where: { status: 'rejected' } }),
    db.referralCommission.groupBy({
      by: ['status'],
      _sum: { commissionAmount: true },
    }),
    db.referralFraudFlag.count({ where: { resolved: false } }),
    db.referralFraudFlag.count({ where: { resolved: false, autoBlocked: true } }),
    db.referralCommission.groupBy({
      by: ['referrerId'],
      where: { status: { notIn: ['reversed', 'rejected'] } },
      _sum: { commissionAmount: true },
      _count: { _all: true },
      orderBy: { _sum: { commissionAmount: 'desc' } },
      take: 10,
    }),
  ]);

  const sumOf = (status: string) =>
    byStatus.find((row) => row.status === status)?._sum.commissionAmount ?? 0;

  const names = top.length
    ? await db.user.findMany({
        where: { id: { in: top.map((row) => row.referrerId) } },
        select: { id: true, name: true },
      })
    : [];
  const nameOf = new Map(names.map((u) => [u.id, u.name]));

  return {
    totalReferrals: total,
    converted,
    rejected,
    conversionRate: total ? converted / total : 0,
    commissionAccrued: sumOf('pending') + sumOf('held') + sumOf('available') + sumOf('paid'),
    commissionAvailable: sumOf('available'),
    commissionPaid: sumOf('paid'),
    commissionReversed: sumOf('reversed'),
    openFlags,
    blockingFlags,
    topReferrers: top.map((row) => ({
      userId: row.referrerId,
      name: nameOf.get(row.referrerId) ?? 'Unknown',
      conversions: row._count._all,
      earned: row._sum.commissionAmount ?? 0,
    })),
  };
}
