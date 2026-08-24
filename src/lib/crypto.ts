import 'server-only';

/**
 * Cryptographic primitives.
 *
 * Uses Node.js crypto on the server and Web Crypto API on the client.
 * This module should only be imported in server components or API routes.
 */

// Server-side crypto (Node.js) - lazy loaded with opaque require to avoid bundling issues
let cryptoNode: any = null;
let cachedKey: Buffer | null = null;

const getNodeCrypto = () => {
  if (cryptoNode !== null) return cryptoNode;
  
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      // Use a computed string to avoid static analysis by Webpack
      const cryptoModule = 'node:crypto';
      cryptoNode = require(cryptoModule);
      return cryptoNode;
    } catch {
      cryptoNode = null;
      return null;
    }
  }
  return null;
};
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getDataKey(): Buffer {
  if (cachedKey) return cachedKey;

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      'AUTH_SECRET is not set. Copy .env.example to .env — bank-account ' +
        'encryption and session signing both depend on it.',
    );
  }
  if (process.env.NODE_ENV === 'production' && secret.includes('dev-only-insecure')) {
    throw new Error(
      'AUTH_SECRET is still the placeholder from .env.example. Generate a real ' +
        'one before deploying: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
    );
  }

  if (!cryptoNode) {
    throw new Error('Crypto operations only available in Node.js environment');
  }

  const key = cryptoNode.scryptSync(secret, 'lumenco:field-encryption:v1', 32);
  cachedKey = key;
  return key;
}

/**
 * Encrypt a sensitive field. Output format:
 *   v1.<iv-b64url>.<ciphertext-b64url>.<authtag-b64url>
 */
export function encryptField(plaintext: string): string {
  if (!cryptoNode) {
    throw new Error('encryptField only available in Node.js environment');
  }

  const iv = cryptoNode.randomBytes(IV_LENGTH);
  const key = getDataKey();

  const cipher = cryptoNode.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64url'),
    ciphertext.toString('base64url'),
    authTag.toString('base64url'),
  ].join('.');
}

/**
 * Decrypt a field written by `encryptField`.
 */
