import { db } from './db';
import {
  allocateByWeight,
  clampToZero,
  percentOf,
  roundOffDelta,
  taxFromInclusive,
  type Paise,
} from './money';
import { getSettings } from './settings';

/**
 * GST.
 *
 * Two rules drive everything here, and both are statutory rather than
 * stylistic:
 *
 *  1. **Place of supply decides the split.** When the buyer's state matches the
 *     seller's, the tax is CGST + SGST (half each). When it differs, it is a
 *     single IGST at the full rate. The total is identical either way — but an
 *     invoice that puts it in the wrong columns is a defective invoice, and the
 *     buyer cannot claim input credit against it.
 *
 *  2. **Indian apparel MRP is tax-inclusive.** A ₹1,000 tag at 5% contains
 *     ₹47.62 of GST, not ₹50. Computing it the other way overstates revenue and
 *     understates the liability. `tax.pricesIncludeTax` controls this, and
 *     turning it off legitimately changes every total in the store.
 *
 * The apparel rate itself is slab-based: 5% up to ₹1,000 per piece, 12% above.
 * The threshold applies **per unit**, not per line — two ₹600 shirts are taxed
 * at 5%, not 12%, which is why `rateFor` takes a unit price.
 */

export const APPAREL_HSN = '6109';

/** Statutory apparel slab, used when no TaxRule row overrides it. */
export const APPAREL_SLAB = {
  threshold: 100_000 as Paise, // ₹1,000 per piece
  belowRate: 5,
  aboveRate: 12,
} as const;

export interface TaxContext {
  /** Seller's state code, from settings. */
  sellerStateCode: string;
  /** Buyer's state code — the place of supply. */
  placeOfSupply: string;
  pricesIncludeTax: boolean;
}

export async function taxContext(placeOfSupply: string): Promise<TaxContext> {
  const settings = await getSettings(['tax.stateCode', 'tax.pricesIncludeTax']);
  return {
    sellerStateCode: settings['tax.stateCode'],
    placeOfSupply: placeOfSupply || settings['tax.stateCode'],
    pricesIncludeTax: settings['tax.pricesIncludeTax'],
  };
}

/** Intra-state → CGST+SGST. Inter-state → IGST. */
export function isIntraState(ctx: TaxContext): boolean {
  return normalizeStateCode(ctx.placeOfSupply) === normalizeStateCode(ctx.sellerStateCode);
}

/** "27" / "27 " / "MH" all need to compare equal. Codes are zero-padded pairs. */
export function normalizeStateCode(code: string | null | undefined): string {
  if (!code) return '';
  const digits = code.replace(/\D/g, '');
  if (digits) return digits.padStart(2, '0');
  return STATE_NAME_TO_CODE[code.trim().toLowerCase()] ?? '';
}

// ── Rate resolution ─────────────────────────────────────────────────────────

export interface RateInput {
  /** Per-unit price, tax-inclusive when `pricesIncludeTax`. */
  unitPrice: Paise;
  hsnCode?: string | null;
  /** The product's own declared rate, used when no rule matches. */
  fallbackRate: number;
}

/**
 * Resolve the GST rate for one unit.
 *
 * Precedence: an active TaxRule matching the HSN code wins (including its own
 * price threshold), then the statutory apparel slab for HSN 61xx/62xx, then the
 * product's declared `gstRate`. Rules are cached because checkout resolves a
 * rate per line and the table changes maybe twice a year.
 */
export async function rateFor(input: RateInput): Promise<number> {
  const rules = await loadTaxRules();
  const hsn = (input.hsnCode ?? '').trim();

  const rule =
    rules.find((r) => r.hsnCode && hsn && r.hsnCode === hsn) ??
    rules.find((r) => r.hsnCode && hsn && hsn.startsWith(r.hsnCode));

  if (rule) {
    if (
      rule.priceThreshold !== null &&
      rule.aboveThresholdRate !== null &&
      input.unitPrice > rule.priceThreshold
    ) {
      return rule.aboveThresholdRate;
    }
    return rule.gstRate;
  }

  // Statutory apparel slab — chapters 61 (knitted) and 62 (woven).
  if (hsn.startsWith('61') || hsn.startsWith('62')) {
    return input.unitPrice > APPAREL_SLAB.threshold
      ? APPAREL_SLAB.aboveRate
      : APPAREL_SLAB.belowRate;
  }

  return input.fallbackRate;
}

