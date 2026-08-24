import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { AuthRequiredError, ForbiddenError } from './auth/session';
import { AccountError } from './auth/accounts';
import { OtpError } from './auth/otp';
import { WalletError } from './wallet';
import { BankError } from './bank';
import { InventoryError } from './inventory';
import { RateLimitError } from './rate-limit';
import { GatewayError } from './adapters/types';
import { hmacSha256, safeEqual } from './crypto';
import { clientIp } from './utils';

/**
 * The API envelope.
 *
 * Every route handler returns one of exactly two shapes:
 *
 *   { ok: true,  data: T }
 *   { ok: false, error: { code, message, field?, details? } }
 *
 * A single shape matters more than it looks. The client fetch wrapper can then
 * have one error path instead of guessing whether a 400 body is `{message}`,
 * `{error}`, or a bare string — which is how you end up rendering
 * "[object Object]" in a toast.
 *
 * `code` is a stable machine token the UI may branch on; `message` is
 * human-facing copy safe to display as-is. Internal detail never reaches the
 * client — `fail()` logs the cause server-side and returns generic copy for
 * anything it doesn't recognise.
 */

export type ApiError = {
  code: string;
  message: string;
  /** Set for validation failures so a form can highlight the offending input. */
  field?: string;
  details?: unknown;
};

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export function ok<T>(data: T, init?: { status?: number; headers?: HeadersInit }) {
  return NextResponse.json<ApiResult<T>>(
    { ok: true, data },
    { status: init?.status ?? 200, headers: init?.headers },
  );
}

export function created<T>(data: T) {
  return ok(data, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function error(
  code: string,
  message: string,
  status = 400,
  extra?: { field?: string; details?: unknown },
) {
  return NextResponse.json<ApiResult<never>>(
    { ok: false, error: { code, message, ...extra } },
    { status },
  );
}

// ── Domain errors → HTTP ────────────────────────────────────────────────────

/**
 * A tagged error any domain module may throw to produce a specific status.
 * Prefer this over a bare Error, which becomes a 500.
 */
export class ApiFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
    readonly field?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiFailure';
  }
}

export function badRequest(message: string, field?: string): never {
  throw new ApiFailure('bad_request', message, 400, field);
}

export function notFound(what = 'Resource'): never {
  throw new ApiFailure('not_found', `${what} not found.`, 404);
}

export function conflict(message: string): never {
  throw new ApiFailure('conflict', message, 409);
}

export function unauthorized(message = 'Please sign in to continue.'): never {
  throw new ApiFailure('unauthorized', message, 401);
}

export function forbidden(message = 'You do not have access to this.'): never {
  throw new ApiFailure('forbidden', message, 403);
}

/**
 * Map any thrown value to a response.
 *
 * The ordering is deliberate: known domain error classes are translated to
 * their real status and their real message (those are written for customers, so
 * they are safe to show), and only genuinely unexpected errors collapse to a
 * 500 with generic copy. The alternative — a catch-all 500 — turns "your wallet
 * balance is too low" into "Something went wrong", which generates support
 * tickets instead of resolving them.
 */
export function fail(cause: unknown): NextResponse {
  if (cause instanceof ApiFailure) {
    return error(cause.code, cause.message, cause.status, {
      field: cause.field,
      details: cause.details,
    });
  }

  if (cause instanceof ZodError) {
    const first = cause.issues[0];
    return error('validation_failed', first?.message ?? 'Invalid input.', 422, {
      field: first?.path.join('.'),
      details: cause.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }

  if (cause instanceof AuthRequiredError) {
    return error('unauthorized', cause.message, 401);
  }

  if (cause instanceof ForbiddenError) {
    return error('forbidden', cause.message, 403, {
      details: { permission: cause.permission },
    });
  }

  // AccountError / WalletError / BankError all carry a stable `code` and a
  // customer-safe message, so they pass through unchanged.
  if (
    cause instanceof AccountError ||
    cause instanceof WalletError ||
    cause instanceof BankError
  ) {
    return error(cause.code, cause.message, cause.status);
  }

  if (cause instanceof OtpError) {
    return error(cause.code, cause.message, cause.status, {
      details: cause.retryAfterSeconds
        ? { retryAfterSeconds: cause.retryAfterSeconds }
        : undefined,
    });
  }

  if (cause instanceof RateLimitError) {
    return NextResponse.json<ApiResult<never>>(
      {
        ok: false,
        error: {
          code: cause.code,
          message: cause.message,
          details: { retryAfter: cause.retryAfter },
        },
      },
      { status: 429, headers: { 'Retry-After': String(cause.retryAfter) } },
    );
  }

  if (cause instanceof InventoryError) {
    return error(cause.code, cause.message, cause.status);
  }

  if (cause instanceof GatewayError) {
    // A vendor outage is neither the customer's fault nor our bug — 502 tells
    // the client a retry is worthwhile, which a 500 does not. `message` may
    // contain vendor internals, so only `userMessage` crosses the boundary.
    console.error(`[api] gateway error (${cause.provider}): ${cause.message}`, cause.raw);
    return error(
      'gateway_error',
      cause.userMessage,
      cause.retryable ? 502 : 400,
    );
  }

  console.error('[api] unhandled error:', cause);
  return error('internal_error', 'Something went wrong on our end. Please try again.', 500);
}

// ── Handler wrapper ─────────────────────────────────────────────────────────

/**
 * Wrap a route handler so it never leaks a stack trace and never has to write
 * its own try/catch. Handlers throw; this translates.
 *
 *   export const POST = handler(async (req) => {
 *     const body = await parse(req, zSchema);
 *     return ok(await doThing(body));
 *   });
 */
export function handler<Ctx = unknown>(
  fn: (req: Request, ctx: Ctx) => Promise<NextResponse | Response>,
) {
  return async (req: Request, ctx: Ctx): Promise<NextResponse | Response> => {
    try {
      return await fn(req, ctx);
    } catch (cause) {
      return fail(cause);
    }
  };
}

// ── Input parsing ───────────────────────────────────────────────────────────

/**
 * Parse and validate a JSON body. Throws ZodError (→ 422) on mismatch and a
 * clean 400 on malformed JSON, rather than the raw SyntaxError a bare
 * `req.json()` would surface.
 */
export async function parse<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiFailure('invalid_json', 'Request body must be valid JSON.', 400);
  }
  return schema.parse(raw);
}

