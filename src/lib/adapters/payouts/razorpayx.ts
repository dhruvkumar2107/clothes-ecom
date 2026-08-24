import crypto from 'node:crypto';
import type { Paise } from '../../money';
import { gatewayFetch } from '../http';
import {
  GatewayError,
  type CreatePayoutInput,
  type DriverMode,
  type FundAccountInput,
  type PayoutContactInput,
  type PayoutGateway,
  type PayoutResult,
} from '../types';

/**
 * RazorpayX Payouts — the primary payout rail.
 *
 * Docs: https://razorpay.com/docs/api/x/
 *
 * Payouts are a three-object flow, and the objects are permanent:
 *
 *   Contact      — the person (one per user, forever)
 *     └ Fund account — a bank account or VPA belonging to that contact
 *         └ Payout    — one transfer to that fund account
 *
 * Four things this driver handles that a naive integration gets wrong:
 *
 *   • **Contacts and fund accounts are not deduplicated by RazorpayX.** Posting
 *     the same `reference_id` twice creates two contacts. So `createContact` and
 *     `createFundAccount` *search first* and only create on a miss — otherwise
 *     every withdrawal accretes another duplicate contact and the RazorpayX
 *     dashboard becomes unusable within a month.
 *   • **The idempotency header is non-standard.** RazorpayX reads
 *     `X-Payout-Idempotency`, not `Idempotency-Key`. Getting this wrong means a
 *     retried timeout sends the money twice — the single worst bug available in
 *     this system. Both headers are sent: theirs for the gateway, ours to unlock
 *     retry in the shared HTTP client.
 *   • **Narration is validated by the bank rail, not by us.** IMPS accepts up to
 *     30 characters of `[a-zA-Z0-9 ]` only. "LUMEN&CO referral payout" is
 *     rejected on the `&`, so narration is sanitised rather than trusted.
 *   • **`pending` does not mean "in transit".** In RazorpayX it means "waiting
 *     for approval in a workflow", which for us is the same as `queued` — money
 *     has not left. Mapping it to `processing` would show a customer a transfer
 *     that nobody has approved yet.
 */

const API_BASE = 'https://api.razorpay.com/v1';

interface RazorpayXConfig {
  keyId: string;
  keySecret: string;
  /** The RazorpayX current account the money leaves from. */
  accountNumber: string;
  webhookSecret: string | null;
  mode: DriverMode;
}

interface RzpContact {
  id: string;
  name: string;
  email?: string | null;
  contact?: string | null;
  reference_id?: string | null;
  type?: string;
  active?: boolean;
}

interface RzpFundAccount {
  id: string;
  contact_id: string;
  account_type: 'bank_account' | 'vpa';
  bank_account?: {
    name?: string;
    ifsc?: string;
    account_number?: string;
    bank_name?: string;
  } | null;
  vpa?: { address?: string; username?: string; handle?: string } | null;
  active?: boolean;
}

interface RzpPayout {
  id: string;
  entity: string;
  fund_account_id?: string;
  amount: number;
  currency: string;
  status:
    | 'queued'
    | 'pending'
    | 'rejected'
    | 'processing'
    | 'processed'
    | 'cancelled'
    | 'reversed'
    | 'failed';
  purpose?: string;
  utr?: string | null;
  mode?: string;
  reference_id?: string | null;
  narration?: string | null;
  fees?: number;
  tax?: number;
  failure_reason?: string | null;
  status_details?: {
    description?: string | null;
    source?: string | null;
    reason?: string | null;
  } | null;
  created_at?: number;
}

interface RzpList<T> {
  entity: 'collection';
  count: number;
  items: T[];
}

/**
 * RazorpayX status → our vocabulary.
 *
 * `pending` = awaiting workflow approval on RazorpayX's side. No money has
 * moved, so it is `queued` for us, not `processing`.
 * `rejected` / `cancelled` = terminal, money never left → `failed`.
 */
function normalizeStatus(status: RzpPayout['status']): PayoutResult['status'] {
  switch (status) {
    case 'processed':
      return 'processed';
    case 'reversed':
      return 'reversed';
    case 'processing':
      return 'processing';
    case 'queued':
    case 'pending':
      return 'queued';
    default:
      return 'failed';
  }
}

/**
 * Bank rails accept a narrow character set in the statement narration. Strip
 * everything else rather than let the gateway reject a payout the customer has
 * already been told is on its way.
 */
function sanitizeNarration(narration: string): string {
  const cleaned = narration
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 30)
    .trim();
  return cleaned || 'Payout';
}

export class RazorpayXPayouts implements PayoutGateway {
  readonly name = 'razorpayx';
  readonly label: string;
  readonly mode: DriverMode;

