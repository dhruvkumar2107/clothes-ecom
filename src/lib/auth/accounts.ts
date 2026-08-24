import { db, tx } from '../db';
import { deviceHash, randomToken, hashToken } from '../crypto';
import { generateReferralCode } from '../ids';
import { addHours, addMinutes, maskEmail, maskPhone } from '../utils';
import { getSetting } from '../settings';
import { getMailer } from '../adapters/registry';
import { ensureWallet } from '../wallet';
import { attributeSignup } from '../referral/attribution';
import type { OtpChannel } from '../enums';
import { assertPasswordAcceptable, hashPassword, needsRehash, verifyPassword } from './password';
import { issueOtp, normalizeDestination, verifyOtp, type IssuedOtp } from './otp';
import { requestContext, loginCustomer, type RequestContext } from './session';
import type { SocialProfile } from './oauth';

/**
 * Account lifecycle: signup, login, social linking, password reset.
 *
 * ── The identity model ─────────────────────────────────────────────────────
 *
 * A user is identified by email *or* phone, and may have both. Both are unique
 * and nullable, which produces the one rule everything here obeys: **a new
 * account is only ever created when neither identifier matches an existing one.**
 * Otherwise the flow attaches to the existing account. Getting this wrong is how
 * a customer ends up with two accounts, one holding their order history and the
 * other their wallet balance.
 *
 * ── Why enumeration is handled unevenly, on purpose ────────────────────────
 *
 * Password login and password reset do not reveal whether an account exists —
 * standard practice, and cheap to maintain. Signup *does*, because it has to: it
 * cannot both create an account and not tell you that it did. The mitigation is
 * that signup with an existing email does not leak whether that account has a
 * password, and both paths sit behind the OTP throttles.
 *
 * ── Social login and account linking ───────────────────────────────────────
 *
 * A verified email from Google links to an existing account with the same email.
 * An *unverified* one does not — otherwise anyone who can set a display email at
 * an identity provider can take over an account. Apple private-relay addresses
 * never link, because they are per-app and per-user: the same human signing in
 * again through a different app gets a different address, so treating one as an
 * identity is a bug that surfaces months later.
 */

export class AccountError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'AccountError';
    this.code = code;
    this.status = status;
  }
}

// ── signup ──────────────────────────────────────────────────────────────────

export interface SignupInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  password?: string | null;
  /** Referral code from a /join/[code] link or typed into the form. */
  referralCode?: string | null;
  locale?: string;
  currency?: string;
  /** True when the identifier was already proven by an OTP challenge. */
  emailVerified?: boolean;
  phoneVerified?: boolean;
  /** Opt-in captured on the signup form. */
  newsletter?: boolean;
}

export interface SignupResult {
  userId: string;
  name: string;
  referralCode: string;
  isNew: boolean;
  /** Coupon the referral rule grants the new customer, if any. */
  welcomeCoupon?: string | null;
  referrerName?: string;
}

