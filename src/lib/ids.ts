import { db, tx, type DbClient } from './db';
import { randomCode, randomCodeSyncFn } from './crypto';

/**
 * Generate a simple random ID (cuid-like).
 * Used for generating unique IDs for various entities.
 */
export function generateId(): string {
  // Use a combination of timestamp and random code for uniqueness
  const timestamp = Date.now().toString(36);
  const randomPart = randomCodeSyncFn(12);
  return `${timestamp}${randomPart}`;
}

/**
 * Human-facing identifiers.
 *
 * Two different guarantees are needed here, and conflating them is a compliance
 * problem:
 *
 *   • Order / return / withdrawal numbers need to be *unique and unguessable-ish*.
 *     Gaps are fine. They embed a date for support legibility.
 *
 *   • Invoice numbers must be **gapless and strictly sequential per financial
 *     year** — that is a statutory requirement under Indian GST rules (Rule 46).
 *     A missing number in a series is something a tax officer asks about, so
 *     these come from a transactional counter, never from a random generator,
 *     and a failed order must not consume one.
 */

// ── Sequence counter ────────────────────────────────────────────────────────

/**
 * Atomically increment a named counter and return the new value.
 *
 * Correctness rests on running inside a transaction: SQLite serialises writers,
 * so the read-modify-write can't interleave. On Postgres this same code is safe
 * because the `update` takes a row lock for the duration of the transaction.
 */
async function nextSequence(client: DbClient, key: string, start = 1): Promise<number> {
  const existing = await client.setting.findUnique({ where: { key } });

  if (!existing) {
    await client.setting.create({
      data: {
        key,
        value: String(start),
        valueType: 'number',
        group: 'sequences',
        label: `Sequence: ${key}`,
        description: 'Internal counter. Do not edit — invoice numbering depends on it.',
      },
    });
    return start;
  }

  const next = Number.parseInt(existing.value, 10) + 1;
  await client.setting.update({ where: { key }, data: { value: String(next) } });
  return next;
}

// ── Financial year ──────────────────────────────────────────────────────────

/**
 * Indian financial year runs 1 April → 31 March. April 2026 is FY 2026-27;
 * March 2026 is FY 2025-26.
 */
