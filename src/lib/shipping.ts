import { db } from './db';
import { clampToZero, type Paise } from './money';
import { readCsv } from './json';
import { getSettings } from './settings';
import { getShippingProvider } from './adapters/registry';
import { addDays, formatEtaRange } from './utils';

/**
 * Shipping, serviceability and delivery promises.
 *
 * Three sources of truth, checked in this order:
 *
 *  1. **The Pincode table** — operator-curated, CSV-importable, and the only
 *     source that can say "we don't deliver here". It is authoritative for COD
 *     availability because a courier's API will happily accept a COD shipment to
 *     a pincode where our own RTO rate makes it a loss.
 *
 *  2. **ShippingZone rows** — rate cards by state or pincode prefix.
 *
 *  3. **The courier adapter** — consulted for live ETA and rate when a real
 *     driver is configured. Never allowed to *widen* availability beyond what
 *     the Pincode table permits; it can only refine the estimate.
 *
 * An unknown pincode is treated as serviceable-but-prepaid-only rather than
 * unserviceable. A new PIN code appearing before an ops import shouldn't block a
 * sale, but it also shouldn't get cash-on-delivery, which is the risky half.
 */

export interface Serviceability {
  pincode: string;
  known: boolean;
  serviceable: boolean;
  city: string | null;
  state: string | null;
  stateCode: string | null;
  zone: string;
  codAvailable: boolean;
  codLimit: Paise;
  prepaidAvailable: boolean;
  expressAvailable: boolean;
  returnAvailable: boolean;
  etaMinDays: number;
  etaMaxDays: number;
  /** "Arrives Mon, 25 Aug – Thu, 28 Aug" */
  etaLabel: string;
  estimatedDeliveryAt: Date;
  reason: string | null;
}

export function isValidPincode(pincode: string): boolean {
  // Indian PIN codes are 6 digits and never start with 0.
  return /^[1-9][0-9]{5}$/.test(pincode.trim());
}

export async function checkServiceability(
  rawPincode: string,
  options: { weightGrams?: number; cod?: boolean; declaredValue?: Paise } = {},
): Promise<Serviceability> {
  const pincode = rawPincode.trim();

  if (!isValidPincode(pincode)) {
    return unserviceable(pincode, false, 'Enter a valid 6-digit PIN code.');
  }

  const row = await db.pincode.findUnique({ where: { pincode } });

  if (row && !row.active) {
    return unserviceable(pincode, true, 'We don’t deliver to this PIN code yet.');
  }

  // Unknown pincode: allow prepaid, withhold COD, and use a conservative ETA.
  if (!row) {
    const eta = { min: 4, max: 8 };
    return {
      pincode,
      known: false,
      serviceable: true,
      city: null,
      state: null,
      stateCode: null,
      zone: 'tier2',
      codAvailable: false,
      codLimit: 0,
      prepaidAvailable: true,
      expressAvailable: false,
      returnAvailable: true,
      etaMinDays: eta.min,
      etaMaxDays: eta.max,
      etaLabel: formatEtaRange(eta.min, eta.max),
      estimatedDeliveryAt: addDays(new Date(), eta.max),
      reason: null,
    };
  }

  const codEnabled = await getSettings(['cod.enabled']);
  let codAvailable = row.codAvailable && codEnabled['cod.enabled'];
  let etaMin = Math.max(1, row.deliveryDays - 1);
  let etaMax = row.deliveryDays + 2;
  let expressAvailable = row.expressAvailable;

  // Refine — never widen — using the live courier when one is configured.
  const provider = getShippingProvider();
  if (provider.mode !== 'mock') {
    try {
      const live = await provider.checkServiceability({
        fromPincode: await originPincode(),
        toPincode: pincode,
        weightGrams: options.weightGrams ?? 500,
        cod: options.cod ?? false,
        declaredValue: options.declaredValue ?? 0,
      });

      if (!live.serviceable) {
        return unserviceable(pincode, true, 'No courier currently serves this PIN code.');
      }
      codAvailable = codAvailable && live.codAvailable;
      expressAvailable = expressAvailable && live.expressAvailable;
      if (live.etaDays) {
        etaMin = Math.max(1, live.etaDays - 1);
        etaMax = live.etaDays + 1;
      }
    } catch (cause) {
      // A courier API outage must not block checkout — fall back to the
      // operator-curated table, which is what it exists for.
      console.warn(
        `[shipping] live serviceability check failed for ${pincode}, using Pincode table:`,
        cause instanceof Error ? cause.message : cause,
      );
    }
  }

  return {
    pincode,
    known: true,
    serviceable: true,
    city: row.city,
    state: row.state,
    stateCode: row.stateCode,
    zone: row.zone,
    codAvailable,
    codLimit: row.codLimit,
    prepaidAvailable: row.prepaidAvailable,
    expressAvailable,
    returnAvailable: row.returnAvailable,
    etaMinDays: etaMin,
    etaMaxDays: etaMax,
    etaLabel: formatEtaRange(etaMin, etaMax),
    estimatedDeliveryAt: addDays(new Date(), etaMax),
    reason: null,
  };
}