interface CachedRule {
  hsnCode: string | null;
  gstRate: number;
  cessRate: number;
  priceThreshold: number | null;
  aboveThresholdRate: number | null;
}

const RULE_CACHE_TTL_MS = 60_000;
let ruleCache: CachedRule[] | null = null;
let ruleCacheExpiresAt = 0;

async function loadTaxRules(): Promise<CachedRule[]> {
  const now = Date.now();
  if (ruleCache && now < ruleCacheExpiresAt) return ruleCache;

  const rows = await db.taxRule.findMany({
    where: { active: true },
    select: {
      hsnCode: true,
      gstRate: true,
      cessRate: true,
      priceThreshold: true,
      aboveThresholdRate: true,
    },
    // Longest HSN prefix first, so 610910 beats 6109 beats 61.
    orderBy: { hsnCode: 'desc' },
  });

  ruleCache = rows;
  ruleCacheExpiresAt = now + RULE_CACHE_TTL_MS;
  return rows;
}

export function invalidateTaxCache(): void {
  ruleCache = null;
  ruleCacheExpiresAt = 0;
}

// ── Per-line computation ────────────────────────────────────────────────────

export interface TaxableLine {
  /** Stable key so callers can match results back to their own rows. */
  key: string;
  unitPrice: Paise;
  qty: number;
  /** Discount already allocated to this line, in paise. */
  discount: Paise;
  hsnCode?: string | null;
  gstRate: number;
}

export interface LineTax {
  key: string;
  rate: number;
  /** Pre-tax value of the line after discount. */
  taxableValue: Paise;
  taxAmount: Paise;
  cgst: Paise;
  sgst: Paise;
  igst: Paise;
  /** Gross line value including tax — what the customer sees. */
  gross: Paise;
}

/**
 * Compute tax for a set of lines.
 *
 * Discount is subtracted **before** tax, which is what the law requires: GST is
 * charged on the consideration actually paid, so a ₹1,000 shirt with a ₹200
 * coupon is taxed on ₹800. Getting this wrong is the single most common defect
 * in Indian storefronts, and it overcharges the customer.
 */
export async function computeLineTax(
  lines: readonly TaxableLine[],
  ctx: TaxContext,
): Promise<LineTax[]> {
  const intra = isIntraState(ctx);
  const out: LineTax[] = [];

  for (const line of lines) {
    const rate = await rateFor({
      unitPrice: line.unitPrice,
      hsnCode: line.hsnCode,
      fallbackRate: line.gstRate,
    });

    const gross = clampToZero(line.unitPrice * line.qty - line.discount);

    // Inclusive: the tax is already inside `gross`, so extract it.
    // Exclusive: `gross` is the taxable base and tax is added on top.
    const taxAmount = ctx.pricesIncludeTax
      ? taxFromInclusive(gross, rate)
      : percentOf(gross, rate);
    const taxableValue = ctx.pricesIncludeTax ? gross - taxAmount : gross;

    // CGST and SGST must be exactly half each and must re-sum to taxAmount —
    // so one half absorbs the odd paisa rather than both rounding up.
    const half = Math.floor(taxAmount / 2);
    out.push({
      key: line.key,
      rate,
      taxableValue,
      taxAmount,
      cgst: intra ? taxAmount - half : 0,
      sgst: intra ? half : 0,
      igst: intra ? 0 : taxAmount,
      gross: ctx.pricesIncludeTax ? gross : gross + taxAmount,
    });
  }

  return out;
}

