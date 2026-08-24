import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

/**
 * JWT signing and verification.
 *
 * Two distinct token families, both HS256 over `AUTH_SECRET`:
 *
 *   • **Session tokens** — carried in an httpOnly cookie. The JWT is *not* the
 *     authority: its jti is stored hashed in the Session table and every request
 *     checks that row. That makes revocation instant (logout, ban, "sign out
 *     everywhere") instead of waiting for expiry, which is the whole reason for
 *     a DB-backed session in front of a stateless token.
 *
 *   • **Challenge tokens** — short-lived, stateless, and carry the *claim* being
 *     proven rather than an identity: "the holder of this token asked for an OTP
 *     to +9198…". They exist so the phone number and purpose don't have to be
 *     re-sent (and re-trusted) on the verify call. Nothing in the DB, because
 *     they are single-purpose and expire in minutes.
 *
 * Secret handling: an unset `AUTH_SECRET` throws at first use rather than
 * defaulting. A signing secret with a fallback value is not a secret, and the
 * failure it produces (tokens that verify across every deployment that shares
 * the default) is invisible until it is exploited.
 */

const ISSUER = 'lumenandco';

let cachedKey: Uint8Array | null = null;

function secret(): Uint8Array {
  if (cachedKey) return cachedKey;
  const raw = process.env.AUTH_SECRET?.trim();
  if (!raw) {
    throw new Error(
      'AUTH_SECRET is not set. Generate one with:\n' +
        '  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
    );
  }
  if (raw.length < 32) {
    throw new Error('AUTH_SECRET must be at least 32 characters to sign HS256 tokens safely.');
  }
  cachedKey = new TextEncoder().encode(raw);
  return cachedKey;
}

/** Test hook — after mutating process.env.AUTH_SECRET. */
export function resetAuthKey(): void {
  cachedKey = null;
}

// ── session tokens ──────────────────────────────────────────────────────────

export type Audience = 'customer' | 'staff';

export interface SessionClaims extends JWTPayload {
  sub: string;
  /** Session row id. The hash of the full token is what the row stores. */
  sid: string;
  aud: Audience;
  /** Denormalised for cheap UI reads; the DB is still the authority. */
  name?: string;
  email?: string | null;
  role?: string;
}

export async function signSessionToken(input: {
  userId: string;
  sessionId: string;
  audience: Audience;
  expiresAt: Date;
  name?: string;
  email?: string | null;
  role?: string;
}): Promise<string> {
  return new SignJWT({
    sid: input.sessionId,
    ...(input.name ? { name: input.name } : {}),
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(input.role ? { role: input.role } : {}),
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(input.userId)
    .setAudience(input.audience)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(Math.floor(input.expiresAt.getTime() / 1000))
    .sign(secret());
}

/**
 * Returns null on any failure — expired, wrong audience, bad signature,
 * malformed. Callers treat "no session" and "invalid session" identically, and
 * distinguishing them in a return value invites a caller to log the difference
 * somewhere an attacker can read.
 */
export async function verifySessionToken(
  token: string | undefined | null,
  audience: Audience,
): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience,
      algorithms: ['HS256'],
    });
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return null;
    return payload as SessionClaims;
  } catch {
    return null;
  }
}

// ── challenge tokens (OTP, reset, OAuth state) ──────────────────────────────

export interface ChallengeClaims extends JWTPayload {
  /** What this token authorises. */
  purpose: string;
  /** Phone, email, or an opaque reference depending on purpose. */
  destination?: string;
  /** OtpChallenge row id, when one exists. */
  cid?: string;
  /** Free-form payload — OAuth `next` path, pending signup fields. */
  data?: Record<string, unknown>;
}

export async function signChallengeToken(input: {
  purpose: string;
  destination?: string;
  challengeId?: string;
  data?: Record<string, unknown>;
  ttlSeconds?: number;
}): Promise<string> {
  const ttl = input.ttlSeconds ?? 900; // 15 minutes
  return new SignJWT({
    purpose: input.purpose,
    ...(input.destination ? { destination: input.destination } : {}),
    ...(input.challengeId ? { cid: input.challengeId } : {}),
    ...(input.data ? { data: input.data } : {}),
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setAudience('challenge')
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttl)
    .sign(secret());
}

/**
 * `expectedPurpose` is mandatory: without it, a token minted to prove "you own
 * this phone number for a *login*" could be replayed against the reset-password
 * endpoint. Purpose confusion is the classic way OTP flows get broken.
 */
export async function verifyChallengeToken(
  token: string | undefined | null,
  expectedPurpose: string,
): Promise<ChallengeClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: 'challenge',
      algorithms: ['HS256'],
    });
    if (payload.purpose !== expectedPurpose) return null;
    return payload as ChallengeClaims;
  } catch {
    return null;
  }
}