function unserviceable(pincode: string, known: boolean, reason: string): Serviceability {
  return {
    pincode,
    known,
    serviceable: false,
    city: null,
    state: null,
    stateCode: null,
    zone: 'remote',
    codAvailable: false,
    codLimit: 0,
    prepaidAvailable: false,
    expressAvailable: false,
    returnAvailable: false,
    etaMinDays: 0,
    etaMaxDays: 0,
    etaLabel: '—',
    estimatedDeliveryAt: new Date(),
    reason,
  };
}

/** The warehouse PIN code shipments originate from — parsed from the seller address. */
async function originPincode(): Promise<string> {
  const settings = await getSettings(['tax.address']);
  const match = settings['tax.address'].match(/\b([1-9][0-9]{5})\b/);
  return match?.[1] ?? '400013';
}

// ── Rates ───────────────────────────────────────────────────────────────────

export interface ShippingQuote {
  rate: Paise;
  codFee: Paise;
  /** Rate before any free-shipping waiver, for the struck-through display. */
  baseRate: Paise;
  freeShipping: boolean;
  freeShippingThreshold: Paise;
  /** How much more to spend to earn free shipping; 0 when already earned. */
  amountToFreeShipping: Paise;
  zoneName: string | null;
  etaMinDays: number;
  etaMaxDays: number;
  etaLabel: string;
  expressRate: Paise | null;
}

/**
 * Quote shipping for a cart.
 *
 * Zone matching prefers the most specific rule: a pincode-prefix match beats a
 * state match, because a zone carved out for remote pincodes inside an otherwise
 * cheap state exists precisely to override it.
 */
export async function quoteShipping(input: {
  pincode: string | null;
  state?: string | null;
  subtotal: Paise;
  cod: boolean;
  weightGrams?: number;
  /** Loyalty tiers can grant free shipping regardless of cart value. */
  freeShippingOverride?: boolean;
}): Promise<ShippingQuote> {
  const settings = await getSettings([
    'checkout.freeShippingAbove',
    'checkout.defaultShippingRate',
    'cod.fee',
  ]);

  const zone = await matchZone(input.pincode, input.state);

  const baseRate = zone?.rate ?? settings['checkout.defaultShippingRate'];
  const codFee = input.cod ? (zone?.codFee ?? settings['cod.fee']) : 0;
  const threshold = zone?.freeAbove ?? settings['checkout.freeShippingAbove'];

  const earnsFree = threshold > 0 && input.subtotal >= threshold;
  const freeShipping = Boolean(input.freeShippingOverride) || earnsFree;

  return {
    rate: freeShipping ? 0 : baseRate,
    codFee,
    baseRate,
    freeShipping,
    freeShippingThreshold: threshold,
    amountToFreeShipping: freeShipping ? 0 : clampToZero(threshold - input.subtotal),
    zoneName: zone?.name ?? null,
    etaMinDays: zone?.etaMinDays ?? 2,
    etaMaxDays: zone?.etaMaxDays ?? 6,
    etaLabel: formatEtaRange(zone?.etaMinDays ?? 2, zone?.etaMaxDays ?? 6),
    expressRate: zone?.expressRate ?? null,
  };
}

interface MatchedZone {
  name: string;
  rate: Paise;
  freeAbove: number | null;
  codFee: Paise;
  etaMinDays: number;
  etaMaxDays: number;
  expressRate: number | null;
}

async function matchZone(
  pincode: string | null,
  state: string | null | undefined,
): Promise<MatchedZone | null> {
  const zones = await db.shippingZone.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      name: true,
      statesCsv: true,
      pincodePrefixCsv: true,
      rate: true,
      freeAbove: true,
      codFee: true,
      etaMinDays: true,
      etaMaxDays: true,
      expressRate: true,
    },
  });

  const normalizedState = state?.trim().toLowerCase() ?? '';

  // Pass 1 — pincode prefix, the more specific rule.
  if (pincode) {
    for (const zone of zones) {
      const prefixes = readCsv(zone.pincodePrefixCsv);
      if (prefixes.some((p) => pincode.startsWith(p))) return zone;
    }
  }

  // Pass 2 — state.
  if (normalizedState) {
    for (const zone of zones) {
      const states = readCsv(zone.statesCsv).map((s) => s.toLowerCase());
      if (states.includes(normalizedState)) return zone;
    }
  }

  // Pass 3 — a catch-all zone (no state and no prefix constraints).
  return zones.find((z) => !z.statesCsv && !z.pincodePrefixCsv) ?? null;
}

// ── COD eligibility ─────────────────────────────────────────────────────────

export interface CodEligibility {
  available: boolean;
  fee: Paise;
  reason: string | null;
}

