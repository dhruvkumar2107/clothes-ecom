import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware class merge. `cn('p-2', cond && 'p-4')` → 'p-4'. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ── Dates ───────────────────────────────────────────────────────────────────

const IST = 'Asia/Kolkata';

/** "22 Aug 2026" */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: IST,
  }).format(d);
}

/** "22 Aug 2026, 4:35 PM" */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: IST,
  }).format(d);
}

/** "4:35 PM" */
export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: IST,
  }).format(d);
}

/**
 * "in 3 days" / "2 hours ago". Uses Intl.RelativeTimeFormat so it localises,
 * and picks the largest sensible unit rather than always using days.
 */
export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';

  const diffMs = d.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  const WEEK = 7 * DAY;
  const MONTH = 30 * DAY;

  if (abs < MINUTE) return 'just now';
  if (abs < HOUR) return rtf.format(Math.round(diffMs / MINUTE), 'minute');
  if (abs < DAY) return rtf.format(Math.round(diffMs / HOUR), 'hour');
  if (abs < WEEK) return rtf.format(Math.round(diffMs / DAY), 'day');
  if (abs < MONTH) return rtf.format(Math.round(diffMs / WEEK), 'week');
  if (abs < 365 * DAY) return rtf.format(Math.round(diffMs / MONTH), 'month');
  return rtf.format(Math.round(diffMs / (365 * DAY)), 'year');
}

/** ISO date key for DailyMetric rows, in IST so "today" matches the business day. */
export function dateKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: IST,
  }).format(date);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function startOfDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Delivery ETA copy: "Arrives Mon, 25 Aug – Thu, 28 Aug" */
export function formatEtaRange(minDays: number, maxDays: number, from = new Date()): string {
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: IST,
    }).format(d);

  const min = addDays(from, minDays);
  const max = addDays(from, maxDays);
  if (minDays === maxDays) return fmt(min);
  return `${fmt(min)} – ${fmt(max)}`;
}

// ── Numbers ─────────────────────────────────────────────────────────────────

/** 1234567 → "12,34,567" (Indian grouping) */
export function formatNumber(n: number, locale = 'en-IN'): string {
  return new Intl.NumberFormat(locale).format(n);
}

/** 0.0432 → "4.3%" */
export function formatPercent(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** Safe division for conversion rates — returns 0 instead of NaN/Infinity. */
export function ratio(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return numerator / denominator;
}

/** Percentage change between two periods, for dashboard deltas. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return current > 0 ? null : 0; // null renders as "new"
  return (current - previous) / previous;
}

// ── Strings ─────────────────────────────────────────────────────────────────

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Mask an email for display in fraud/audit views: a•••v@gmail.com */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  if (local.length <= 2) return `${local[0]}•••@${domain}`;
  return `${local[0]}•••${local[local.length - 1]}@${domain}`;
}

/** +91 98765 43210 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  if (local.length !== 10) return phone;
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return phone;
  return `+91 •••••${digits.slice(5)}`;
}

/** Format paise as Indian Rupees: 12345 → "₹123.45" */
export function formatCurrency(paise: number, locale = 'en-IN', currency = 'INR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

/** Debounce function for search inputs */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  ms: number
): T & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout | null = null;
  const debounced = ((...args: any[]) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  }) as T & { cancel: () => void };
  debounced.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId);
  };
  return debounced;
}

// ── Collections ─────────────────────────────────────────────────────────────

export function groupBy<T, K extends string | number>(
  items: readonly T[],
  key: (item: T) => K,
): Record<K, T[]> {
  return items.reduce((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

export function unique<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}

export function uniqueBy<T, K>(items: readonly T[], key: (item: T) => K): T[] {
  const seen = new Set<K>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Deterministic pick from an array, seeded by a string. Used for stable mock data. */
export function seededPick<T>(items: readonly T[], seed: string): T {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return items[Math.abs(hash) % items.length];
}

// ── Async ───────────────────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry with exponential backoff and jitter. Used for gateway HTTP calls, where
 * a bare retry loop would synchronise all clients onto the same retry instant
 * and re-hammer a recovering service.
 */
export async function retry<T>(
  fn: (attempt: number) => Promise<T>,
  options: { attempts?: number; baseMs?: number; onError?: (e: unknown, attempt: number) => void } = {},
): Promise<T> {
  const { attempts = 3, baseMs = 300, onError } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      onError?.(error, attempt);
      if (attempt === attempts) break;
      const backoff = baseMs * 2 ** (attempt - 1);
      const jitter = Math.random() * backoff * 0.3;
      await sleep(backoff + jitter);
    }
  }
  throw lastError;
}

// ── Request helpers ─────────────────────────────────────────────────────────

/**
 * Best-effort client IP. Behind a proxy the left-most x-forwarded-for entry is
 * the client; we don't trust it for auth decisions, only for fraud signals and
 * audit logs.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip') ?? headers.get('cf-connecting-ip') ?? null;
}

export function deviceTypeFrom(userAgent: string | null): 'mobile' | 'tablet' | 'desktop' {
  if (!userAgent) return 'desktop';
  if (/iPad|Tablet|PlayBook|Silk/i.test(userAgent)) return 'tablet';
  if (/Mobi|Android|iPhone|iPod/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

/** Normalise a UTM source so "Google" / "google.com" / "GOOGLE" roll up together. */
export function normalizeSource(raw: string | null | undefined): string {
  if (!raw) return 'direct';
  const s = raw.toLowerCase().replace(/^www\./, '').replace(/\.(com|in|co\.in|org)$/, '');
  const map: Record<string, string> = {
    'google': 'google',
    'googleads': 'google',
    'fb': 'facebook',
    'facebook': 'facebook',
    'ig': 'instagram',
    'instagram': 'instagram',
    't.co': 'twitter',
    'x': 'twitter',
    'twitter': 'twitter',
  };
  return map[s] ?? s;
}
