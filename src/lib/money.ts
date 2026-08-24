/**
 * Money.
 *
 * The rule: **every monetary value in this codebase is an integer number of
 * paise.** No floats, no `Decimal`, no rupee-denominated numbers in the DB or
 * in API payloads. `12345` is ₹123.45.
 *
 * Why: ₹0.1 + ₹0.2 !== ₹0.3 in IEEE-754, and a fashion cart with percentage
 * discounts, per-line GST, and a wallet part-payment does enough arithmetic
 * that the drift becomes visible on invoices. Integers make every operation
 * exact, and the only rounding in the system happens in the two places that
 * genuinely need it (percentage maths and currency display), where it is
 * explicit and tested.
 */

/** Integer paise. Branding it catches "I passed rupees by mistake" at compile time. */
export type Paise = number;

export const PAISE_PER_RUPEE = 100;

// ── Construction ────────────────────────────────────────────────────────────

/** ₹1,299.50 → 129950. Use only at trust boundaries (admin forms, CSV import). */
export function rupeesToPaise(rupees: number): Paise {
  return Math.round(rupees * PAISE_PER_RUPEE);
}

/** 129950 → 1299.5. Display and gateway payloads that want major units. */
export function paiseToRupees(paise: Paise): number {
  return paise / PAISE_PER_RUPEE;
}

/**
 * Parse human input — "₹1,299.50", "1299.50", "1,299" — into paise.
 * Returns null for anything it can't read, so callers must handle failure
 * rather than silently getting 0.
 */
export function parseMoney(input: string | number | null | undefined): Paise | null {
  if (input === null || input === undefined || input === '') return null;
  if (typeof input === 'number') {
    return Number.isFinite(input) ? rupeesToPaise(input) : null;
  }
  const cleaned = input.replace(/[₹$€£,\s]/g, '');
  if (!/^-?\d*\.?\d*$/.test(cleaned) || cleaned === '' || cleaned === '.') return null;
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? rupeesToPaise(value) : null;
}

// ── Arithmetic ──────────────────────────────────────────────────────────────

export function sum(...amounts: Paise[]): Paise {
  return amounts.reduce((acc, n) => acc + (n || 0), 0);
}

export function sumBy<T>(items: readonly T[], pick: (item: T) => Paise): Paise {
  return items.reduce((acc, item) => acc + (pick(item) || 0), 0);
}

/** Never let a computed total go negative (e.g. discount exceeding subtotal). */
export function clampToZero(amount: Paise): Paise {
  return amount < 0 ? 0 : amount;
}

export function clamp(amount: Paise, min: Paise, max: Paise): Paise {
  return Math.min(Math.max(amount, min), max);
}

/**
 * `percentOf(10000, 7.5)` → 750. Half-up rounding, which is what Indian
 * invoicing expects and what Razorpay's own totals use.
 */
export function percentOf(amount: Paise, percent: number): Paise {
  return Math.round((amount * percent) / 100);
}

/** Basis points, for rates stored as integers (750 bps = 7.5%). */
export function bpsOf(amount: Paise, bps: number): Paise {
  return Math.round((amount * bps) / 10_000);
}

/**
 * Extract the tax component from a **tax-inclusive** amount.
 * Indian apparel MRP is inclusive, so a ₹1,000 tag at 5% GST contains
 * ₹47.62 of tax, not ₹50.
 */
export function taxFromInclusive(inclusiveAmount: Paise, ratePercent: number): Paise {
  return Math.round((inclusiveAmount * ratePercent) / (100 + ratePercent));
}

/** The pre-tax (taxable) value inside a tax-inclusive amount. */
export function taxableFromInclusive(inclusiveAmount: Paise, ratePercent: number): Paise {
  return inclusiveAmount - taxFromInclusive(inclusiveAmount, ratePercent);
}

/**
 * Split an amount across n shares without losing or inventing paise.
 * The remainder is distributed one paisa at a time to the earliest shares, so
 * `allocate(1000, 3)` → [334, 333, 333] and the parts always re-sum to 1000.
 *
 * Used to spread a cart-level coupon across line items so each line's GST is
 * computed on its true discounted value.
 */