/**
 * Decide whether COD may be offered for a specific cart at a specific address.
 *
 * Four independent gates, each with its own message. A customer told simply "COD
 * unavailable" will retry the same thing; one told "COD isn't available above
 * ₹25,000" will pay online.
 */
export async function codEligibility(input: {
  pincode: string | null;
  grandTotal: Paise;
  serviceability?: Serviceability | null;
}): Promise<CodEligibility> {
  const settings = await getSettings([
    'cod.enabled',
    'cod.fee',
    'cod.maxOrderValue',
    'cod.minOrderValue',
  ]);

  if (!settings['cod.enabled']) {
    return { available: false, fee: 0, reason: 'Cash on delivery is currently unavailable.' };
  }

  if (input.grandTotal > settings['cod.maxOrderValue']) {
    return {
      available: false,
      fee: 0,
      reason: `Orders above ₹${Math.round(
        settings['cod.maxOrderValue'] / 100,
      ).toLocaleString('en-IN')} must be prepaid.`,
    };
  }

  if (input.grandTotal < settings['cod.minOrderValue']) {
    return {
      available: false,
      fee: 0,
      reason: `Cash on delivery needs a minimum order of ₹${Math.round(
        settings['cod.minOrderValue'] / 100,
      ).toLocaleString('en-IN')}.`,
    };
  }

  if (!input.pincode) {
    return { available: false, fee: 0, reason: 'Add a delivery address to see COD.' };
  }

  const service = input.serviceability ?? (await checkServiceability(input.pincode, { cod: true }));

  if (!service.serviceable) {
    return { available: false, fee: 0, reason: service.reason };
  }
  if (!service.codAvailable) {
    return {
      available: false,
      fee: 0,
      reason: 'Cash on delivery isn’t available for this PIN code.',
    };
  }
  if (service.codLimit > 0 && input.grandTotal > service.codLimit) {
    return {
      available: false,
      fee: 0,
      reason: `COD for this PIN code is capped at ₹${Math.round(
        service.codLimit / 100,
      ).toLocaleString('en-IN')}.`,
    };
  }

  return { available: true, fee: settings['cod.fee'], reason: null };
}

// ── Weight ──────────────────────────────────────────────────────────────────

/**
 * Billable weight for a parcel.
 *
 * Couriers bill on the greater of actual and volumetric weight. We don't hold
 * per-variant dimensions, so this applies a packaging allowance and a per-item
 * bulk factor — enough to keep the declared weight from being systematically
 * under, which is what triggers courier weight-discrepancy claims.
 */
export function billableWeight(
  items: readonly { weightGrams: number; qty: number }[],
): number {
  const actual = items.reduce((a, i) => a + i.weightGrams * i.qty, 0);
  const totalUnits = items.reduce((a, i) => a + i.qty, 0);
  const packaging = 80 + totalUnits * 25; // mailer + tissue + tag per piece
  return Math.max(200, actual + packaging);
}

// ── Pincode import ──────────────────────────────────────────────────────────

export interface PincodeImportRow {
  pincode: string;
  city: string;
  state: string;
  stateCode?: string;
  zone?: string;
  codAvailable?: boolean;
  prepaidAvailable?: boolean;
  codLimit?: number;
  deliveryDays?: number;
  returnAvailable?: boolean;
  expressAvailable?: boolean;
  active?: boolean;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: { row: number; pincode: string; reason: string }[];
}

/**
 * Upsert pincodes from a parsed CSV.
 *
 * Invalid rows are collected and reported rather than aborting the import — an
 * ops file of 20,000 rows with three typos should load 19,997 of them and tell
 * you which three to fix.
 */
export async function importPincodes(rows: readonly PincodeImportRow[]): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: [] };

  for (const [index, row] of rows.entries()) {
    const pincode = String(row.pincode ?? '').trim();

    if (!isValidPincode(pincode)) {
      result.skipped.push({ row: index + 2, pincode, reason: 'Invalid PIN code' });
      continue;
    }
    if (!row.city?.trim() || !row.state?.trim()) {
      result.skipped.push({ row: index + 2, pincode, reason: 'City and state are required' });
      continue;
    }

    const data = {
      city: row.city.trim(),
      state: row.state.trim(),
      stateCode: row.stateCode?.trim() || null,
      zone: row.zone?.trim() || 'tier2',
      codAvailable: row.codAvailable ?? true,
      prepaidAvailable: row.prepaidAvailable ?? true,
      codLimit: row.codLimit ?? 500_000,
      deliveryDays: row.deliveryDays ?? 4,
      returnAvailable: row.returnAvailable ?? true,
      expressAvailable: row.expressAvailable ?? false,
      active: row.active ?? true,
    };

    const existing = await db.pincode.findUnique({
      where: { pincode },
      select: { id: true },
    });

    if (existing) {
      await db.pincode.update({ where: { pincode }, data });
      result.updated++;
    } else {
      await db.pincode.create({ data: { pincode, ...data } });
      result.created++;
    }
  }

  return result;
}