/** Parse a form submission (multipart or urlencoded) against a schema. */
export async function parseForm<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const form = await req.formData();
  const raw: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    // Repeated keys collapse into an array so `tags=a&tags=b` works.
    if (key in raw) {
      const existing = raw[key];
      raw[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
    } else {
      raw[key] = value;
    }
  }
  return schema.parse(raw);
}

/** Validate query-string params against a schema. */
export function parseQuery<T>(req: Request, schema: ZodType<T>): T {
  const url = new URL(req.url);
  const raw: Record<string, unknown> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const all = url.searchParams.getAll(key);
    raw[key] = all.length > 1 ? all : all[0];
  }
  return schema.parse(raw);
}

/** Read one query param without a schema — for simple pass-through cases. */
export function q(req: Request, key: string): string | null {
  return new URL(req.url).searchParams.get(key);
}

// ── Pagination ──────────────────────────────────────────────────────────────

export interface Page {
  page: number;
  perPage: number;
  skip: number;
  take: number;
}

/** Clamped page params. `perPage` is capped so a client can't request 100k rows. */
export function pageParams(req: Request, defaultPerPage = 24, maxPerPage = 100): Page {
  const url = new URL(req.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const requested =
    Number.parseInt(url.searchParams.get('perPage') ?? String(defaultPerPage), 10) ||
    defaultPerPage;
  const perPage = Math.min(Math.max(1, requested), maxPerPage);
  return { page, perPage, skip: (page - 1) * perPage, take: perPage };
}

export interface Paginated<T> {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export function paginated<T>(items: T[], total: number, page: Page): Paginated<T> {
  const totalPages = Math.max(1, Math.ceil(total / page.perPage));
  return {
    items,
    page: page.page,
    perPage: page.perPage,
    total,
    totalPages,
    hasMore: page.page < totalPages,
  };
}

// ── Files ───────────────────────────────────────────────────────────────────

/** Send a generated file (invoice PDF, CSV export) as a download. */
export function fileResponse(
  body: Uint8Array | string,
  filename: string,
  contentType: string,
): NextResponse {
  const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body;
  // BlobPart typing is fussy about ArrayBufferView vs Buffer across runtimes;
  // copying into a fresh Uint8Array keeps this valid in both node and edge.
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'no-store',
    },
  });
}

export function csvResponse(csv: string, filename: string): NextResponse {
  // U+FEFF makes Excel open UTF-8 CSVs without mangling ₹ and accented names.
  return fileResponse(`\uFEFF${csv}`, filename, 'text/csv; charset=utf-8');
}

// ── Aliases for backward compatibility ────────────────────────────────────────
export const apiOk = ok;
export const apiError = error;

// ── Rate limiting ─────────────────────────────────────────────────────────────
export interface RateLimitOptions {
  limit: number;
  window: string; // e.g., '1m', '1h', '1d'
  keyPrefix: string;
}

export interface RateLimitResult {
  limited: boolean;
  response?: NextResponse;
  remaining: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export async function rateLimit(
  request: Request,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const key = `${options.keyPrefix}:${clientIp(new Headers(request.headers)) ?? 'anonymous'}`;
  const now = Date.now();
  const windowMs = parseWindow(options.window);

  const entry = rateLimitStore.get(key);
  if (entry && entry.resetAt > now) {
    if (entry.count >= options.limit) {
      return {
        limited: true,
        response: NextResponse.json(
          { ok: false, error: { code: 'rate_limited', message: 'Too many requests. Please try again later.' } },
          { status: 429, headers: { 'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)) } }
        ),
        remaining: 0,
        resetAt: entry.resetAt,
      };
    }
    entry.count++;
    return { limited: false, remaining: options.limit - entry.count, resetAt: entry.resetAt };
  }

  rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
  return { limited: false, remaining: options.limit - 1, resetAt: now + windowMs };
}

function parseWindow(window: string): number {
  const match = window.match(/^(\d+)([mhd])$/);
  if (!match) return 60000;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 60000;
  }
}

// ── Webhook verification ──────────────────────────────────────────────────────
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  provider: string
): Promise<boolean> {
  const expectedSignature = await hmacSha256(payload, secret);
  return safeEqual(signature, expectedSignature);
}