  private readonly config: RazorpayXConfig;

  constructor(config: RazorpayXConfig) {
    this.config = config;
    this.mode = config.mode;
    this.label = `RazorpayX (${config.mode})`;
  }

  private get auth() {
    return { username: this.config.keyId, password: this.config.keySecret };
  }

  /**
   * Existing contact for this user, if RazorpayX already has one.
   *
   * A failure here is deliberately swallowed: a listing outage should not block
   * a withdrawal. The worst case is one duplicate contact, which is a tidiness
   * problem; refusing the payout is a customer-facing one.
   */
  private async findContact(referenceId: string): Promise<RzpContact | null> {
    try {
      const response = await gatewayFetch<RzpList<RzpContact>>({
        provider: 'razorpayx',
        url: `${API_BASE}/contacts?reference_id=${encodeURIComponent(referenceId)}&count=10`,
        method: 'GET',
        basicAuth: this.auth,
        timeoutMs: 8_000,
      });
      return (
        response.data.items?.find((c) => c.reference_id === referenceId && c.active !== false) ??
        null
      );
    } catch {
      return null;
    }
  }

  async createContact(input: PayoutContactInput): Promise<{ contactId: string; raw: unknown }> {
    const existing = await this.findContact(input.referenceId);
    if (existing) {
      return { contactId: existing.id, raw: { ...existing, reused: true } };
    }

    const response = await gatewayFetch<RzpContact>({
      provider: 'razorpayx',
      url: `${API_BASE}/contacts`,
      method: 'POST',
      basicAuth: this.auth,
      body: {
        name: input.name.slice(0, 50),
        email: input.email ?? undefined,
        contact: input.phone ?? undefined,
        type: input.type ?? 'customer',
        reference_id: input.referenceId.slice(0, 40),
      },
    });

    return { contactId: response.data.id, raw: response.data };
  }

  private async findFundAccount(input: FundAccountInput): Promise<RzpFundAccount | null> {
    try {
      const response = await gatewayFetch<RzpList<RzpFundAccount>>({
        provider: 'razorpayx',
        url: `${API_BASE}/fund_accounts?contact_id=${encodeURIComponent(input.contactId)}&count=100`,
        method: 'GET',
        basicAuth: this.auth,
        timeoutMs: 8_000,
      });

      const items = response.data.items ?? [];

      if (input.kind === 'bank') {
        const ifsc = input.ifsc?.toUpperCase();
        return (
          items.find(
            (a) =>
              a.account_type === 'bank_account' &&
              a.active !== false &&
              a.bank_account?.ifsc?.toUpperCase() === ifsc &&
              a.bank_account?.account_number === input.accountNumber,
          ) ?? null
        );
      }

      const vpa = input.vpa?.toLowerCase();
      return (
        items.find(
          (a) =>
            a.account_type === 'vpa' &&
            a.active !== false &&
            a.vpa?.address?.toLowerCase() === vpa,
        ) ?? null
      );
    } catch {
      return null;
    }
  }

  async createFundAccount(
    input: FundAccountInput,
  ): Promise<{ fundAccountId: string; raw: unknown }> {
    if (input.kind === 'bank' && (!input.accountNumber || !input.ifsc)) {
      throw new GatewayError({
        code: 'BAD_REQUEST_ERROR',
        message: 'razorpayx: bank fund account requires accountNumber and ifsc',
        provider: 'razorpayx',
        retryable: false,
      });
    }
    if (input.kind === 'upi' && !input.vpa) {
      throw new GatewayError({
        code: 'BAD_REQUEST_ERROR',
        message: 'razorpayx: upi fund account requires vpa',
        provider: 'razorpayx',
        retryable: false,
      });
    }

    const existing = await this.findFundAccount(input);
    if (existing) {
      return { fundAccountId: existing.id, raw: { ...existing, reused: true } };
    }

    const body =
      input.kind === 'bank'
        ? {
            contact_id: input.contactId,
            account_type: 'bank_account',
            bank_account: {
              name: input.accountHolderName.slice(0, 120),
              ifsc: input.ifsc!.toUpperCase(),
              account_number: input.accountNumber!,
            },
          }
        : {
            contact_id: input.contactId,
            account_type: 'vpa',
            vpa: { address: input.vpa!.toLowerCase() },
          };

    const response = await gatewayFetch<RzpFundAccount>({
      provider: 'razorpayx',
      url: `${API_BASE}/fund_accounts`,
      method: 'POST',
      basicAuth: this.auth,
      body,
    });

    return { fundAccountId: response.data.id, raw: response.data };
  }