export interface TaxSummary {
  lines: LineTax[];
  taxableValue: Paise;
  cgst: Paise;
  sgst: Paise;
  igst: Paise;
  cess: Paise;
  taxTotal: Paise;
  /** Signed adjustment that lands the invoice on whole rupees. */
  roundOff: Paise;
  /** Rate → taxable + tax, for the invoice's HSN summary table. */
  byRate: { rate: number; taxableValue: Paise; taxAmount: Paise }[];
}

export function summarizeTax(lines: readonly LineTax[]): TaxSummary {
  const taxableValue = lines.reduce((a, l) => a + l.taxableValue, 0);
  const cgst = lines.reduce((a, l) => a + l.cgst, 0);
  const sgst = lines.reduce((a, l) => a + l.sgst, 0);
  const igst = lines.reduce((a, l) => a + l.igst, 0);
  const taxTotal = cgst + sgst + igst;

  const rateMap = new Map<number, { taxableValue: Paise; taxAmount: Paise }>();
  for (const line of lines) {
    const entry = rateMap.get(line.rate) ?? { taxableValue: 0, taxAmount: 0 };
    entry.taxableValue += line.taxableValue;
    entry.taxAmount += line.taxAmount;
    rateMap.set(line.rate, entry);
  }

  return {
    lines: [...lines],
    taxableValue,
    cgst,
    sgst,
    igst,
    cess: 0,
    taxTotal,
    roundOff: roundOffDelta(taxableValue + taxTotal),
    byRate: [...rateMap.entries()]
      .map(([rate, v]) => ({ rate, ...v }))
      .sort((a, b) => a.rate - b.rate),
  };
}

/**
 * Spread a cart-level discount (a coupon, a wallet-funded promo) across lines in
 * proportion to their value, so each line's GST is computed on its own true
 * discounted amount.
 *
 * Doing this at the cart level instead — one discount, one tax figure — produces
 * an invoice whose line items don't add up to its total, which is the kind of
 * thing an auditor notices.
 */
export function allocateDiscount(
  totalDiscount: Paise,
  lines: readonly { key: string; unitPrice: Paise; qty: number }[],
): Map<string, Paise> {
  const weights = lines.map((l) => l.unitPrice * l.qty);
  const parts = allocateByWeight(totalDiscount, weights);
  return new Map(lines.map((line, i) => [line.key, parts[i] ?? 0]));
}

// ── State codes ─────────────────────────────────────────────────────────────

/** GST state codes, for resolving a place of supply from an address. */
export const STATE_CODES: { code: string; name: string }[] = [
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman and Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
];

const STATE_NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  STATE_CODES.map((s) => [s.name.toLowerCase(), s.code]),
);

export function stateCodeFromName(name: string | null | undefined): string {
  if (!name) return '';
  return STATE_NAME_TO_CODE[name.trim().toLowerCase()] ?? '';
}

export function stateNameFromCode(code: string | null | undefined): string {
  const normalized = normalizeStateCode(code);
  return STATE_CODES.find((s) => s.code === normalized)?.name ?? '';
}

/**
 * Validate a GSTIN's shape and checksum.
 *
 * Format is 2-digit state code, 10-char PAN, 1 entity digit, 1 fixed 'Z', and a
 * check character. The checksum is verified because a mistyped B2B GSTIN puts a
 * wrong number on a tax invoice, and the buyer discovers it months later when
 * their input credit is rejected.
 */
export function isValidGstin(gstin: string): boolean {
  const value = gstin.trim().toUpperCase();
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(value)) return false;

  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const factor = i % 2 === 0 ? 1 : 2;
    const product = alphabet.indexOf(value[i]) * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }
  const checkIndex = (36 - (sum % 36)) % 36;
  return alphabet[checkIndex] === value[14];
}

/** The state code embedded in a GSTIN — a B2B buyer's place of supply. */
export function stateCodeFromGstin(gstin: string): string {
  return gstin.trim().slice(0, 2);
}