export async function signup(input: SignupInput, ctx?: RequestContext): Promise<SignupResult> {
  const context = ctx ?? (await requestContext());

  const name = input.name.trim();
  if (name.length < 2) {
    throw new AccountError('invalid_name', 'Please tell us your name.');
  }

  const email = input.email ? normalizeEmail(input.email) : null;
  const phone = input.phone ? normalizeDestination('sms', input.phone) : null;
  if (!email && !phone) {
    throw new AccountError('no_identifier', 'An email address or phone number is required.');
  }
  if (email && !isEmail(email)) {
    throw new AccountError('invalid_email', 'That email address does not look right.');
  }

  if (input.password) {
    assertPasswordAcceptable(input.password, { email, name });
  }

  const existing = await findByIdentifier({ email, phone });
  if (existing) {
    // Deliberately does not say whether that account has a password — the
    // message is identical either way.
    throw new AccountError(
      'account_exists',
      email && existing.email === email
        ? `An account already uses ${maskEmail(email)}. Sign in instead.`
        : `An account already uses ${maskPhone(phone ?? '')}. Sign in instead.`,
      409,
    );
  }

  const referralCode = await generateReferralCode(name);
  const passwordHash = input.password ? await hashPassword(input.password) : null;
  const [defaultLocale, defaultCurrency] = await Promise.all([
    getSetting('store.defaultLocale'),
    getSetting('store.defaultCurrency'),
  ]);

  const user = await db.user.create({
    data: {
      name,
      email,
      phone,
      passwordHash,
      referralCode,
      emailVerifiedAt: email && input.emailVerified ? new Date() : null,
      phoneVerifiedAt: phone && input.phoneVerified ? new Date() : null,
      locale: input.locale ?? defaultLocale,
      currency: input.currency ?? defaultCurrency,
      signupIp: context.ip,
      signupDeviceHash: context.deviceHash,
      signupUserAgent: context.userAgent,
    },
    select: { id: true, name: true, referralCode: true },
  });

  await ensureWallet(user.id);

  const result: SignupResult = {
    userId: user.id,
    name: user.name,
    referralCode: user.referralCode,
    isNew: true,
  };

  if (input.referralCode?.trim()) {
    // Attribution never blocks the signup — see referral/attribution.ts. A
    // thrown error here would cost us the customer to protect a commission.
    const attribution = await attributeSignup({
      refereeId: user.id,
      code: input.referralCode,
      ip: context.ip,
      deviceHash: context.deviceHash,
      userAgent: context.userAgent,
    }).catch((error) => {
      console.error('[accounts] referral attribution failed:', error);
      return null;
    });

    if (attribution?.attributed) {
      result.welcomeCoupon = attribution.welcomeCoupon;
      result.referrerName = attribution.referrerName;
    }
  }

  if (input.newsletter && email) {
    await db.newsletterSubscriber
      .upsert({
        where: { email },
        create: { email, name, source: 'checkout', consentEmail: true },
        update: { consentEmail: true, status: 'subscribed', unsubscribedAt: null },
      })
      .catch(() => undefined);
  }

  return result;
}

// ── password login ──────────────────────────────────────────────────────────

export interface LoginResult {
  userId: string;
  name: string;
  sessionId: string;
  /**
   * No raw token here on purpose. `loginCustomer` sets the httpOnly cookie
   * itself, so handing the token back would only create somewhere else for it to
   * leak — a log line, a JSON response body, a client-side store.
   */
  loyaltyTier: string;
}

export async function loginWithPassword(input: {
  identifier: string;
  password: string;
}): Promise<LoginResult> {
  const identifier = input.identifier.trim();
  const looksLikePhone = /^[\d+\s()-]+$/.test(identifier);

  const user = await findByIdentifier(
    looksLikePhone
      ? { phone: normalizeDestination('sms', identifier) }
      : { email: normalizeEmail(identifier) },
  );

  // `verifyPassword` burns a comparison against a real dummy hash when the
  // stored hash is null, so an account without a password takes the same time as
  // a wrong password — otherwise response time reveals which accounts are
  // social-only.
  const ok = await verifyPassword(input.password, user?.passwordHash ?? null);
  if (!user || !ok) {
    throw new AccountError('invalid_credentials', 'That email or password is not right.', 401);
  }
  assertUsable(user);

  if (needsRehash(user.passwordHash)) {
    await db.user
      .update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(input.password) },
      })
      .catch(() => undefined);
  }

  const session = await loginCustomer(user.id);
  return {
    userId: user.id,
    name: user.name,
    sessionId: session.sessionId,
    loyaltyTier: session.loyaltyTier,
  };
}

// ── OTP login / signup ──────────────────────────────────────────────────────

/**
 * Start an OTP login.
 *
 * Does not reveal whether the destination has an account — the code goes out
 * either way, and the verify step decides between signing in and signing up. That
 * also makes the "continue with phone" button a single flow rather than forcing
 * the customer to know which one they are.
 */
export async function startOtpLogin(input: {
  channel: OtpChannel;
  destination: string;
  ip?: string | null;
}): Promise<IssuedOtp & { hasAccount: boolean }> {
  const destination = normalizeDestination(input.channel, input.destination);
  const existing = await findByIdentifier(
    input.channel === 'email' ? { email: destination } : { phone: destination },
  );

  const issued = await issueOtp({
    channel: input.channel,
    destination,
    purpose: 'login',
    ip: input.ip,
    data: { hasAccount: Boolean(existing) },
  });

  // Returned so the client knows whether to collect a name on the next screen,
  // not so it can skip the code. The code is still required either way.
  return { ...issued, hasAccount: Boolean(existing) };
}