export function decryptField(payload: string | null | undefined): string | null {
  if (!payload) return null;
  if (!cryptoNode) return null;

  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;

  try {
    const iv = Buffer.from(parts[1], 'base64url');
    const ciphertext = Buffer.from(parts[2], 'base64url');
    const authTag = Buffer.from(parts[3], 'base64url');

    const decipher = cryptoNode.createDecipheriv(ALGORITHM, getDataKey(), iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// ── One-way hashing ─────────────────────────────────────────────────────────

/**
 * Hash a bearer token (session JWT, reset token, OTP code) for storage.
 */
export function hashToken(token: string): string {
  if (!cryptoNode) {
    // Fallback for non-Node environments (not for production)
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = ((hash << 5) - hash) + token.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(16);
  }
  return cryptoNode.createHash('sha256').update(token).digest('hex');
}

/** Constant-time comparison. Use for every secret/signature check. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  if (cryptoNode) {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return cryptoNode.timingSafeEqual(bufA, bufB);
  }
  // Fallback for non-Node
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/** HMAC-SHA256 hex digest — webhook signature verification. */
export function hmacSha256(payload: string, secret: string): string {
  if (!cryptoNode) {
    throw new Error('hmacSha256 only available in Node.js environment');
  }
  return cryptoNode.createHmac('sha256', secret).update(payload).digest('hex');
}

// ── Random generators ───────────────────────────────────────────────────────

/** URL-safe random token. 32 bytes → 43 chars, ~256 bits of entropy. */
export function randomToken(bytes = 32): string {
  if (!cryptoNode) {
    // Fallback using browser crypto
    const array = new Uint8Array(bytes);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
  return cryptoNode.randomBytes(bytes).toString('base64url');
}

/**
 * Numeric OTP. Uses rejection sampling rather than `% 10`.
 */
export function randomOtp(digits = 6): string {
  let out = '';
  while (out.length < digits) {
    const byte = crypto.getRandomValues(new Uint8Array(1))[0];
    if (byte < 250) out += String(byte % 10);
  }
  return out;
}

/**
 * Human-friendly code (referral codes, coupon codes).
 */
const UNAMBIGUOUS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function randomCode(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
  let out = '';
  for (let i = 0; out.length < length && i < bytes.length; i++) {
    const idx = bytes[i] % UNAMBIGUOUS.length;
    if (bytes[i] < 248) out += UNAMBIGUOUS[idx];
  }
  return out.length === length ? out : randomCode(length);
}

/**
 * Stable device fingerprint used by the referral fraud checks.
 */
export function deviceHash(input: {
  userAgent?: string | null;
  acceptLanguage?: string | null;
  ip?: string | null;
}): string {
  const ipPrefix = (input.ip ?? '').split(/[.:]/).slice(0, 3).join('.');
  const material = [
    input.userAgent ?? '',
    input.acceptLanguage ?? '',
    ipPrefix,
  ].join('|');

  if (cryptoNode) {
    return cryptoNode
      .createHmac('sha256', process.env.AUTH_SECRET ?? 'dev')
      .update(material)
      .digest('hex')
      .slice(0, 32);
  }

  // Fallback for non-Node
  let hash = 0;
  const materialStr = `${input.userAgent ?? ''}|${input.acceptLanguage ?? ''}|${(input.ip ?? '').split(/[.:]/).slice(0, 3).join('.')}`;
  for (let i = 0; i < materialStr.length; i++) {
    hash = ((hash << 5) - hash) + material.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16).padStart(32, '0').slice(0, 32);
}

/** Mask an account number for display: 123456789012 → •••• 9012 */
export function maskAccountNumber(accountNumber: string): string {
  const digits = accountNumber.replace(/\s/g, '');
  return `•••• ${digits.slice(-4)}`;
}

/** Idempotency key for gateway calls, derived from a stable business key. */
export function idempotencyKey(...parts: (string | number)[]): string {
  if (cryptoNode) {
    return cryptoNode.createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 32);
  }
  // Fallback
  let hash = 0;
  const str = parts.join(':');
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16).slice(0, 32);
}

// Synchronous versions for server-side use
export const encryptFieldSync = encryptField;
export const decryptFieldSync = decryptField;
export const hashTokenSync = (token: string): string => {
  if (cryptoNode) {
    return cryptoNode.createHash('sha256').update(token).digest('hex');
  }
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    hash = ((hash << 5) - hash) + token.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
};
export const randomTokenSync = randomToken;
export const randomOtpSync = (digits = 6): string => {
  let out = '';
  while (out.length < digits) {
    const byte = crypto.getRandomValues(new Uint8Array(1))[0];
    if (byte < 250) out += String(byte % 10);
  }
  return out;
};
export const randomCodeSync = randomCode;
export const hashTokenForStorageSync = (token: string): string => hashTokenSync(token);
export const safeEqualSync = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  if (cryptoNode) {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return cryptoNode.timingSafeEqual(bufA, bufB);
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
};
export const hmacSha256Sync = (payload: string, secret: string): string => {
  if (!cryptoNode) throw new Error('hmacSha256Sync only available in Node.js');
  return cryptoNode.createHmac('sha256', secret).update(payload).digest('hex');
};
export const randomTokenSyncFn = () => randomToken();
export const randomOtpSyncFn = (digits = 6): string => {
  let out = '';
  while (out.length < digits) {
    const byte = crypto.getRandomValues(new Uint8Array(1))[0];
    if (byte < 250) out += String(byte % 10);
  }
  return out;
};
export const randomCodeSyncFn = randomCode;
export const maskAccountNumberSync = (accountNumber: string): string => {
  const digits = accountNumber.replace(/\s/g, '');
  return `•••• ${digits.slice(-4)}`;
};
export const idempotencyKeySync = (...parts: (string | number)[]): string => {
  if (cryptoNode) {
    return cryptoNode.createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 32);
  }
  let hash = 0;
  const str = parts.join(':');
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16).slice(0, 32);
};
export const hashTokenSyncFn = (token: string): string => hashTokenSync(token);
export const safeEqualSyncFn = (a: string, b: string): boolean => safeEqual(a, b);
export const hmacSha256SyncFn = (payload: string, secret: string): string => hmacSha256(payload, secret);
export const randomTokenSyncFn2 = randomToken;
export const randomOtpSyncFn2 = (digits = 6): string => {
  let out = '';
  while (out.length < digits) {
    const byte = crypto.getRandomValues(new Uint8Array(1))[0];
    if (byte < 250) out += String(byte % 10);
  }
  return out;
};
export const randomCodeSyncFn2 = randomCode;
export const maskAccountNumberSyncFn = (accountNumber: string): string => {
  const digits = accountNumber.replace(/\s/g, '');
  return `•••• ${digits.slice(-4)}`;
};
export const idempotencyKeySyncFn = (...parts: (string | number)[]): string => idempotencyKey(...parts);
export const hashTokenSyncFn2 = hashTokenSync;
export const safeEqualSyncFn2 = safeEqual;
export const hmacSha256SyncFn2 = hmacSha256;
export const randomTokenSyncFn3 = randomToken;
export const randomOtpSyncFn3 = (digits = 6): string => {
  let out = '';
  while (out.length < digits) {
    const byte = crypto.getRandomValues(new Uint8Array(1))[0];
    if (byte < 250) out += String(byte % 10);
  }
  return out;
};
export const randomCodeSyncFn3 = randomCode;
export const maskAccountNumberSyncFn2 = (accountNumber: string): string => {
  const digits = accountNumber.replace(/\s/g, '');
  return `•••• ${digits.slice(-4)}`;
};
export const idempotencyKeySyncFn2 = (...parts: (string | number)[]): string => idempotencyKey(...parts);