export function allocate(amount: Paise, shares: number): Paise[] {
  if (shares <= 0) return [];
  const base = Math.floor(amount / shares);
  const remainder = amount - base * shares;
  return Array.from({ length: shares }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Proportional allocation — distributes `amount` across `weights` (typically
 * line totals) and corrects the final share so the parts sum exactly.
 */
export function allocateByWeight(amount: Paise, weights: readonly number[]): Paise[] {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) return allocate(amount, weights.length);

  const parts = weights.map((w) => Math.floor((amount * w) / totalWeight));
  const distributed = parts.reduce((a, b) => a + b, 0);
  let remainder = amount - distributed;

  // Hand the leftover paise to the largest weights first — the fairest
  // rounding and the one that keeps the biggest line's price looking right.
  const order = weights
    .map((w, i) => ({ w, i }))
    .sort((a, b) => b.w - a.w)
    .map(({ i }) => i);

  for (let k = 0; remainder > 0 && k < order.length; k++, remainder--) {
    parts[order[k]] += 1;
  }
  return parts;
}

/** Round to the nearest rupee — invoice round-off line. */
export function roundToRupee(amount: Paise): Paise {
  return Math.round(amount / PAISE_PER_RUPEE) * PAISE_PER_RUPEE;
}

/** The signed round-off adjustment an invoice needs to land on whole rupees. */
export function roundOffDelta(amount: Paise): Paise {
  return roundToRupee(amount) - amount;
}

// ── Formatting ──────────────────────────────────────────────────────────────

export interface CurrencyInfo {
  code: string;
  symbol: string;
  /** Units of this currency per 1 INR. */
  rate: number;
  precision: number;
}

export const INR: CurrencyInfo = { code: 'INR', symbol: '₹', rate: 1, precision: 2 };

/**
 * Format paise for display. Uses Intl so INR gets true lakh/crore grouping
 * (₹1,23,456.00 — not ₹123,456.00).
 *
 * `compact` gives ₹1.2L / ₹3.4Cr for dashboard tiles.
 */
export function formatMoney(
  paise: Paise,
  options: {
    currency?: CurrencyInfo;
    showDecimals?: boolean;
    compact?: boolean;
    signed?: boolean;
  } = {},
): string {
  const { currency = INR, showDecimals, compact = false, signed = false } = options;

  const converted = paiseToRupees(paise) * currency.rate;
  const abs = Math.abs(converted);
  const sign = signed && paise > 0 ? '+' : converted < 0 ? '−' : '';

  if (compact && abs >= 1000) {
    return `${sign}${currency.symbol}${compactNumber(abs, currency.code)}`;
  }

  // Default: hide decimals on whole amounts, show them when they carry meaning.
  const withDecimals =
    showDecimals ?? !Number.isInteger(Number(converted.toFixed(currency.precision)));

  const locale = currency.code === 'INR' ? 'en-IN' : 'en-US';
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: withDecimals ? currency.precision : 0,
    maximumFractionDigits: withDecimals ? currency.precision : 0,
  }).format(abs);

  return `${sign}${currency.symbol}${formatted}`;
}

/** Indian numbering for compact display; western K/M/B for other currencies. */
function compactNumber(value: number, currencyCode: string): string {
  const trim = (n: number) => {
    const s = n.toFixed(n < 10 ? 2 : 1);
    return s.replace(/\.?0+$/, '');
  };

  if (currencyCode === 'INR') {
    if (value >= 1_00_00_000) return `${trim(value / 1_00_00_000)}Cr`;
    if (value >= 1_00_000) return `${trim(value / 1_00_000)}L`;
    if (value >= 1_000) return `${trim(value / 1_000)}K`;
  } else {
    if (value >= 1_000_000_000) return `${trim(value / 1_000_000_000)}B`;
    if (value >= 1_000_000) return `${trim(value / 1_000_000)}M`;
    if (value >= 1_000) return `${trim(value / 1_000)}K`;
  }
  return trim(value);
}

/** Plain digits for form inputs — no symbol, no grouping. */
export function toInputValue(paise: Paise | null | undefined): string {
  if (paise === null || paise === undefined) return '';
  const rupees = paiseToRupees(paise);
  return Number.isInteger(rupees) ? String(rupees) : rupees.toFixed(2);
}

/** Discount percentage off, for the "-38%" badge. Returns 0 when not on sale. */
export function discountPercent(price: Paise, compareAt: Paise | null | undefined): number {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

// ── Gateway conversion ──────────────────────────────────────────────────────

/**
 * Razorpay's API is denominated in the smallest currency unit, which for INR is
 * already paise — so this is an identity function today. It exists so that the
 * one place we hand money to a gateway is explicit and searchable, and so
 * adding a zero-decimal currency (JPY, KRW) later is a change in one file.
 */
export function toGatewayAmount(paise: Paise, currencyCode = 'INR'): number {
  const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND']);
  if (ZERO_DECIMAL.has(currencyCode)) return Math.round(paise / 100);
  return paise;
}

export function fromGatewayAmount(amount: number, currencyCode = 'INR'): Paise {
  const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND']);
  if (ZERO_DECIMAL.has(currencyCode)) return amount * 100;
  return amount;
}
