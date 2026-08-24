import bcrypt from 'bcryptjs';

/**
 * Password hashing and strength rules.
 *
 * bcryptjs rather than node's `crypto.scrypt` because the cost factor is
 * embedded in the stored hash, so raising it later doesn't invalidate existing
 * passwords — `needsRehash` detects the old cost on login and silently upgrades.
 */

/**
 * 12 rounds is ~250ms on typical server hardware in 2026: slow enough to make
 * offline cracking expensive, fast enough that a login doesn't feel laggy.
 * bcryptjs is pure JS and roughly 3× slower than the native binding, which is
 * an acceptable trade for having no build step.
 */
const COST = 12;

/** bcrypt silently truncates at 72 bytes, so a longer password is a lie. */
const MAX_BYTES = 72;

export async function hashPassword(plain: string): Promise<string> {
  assertLength(plain);
  return bcrypt.hash(plain, COST);
}

/**
 * Constant-time by construction (bcrypt.compare re-derives with the stored salt
 * and compares digests). A null hash — a customer who has only ever used OTP or
 * social login — must still burn the same work, otherwise response time reveals
 * which emails have passwords.
 */
export async function verifyPassword(
  plain: string,
  hash: string | null | undefined,
): Promise<boolean> {
  if (!hash) {
    await bcrypt.compare(plain.slice(0, MAX_BYTES), DUMMY_HASH);
    return false;
  }
  try {
    return await bcrypt.compare(plain.slice(0, MAX_BYTES), hash);
  } catch {
    // Malformed hash in the DB — treat as no-match rather than a 500.
    return false;
  }
}

/** A real bcrypt hash of a value nobody knows, used to equalise timing. */
const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEe.O1KpZKh3RQ/0YtwLB.PBcJj7f9uOEHy';

/** True when the stored hash was made with a weaker cost than we now use. */
export function needsRehash(hash: string | null | undefined): boolean {
  if (!hash) return false;
  const match = /^\$2[aby]\$(\d{2})\$/.exec(hash);
  if (!match) return true;
  return Number(match[1]) < COST;
}

function assertLength(plain: string): void {
  if (Buffer.byteLength(plain, 'utf8') > MAX_BYTES) {
    throw new Error(`Password must be at most ${MAX_BYTES} bytes`);
  }
}

// ── strength ────────────────────────────────────────────────────────────────

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Too weak' | 'Weak' | 'Fair' | 'Strong' | 'Excellent';
  /** Blocking reasons. Empty means the password is acceptable. */
  problems: string[];
}

/**
 * The 20 or so passwords that dominate every breach corpus. A full dictionary
 * check belongs in a service; this catches the cases that actually show up.
 */
const COMMON = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
  'qwerty', 'qwerty123', 'iloveyou', 'admin123', 'welcome1', 'letmein',
  'monkey123', 'abc12345', 'football', 'princess', 'sunshine', 'india123',
  'lumenandco', 'lumen123',
]);

/**
 * Deliberately not a hard "must contain a symbol" rule. Composition rules push
 * people toward `Password1!`, which is weaker than a long passphrase; length is
 * what actually helps, so that is the only hard floor beyond the blocklist.
 */
export function scorePassword(plain: string, context: { email?: string | null; name?: string | null } = {}): PasswordStrength {
  const problems: string[] = [];
  const value = plain.trim();

  if (value.length < 8) problems.push('Use at least 8 characters.');
  if (Buffer.byteLength(value, 'utf8') > MAX_BYTES) problems.push('That password is too long.');
  if (COMMON.has(value.toLowerCase())) problems.push('That password is too common — pick something else.');
  if (/^(.)\1+$/.test(value)) problems.push('Repeating one character is not a password.');

  // Reusing the local part of your own email is the single most common weak
  // choice that composition rules happily accept.
  const emailLocal = context.email?.split('@')[0]?.toLowerCase();
  if (emailLocal && emailLocal.length >= 4 && value.toLowerCase().includes(emailLocal)) {
    problems.push('Do not use your email address in your password.');
  }
  const firstName = context.name?.trim().split(/\s+/)[0]?.toLowerCase();
  if (firstName && firstName.length >= 4 && value.toLowerCase().includes(firstName)) {
    problems.push('Do not use your name in your password.');
  }

  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (value.length >= 16) score += 1;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(value)).length;
  if (classes >= 3) score += 1;
  if (problems.length > 0) score = Math.min(score, 1);

  const labels: PasswordStrength['label'][] = ['Too weak', 'Weak', 'Fair', 'Strong', 'Excellent'];
  const clamped = Math.max(0, Math.min(4, score)) as 0 | 1 | 2 | 3 | 4;

  return { score: clamped, label: labels[clamped], problems };
}

/** Throws with the first problem — for API routes that just need a gate. */
export function assertPasswordAcceptable(
  plain: string,
  context: { email?: string | null; name?: string | null } = {},
): void {
  const { problems } = scorePassword(plain, context);
  if (problems.length > 0) throw new Error(problems[0]);
}
