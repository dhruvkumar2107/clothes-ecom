import { cookies, headers } from 'next/headers';
import { db } from '../db';
import { hashToken, deviceHash } from '../crypto';
import { addDays, clientIp } from '../utils';
import { signSessionToken, verifySessionToken, type Audience } from './jwt';
import { parsePermissions } from './permissions';

/**
 * Session lifecycle for customers and staff.
 *
 * The cookie carries a JWT; the JWT's `sid` points at a Session row that stores
 * `sha256(token)`. Both must agree for a request to be authenticated, which
 * gives three properties a bare JWT cannot:
 *
 *   • **Instant revocation.** Logout, a ban, or "sign out of all devices" sets
 *     `revokedAt` and the next request fails — no waiting for expiry.
 *   • **A device list.** Users can see and drop their own sessions.
 *   • **Theft containment.** The raw token is never stored, so a leaked database
 *     dump does not hand over live sessions.
 *
 * Staff sessions are a separate cookie with a separate audience. A customer
 * token presented to an admin route fails the audience check rather than being
 * merely unauthorised, so the two identity spaces cannot be confused even if a
 * route forgets its own guard.
 */

const CUSTOMER_COOKIE = 'lmn_session';
const STAFF_COOKIE = 'lmn_staff';

/**
 * 30 days for customers — a fashion store is browsed intermittently and forcing
 * a monthly re-login costs more in abandoned carts than it buys in security.
 * 12 hours for staff, because an admin session can move money and is far more
 * likely to be left open on a shared machine.
 */
const CUSTOMER_TTL_DAYS = 30;
const STAFF_TTL_HOURS = 12;

const BASE_COOKIE = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  // Secure is derived from the deployed URL rather than NODE_ENV: a staging
  // build served over https still needs it, and a local https proxy shouldn't
  // have to change the build.
  secure: (process.env.NEXT_PUBLIC_APP_URL ?? '').startsWith('https://'),
};

// ── request context ─────────────────────────────────────────────────────────

export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
  deviceHash: string;
}

export async function requestContext(): Promise<RequestContext> {
  const h = await headers();
  const userAgent = h.get('user-agent');
  const ip = clientIp(h);
  return {
    ip,
    userAgent,
    deviceHash: deviceHash({
      userAgent,
      acceptLanguage: h.get('accept-language'),
      ip,
    }),
  };
}

// ── customer sessions ───────────────────────────────────────────────────────

export interface CustomerSession {
  userId: string;
  sessionId: string;
  name: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  status: string;
  loyaltyTier: string;
  referralCode: string;
  currency: string;
  locale: string;
}

/** Mint a session row + cookie. Returns the raw token for non-cookie callers. */
export async function createCustomerSession(
  userId: string,
  ctx?: RequestContext,
): Promise<{ token: string; expiresAt: Date; sessionId: string }> {
  const context = ctx ?? (await requestContext());
  const expiresAt = addDays(new Date(), CUSTOMER_TTL_DAYS);

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, status: true },
  });
  if (!user) throw new Error('Cannot create a session for a user that does not exist');
  if (user.status === 'banned') throw new Error('This account has been suspended.');

  // The row is created first with a placeholder so its id can go inside the
  // JWT, then updated with the hash of the finished token. Two writes, but the
  // alternative is generating an id client-side and trusting it.
  const row = await db.session.create({
    data: {
      userId,
      tokenHash: `pending:${crypto.randomUUID()}`,
      ip: context.ip,
      userAgent: context.userAgent,
      deviceHash: context.deviceHash,
      expiresAt,
    },
    select: { id: true },
  });

  const token = await signSessionToken({
    userId,
    sessionId: row.id,
    audience: 'customer',
    expiresAt,
    name: user.name,
    email: user.email,
  });

  await db.session.update({
    where: { id: row.id },
    data: { tokenHash: hashToken(token) },
  });

  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });

  return { token, expiresAt, sessionId: row.id };
}

/** Create the session and write the cookie. Route handlers and server actions only. */
export async function loginCustomer(userId: string, ctx?: RequestContext): Promise<CustomerSession> {
  const { token, expiresAt } = await createCustomerSession(userId, ctx);
  const jar = await cookies();
  jar.set(CUSTOMER_COOKIE, token, { ...BASE_COOKIE, expires: expiresAt });
  const session = await getCustomerSession();
  if (!session) throw new Error('Session was created but could not be read back');
  return session;
}

/**
 * Resolve the current customer, or null.
 *
 * Every call hits the database. That is a deliberate choice over trusting the
 * JWT's claims: a banned user, a revoked session, or a changed email must take
 * effect on the *next* request, not in 30 days. The query is a single indexed
 * lookup and Next dedupes it per render pass.
 */
export async function getCustomerSession(): Promise<CustomerSession | null> {
  const jar = await cookies();
  const token = jar.get(CUSTOMER_COOKIE)?.value;
  const claims = await verifySessionToken(token, 'customer');
  if (!claims) return null;

  const row = await db.session.findUnique({
    where: { id: claims.sid },
    select: {
      id: true,
      tokenHash: true,
      expiresAt: true,
      revokedAt: true,
      userId: true,
      user: {
        select: {
          id: true, name: true, email: true, phone: true, photoUrl: true,
          status: true, loyaltyTier: true, referralCode: true, currency: true, locale: true,
        },
      },
    },
  });

  if (!row || row.revokedAt) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  // The sid could be swapped for another user's session id only by someone who
  // can forge the signature, but comparing the hash costs nothing and closes it.
  if (row.tokenHash !== hashToken(token!)) return null;
  if (row.userId !== claims.sub) return null;
  if (row.user.status === 'banned') return null;

  return {
    userId: row.user.id,
    sessionId: row.id,
    name: row.user.name,
    email: row.user.email,
    phone: row.user.phone,
    photoUrl: row.user.photoUrl,
    status: row.user.status,
    loyaltyTier: row.user.loyaltyTier,
    referralCode: row.user.referralCode,
    currency: row.user.currency,
    locale: row.user.locale,
  };
}

