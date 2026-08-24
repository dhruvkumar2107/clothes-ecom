import { db } from '../db';
import { hashToken, randomOtp, safeEqual } from '../crypto';
import { addMinutes, maskEmail, maskPhone } from '../utils';
import { getMailer, getSmsSender } from '../adapters/registry';
import type { OtpChannel, OtpPurpose } from '../enums';
import { signChallengeToken, verifyChallengeToken } from './jwt';

/**
 * OTP issue and verify.
 *
 * The threat model here is not "guess a 6-digit code" — it is enumeration and
 * cost. An unthrottled OTP endpoint is a free SMS cannon pointed at arbitrary
 * numbers, billed to us. So there are four independent limits, and the code
 * length is almost the least interesting of them:
 *
 *   1. **Attempts per code** (5). Sixth wrong guess burns the challenge.
 *   2. **Resends per destination** (5 in 30 min), with a cooldown between sends.
 *   3. **Issues per IP** (15 in 30 min), which is what stops the cannon — the
 *      per-destination limit alone is useless against a script iterating
 *      numbers.
 *   4. **Expiry** (10 min).
 *
 * Codes are stored hashed. A 6-digit space is trivially brute-forced offline, so
 * hashing them is not about secrecy of the code itself — it is so that a
 * database read cannot be used to *complete* a login for a number the attacker
 * does not control, which is exactly what a support-tool SQL query or a leaked
 * backup would otherwise permit.
 */

const CODE_DIGITS = 6;
const TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

/** Between two sends to the same destination. Long enough to stop double-taps. */
const RESEND_COOLDOWN_SECONDS = 45;
const RESEND_WINDOW_MINUTES = 30;
const MAX_SENDS_PER_DESTINATION = 5;

const IP_WINDOW_MINUTES = 30;
const MAX_SENDS_PER_IP = 15;

export class OtpError extends Error {
  readonly code: string;
  readonly retryAfterSeconds?: number;
  readonly status: number;
  constructor(code: string, message: string, opts: { retryAfter?: number; status?: number } = {}) {
    super(message);
    this.name = 'OtpError';
    this.code = code;
    this.retryAfterSeconds = opts.retryAfter;
    this.status = opts.status ?? 429;
  }
}

export interface IssueOtpInput {
  destination: string;
  channel: OtpChannel;
  purpose: OtpPurpose;
  ip?: string | null;
  /** Carried through the challenge token to the verify step. */
  data?: Record<string, unknown>;
}

export interface IssuedOtp {
  challengeId: string;
  /** Sign this back on verify — it binds destination + purpose to the attempt. */
  challengeToken: string;
  expiresAt: Date;
  maskedDestination: string;
  resendAvailableInSeconds: number;
  /**
   * Present only when the resolved SMS/mail driver is a mock, so the dev UI can
   * show the code instead of requiring a gateway. Never populated in production
   * (see `shouldEchoCode`) and never persisted.
   */
  devCode?: string;
}

export function normalizeDestination(channel: OtpChannel, raw: string): string {
  const value = raw.trim();
  if (channel === 'email') return value.toLowerCase();
  const digits = value.replace(/\D/g, '');
  // Store the bare 10-digit national number so +91/0/91 prefixed inputs all
  // resolve to the same throttle bucket and the same User row.
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export function assertValidDestination(channel: OtpChannel, destination: string): void {
  if (channel === 'email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(destination)) {
      throw new OtpError('invalid_destination', 'That email address does not look valid.', { status: 400 });
    }
    return;
  }
  if (!/^[6-9]\d{9}$/.test(destination)) {
    throw new OtpError('invalid_destination', 'Enter a valid 10-digit Indian mobile number.', { status: 400 });
  }
}

/**
 * The mock drivers cannot deliver anything, so without an echo there is no way
 * to log in on a fresh clone. Gated on the resolved driver *and* NODE_ENV so
 * that a production deploy which forgot its SMS keys fails closed — it stops
 * logins rather than publishing codes over the API.
 */
function shouldEchoCode(channel: OtpChannel): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  const driver = channel === 'email' ? getMailer() : getSmsSender();
  return driver.mode === 'mock';
}

