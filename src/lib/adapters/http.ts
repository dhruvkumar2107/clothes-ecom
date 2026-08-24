import { GatewayError } from './types';

/**
 * Shared HTTP client for every outbound vendor call.
 *
 * Hand-rolling `fetch` at each call site is how integrations rot: one forgets a
 * timeout and hangs a request thread, another retries a non-idempotent POST and
 * double-charges someone, a third swallows the vendor's error body so support
 * has nothing to debug with. This centralises the four decisions that matter:
 *
 *   • **Timeouts.** Always set. A payment gateway that stops responding must
 *     fail our request in seconds, not hold a checkout open indefinitely.
 *   • **Retries.** Only for genuinely transient failures (network error, 5xx,
 *     429), only with backoff + jitter, and only when the caller has passed an
 *     idempotency key — otherwise a retried "create payout" moves money twice.
 *   • **Error shape.** Vendors put failure codes in different places. Everything
 *     leaves here as a `GatewayError` with a stable code and an honest
 *     `retryable` flag.
 *   • **Redaction.** Request/response bodies get persisted for audit, so
 *     account numbers and keys are scrubbed before they can reach a log.
 */

export interface GatewayRequest {
  provider: string;
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /**
   * Serialized as JSON, unless it is already a string — Stripe's API is
   * form-encoded, so its driver passes a pre-encoded string and sets
   * `Content-Type` itself.
   */
  body?: unknown;
  headers?: Record<string, string>;
  /** HTTP Basic — the auth scheme Razorpay and Cashfree Payouts both use. */
  basicAuth?: { username: string; password: string };
  bearerToken?: string;
  timeoutMs?: number;
  /**
   * Presence of a key is what makes a POST safe to retry. Without it, this
   * client will not retry a mutating request even on a 5xx.
   */
  idempotencyKey?: string;
  maxAttempts?: number;
  /** Treat these statuses as success and return the parsed body. */
  expectStatuses?: number[];
}

export interface GatewayResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string>;
  /** Redacted, ready to persist on an audit record. */
  requestSnapshot: unknown;
  responseSnapshot: unknown;
  durationMs: number;
  attempts: number;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_ATTEMPTS = 3;

/** Field names whose values must never be persisted or logged in full. */
const SENSITIVE_KEYS = new Set([
  'account_number',
  'accountnumber',
  'accountNumber',
  'card',
  'cvv',
  'card_number',
  'password',
  'secret',
  'client_secret',
  'key_secret',
  'authorization',
  'x-api-key',
  'x-client-secret',
  'private_key',
  'token',
  'access_token',
]);

/**
 * Recursively redact sensitive values, keeping the last 4 characters of
 * account-like fields so an operator can still match a record to a statement.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[deep]';
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (SENSITIVE_KEYS.has(key) || SENSITIVE_KEYS.has(lower)) {
        if (typeof val === 'string' && val.length > 4 && /^\d+$/.test(val)) {
          out[key] = `••••${val.slice(-4)}`;
        } else {
          out[key] = '[redacted]';
        }
      } else {
        out[key] = redact(val, depth + 1);
      }
    }
    return out;
  }

  return value;
}

function isRetryableStatus(status: number): boolean {
  // 429 = rate limited, 5xx = vendor-side. 4xx otherwise means *we* were wrong,
  // and repeating the same wrong request will stay wrong.
  return status === 429 || status === 408 || (status >= 500 && status <= 599);
}

/**
 * Pull a usable error code + message out of an arbitrary vendor error body.
 * Handles Razorpay (`error.code`/`error.description`), Cashfree
 * (`subCode`/`message`), and Decentro (`decentroTxnId`/`message`) shapes.
 */
function extractError(
  provider: string,
  status: number,
  data: unknown,
): { code: string; message: string } {
  const body = (data ?? {}) as Record<string, unknown>;

  const nested = (body.error ?? {}) as Record<string, unknown>;
  const code =
    (nested.code as string) ??
    (body.code as string) ??
    (body.subCode as string) ??
    (body.status as string) ??
    `HTTP_${status}`;

  const message =
    (nested.description as string) ??
    (nested.message as string) ??
    (body.message as string) ??
    (body.error_description as string) ??
    (typeof data === 'string' ? data : `${provider} returned HTTP ${status}`);

  return { code: String(code), message: String(message).slice(0, 500) };
}

