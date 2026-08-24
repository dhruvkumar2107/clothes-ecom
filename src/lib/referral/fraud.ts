import { db, type DbClient } from '../db';
import { addMinutes } from '../utils';
import { FRAUD_FLAG_META, type FraudFlagType, type FraudSeverity } from '../enums';
import { getSettings } from '../settings';

/**
 * Referral fraud checks.
 *
 * A referral programme that pays real money into a withdrawable wallet is an
 * arbitrage target the moment it launches. The attack is not sophisticated:
 * sign up, refer yourself with a second email, place a small order, withdraw the
 * commission, repeat. Everything here exists to make that unprofitable.
 *
 * Two principles shape the design:
 *
 * **Blocking is rare; flagging is normal.** Only three signals block
 * (`self_referral`, `same_device`, `payout_abuse`) because the others have
 * innocent explanations that are *common* rather than rare — a shared office IP,
 * a family on one connection, a burst of signups after a post goes viral.
 * Blocking those would reject genuine referrals silently, which is worse than
 * paying a few fraudulent ones: the customer never finds out why their friend's
 * signup did not count, and the programme quietly stops working.
 *
 * **Detection runs at signup, but the money is gated later.** Flags are written
 * when the edge is created, and again re-read before commission is released.
 * That two-stage gate is what makes the hold window useful — a flag raised days
 * after signup (velocity, payout patterns) still stops the payout.
 *
 * Device hashing is `deviceHash()` in src/lib/crypto.ts: user agent + accept
 * language + IP. It is deliberately weak as a fingerprint — it will collide for
 * two people on identical phones on the same wifi, which is why `same_device`
 * blocks the *commission* rather than the signup.
 */

export interface FraudSignal {
  type: FraudFlagType;
  severity: FraudSeverity;
  detail: string;
  blocks: boolean;
}

export interface FraudContext {
  referrerId: string;
  refereeId?: string;
  refereeEmail?: string | null;
  refereePhone?: string | null;
  ip?: string | null;
  deviceHash?: string | null;
  userAgent?: string | null;
}

/**
 * Domains whose whole purpose is a throwaway address. Flag, never block —
 * plenty of privacy-conscious customers use them legitimately, and the list is
 * always out of date.
 */
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'temp-mail.org',
  '10minutemail.com', 'throwawaymail.com', 'yopmail.com', 'sharklasers.com',
  'trashmail.com', 'getnada.com', 'dispostable.com', 'maildrop.cc',
  'fakeinbox.com', 'mailnesia.com', 'tempr.email', 'discard.email',
]);

/**
 * Run every check. Returns all signals, blocking or not — the caller decides
 * what to do with them, because signup and payout have different tolerances.
 */
export async function evaluateReferral(ctx: FraudContext): Promise<FraudSignal[]> {
  const settings = await getSettings([
    'referral.blockSameDevice',
    'referral.flagSameIp',
    'referral.velocityThreshold',
  ]);

  const signals: FraudSignal[] = [];

  const referrer = await db.user.findUnique({
    where: { id: ctx.referrerId },
    select: {
      id: true, email: true, phone: true, status: true,
      signupIp: true, signupDeviceHash: true,
    },
  });
  if (!referrer) return signals;

  // ── self-referral ────────────────────────────────────────────────────────
  // Checked on identity, not just id: the same person with two emails is the
  // case that actually happens, and a shared phone number is the strongest
  // available signal since Indian numbers are KYC-bound to one person.
  if (ctx.refereeId && ctx.refereeId === ctx.referrerId) {
    signals.push(signal('self_referral', 'high', 'Referrer and referee are the same account.'));
  } else if (ctx.refereePhone && referrer.phone && ctx.refereePhone === referrer.phone) {
    signals.push(signal('self_referral', 'high', 'Referee phone number matches the referrer.'));
  } else if (ctx.refereeEmail && referrer.email) {
    const a = canonicalEmail(ctx.refereeEmail);
    const b = canonicalEmail(referrer.email);
    if (a === b) {
      signals.push(
        signal('self_referral', 'high', `Referee email is an alias of the referrer's (${b}).`),
      );
    }
  }

  // ── same device ──────────────────────────────────────────────────────────
  if (ctx.deviceHash && referrer.signupDeviceHash && ctx.deviceHash === referrer.signupDeviceHash) {
    signals.push(
      signal(
        'same_device',
        'high',
        'Referee signed up from the same device fingerprint as the referrer.',
        settings['referral.blockSameDevice'],
      ),
    );
  }

  // ── shared IP ────────────────────────────────────────────────────────────
  if (settings['referral.flagSameIp'] && ctx.ip && referrer.signupIp && ctx.ip === referrer.signupIp) {
    signals.push(
      signal('same_ip', 'low', `Both accounts signed up from ${ctx.ip}. Common on shared networks.`),
    );
  }

  // ── velocity ─────────────────────────────────────────────────────────────
  // Counted over an hour rather than a day: a genuine viral moment produces a
  // sustained trickle, whereas scripted signups arrive in a burst.
  const threshold = settings['referral.velocityThreshold'];
  if (threshold > 0) {
    const recent = await db.referral.count({
      where: { referrerId: ctx.referrerId, createdAt: { gte: addMinutes(new Date(), -60) } },
    });
    if (recent >= threshold) {
      signals.push(
        signal('velocity', 'medium', `${recent} referrals accepted in the last hour (limit ${threshold}).`),
      );
    }
  }

  // ── disposable email ─────────────────────────────────────────────────────
  if (ctx.refereeEmail) {
    const domain = ctx.refereeEmail.split('@')[1]?.toLowerCase();
    if (domain && DISPOSABLE_DOMAINS.has(domain)) {
      signals.push(signal('disposable_email', 'medium', `Referee used a disposable domain (${domain}).`));
    }
  }

  // ── referrer standing ────────────────────────────────────────────────────
  if (referrer.status === 'banned' || referrer.status === 'flagged') {
    signals.push(
      signal('payout_abuse', 'high', `Referrer account is ${referrer.status}.`, true),
    );
  }

  return signals;
}

