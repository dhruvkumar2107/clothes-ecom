import { SignJWT, createRemoteJWKSet, jwtVerify, importPKCS8 } from 'jose';
import { randomToken } from '../crypto';

/**
 * Google and Apple sign-in, implemented directly against the providers.
 *
 * Both are OAuth 2.0 / OIDC authorization-code flows, and both are gated on
 * their credentials being present — `googleEnabled()` / `appleEnabled()` drive
 * whether the buttons render at all, so a fresh clone shows email and phone
 * login without dead buttons that 500 on click.
 *
 * The two differ in three ways that the code has to handle rather than abstract:
 *
 *   • **Apple has no client secret.** You mint a short-lived ES256 JWT signed
 *     with a .p8 private key, and it expires — so it is generated per request,
 *     not stored.
 *   • **Apple POSTs the callback** as `application/x-www-form-urlencoded`
 *     (because `response_mode=form_post` is required once you request scopes),
 *     and it sends the user's name *only on the very first authorization*, ever.
 *     If it is not captured then, it is not recoverable.
 *   • **Apple's email may be a private relay.** `@privaterelay.appleid.com`
 *     forwards mail but is per-app and cannot be matched against a Google
 *     account, so linking by email would silently create duplicate identities.
 *
 * State is a signed, self-contained token rather than a server-side row: it
 * carries the CSRF nonce and the post-login redirect, so no storage is needed
 * and a stale callback simply fails to verify.
 */

const GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS = new URL('https://www.googleapis.com/oauth2/v3/certs');

const APPLE_AUTH = 'https://appleid.apple.com/auth/authorize';
const APPLE_TOKEN = 'https://appleid.apple.com/auth/token';
const APPLE_JWKS = new URL('https://appleid.apple.com/auth/keys');

function env(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value && !value.startsWith('your_') ? value : undefined;
}