export interface OtpLoginResult extends LoginResult {
  isNew: boolean;
}

/**
 * Complete an OTP login, creating the account if the destination is unknown.
 *
 * "Sign in or sign up" as one flow, which is what a phone-first Indian audience
 * expects. The name is required up front for a new account rather than after
 * verification: the code is single-use, so a missing name after a successful
 * verify would burn the code and force the customer to request another.
 */
export async function completeOtpLogin(input: {
  challengeToken: string;
  code: string;
  /** Required when the destination has no account yet. */
  name?: string;
  referralCode?: string | null;
  newsletter?: boolean;
}): Promise<OtpLoginResult> {
  const verified = await verifyOtp({
    challengeToken: input.challengeToken,
    code: input.code,
    purpose: 'login',
  });

  const isEmailChannel = verified.channel === 'email';
  const where = isEmailChannel
    ? { email: verified.destination }
    : { phone: verified.destination };

  let user = await findByIdentifier(where);
  let isNew = false;

  if (!user) {
    const name = input.name?.trim();
    if (!name || name.length < 2) {
      throw new AccountError(
        'name_required',
        'We need your name to finish setting up your account. Request a new code and enter your name with it.',
        422,
      );
    }

    const created = await signup({
      name,
      email: isEmailChannel ? verified.destination : null,
      phone: isEmailChannel ? null : verified.destination,
      emailVerified: isEmailChannel,
      phoneVerified: !isEmailChannel,
      referralCode: input.referralCode,
      newsletter: input.newsletter,
    });

    user = await db.user.findUniqueOrThrow({ where: { id: created.userId }, select: userSelect });
    isNew = true;
  } else {
    assertUsable(user);
    // The OTP proved control of the identifier, so stamp it verified. Cheap, and
    // it means a customer who signed up with an unverified email gets there
    // without a separate verification email.
    await db.user.update({
      where: { id: user.id },
      data: isEmailChannel ? { emailVerifiedAt: new Date() } : { phoneVerifiedAt: new Date() },
    });
  }

  const session = await loginCustomer(user.id);
  return {
    userId: user.id,
    name: user.name,
    sessionId: session.sessionId,
    loyaltyTier: session.loyaltyTier,
    isNew,
  };
}

// ── social login ────────────────────────────────────────────────────────────

export interface SocialLoginResult extends LoginResult {
  isNew: boolean;
  /** True when the provider was attached to an account that already existed. */
  linked: boolean;
}

export async function loginWithSocial(
  profile: SocialProfile,
  options: { referralCode?: string | null } = {},
): Promise<SocialLoginResult> {
  const context = await requestContext();

  // 1. The provider account is the strongest key. It is what the customer
  //    actually authenticated against, and it survives an email change at the
  //    provider — which an email-first lookup would not.
  const account = await db.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
      },
    },
    select: { userId: true },
  });

  if (account) {
    const user = await db.user.findUniqueOrThrow({
      where: { id: account.userId },
      select: userSelect,
    });
    assertUsable(user);
    const session = await loginCustomer(user.id);
    return {
      userId: user.id,
      name: user.name,
      sessionId: session.sessionId,
      loyaltyTier: session.loyaltyTier,
      isNew: false,
      linked: false,
    };
  }

  // 2. Link by email — but only a verified, non-relay one.
  const linkable =
    profile.email && profile.emailVerified && !profile.isPrivateRelay
      ? normalizeEmail(profile.email)
      : null;

  const existing = linkable ? await findByIdentifier({ email: linkable }) : null;

  if (existing) {
    assertUsable(existing);
    await db.account.create({
      data: {
        userId: existing.id,
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
        email: profile.email ?? null,
        displayName: profile.name ?? null,
        avatarUrl: profile.avatarUrl ?? null,
      },
    });
    if (!existing.emailVerifiedAt) {
      await db.user.update({ where: { id: existing.id }, data: { emailVerifiedAt: new Date() } });
    }
    const session = await loginCustomer(existing.id);
    return {
      userId: existing.id,
      name: existing.name,
      sessionId: session.sessionId,
      loyaltyTier: session.loyaltyTier,
      isNew: false,
      linked: true,
    };
  }

  // 3. A new account. A private-relay address is still stored — we need
  //    somewhere to send order confirmations, and Apple's forwarding works fine
  //    for that. It is only unsuitable as a *linking* key.
  const name = profile.name?.trim() || 'LUMEN Member';
  const referralCode = await generateReferralCode(name);

  const user = await tx(async (client) => {
    const created = await client.user.create({
      data: {
        name,
        email: profile.email ? normalizeEmail(profile.email) : null,
        emailVerifiedAt: profile.emailVerified ? new Date() : null,
        photoUrl: profile.avatarUrl ?? null,
        referralCode,
        signupIp: context.ip,
        signupDeviceHash: context.deviceHash,
        signupUserAgent: context.userAgent,
      },
      select: userSelect,
    });

    await client.account.create({
      data: {
        userId: created.id,
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
        email: profile.email ?? null,
        displayName: profile.name ?? null,
        avatarUrl: profile.avatarUrl ?? null,
      },
    });

    return created;
  });

  await ensureWallet(user.id);

  if (options.referralCode?.trim()) {
    await attributeSignup({
      refereeId: user.id,
      code: options.referralCode,
      ip: context.ip,
      deviceHash: context.deviceHash,
      userAgent: context.userAgent,
    }).catch(() => null);
  }

  const session = await loginCustomer(user.id);
  return {
    userId: user.id,
    name: user.name,
    sessionId: session.sessionId,
    loyaltyTier: session.loyaltyTier,
    isNew: true,
    linked: false,
  };
}

