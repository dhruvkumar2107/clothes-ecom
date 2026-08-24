import { db, type DbClient } from '../db';
import { generateReferralCode } from '../ids';
import { getSettings } from '../settings';
import { blockingSignals, evaluateReferral, recordFlags, riskScore } from './fraud';

/**
 * Referral attribution — turning a code on a signup into a `Referral` edge.
 *
 * The edge is created at signup and is append-only: `User.referredById` is set
 * once and never mutated, so the chain can be walked and audited without
 * worrying that someone re-pointed it. Reattributing a referral after the fact
 * is the kind of feature that lets a support agent hand commission to whoever
 * complains loudest, so it is not possible here at all — an admin can reject or
 * override a *commission*, but not rewrite who referred whom.
 *
 * The interesting decision is what happens on a blocking fraud signal. The
 * referral is still created, with `status: 'rejected'` and the flags attached,
 * rather than being dropped. A dropped referral is invisible: the referrer sees
 * nothing, support has nothing to look at, and a false positive is
 * unrecoverable. A rejected one shows up in the admin with its reason and can be
 * resolved.
 *
 * Signup is never blocked by referral fraud. The customer being referred did
 * nothing wrong, and refusing their account to protect a commission is a
 * spectacular own goal.
 */

export interface AttributionInput {
  refereeId: string;
  /** Raw code from the signup link or form. Case-insensitive. */
  code: string;
  ip?: string | null;
  deviceHash?: string | null;
  userAgent?: string | null;
}

export interface AttributionResult {
  attributed: boolean;
  referralId?: string;
  referrerId?: string;
  referrerName?: string;
  status: 'signed_up' | 'rejected' | 'none';
  /** Coupon the referee gets, if the winning rule defines one. */
  welcomeCoupon?: string | null;
  reason?: string;
}

/** Resolve a code to its owner without creating anything — for link previews. */
export async function lookupReferralCode(code: string): Promise<{
  valid: boolean;
  referrerName?: string;
  referrerId?: string;
  welcomeCoupon?: string | null;
}> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { valid: false };

  const [referrer, settings] = await Promise.all([
    db.user.findFirst({
      where: { referralCode: normalized },
      select: { id: true, name: true, status: true },
    }),
    getSettings(['referral.enabled', 'referral.welcomeCouponCode']),
  ]);

  if (!settings['referral.enabled']) return { valid: false };
  if (!referrer || referrer.status === 'banned') return { valid: false };

  const rule = await activeRule();

  return {
    valid: true,
    referrerId: referrer.id,
    // First name only. The full name of a stranger is more than a signup page
    // needs to show, and referral links get shared publicly.
    referrerName: referrer.name.trim().split(/\s+/)[0],
    welcomeCoupon: rule?.refereeCouponCode ?? settings['referral.welcomeCouponCode'] ?? null,
  };
}

export async function attributeSignup(input: AttributionInput): Promise<AttributionResult> {
  const settings = await getSettings(['referral.enabled', 'referral.welcomeCouponCode']);
  if (!settings['referral.enabled']) return { attributed: false, status: 'none' };

  const code = input.code.trim().toUpperCase();
  if (!code) return { attributed: false, status: 'none' };

  const referrer = await db.user.findFirst({
    where: { referralCode: code },
    select: { id: true, name: true, status: true },
  });
  if (!referrer) {
    return { attributed: false, status: 'none', reason: 'That referral code was not recognised.' };
  }

  const referee = await db.user.findUnique({
    where: { id: input.refereeId },
    select: { id: true, email: true, phone: true, referredById: true },
  });
  if (!referee) return { attributed: false, status: 'none' };

  // Already attributed — a second attempt is a no-op, not an overwrite.
  if (referee.referredById) {
    const existing = await db.referral.findUnique({
      where: { referredUserId: referee.id },
      select: { id: true, referrerId: true, status: true },
    });
    return {
      attributed: true,
      referralId: existing?.id,
      referrerId: existing?.referrerId,
      status: existing?.status === 'rejected' ? 'rejected' : 'signed_up',
      reason: 'This account was already referred.',
    };
  }

  const signals = await evaluateReferral({
    referrerId: referrer.id,
    refereeId: referee.id,
    refereeEmail: referee.email,
    refereePhone: referee.phone,
    ip: input.ip,
    deviceHash: input.deviceHash,
    userAgent: input.userAgent,
  });

  const blocking = blockingSignals(signals);
  const status = blocking.length > 0 ? 'rejected' : 'signed_up';
  const rule = await activeRule();

  const referral = await db.$transaction(async (client) => {
    const created = await client.referral.create({
      data: {
        referrerId: referrer.id,
        referredUserId: referee.id,
        code,
        status,
        signupIp: input.ip ?? null,
        signupDeviceHash: input.deviceHash ?? null,
        signupUserAgent: input.userAgent ?? null,
        fraudFlagsCsv: signals.length ? signals.map((s) => s.type).join(',') : null,
        riskScore: riskScore(signals),
      },
      select: { id: true },
    });

    // The User pointer is written in the same transaction as the edge, so the
    // two can never disagree about who referred whom.
    await client.user.update({
      where: { id: referee.id },
      data: { referredById: referrer.id },
    });

    if (signals.length) {
      await recordFlags({ userId: referee.id, referralId: created.id, signals }, client as DbClient);
    }

    return created;
  });

  return {
    attributed: true,
    referralId: referral.id,
    referrerId: referrer.id,
    referrerName: referrer.name.trim().split(/\s+/)[0],
    status,
    welcomeCoupon:
      status === 'signed_up'
        ? (rule?.refereeCouponCode ?? settings['referral.welcomeCouponCode'] ?? null)
        : null,
    reason: blocking.length ? blocking[0].detail : undefined,
  };
}

/**
 * The highest-priority rule in force right now.
 *
 * `priority` desc then `createdAt` desc, so a newer rule wins a tie — which
 * matches the mental model of an admin who duplicates a rule to change a rate
 * and expects the new one to take effect.
 */
export async function activeRule(now = new Date()) {
  return db.referralRule.findFirst({
    where: {
      active: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    include: { tiers: { where: { active: true }, orderBy: { minConversions: 'asc' } } },
  });
}

/** Every user gets a code. Called from signup; safe to call again. */
export async function ensureReferralCode(userId: string): Promise<string> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { referralCode: true, name: true },
  });
  if (user.referralCode) return user.referralCode;

  const code = await generateReferralCode(user.name);
  await db.user.update({ where: { id: userId }, data: { referralCode: code } });
  return code;
}

/** The shareable link. Kept here so the format is defined in exactly one place. */
export function referralLink(code: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/join/${code}`;
}
