import crypto from 'node:crypto';
import type { Paise } from '../../money';
import {
  GatewayError,
  type CreatePayoutInput,
  type FundAccountInput,
  type PayoutContactInput,
  type PayoutGateway,
  type PayoutResult,
} from '../types';

/**
 * Mock payout gateway (wallet → bank).
 *
 * Payouts are the highest-consequence operation in the platform: a bug here
 * sends a customer's referral earnings to the wrong account, twice, or not at
 * all. So the mock models the parts that actually cause those bugs:
 *
 *   • **Asynchronous settlement.** `createPayout` returns `queued`, never
 *     `processed`. IMPS is fast but not synchronous, NEFT is batched, and a
 *     payout can still fail or be reversed *after* the API said 200 OK. Code
 *     written against a mock that returns instant success has no place to put
 *     the reversal handling it will eventually need.
 *   • **Idempotency.** A payout request carrying an idempotency key that was
 *     already used returns the *original* payout rather than creating a second
 *     one. That is the behaviour real gateways have and the reason a timed-out
 *     "create payout" is safe to retry — so it is worth exercising in dev.
 *   • **Retryable vs terminal failures.** `failureReason` distinguishes "bank
 *     was down, try again" from "account is invalid, stop". The withdrawal state
 *     machine branches on exactly this.
 *
 * Outcomes are selected by the **paise digits of the amount**, so any branch is
 * reachable from the withdrawal form without code changes:
 *
 *   ₹500.01 → failed, terminal   (beneficiary account invalid)
 *   ₹500.02 → failed, retryable  (bank unavailable — exercises payout retry)
 *   ₹500.03 → reversed           (bank returned the funds; wallet re-credited)
 *   ₹500.04 → stuck in processing (exercises the "still pending" admin view)
 *   anything else → processed with a synthetic UTR
 */

const QUEUED_MS = 3_000;
const SETTLE_MS = 8_000;

type MockPayoutOutcome = 'processed' | 'invalid_account' | 'bank_down' | 'reversed' | 'stuck';

function outcomeFor(amount: Paise): MockPayoutOutcome {
  switch (amount % 100) {
    case 1:
      return 'invalid_account';
    case 2:
      return 'bank_down';
    case 3:
      return 'reversed';
    case 4:
      return 'stuck';
    default:
      return 'processed';
  }
}

interface PayoutPayload {
  t: number;
  amount: number;
  mode: string;
  fundAccountId: string;
  referenceId: string;
}

const PAYOUT_PREFIX = 'pout_mock_';

function encode(payload: PayoutPayload): string {
  return `${PAYOUT_PREFIX}${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')}`;
}

function decode(id: string): PayoutPayload | null {
  if (!id.startsWith(PAYOUT_PREFIX)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(id.slice(PAYOUT_PREFIX.length), 'base64url').toString('utf8'),
    ) as PayoutPayload;
    return typeof parsed.amount === 'number' && typeof parsed.t === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Idempotency ledger. Survives Next hot reload so a retried request during
 * development behaves the way it would in production.
 */
const store = globalThis as unknown as { __mockPayoutIdem?: Map<string, string> };
const idempotencyLedger = (store.__mockPayoutIdem ??= new Map<string, string>());

/** Stable id from a seed, so the same input always yields the same handle. */
function stableId(prefix: string, seed: string): string {
  const hash = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 14);
  return `${prefix}_mock_${hash}`;
}

function syntheticUtr(seed: string): string {
  const digits = crypto
    .createHash('sha256')
    .update(seed)
    .digest('hex')
    .replace(/\D/g, '')
    .padEnd(12, '0')
    .slice(0, 12);
  return `MOCKP${digits}`;
}

export class MockPayouts implements PayoutGateway {
  readonly name = 'mock';
  readonly mode = 'mock' as const;
  readonly label = 'Mock payout gateway';

  async createContact(input: PayoutContactInput): Promise<{ contactId: string; raw: unknown }> {
    // Real gateways key contacts on reference_id, so the same user always
    // resolves to the same contact rather than accumulating duplicates.
    return {
      contactId: stableId('cont', input.referenceId),
      raw: { driver: 'mock', name: input.name, referenceId: input.referenceId },
    };
  }

  async createFundAccount(
    input: FundAccountInput,
  ): Promise<{ fundAccountId: string; raw: unknown }> {
    if (input.kind === 'bank') {
      if (!input.accountNumber || !input.ifsc) {
        throw new GatewayError({
          code: 'BAD_REQUEST_ERROR',
          message: 'mock: bank fund account requires accountNumber and ifsc',
          provider: 'mock',
          retryable: false,
        });
      }
    } else if (!input.vpa) {
      throw new GatewayError({
        code: 'BAD_REQUEST_ERROR',
        message: 'mock: upi fund account requires vpa',
        provider: 'mock',
        retryable: false,
      });
    }

    const seed =
      input.kind === 'bank'
        ? `${input.contactId}:${input.ifsc}:${input.accountNumber}`
        : `${input.contactId}:${input.vpa}`;

    return {
      fundAccountId: stableId('fa', seed),
      raw: {
        driver: 'mock',
        kind: input.kind,
        // Never echo the full account number back, even in mock — this object
        // gets persisted on PayoutAttempt.
        accountLast4: input.accountNumber?.slice(-4) ?? null,
        ifsc: input.ifsc ?? null,
        vpa: input.vpa ?? null,
      },
    };
  }

