import { gatewayFetch } from '../http';
import type { IfscDetails } from '../types';
import { bankFromIfsc, isValidIfscFormat } from './name-match';

/**
 * IFSC lookup, shared by every verification driver.
 *
 * This is the one piece of bank verification that needs no credentials:
 * `ifsc.razorpay.com` is a free, key-less, public mirror of the RBI branch
 * directory. So even the mock driver performs a *real* IFSC validation — a typo'd
 * or non-existent IFSC is genuinely rejected in development, not waved through.
 *
 * A local format check runs first (saves a round-trip on obvious typos and gives
 * instant feedback), then the network lookup, then a synthesized fallback if the
 * service is unreachable. The fallback is deliberately conservative: it only
 * resolves prefixes we recognise, so an unknown bank code with no network still
 * returns null rather than pretending to be valid.
 *
 * Results are cached in-process. The branch directory changes on the order of
 * weeks, and a checkout or withdrawal form may look up the same IFSC repeatedly.
 */

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const NEGATIVE_TTL_MS = 5 * 60 * 1000; // don't hammer on a bad code for long

interface CacheEntry {
  value: IfscDetails | null;
  expiresAt: number;
}

// Survives Next hot reload so dev doesn't re-fetch on every edit.
const globalCache = globalThis as unknown as { __ifscCache?: Map<string, CacheEntry> };
const cache = (globalCache.__ifscCache ??= new Map<string, CacheEntry>());

function lookupUrl(): string {
  const base = process.env.IFSC_LOOKUP_URL?.trim() || 'https://ifsc.razorpay.com';
  return base.replace(/\/+$/, '');
}

/** Shape returned by ifsc.razorpay.com. */
interface RazorpayIfscResponse {
  IFSC?: string;
  BANK?: string;
  BANKCODE?: string;
  BRANCH?: string;
  ADDRESS?: string;
  CITY?: string;
  DISTRICT?: string;
  STATE?: string;
  IMPS?: boolean;
  NEFT?: boolean;
  RTGS?: boolean;
  UPI?: boolean;
}

export async function lookupIfscShared(rawIfsc: string): Promise<IfscDetails | null> {
  const ifsc = rawIfsc.toUpperCase().trim();

  if (!isValidIfscFormat(ifsc)) return null;

  const cached = cache.get(ifsc);
  if (cached && Date.now() < cached.expiresAt) return cached.value;

  try {
    const response = await gatewayFetch<RazorpayIfscResponse>({
      provider: 'ifsc',
      url: `${lookupUrl()}/${ifsc}`,
      method: 'GET',
      timeoutMs: 6_000,
      // 404 is a legitimate answer ("no such branch"), not a failure to handle.
      expectStatuses: [200, 404],
    });

    if (response.status === 404 || !response.data?.BANK) {
      cache.set(ifsc, { value: null, expiresAt: Date.now() + NEGATIVE_TTL_MS });
      return null;
    }

    const d = response.data;
    const details: IfscDetails = {
      ifsc: d.IFSC ?? ifsc,
      bank: d.BANK ?? bankFromIfsc(ifsc) ?? 'Unknown bank',
      bankCode: d.BANKCODE ?? ifsc.slice(0, 4),
      branch: d.BRANCH ?? 'Unknown branch',
      address: d.ADDRESS ?? null,
      city: d.CITY ?? '',
      district: d.DISTRICT ?? null,
      state: d.STATE ?? '',
      // Absent flags default to the rails essentially every branch supports.
      imps: d.IMPS ?? true,
      neft: d.NEFT ?? true,
      rtgs: d.RTGS ?? true,
      upi: d.UPI ?? true,
    };

    cache.set(ifsc, { value: details, expiresAt: Date.now() + CACHE_TTL_MS });
    return details;
  } catch {
    // Offline or the directory is down. Fall back to the prefix table so a
    // recognised bank code still resolves — but only for codes we know, so an
    // invented IFSC can't slip through just because the network is unavailable.
    const bank = bankFromIfsc(ifsc);
    if (!bank) return null;

    const fallback: IfscDetails = {
      ifsc,
      bank,
      bankCode: ifsc.slice(0, 4),
      branch: 'Branch details unavailable offline',
      address: null,
      city: '',
      district: null,
      state: '',
      imps: true,
      neft: true,
      rtgs: true,
      upi: true,
    };

    // Cache briefly only — we want to re-attempt the real lookup soon.
    cache.set(ifsc, { value: fallback, expiresAt: Date.now() + NEGATIVE_TTL_MS });
    return fallback;
  }
}

/**
 * Which payout rails may we offer for this branch?
 *
 * IMPS is instant but capped at ₹5 lakh; NEFT is batched; RTGS has a ₹2 lakh
 * floor. Picking the wrong rail is a guaranteed payout failure, so this decides
 * it centrally from the amount and the branch's advertised support.
 */
export function preferredPayoutMode(
  amountPaise: number,
  details: IfscDetails | null,
): 'IMPS' | 'NEFT' | 'RTGS' {
  const IMPS_MAX = 50_000_000; // ₹5,00,000
  const RTGS_MIN = 20_000_000; // ₹2,00,000

  if (amountPaise <= IMPS_MAX && (details?.imps ?? true)) return 'IMPS';
  if (amountPaise >= RTGS_MIN && (details?.rtgs ?? false)) return 'RTGS';
  return 'NEFT';
}

export function clearIfscCache(): void {
  cache.clear();
}