export async function issueOtp(input: IssueOtpInput): Promise<IssuedOtp> {
  const destination = normalizeDestination(input.channel, input.destination);
  assertValidDestination(input.channel, destination);

  const now = new Date();
  await enforceThrottles(destination, input.purpose, input.ip ?? null, now);

  const code = randomOtp(CODE_DIGITS);
  const expiresAt = addMinutes(now, TTL_MINUTES);

  // Any still-live challenge for the same destination+purpose is consumed. Two
  // valid codes at once doubles the guess space for free and confuses users who
  // received both.
  await db.otpChallenge.updateMany({
    where: { destination, purpose: input.purpose, consumedAt: null, expiresAt: { gt: now } },
    data: { consumedAt: now },
  });

  const challenge = await db.otpChallenge.create({
    data: {
      channel: input.channel,
      destination,
      purpose: input.purpose,
      codeHash: hashToken(code),
      maxAttempts: MAX_ATTEMPTS,
      expiresAt,
      ip: input.ip ?? null,
    },
    select: { id: true },
  });

  await deliver(input.channel, destination, code, input.purpose);

  const challengeToken = await signChallengeToken({
    purpose: `otp:${input.purpose}`,
    destination,
    challengeId: challenge.id,
    data: { ...input.data, channel: input.channel },
    ttlSeconds: TTL_MINUTES * 60,
  });

  return {
    challengeId: challenge.id,
    challengeToken,
    expiresAt,
    maskedDestination:
      input.channel === 'email' ? maskEmail(destination) : maskPhone(destination),
    resendAvailableInSeconds: RESEND_COOLDOWN_SECONDS,
    ...(shouldEchoCode(input.channel) ? { devCode: code } : {}),
  };
}

async function enforceThrottles(
  destination: string,
  purpose: OtpPurpose,
  ip: string | null,
  now: Date,
): Promise<void> {
  const lastSend = await db.otpChallenge.findFirst({
    where: { destination, purpose },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  if (lastSend) {
    const elapsed = (now.getTime() - lastSend.createdAt.getTime()) / 1000;
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed);
      throw new OtpError('cooldown', `Please wait ${wait}s before requesting another code.`, {
        retryAfter: wait,
      });
    }
  }

  const sendsToDestination = await db.otpChallenge.count({
    where: { destination, createdAt: { gte: addMinutes(now, -RESEND_WINDOW_MINUTES) } },
  });
  if (sendsToDestination >= MAX_SENDS_PER_DESTINATION) {
    throw new OtpError(
      'destination_limit',
      'Too many codes requested for this number. Try again in half an hour.',
      { retryAfter: RESEND_WINDOW_MINUTES * 60 },
    );
  }

  // The limit that actually matters: without it, the per-destination cap is
  // bypassed by walking through numbers, and every attempt costs us an SMS.
  if (ip) {
    const sendsFromIp = await db.otpChallenge.count({
      where: { ip, createdAt: { gte: addMinutes(now, -IP_WINDOW_MINUTES) } },
    });
    if (sendsFromIp >= MAX_SENDS_PER_IP) {
      throw new OtpError('ip_limit', 'Too many verification codes requested. Try again later.', {
        retryAfter: IP_WINDOW_MINUTES * 60,
      });
    }
  }
}

const PURPOSE_COPY: Record<OtpPurpose, string> = {
  login: 'signing in',
  signup: 'creating your account',
  reset: 'resetting your password',
  verify_phone: 'verifying your phone number',
  verify_email: 'verifying your email',
};

async function deliver(
  channel: OtpChannel,
  destination: string,
  code: string,
  purpose: OtpPurpose,
): Promise<void> {
  const reason = PURPOSE_COPY[purpose];

  if (channel === 'email') {
    await getMailer().send({
      to: destination,
      subject: `${code} is your LUMEN&CO verification code`,
      html: otpEmail(code, reason),
      template: `otp.${purpose}`,
      meta: { purpose },
    });
    return;
  }

  // `template` carries the DLT template id when one is configured; the variable
  // map is what MSG91's flow endpoint actually sends. See sms/msg91.ts.
  await getSmsSender().send({
    to: destination,
    body: `${code} is your LUMEN&CO verification code. Valid for ${TTL_MINUTES} minutes. Do not share it with anyone.`,
    channel: channel === 'whatsapp' ? 'whatsapp' : 'sms',
    template: process.env.MSG91_TEMPLATE_ID ?? `otp.${purpose}`,
    meta: { OTP: code, purpose, VAR1: code },
  });
}