/** Detach a social provider. Refused if it is the only way back in. */
export async function unlinkSocial(userId: string, provider: string): Promise<void> {
  const [user, accounts] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true, phone: true },
    }),
    db.account.findMany({ where: { userId }, select: { id: true, provider: true } }),
  ]);

  const remaining = accounts.filter((a) => a.provider !== provider);
  const hasOtherRoute = Boolean(user.passwordHash) || Boolean(user.phone) || remaining.length > 0;
  if (!hasOtherRoute) {
    throw new AccountError(
      'last_login_method',
      'Set a password or add a phone number before removing this sign-in method.',
    );
  }

  await db.account.deleteMany({ where: { userId, provider } });
}

// ── password reset ──────────────────────────────────────────────────────────

const RESET_TTL_HOURS = 2;

/**
 * Begin a reset by emailed link.
 *
 * Always reports success, whether or not the address is known. The response is
 * identical either way, so the endpoint cannot be used to enumerate customers.
 */
export async function requestPasswordReset(email: string): Promise<{ sent: boolean }> {
  const normalized = normalizeEmail(email);
  const user = await db.user.findUnique({
    where: { email: normalized },
    select: { id: true, name: true, email: true, status: true },
  });

  if (!user || !user.email || user.status === 'banned') return { sent: true };

  // Invalidate outstanding tokens. Two live reset links means the one in an old,
  // forwarded email still works.
  await db.passwordReset.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = randomToken(32);
  await db.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: addHours(new Date(), RESET_TTL_HOURS),
    },
  });

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const link = `${base}/reset-password?token=${token}`;

  await getMailer()
    .send({
      to: user.email,
      subject: 'Reset your LUMEN&CO password',
      html: resetEmail(user.name, link),
      text: `Reset your password: ${link}\n\nThis link works once and expires in ${RESET_TTL_HOURS} hours.`,
      template: 'password_reset',
    })
    .catch((error) => {
      console.error('[accounts] reset email failed:', error);
    });

  return { sent: true };
}

/** Reset by OTP instead of a link — the only route for a phone-only account. */
export async function requestPasswordResetOtp(input: {
  channel: OtpChannel;
  destination: string;
  ip?: string | null;
}): Promise<IssuedOtp> {
  return issueOtp({
    channel: input.channel,
    destination: input.destination,
    purpose: 'reset',
    ip: input.ip,
  });
}