  async createPayout(input: CreatePayoutInput): Promise<PayoutResult> {
    if (input.amount <= 0) {
      throw new GatewayError({
        code: 'BAD_REQUEST_ERROR',
        message: 'razorpayx: payout amount must be greater than zero',
        provider: 'razorpayx',
        retryable: false,
      });
    }

    // RBI caps a single IMPS transfer at ₹5,00,000. Catching it here gives the
    // customer a useful message instead of a raw gateway rejection.
    if (input.mode === 'IMPS' && input.amount > 50_000_000) {
      throw new GatewayError({
        code: 'amount_exceeds_limit',
        message: 'razorpayx: IMPS is limited to ₹5,00,000 per transaction',
        provider: 'razorpayx',
        retryable: false,
        userMessage:
          'That amount is above the instant transfer limit. Withdraw a smaller amount, or contact support for a NEFT transfer.',
      });
    }

    const response = await gatewayFetch<RzpPayout>({
      provider: 'razorpayx',
      url: `${API_BASE}/payouts`,
      method: 'POST',
      basicAuth: this.auth,
      headers: {
        // RazorpayX's own header — this is the one that actually prevents a
        // duplicate transfer.
        'X-Payout-Idempotency': input.idempotencyKey,
      },
      // And ours, which is what permits the HTTP client to retry a timeout at
      // all. Without a key present it would give up after one attempt.
      idempotencyKey: input.idempotencyKey,
      // A payout that times out at the network layer may still have been
      // accepted; the long timeout reduces how often we land in that ambiguity.
      timeoutMs: 30_000,
      body: {
        account_number: this.config.accountNumber,
        fund_account_id: input.fundAccountId,
        amount: input.amount,
        currency: input.currency || 'INR',
        // The fund account's type must match the mode (VPA ⇔ UPI); RazorpayX
        // rejects a mismatch, and the wallet service pairs them at the source.
        mode: input.mode,
        purpose: 'payout',
        // If the RazorpayX float is short, hold the payout rather than fail it.
        // A queued payout resolves itself once the account is topped up; a
        // failed one needs the customer to request the withdrawal again.
        queue_if_low_balance: true,
        reference_id: input.referenceId.slice(0, 40),
        narration: sanitizeNarration(input.narration),
        notes: input.notes ?? {},
      },
    });

    return this.toResult(response.data);
  }

  async fetchPayout(providerPayoutId: string): Promise<PayoutResult> {
    const response = await gatewayFetch<RzpPayout>({
      provider: 'razorpayx',
      url: `${API_BASE}/payouts/${encodeURIComponent(providerPayoutId)}`,
      method: 'GET',
      basicAuth: this.auth,
    });
    return this.toResult(response.data);
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.config.webhookSecret) {
      // Fail closed. An unsigned payout webhook we accept is an endpoint for
      // marking arbitrary withdrawals "processed" without money moving.
      return false;
    }

    const expected = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(rawBody, 'utf8')
      .digest('hex');

    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature ?? '', 'utf8');
    if (a.length !== b.length) {
      crypto.timingSafeEqual(a, a);
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  }

  /**
   * Available balance on the RazorpayX account.
   *
   * Errors propagate rather than being coerced to zero: a dashboard showing
   * "₹0 available" because a permission is missing would stop an operator
   * approving legitimate withdrawals.
   */
  async fetchBalance(): Promise<{ balance: Paise; currency: string }> {
    interface BalanceResponse {
      balance?: number | { balance?: number; currency?: string };
      currency?: string;
    }

    const response = await gatewayFetch<BalanceResponse>({
      provider: 'razorpayx',
      url: `${API_BASE}/banking_accounts/balance/${encodeURIComponent(this.config.accountNumber)}`,
      method: 'GET',
      basicAuth: this.auth,
      timeoutMs: 8_000,
    });

    const raw = response.data.balance;
    if (typeof raw === 'number') {
      return { balance: raw, currency: response.data.currency ?? 'INR' };
    }
    return {
      balance: raw?.balance ?? 0,
      currency: raw?.currency ?? response.data.currency ?? 'INR',
    };
  }

  private toResult(p: RzpPayout): PayoutResult {
    return {
      providerPayoutId: p.id,
      amount: p.amount,
      status: normalizeStatus(p.status),
      mode: p.mode ?? null,
      utr: p.utr ?? null,
      // status_details carries the human-readable reason on a failure; the
      // top-level failure_reason is often null even when the payout failed.
      failureReason:
        p.status_details?.description ?? p.failure_reason ?? p.status_details?.reason ?? null,
      fees: p.fees ?? 0,
      tax: p.tax ?? 0,
      raw: p,
    };
  }
}