function signal(
  type: FraudFlagType,
  severity: FraudSeverity,
  detail: string,
  blocksOverride?: boolean,
): FraudSignal {
  return {
    type,
    severity,
    detail,
    blocks: blocksOverride ?? FRAUD_FLAG_META[type].blocks,
  };
}

/**
 * Gmail ignores dots and everything after `+`, so `a.b+ref@gmail.com` and
 * `ab@gmail.com` are one mailbox. Normalising catches the laziest self-referral
 * without needing a device or IP match. Applied to the plus-suffix for every
 * domain (universal) but dot-stripping only for Google's, where it is the
 * documented behaviour.
 */
export function canonicalEmail(email: string): string {
  const [rawLocal, domain] = email.toLowerCase().trim().split('@');
  if (!domain) return email.toLowerCase().trim();
  let local = rawLocal.split('+')[0];
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.replace(/\./g, '');
    return `${local}@gmail.com`;
  }
  return `${local}@${domain}`;
}

/** Persist signals as flag rows. Idempotent per (referral, type). */
export async function recordFlags(
  input: { userId: string; referralId?: string | null; signals: FraudSignal[] },
  client: DbClient = db,
): Promise<number> {
  let written = 0;
  for (const s of input.signals) {
    const existing = input.referralId
      ? await client.referralFraudFlag.findFirst({
          where: { referralId: input.referralId, type: s.type },
          select: { id: true },
        })
      : null;
    if (existing) continue;

    await client.referralFraudFlag.create({
      data: {
        referralId: input.referralId ?? null,
        userId: input.userId,
        type: s.type,
        severity: s.severity,
        detail: s.detail,
        autoBlocked: s.blocks,
      },
    });
    written += 1;
  }
  return written;
}

/** 0–100. Drives the admin sort order; not used as a gate on its own. */
export function riskScore(signals: readonly FraudSignal[]): number {
  const weights: Record<FraudSeverity, number> = { low: 10, medium: 25, high: 50 };
  const raw = signals.reduce((total, s) => total + weights[s.severity], 0);
  return Math.min(100, raw);
}

export function blockingSignals(signals: readonly FraudSignal[]): FraudSignal[] {
  return signals.filter((s) => s.blocks);
}

/**
 * Re-check before releasing money. Reads persisted flags rather than re-running
 * detection, so an admin who resolved a flag as a false positive unblocks the
 * payout — the whole point of having a resolution workflow.
 */
export async function isReferralPayable(referralId: string): Promise<{
  payable: boolean;
  reason?: string;
}> {
  const flags = await db.referralFraudFlag.findMany({
    where: { referralId, autoBlocked: true, resolved: false },
    select: { type: true, detail: true },
  });
  if (flags.length === 0) return { payable: true };
  return {
    payable: false,
    reason: `${FRAUD_FLAG_META[flags[0].type as FraudFlagType].label}: ${flags[0].detail}`,
  };
}