export async function resetPasswordWithToken(input: {
  token: string;
  password: string;
}): Promise<{ userId: string }> {
  const record = await db.passwordReset.findUnique({
    where: { tokenHash: hashToken(input.token) },
    select: { id: true, userId: true, usedAt: true, expiresAt: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AccountError(
      'invalid_token',
      'That reset link has expired or has already been used. Request a new one.',
      410,
    );
  }

  const user = await db.user.findUniqueOrThrow({
    where: { id: record.userId },
    select: { id: true, email: true, name: true },
  });
  assertPasswordAcceptable(input.password, { email: user.email, name: user.name });

  await applyNewPassword(user.id, input.password, record.id);
  return { userId: user.id };
}

export async function resetPasswordWithOtp(input: {
  challengeToken: string;
  code: string;
  password: string;
}): Promise<{ userId: string }> {
  const verified = await verifyOtp({
    challengeToken: input.challengeToken,
    code: input.code,
    purpose: 'reset',
  });

  const user = await findByIdentifier(
    verified.channel === 'email'
      ? { email: verified.destination }
      : { phone: verified.destination },
  );
  if (!user) {
    // Reachable only if the account was deleted between issue and verify.
    throw new AccountError('no_account', 'No account uses that number.', 404);
  }

  assertPasswordAcceptable(input.password, { email: user.email, name: user.name });
  await applyNewPassword(user.id, input.password);
  return { userId: user.id };
}

/**
 * Write the new hash and revoke every session.
 *
 * The revocation is the important half. A password reset that leaves the
 * attacker's existing session alive has achieved nothing — and the DB-backed
 * session design exists precisely so this takes effect on their next request
 * rather than in thirty days.
 */
async function applyNewPassword(
  userId: string,
  password: string,
  resetId?: string,
): Promise<void> {
  const hash = await hashPassword(password);

  await tx(async (client) => {
    await client.user.update({ where: { id: userId }, data: { passwordHash: hash } });
    await client.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (resetId) {
      await client.passwordReset.update({ where: { id: resetId }, data: { usedAt: new Date() } });
    } else {
      await client.passwordReset.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      });
    }
  });
}

/** Change a password while signed in. Requires the current one, if there is one. */
export async function changePassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: input.userId },
    select: { id: true, email: true, name: true, passwordHash: true },
  });

  // A social-only account setting its first password has no current one to give.
  if (user.passwordHash) {
    const ok = await verifyPassword(input.currentPassword, user.passwordHash);
    if (!ok) throw new AccountError('wrong_password', 'That is not your current password.', 401);
  }

  assertPasswordAcceptable(input.newPassword, { email: user.email, name: user.name });
  await applyNewPassword(user.id, input.newPassword);
}

// ── profile ─────────────────────────────────────────────────────────────────

export interface ProfileUpdate {
  name?: string;
  photoUrl?: string | null;
  gender?: string | null;
  dateOfBirth?: Date | null;
  locale?: string;
  currency?: string;
}

export async function updateProfile(userId: string, input: ProfileUpdate): Promise<void> {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 2) throw new AccountError('invalid_name', 'Please enter your name.');
    data.name = name;
  }
  if (input.photoUrl !== undefined) data.photoUrl = input.photoUrl;
  if (input.gender !== undefined) data.gender = input.gender;
  if (input.dateOfBirth !== undefined) data.dateOfBirth = input.dateOfBirth;
  if (input.locale !== undefined) data.locale = input.locale;
  if (input.currency !== undefined) data.currency = input.currency;

  if (Object.keys(data).length === 0) return;
  await db.user.update({ where: { id: userId }, data });
}

/**
 * Change the email or phone on an account — always behind an OTP.
 *
 * The verification is on the *new* address, not the old one. Proving control of
 * the destination is the whole point: an unverified change lets anyone who
 * borrows a signed-in session point the account's password resets at their own
 * inbox.
 */
export async function startIdentifierChange(input: {
  userId: string;
  channel: OtpChannel;
  destination: string;
  ip?: string | null;
}): Promise<IssuedOtp> {
  const destination = normalizeDestination(input.channel, input.destination);

  const clash = await findByIdentifier(
    input.channel === 'email' ? { email: destination } : { phone: destination },
  );
  if (clash && clash.id !== input.userId) {
    throw new AccountError('in_use', 'Another account already uses that.', 409);
  }

  return issueOtp({
    channel: input.channel,
    destination,
    purpose: input.channel === 'email' ? 'verify_email' : 'verify_phone',
    ip: input.ip,
    data: { userId: input.userId },
  });
}