/** Throws instead of returning null — for routes that have no anonymous path. */
export async function requireCustomer(): Promise<CustomerSession> {
  const session = await getCustomerSession();
  if (!session) throw new AuthRequiredError();
  return session;
}

export async function logoutCustomer(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(CUSTOMER_COOKIE)?.value;
  if (token) {
    const claims = await verifySessionToken(token, 'customer');
    if (claims?.sid) {
      await db.session
        .update({ where: { id: claims.sid }, data: { revokedAt: new Date() } })
        .catch(() => undefined);
    }
  }
  jar.delete(CUSTOMER_COOKIE);
}

/** "Sign out everywhere" — optionally keeping the session making the request. */
export async function revokeAllCustomerSessions(
  userId: string,
  exceptSessionId?: string,
): Promise<number> {
  const result = await db.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

// ── staff sessions ──────────────────────────────────────────────────────────

export interface StaffSessionInfo {
  staffId: string;
  sessionId: string;
  name: string;
  email: string;
  photoUrl: string | null;
  roleId: string;
  roleName: string;
  roleSlug: string;
  permissions: string[];
}

export async function loginStaff(staffId: string, ctx?: RequestContext): Promise<StaffSessionInfo> {
  const context = ctx ?? (await requestContext());
  const expiresAt = new Date(Date.now() + STAFF_TTL_HOURS * 3600_000);

  const staff = await db.staffUser.findUnique({
    where: { id: staffId },
    select: { id: true, name: true, email: true, status: true, role: { select: { slug: true } } },
  });
  if (!staff) throw new Error('Unknown staff account');
  if (staff.status !== 'active') throw new Error('This staff account is suspended.');

  const row = await db.staffSession.create({
    data: {
      staffId,
      tokenHash: `pending:${crypto.randomUUID()}`,
      ip: context.ip,
      userAgent: context.userAgent,
      expiresAt,
    },
    select: { id: true },
  });

  const token = await signSessionToken({
    userId: staffId,
    sessionId: row.id,
    audience: 'staff',
    expiresAt,
    name: staff.name,
    email: staff.email,
    role: staff.role.slug,
  });

  await db.staffSession.update({ where: { id: row.id }, data: { tokenHash: hashToken(token) } });
  await db.staffUser.update({ where: { id: staffId }, data: { lastLoginAt: new Date() } });

  const jar = await cookies();
  jar.set(STAFF_COOKIE, token, { ...BASE_COOKIE, expires: expiresAt });

  const session = await getStaffSession();
  if (!session) throw new Error('Staff session was created but could not be read back');
  return session;
}

export async function getStaffSession(): Promise<StaffSessionInfo | null> {
  const jar = await cookies();
  const token = jar.get(STAFF_COOKIE)?.value;
  const claims = await verifySessionToken(token, 'staff');
  if (!claims) return null;

  const row = await db.staffSession.findUnique({
    where: { id: claims.sid },
    select: {
      id: true, tokenHash: true, expiresAt: true, revokedAt: true, staffId: true,
      staff: {
        select: {
          id: true, name: true, email: true, photoUrl: true, status: true,
          role: { select: { id: true, name: true, slug: true, permissionsCsv: true } },
        },
      },
    },
  });

  if (!row || row.revokedAt) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  if (row.tokenHash !== hashToken(token!)) return null;
  if (row.staffId !== claims.sub) return null;
  if (row.staff.status !== 'active') return null;

  return {
    staffId: row.staff.id,
    sessionId: row.id,
    name: row.staff.name,
    email: row.staff.email,
    photoUrl: row.staff.photoUrl,
    roleId: row.staff.role.id,
    roleName: row.staff.role.name,
    roleSlug: row.staff.role.slug,
    permissions: parsePermissions(row.staff.role.permissionsCsv),
  };
}

export async function logoutStaff(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(STAFF_COOKIE)?.value;
  if (token) {
    const claims = await verifySessionToken(token, 'staff');
    if (claims?.sid) {
      await db.staffSession
        .update({ where: { id: claims.sid }, data: { revokedAt: new Date() } })
        .catch(() => undefined);
    }
  }
  jar.delete(STAFF_COOKIE);
}

// ── errors ──────────────────────────────────────────────────────────────────

/**
 * Distinct classes so an API route can map them to 401 vs 403 without parsing
 * message strings, and so a page can redirect to the right place.
 */
export class AuthRequiredError extends Error {
  readonly status = 401;
  constructor(message = 'Please sign in to continue.') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  readonly permission?: string;
  constructor(message = 'You do not have permission to do that.', permission?: string) {
    super(message);
    this.name = 'ForbiddenError';
    this.permission = permission;
  }
}

export const COOKIE_NAMES = { customer: CUSTOMER_COOKIE, staff: STAFF_COOKIE } as const;