export function googleEnabled(): boolean {
  return Boolean(env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET'));
}

export function appleEnabled(): boolean {
  return Boolean(
    env('APPLE_CLIENT_ID') && env('APPLE_TEAM_ID') && env('APPLE_KEY_ID') && env('APPLE_PRIVATE_KEY'),
  );
}

export function enabledSocialProviders(): ('google' | 'apple')[] {
  const out: ('google' | 'apple')[] = [];
  if (googleEnabled()) out.push('google');
  if (appleEnabled()) out.push('apple');
  return out;
}

function appUrl(): string {
  return (env('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
}

export function redirectUri(provider: 'google' | 'apple'): string {
  return `${appUrl()}/api/auth/${provider}/callback`;
}

// ── state ───────────────────────────────────────────────────────────────────

export interface OAuthState {
  nonce: string;
  next: string;
  /** Referral code from the signup link, so social signups still get credited. */
  ref?: string;
}

/**
 * Signed with AUTH_SECRET via the same helper family as challenge tokens, so
 * there is one secret to rotate. 10 minutes is generous for a consent screen and
 * short enough that a leaked callback URL is not reusable.
 */
export async function encodeState(state: OAuthState): Promise<string> {
  const { signChallengeToken } = await import('./jwt');
  return signChallengeToken({
    purpose: 'oauth:state',
    data: state as unknown as Record<string, unknown>,
    ttlSeconds: 600,
  });
}

export async function decodeState(token: string | null | undefined): Promise<OAuthState | null> {
  if (!token) return null;
  const { verifyChallengeToken } = await import('./jwt');
  const claims = await verifyChallengeToken(token, 'oauth:state');
  const data = claims?.data as OAuthState | undefined;
  if (!data?.nonce) return null;
  return data;
}

export function newNonce(): string {
  return randomToken(16);
}

// ── shared shape ────────────────────────────────────────────────────────────

export interface SocialProfile {
  provider: 'google' | 'apple';
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
  /** True for @privaterelay.appleid.com — do not use for account linking. */
  isPrivateRelay: boolean;
}

export class OAuthError extends Error {
  readonly provider: string;
  constructor(provider: string, message: string) {
    super(message);
    this.name = 'OAuthError';
    this.provider = provider;
  }
}

// ── Google ──────────────────────────────────────────────────────────────────

export function googleAuthUrl(state: string, nonce: string): string {
  const params = new URLSearchParams({
    client_id: env('GOOGLE_CLIENT_ID')!,
    redirect_uri: redirectUri('google'),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    // `select_account` rather than the default: a shared machine otherwise
    // signs in whoever is already logged into Chrome, with no visible step.
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string, nonce: string): Promise<SocialProfile> {
  const response = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env('GOOGLE_CLIENT_ID')!,
      client_secret: env('GOOGLE_CLIENT_SECRET')!,
      redirect_uri: redirectUri('google'),
      grant_type: 'authorization_code',
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    id_token?: string;
    error_description?: string;
    error?: string;
  };

  if (!response.ok || !payload.id_token) {
    throw new OAuthError('google', payload.error_description ?? payload.error ?? 'Google sign-in failed.');
  }

  // Verifying the id_token rather than calling the userinfo endpoint: it is one
  // fewer round trip and it is the token whose nonce binds this response to the
  // request we started.
  const { payload: claims } = await jwtVerify(payload.id_token, createRemoteJWKSet(GOOGLE_JWKS), {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: env('GOOGLE_CLIENT_ID')!,
  });

  if (claims.nonce !== nonce) {
    throw new OAuthError('google', 'Sign-in could not be verified. Please try again.');
  }
  if (!claims.sub) throw new OAuthError('google', 'Google did not return an account id.');

  return {
    provider: 'google',
    providerAccountId: String(claims.sub),
    email: typeof claims.email === 'string' ? claims.email.toLowerCase() : null,
    emailVerified: claims.email_verified === true,
    name: typeof claims.name === 'string' ? claims.name : null,
    avatarUrl: typeof claims.picture === 'string' ? claims.picture : null,
    isPrivateRelay: false,
  };
}

// ── Apple ───────────────────────────────────────────────────────────────────

export function appleAuthUrl(state: string, nonce: string): string {
  const params = new URLSearchParams({
    client_id: env('APPLE_CLIENT_ID')!,
    redirect_uri: redirectUri('apple'),
    response_type: 'code id_token',
    scope: 'name email',
    state,
    nonce,
    // Mandatory once `name`/`email` scopes are requested — Apple refuses to send
    // the callback as a GET in that case.
    response_mode: 'form_post',
  });
  return `${APPLE_AUTH}?${params.toString()}`;
}

/**
 * Apple's "client secret" is an ES256 JWT signed with the .p8 key, valid for at
 * most 6 months. Generated per request at 5 minutes — there is no benefit to a
 * long-lived one and a short expiry limits what a leaked log line is worth.
 */
async function appleClientSecret(): Promise<string> {
  const raw = env('APPLE_PRIVATE_KEY')!;
  // Env files cannot hold real newlines, so the .p8 is stored with \n escapes.
  const pem = raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
  const key = await importPKCS8(pem.trim(), 'ES256');

  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: env('APPLE_KEY_ID')! })
    .setIssuer(env('APPLE_TEAM_ID')!)
    .setSubject(env('APPLE_CLIENT_ID')!)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 300)
    .sign(key);
}

export async function exchangeAppleCode(
  code: string,
  nonce: string,
  /** Apple sends this once, on first authorization only. */
  userJson?: string | null,
): Promise<SocialProfile> {
  const response = await fetch(APPLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env('APPLE_CLIENT_ID')!,
      client_secret: await appleClientSecret(),
      redirect_uri: redirectUri('apple'),
      grant_type: 'authorization_code',
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    id_token?: string;
    error?: string;
  };

  if (!response.ok || !payload.id_token) {
    throw new OAuthError('apple', appleErrorCopy(payload.error));
  }

  const { payload: claims } = await jwtVerify(payload.id_token, createRemoteJWKSet(APPLE_JWKS), {
    issuer: 'https://appleid.apple.com',
    audience: env('APPLE_CLIENT_ID')!,
  });

  if (claims.nonce !== nonce) {
    throw new OAuthError('apple', 'Sign-in could not be verified. Please try again.');
  }
  if (!claims.sub) throw new OAuthError('apple', 'Apple did not return an account id.');

  const email = typeof claims.email === 'string' ? claims.email.toLowerCase() : null;

  // The name arrives as a JSON blob in the form post, not in the token, and only
  // the first time. Missing here means the user has authorized before.
  let name: string | null = null;
  if (userJson) {
    try {
      const parsed = JSON.parse(userJson) as { name?: { firstName?: string; lastName?: string } };
      const parts = [parsed.name?.firstName, parsed.name?.lastName].filter(Boolean);
      if (parts.length) name = parts.join(' ');
    } catch {
      // Malformed blob is not worth failing a login over.
    }
  }

  return {
    provider: 'apple',
    providerAccountId: String(claims.sub),
    email,
    // `email_verified` arrives as the string "true" about as often as a boolean.
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
    name,
    avatarUrl: null,
    isPrivateRelay:
      claims.is_private_email === true ||
      claims.is_private_email === 'true' ||
      Boolean(email?.endsWith('@privaterelay.appleid.com')),
  };
}

function appleErrorCopy(error: string | undefined): string {
  switch (error) {
    case 'invalid_client':
      return 'Apple sign-in is misconfigured (invalid client). Check APPLE_CLIENT_ID and the .p8 key.';
    case 'invalid_grant':
      return 'That Apple sign-in link has already been used. Please try again.';
    default:
      return 'Apple sign-in failed. Please try again.';
  }
}