function otpEmail(code: string, reason: string): string {
  return `<!doctype html>
<html><body style="margin:0;background:#0A0A0F;font-family:'Helvetica Neue',Arial,sans-serif;color:#E7E7EA">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:480px;background:#12121A;border:1px solid #24243040;border-radius:20px;padding:40px">
        <tr><td>
          <div style="font-size:13px;letter-spacing:.28em;text-transform:uppercase;color:#8B5CF6">LUMEN&amp;CO</div>
          <h1 style="margin:24px 0 8px;font-size:26px;font-weight:400;letter-spacing:-.02em">Your code</h1>
          <p style="margin:0 0 28px;color:#9A9AA8;font-size:14px;line-height:1.6">Use this code to continue ${reason}. It expires in ${TTL_MINUTES} minutes.</p>
          <div style="font-size:38px;letter-spacing:.32em;font-weight:600;color:#2DD4BF;padding:20px 0;text-align:center;background:#0A0A0F;border-radius:12px">${code}</div>
          <p style="margin:28px 0 0;color:#6A6A78;font-size:12px;line-height:1.6">If you did not request this, you can ignore this email — no changes have been made to your account. Never share this code with anyone, including someone claiming to be from LUMEN&amp;CO.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ── verification ────────────────────────────────────────────────────────────

export interface VerifiedOtp {
  destination: string;
  channel: OtpChannel;
  purpose: OtpPurpose;
  data: Record<string, unknown>;
}

/**
 * Verify a code against a challenge token.
 *
 * The token supplies the challenge id and destination, so neither is taken from
 * the request body — a client cannot claim to be verifying a different number
 * than the one the code was sent to.
 */
export async function verifyOtp(input: {
  challengeToken: string;
  code: string;
  purpose: OtpPurpose;
}): Promise<VerifiedOtp> {
  const claims = await verifyChallengeToken(input.challengeToken, `otp:${input.purpose}`);
  if (!claims?.cid || !claims.destination) {
    throw new OtpError('challenge_invalid', 'That verification session has expired. Request a new code.', {
      status: 400,
    });
  }

  const challenge = await db.otpChallenge.findUnique({ where: { id: claims.cid } });
  if (!challenge) {
    throw new OtpError('challenge_invalid', 'That verification session has expired. Request a new code.', {
      status: 400,
    });
  }
  if (challenge.consumedAt) {
    throw new OtpError('challenge_used', 'That code has already been used. Request a new one.', { status: 400 });
  }
  if (challenge.expiresAt.getTime() <= Date.now()) {
    throw new OtpError('challenge_expired', 'That code has expired. Request a new one.', { status: 400 });
  }
  if (challenge.destination !== claims.destination || challenge.purpose !== input.purpose) {
    throw new OtpError('challenge_mismatch', 'That verification session is not valid.', { status: 400 });
  }
  if (challenge.attempts >= challenge.maxAttempts) {
    throw new OtpError('too_many_attempts', 'Too many incorrect attempts. Request a new code.', { status: 429 });
  }

  const submitted = input.code.replace(/\D/g, '');
  const matches = safeEqual(hashToken(submitted), challenge.codeHash);

  if (!matches) {
    const updated = await db.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true, maxAttempts: true },
    });
    const left = Math.max(0, updated.maxAttempts - updated.attempts);
    // Burning the challenge on the last attempt is the point of counting: the
    // code stops being guessable rather than merely being reported as expired.
    if (left === 0) {
      await db.otpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });
      throw new OtpError('too_many_attempts', 'Too many incorrect attempts. Request a new code.', { status: 429 });
    }
    throw new OtpError(
      'code_incorrect',
      `That code is not right. ${left} attempt${left === 1 ? '' : 's'} left.`,
      { status: 400 },
    );
  }

  await db.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });

  return {
    destination: challenge.destination,
    channel: challenge.channel as OtpChannel,
    purpose: challenge.purpose as OtpPurpose,
    data: (claims.data as Record<string, unknown>) ?? {},
  };
}

/** Housekeeping — expired challenges carry no value and hold PII. */
export async function pruneExpiredOtps(olderThanHours = 24): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanHours * 3600_000);
  const result = await db.otpChallenge.deleteMany({ where: { expiresAt: { lt: cutoff } } });
  return result.count;
}