export async function gatewayFetch<T = unknown>(
  request: GatewayRequest,
): Promise<GatewayResponse<T>> {
  const {
    provider,
    url,
    method = 'GET',
    body,
    headers = {},
    basicAuth,
    bearerToken,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    idempotencyKey,
    expectStatuses,
  } = request;

  const isMutating = method !== 'GET';
  // A mutating call without an idempotency key gets exactly one attempt.
  const maxAttempts =
    request.maxAttempts ?? (isMutating && !idempotencyKey ? 1 : DEFAULT_MAX_ATTEMPTS);

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'LumenAndCo/1.0 (+commerce-platform)',
    ...headers,
  };

  if (body !== undefined && !finalHeaders['Content-Type']) {
    finalHeaders['Content-Type'] = 'application/json';
  }
  if (basicAuth) {
    const encoded = Buffer.from(`${basicAuth.username}:${basicAuth.password}`).toString('base64');
    finalHeaders.Authorization = `Basic ${encoded}`;
  }
  if (bearerToken) {
    finalHeaders.Authorization = `Bearer ${bearerToken}`;
  }
  if (idempotencyKey) {
    // Razorpay uses X-Payout-Idempotency; most others accept Idempotency-Key.
    finalHeaders['Idempotency-Key'] ??= idempotencyKey;
  }

  const serializedBody =
    body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body);
  const requestSnapshot = redact({ url, method, body });

  const startedAt = Date.now();
  let lastError: GatewayError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: finalHeaders,
        body: serializedBody,
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timer);

      const rawText = await response.text();
      let data: unknown = null;
      if (rawText) {
        try {
          data = JSON.parse(rawText);
        } catch {
          // Some vendors return HTML error pages or bare strings.
          data = rawText;
        }
      }

      const ok = expectStatuses
        ? expectStatuses.includes(response.status)
        : response.ok;

      if (ok) {
        return {
          status: response.status,
          data: data as T,
          headers: Object.fromEntries(response.headers.entries()),
          requestSnapshot,
          responseSnapshot: redact(data),
          durationMs: Date.now() - startedAt,
          attempts: attempt,
        };
      }

      const { code, message } = extractError(provider, response.status, data);
      const retryable = isRetryableStatus(response.status) && (!isMutating || !!idempotencyKey);

      lastError = new GatewayError({
        code,
        message: `${provider}: ${message}`,
        provider,
        httpStatus: response.status,
        retryable,
        raw: redact(data),
        userMessage: userFacingMessage(code, response.status),
      });

      if (!retryable || attempt === maxAttempts) throw lastError;
    } catch (error) {
      clearTimeout(timer);

      if (error instanceof GatewayError) {
        if (!error.retryable || attempt === maxAttempts) throw error;
        lastError = error;
      } else {
        const aborted = error instanceof Error && error.name === 'AbortError';
        // A timeout on a mutating request is the dangerous case: the vendor may
        // have processed it. Only retry when an idempotency key makes that safe.
        const retryable = !isMutating || !!idempotencyKey;

        lastError = new GatewayError({
          code: aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
          message: aborted
            ? `${provider}: request timed out after ${timeoutMs}ms`
            : `${provider}: ${(error as Error).message}`,
          provider,
          retryable,
          raw: { name: (error as Error).name },
          userMessage:
            'We could not reach the payment network. Please check your connection and try again.',
        });

        if (!retryable || attempt === maxAttempts) throw lastError;
      }
    }

    // Exponential backoff with jitter, so concurrent clients don't retry in lockstep.
    const backoff = 400 * 2 ** (attempt - 1);
    const jitter = Math.random() * backoff * 0.4;
    await new Promise((r) => setTimeout(r, backoff + jitter));
  }

  throw (
    lastError ??
    new GatewayError({
      code: 'UNKNOWN',
      message: `${provider}: request failed`,
      provider,
    })
  );
}

/**
 * Map vendor codes to copy a customer should actually see. Anything unmapped
 * gets a generic message — vendor strings leak internals and often name the
 * wrong party ("merchant account inactive" is not the shopper's problem).
 */
function userFacingMessage(code: string, status: number): string {
  const map: Record<string, string> = {
    BAD_REQUEST_ERROR: 'Those payment details look incorrect. Please check and try again.',
    GATEWAY_ERROR: 'Your bank could not be reached. Please try a different payment method.',
    SERVER_ERROR: 'The payment network is having trouble. Please try again in a moment.',
    'payment_failed': 'The payment did not go through. You have not been charged.',
    'BAD_REQUEST_PAYMENT_FAILED': 'The payment was declined by your bank.',
    'insufficient_balance': 'Insufficient balance in the selected account.',
    'invalid_vpa': 'That UPI ID does not look valid. Please re-enter it.',
    'invalid_ifsc': 'That IFSC code is not valid. Please check your passbook.',
    'account_invalid': 'The bank rejected these account details.',
    TIMEOUT: 'The payment network is slow to respond. Please try again.',
    NETWORK_ERROR: 'We could not reach the payment network. Please try again.',
  };

  if (map[code]) return map[code];
  if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
  if (status >= 500) return 'The payment network is temporarily unavailable. Please try again.';
  return 'Something went wrong with that payment. Please try again.';
}

/** Small helper for building form-encoded bodies (Apple's token endpoint). */
export function formEncode(data: Record<string, string>): string {
  return new URLSearchParams(data).toString();
}