  async createPayout(input: CreatePayoutInput): Promise<PayoutResult> {
    if (input.amount <= 0) {
      throw new GatewayError({
        code: 'BAD_REQUEST_ERROR',
        message: 'mock: payout amount must be greater than zero',
        provider: 'mock',
        retryable: false,
      });
    }

    // IMPS is capped at ₹5 lakh per transaction; a real gateway rejects this, so
    // the mock must too or the rail-selection logic never gets tested.
    if (input.mode === 'IMPS' && input.amount > 50_000_000) {
      throw new GatewayError({
        code: 'amount_exceeds_limit',
        message: 'mock: IMPS transactions are capped at ₹5,00,000',
        provider: 'mock',
        retryable: false,
        userMessage: 'That amount is above the instant transfer limit. Please withdraw less.',
      });
    }

    // The whole point of an idempotency key: a retried request returns the
    // original payout instead of sending money a second time.
    const existing = idempotencyLedger.get(input.idempotencyKey);
    if (existing) {
      return this.resolve(existing, { replayed: true });
    }

    const id = encode({
      t: Date.now(),
      amount: input.amount,
      mode: input.mode,
      fundAccountId: input.fundAccountId,
      referenceId: input.referenceId,
    });

    idempotencyLedger.set(input.idempotencyKey, id);

    return {
      providerPayoutId: id,
      amount: input.amount,
      status: 'queued',
      mode: input.mode,
      utr: null,
      fees: 0,
      tax: 0,
      raw: {
        driver: 'mock',
        narration: input.narration.slice(0, 30),
        settlesInMs: SETTLE_MS,
        deterministicOutcome: outcomeFor(input.amount),
      },
    };
  }

  async fetchPayout(providerPayoutId: string): Promise<PayoutResult> {
    return this.resolve(providerPayoutId, {});
  }

  private resolve(providerPayoutId: string, extra: Record<string, unknown>): PayoutResult {
    const p = decode(providerPayoutId);
    if (!p) {
      throw new GatewayError({
        code: 'not_found',
        message: `mock: unknown payout ${providerPayoutId}`,
        provider: 'mock',
        retryable: false,
      });
    }

    const elapsed = Date.now() - p.t;
    const outcome = outcomeFor(p.amount);

    // RazorpayX charges a flat fee plus 18% GST on it; modelling that keeps the
    // settlement reports honest about what leaves the account.
    const fees = p.mode === 'IMPS' ? 500 : p.mode === 'RTGS' ? 1000 : 250;
    const tax = Math.round(fees * 0.18);

    const base = {
      providerPayoutId,
      amount: p.amount,
      mode: p.mode,
      fees,
      tax,
    };

    if (elapsed < QUEUED_MS) {
      return { ...base, status: 'queued', utr: null, raw: { driver: 'mock', elapsed, ...extra } };
    }
    if (elapsed < SETTLE_MS || outcome === 'stuck') {
      return {
        ...base,
        status: 'processing',
        utr: null,
        raw: {
          driver: 'mock',
          elapsed,
          note: outcome === 'stuck' ? 'Amount ending in .04 never settles.' : undefined,
          ...extra,
        },
      };
    }

    switch (outcome) {
      case 'invalid_account':
        return {
          ...base,
          status: 'failed',
          utr: null,
          failureReason: 'Beneficiary account number is invalid',
          raw: { driver: 'mock', code: 'BENEFICIARY_ACCOUNT_INVALID', retryable: false, ...extra },
        };
      case 'bank_down':
        return {
          ...base,
          status: 'failed',
          utr: null,
          failureReason: 'Beneficiary bank is temporarily unavailable',
          raw: { driver: 'mock', code: 'BENEFICIARY_BANK_UNAVAILABLE', retryable: true, ...extra },
        };
      case 'reversed':
        return {
          ...base,
          status: 'reversed',
          utr: syntheticUtr(providerPayoutId),
          failureReason: 'Funds returned by the beneficiary bank',
          raw: { driver: 'mock', code: 'PAYOUT_REVERSED', ...extra },
        };
      default:
        return {
          ...base,
          status: 'processed',
          utr: syntheticUtr(providerPayoutId),
          raw: { driver: 'mock', elapsed, ...extra },
        };
    }
  }

  verifyWebhookSignature(): boolean {
    // No signing secret exists in mock mode; the webhook route refuses
    // mock-signed payloads unless the resolved driver is the mock, so this
    // cannot become a production bypass.
    return true;
  }

  async fetchBalance(): Promise<{ balance: Paise; currency: string }> {
    // A fixed ₹5,00,000 float, so the admin payouts dashboard has something
    // sensible to render and the "insufficient balance" guard is testable by
    // requesting more than this.
    return { balance: 50_000_000, currency: 'INR' };
  }
}