export function financialYear(date = new Date()): string {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? year : year - 1; // month is 0-indexed
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

/** Compact FY token for embedding in identifiers: "2026-27" → "2627". */
function fyToken(date = new Date()): string {
  return financialYear(date).replace('-', '').slice(2);
}

// ── Order numbers ───────────────────────────────────────────────────────────

/**
 * `LMN-2627-004821`
 *
 * Prefix + financial year + zero-padded per-FY counter. Sequential enough to
 * sort naturally in the admin, and the FY segment keeps the counter from
 * growing unboundedly across years.
 */
export async function generateOrderNumber(client: DbClient = db): Promise<string> {
  const prefix = process.env.INVOICE_PREFIX || 'LMN';
  const fy = fyToken();
  const seq = await nextSequence(client, `seq:order:${fy}`, 1001);
  return `${prefix}-${fy}-${String(seq).padStart(6, '0')}`;
}

/**
 * Statutory GST invoice number: `LMN/2026-27/000142`.
 *
 * Must be called inside the same transaction that creates the Invoice row, so
 * a rollback releases the number instead of burning it.
 */
export async function generateInvoiceNumber(
  client: DbClient,
  kind: 'tax' | 'credit_note' = 'tax',
  date = new Date(),
): Promise<{ invoiceNumber: string; financialYear: string }> {
  const prefix = process.env.INVOICE_PREFIX || 'LMN';
  const fy = financialYear(date);
  const series = kind === 'credit_note' ? 'CN' : 'INV';
  const seq = await nextSequence(client, `seq:invoice:${series}:${fy}`, 1);

  const marker = kind === 'credit_note' ? `${prefix}/CN` : prefix;
  return {
    invoiceNumber: `${marker}/${fy}/${String(seq).padStart(6, '0')}`,
    financialYear: fy,
  };
}

export async function generateReturnNumber(client: DbClient = db): Promise<string> {
  const fy = fyToken();
  const seq = await nextSequence(client, `seq:return:${fy}`, 1);
  return `RET-${fy}-${String(seq).padStart(5, '0')}`;
}

export async function generateWithdrawalNumber(client: DbClient = db): Promise<string> {
  const fy = fyToken();
  const seq = await nextSequence(client, `seq:withdrawal:${fy}`, 1);
  return `WDL-${fy}-${String(seq).padStart(5, '0')}`;
}

/**
 * `TKT-2627-00318`
 *
 * A support reference short enough for a customer to read out over the phone.
 * Sequential, because support staff sort by it constantly.
 */
export async function generateTicketRef(client: DbClient = db): Promise<string> {
  const fy = fyToken();
  const seq = await nextSequence(client, `seq:ticket:${fy}`, 1);
  return `TKT-${fy}-${String(seq).padStart(5, '0')}`;
}

/** Gateway-facing receipt id for a payment intent. Must be ≤ 40 chars for Razorpay. */
export function generateReceiptId(orderNumber: string, attempt: number): string {
  return `rcpt_${orderNumber.replace(/[^A-Za-z0-9]/g, '')}_${attempt}`.slice(0, 40);
}

// ── Referral codes ──────────────────────────────────────────────────────────

/**
 * Derive a referral code from the user's name plus random entropy, e.g.
 * `AARAV7K2M`. The name stem makes the code feel personal when it's shared,
 * and the random tail keeps it unguessable so nobody can farm codes by
 * enumerating first names.
 *
 * Retries on collision; falls back to a fully random code after a few attempts
 * rather than looping forever on an unlucky stem.
 */
export async function generateReferralCode(
  name: string,
  client: DbClient = db,
): Promise<string> {
  const stem = name
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 5);

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = stem.length >= 3 ? `${stem}${randomCode(4)}` : randomCode(8);
    const clash = await client.user.findUnique({
      where: { referralCode: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
  }

  // Widen the search space instead of retrying the same shape.
  return `${randomCode(10)}`;
}

/** SKU for a variant: `LMN-TSH-BLK-M-4821`. */
export function generateSku(input: {
  categorySlug: string;
  productName: string;
  color: string;
  size: string;
}): string {
  const abbr = (s: string, n: number) =>
    s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, n) || 'XXX';

  return [
    'LMN',
    abbr(input.categorySlug, 3),
    abbr(input.color, 3),
    input.size.toUpperCase(),
    Math.floor(1000 + Math.random() * 9000),
  ].join('-');
}

/** Opaque session key for guest carts and analytics. */
export function generateSessionKey(): string {
  return `sk_${randomCode(24).toLowerCase()}`;
}

/**
 * Slugify a title for catalogue URLs, appending a short suffix when the base
 * slug is taken so publishing two "Chrome Oversized Tee" products can't fail.
 */
export async function generateUniqueSlug(
  title: string,
  model: 'product' | 'collection' | 'category' | 'blogPost',
  client: DbClient = db,
  excludeId?: string,
): Promise<string> {
  const base =
    title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '') // strip combining accents left by NFKD
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'item';

  for (let attempt = 0; attempt < 8; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${randomCode(4).toLowerCase()}`;

    // The four models all expose a unique `slug`, but their delegate types
    // differ, so this needs a narrow cast rather than a shared interface.
    const delegate = (client as unknown as Record<string, {
      findUnique: (a: { where: { slug: string }; select: { id: true } }) => Promise<{ id: string } | null>;
    }>)[model];

    const found = await delegate.findUnique({ where: { slug }, select: { id: true } });
    if (!found || (excludeId && found.id === excludeId)) return slug;
  }

  return `${base}-${Date.now().toString(36)}`;
}

/** Convenience wrapper so callers don't have to open their own transaction. */
export async function withSequence<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
  return tx(fn);
}