export async function completeIdentifierChange(input: {
  userId: string;
  challengeToken: string;
  code: string;
  channel: OtpChannel;
}): Promise<{ field: 'email' | 'phone'; value: string }> {
  const verified = await verifyOtp({
    challengeToken: input.challengeToken,
    code: input.code,
    purpose: input.channel === 'email' ? 'verify_email' : 'verify_phone',
  });

  // The challenge carries the user it was issued for. Checking it stops a
  // verified code from being replayed against a different signed-in account.
  if (verified.data.userId && verified.data.userId !== input.userId) {
    throw new AccountError('wrong_account', 'That code was issued for another account.', 403);
  }

  const isEmailChannel = verified.channel === 'email';

  // Re-checked after verification, because someone else may have claimed the
  // identifier during the ten minutes the code was live.
  const clash = await findByIdentifier(
    isEmailChannel ? { email: verified.destination } : { phone: verified.destination },
  );
  if (clash && clash.id !== input.userId) {
    throw new AccountError('in_use', 'Another account already uses that.', 409);
  }

  await db.user.update({
    where: { id: input.userId },
    data: isEmailChannel
      ? { email: verified.destination, emailVerifiedAt: new Date() }
      : { phone: verified.destination, phoneVerifiedAt: new Date() },
  });

  return { field: isEmailChannel ? 'email' : 'phone', value: verified.destination };
}

// ── helpers ─────────────────────────────────────────────────────────────────

const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  passwordHash: true,
  status: true,
  banReason: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
} as const;

type AccountUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  passwordHash: string | null;
  status: string;
  banReason: string | null;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
};

async function findByIdentifier(where: {
  email?: string | null;
  phone?: string | null;
}): Promise<AccountUser | null> {
  const or: Array<{ email: string } | { phone: string }> = [];
  if (where.email) or.push({ email: where.email });
  if (where.phone) or.push({ phone: where.phone });
  if (or.length === 0) return null;

  return db.user.findFirst({ where: { OR: or }, select: userSelect });
}

function assertUsable(user: { status: string; banReason: string | null }): void {
  if (user.status === 'banned') {
    throw new AccountError(
      'banned',
      user.banReason
        ? `This account has been suspended: ${user.banReason}`
        : 'This account has been suspended. Please contact support.',
      403,
    );
  }
  // `flagged` deliberately still signs in. Flagging is an internal review state;
  // locking the customer out turns a quiet investigation into a support
  // escalation, and the gates that matter — withdrawal, commission release —
  // check the flag directly.
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/** Fingerprint helper for callers outside a request context (scripts, seeds). */
export function fingerprint(userAgent?: string | null, ip?: string | null): string {
  return deviceHash({ userAgent, ip });
}

/** Housekeeping — drop reset tokens that can no longer be used. */
export async function pruneExpiredResets(): Promise<number> {
  const cutoff = addMinutes(new Date(), -60);
  const result = await db.passwordReset.deleteMany({
    where: { OR: [{ expiresAt: { lt: cutoff } }, { usedAt: { lt: cutoff } }] },
  });
  return result.count;
}

function resetEmail(name: string, link: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0A0A0F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0F;padding:40px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#12121A;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden">
        <tr><td style="padding:36px 36px 8px">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:0.16em;color:#F4F4F6">LUMEN&amp;CO</div>
          <div style="height:2px;width:52px;margin-top:8px;background:linear-gradient(90deg,#8B5CF6,#2DD4BF)"></div>
        </td></tr>
        <tr><td style="padding:24px 36px 0">
          <h1 style="margin:0 0 12px;font-size:24px;font-weight:600;color:#F4F4F6">Reset your password</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#9A9AA8">
            Hi ${escapeHtml(name.split(/\s+/)[0])}, use the button below to set a new password.
            It works once, and expires in ${RESET_TTL_HOURS} hours.
          </p>
          <a href="${link}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:linear-gradient(90deg,#8B5CF6,#2DD4BF);color:#0A0A0F;font-size:15px;font-weight:600;text-decoration:none">Choose a new password</a>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6C6C7A">
            Didn't ask for this? You can ignore this email — nothing has changed, and your
            current password still works.
          </p>
        </td></tr>
        <tr><td style="padding:28px 36px 36px">
          <div style="height:1px;background:rgba(255,255,255,0.08);margin-bottom:16px"></div>
          <p style="margin:0;font-size:12px;color:#4E4E5C">LUMEN AND CO PVT LTD · light as couture</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
