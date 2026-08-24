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
 * Cashfree Payouts — the alternate payout rail.
 *
 * Docs: https://docs.cashfree.com/reference/payouts-version1
 *
 * Cashfree's model differs from RazorpayX in three ways that each change the
 * code, not just the URLs:
 *
 *   • **Amounts are in rupees, not paise.** `"1500.00"` means ₹1,500, where
 *     Razorpay's `150000` means the same thing. Every other number in this
 *     codebase is integer paise, so conversion is confined to this file and
 *     asserted on the way back in. Getting this wrong pays out 100× or 1/100×
 *     the intended amount, which is why it is the first thing in this comment.
 *   • **There is no separate contact object.** A Cashfree *beneficiary* is the
 *     person and the bank account fused into one record, keyed by a `beneId` we
 *     choose. So `createContact` makes no network call — it derives the id — and
 *     `createFundAccount` is what actually registers anything.
 *   • **Idempotency is the `transferId`, not a header.** Re-sending a transfer
 *     with an existing id returns subCode 409, and the correct response to that
 *     is to *fetch the original transfer* and report its real status — not to
 *     retry with a new id, which would pay twice.
 *
 * Auth is a short-lived bearer token (300s) from `/payout/v1/authorize`, cached
 * and refreshed with 60s of headroom. Cashfree also requires the calling server's
 * IP to be whitelisted in their dashboard; a 403 with `IP_NOT_WHITELISTED` means
 * that, not a bad key.
 */

interface CashfreePayoutsConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  mode: DriverMode;
}

interface CfEnvelope<T> {
  status?: 'SUCCESS' | 'ERROR';
  subCode?: string;
  message?: string;
  data?: T;
}

interface CfAuthData {
  token: string;
  expiry: number;
}

interface CfTransfer {
  transferId?: string;
  referenceId?: string | number;
  status?: 'SUCCESS' | 'PENDING' | 'FAILED' | 'REVERSED' | 'REJECTED' | 'RECEIVED';
  acknowledged?: number;
  utr?: string | null;
  amount?: string | number;
  transferMode?: string;
  reason?: string | null;
  bankDetails?: Record<string, unknown>;
}

interface CfBalanceData {
  balance?: string | number;
  availableBalance?: string | number;
}

const TOKEN_TTL_HEADROOM_MS = 60_000;

/** Our paise → Cashfree's rupee string. */
function toRupeeString(paise: Paise): string {
  return (paise / 100).toFixed(2);
}

/** Cashfree's rupee string → our paise. Rounded, because floats. */
function fromRupees(value: string | number | undefined): Paise {
  if (value === undefined || value === null) return 0;
  const n = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/**
 * Cashfree ids accept `[A-Za-z0-9_-]` (plus `.` and `@` for beneIds) and are
 * length-capped. Sanitising here keeps a UUID-with-colons reference from being
 * rejected at the last step of a withdrawal.
 */
function safeId(value: string, max: number): string {
  const cleaned = value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, max);
  return cleaned || `id${crypto.createHash('sha256').update(value).digest('hex').slice(0, 12)}`;
}

function shortHash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 10);
}

/**
 * Cashfree requires contact fields (email, phone, address) on the beneficiary
 * record even though only the account number and IFSC determine where money
 * lands. `createContact` caches what it was given so `createFundAccount` can
 * include it. Survives hot reload; a cold miss falls back to placeholders.
 */
interface ContactDetails {
  name: string;
  email?: string | null;
  phone?: string | null;
}
const store = globalThis as unknown as { __cfPayoutContacts?: Map<string, ContactDetails> };
const contactCache = (store.__cfPayoutContacts ??= new Map<string, ContactDetails>());

/** Cashfree transfer status → our vocabulary. */
function normalizeStatus(status: CfTransfer['status']): PayoutResult['status'] {
  switch (status) {
    case 'SUCCESS':
      return 'processed';
    case 'REVERSED':
      return 'reversed';
    case 'PENDING':
      return 'processing';
    case 'RECEIVED':
      // Accepted into Cashfree's queue; the bank has not been contacted yet.
      return 'queued';
    default:
      return 'failed';
  }
}

/** Our mode → Cashfree's `transferMode` values. */
function transferMode(mode: CreatePayoutInput['mode']): string {
  switch (mode) {
    case 'IMPS':
      return 'imps';
    case 'RTGS':
      return 'rtgs';
    case 'UPI':
      return 'upi';
    default:
      return 'neft';
  }
}

export class CashfreePayouts implements PayoutGateway {
  readonly name = 'cashfree';
  readonly label: string;
  readonly mode: DriverMode;

  private readonly config: CashfreePayoutsConfig;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(config: CashfreePayoutsConfig) {
    this.config = config;
    this.mode = config.mode;
    this.label = `Cashfree Payouts (${config.mode})`;
  }

  /** Bearer token, cached. Re-authorising per call would triple request volume. */
  private async authorize(): Promise<string> {
    if (this.token && this.token.expiresAt - Date.now() > TOKEN_TTL_HEADROOM_MS) {
      return this.token.value;
    }

    const response = await gatewayFetch<CfEnvelope<CfAuthData>>({
      provider: 'cashfree',
      url: `${this.config.baseUrl}/payout/v1/authorize`,
      method: 'POST',
      headers: {
        'X-Client-Id': this.config.clientId,
        'X-Client-Secret': this.config.clientSecret,
      },
      timeoutMs: 10_000,
    });

    const token = response.data.data?.token;
    if (!token) {
      throw new GatewayError({
        code: response.data.subCode ?? 'AUTH_FAILED',
        message: `cashfree: authorization failed — ${response.data.message ?? 'no token returned'}`,
        provider: 'cashfree',
        retryable: false,
        raw: response.responseSnapshot,
      });
    }

    // Cashfree tokens live 300s. Trust the returned expiry when present.
    const expiry = response.data.data?.expiry;
    const expiresAt =
      typeof expiry === 'number' && expiry > 1_000_000_000
        ? expiry * 1000
        : Date.now() + 300_000;

    this.token = { value: token, expiresAt };
    return token;
  }

  private async call<T>(init: {
    path: string;
    method?: 'GET' | 'POST';
    body?: unknown;
    idempotencyKey?: string;
    timeoutMs?: number;
  }): Promise<CfEnvelope<T>> {
    const token = await this.authorize();

    const response = await gatewayFetch<CfEnvelope<T>>({
      provider: 'cashfree',
      url: `${this.config.baseUrl}${init.path}`,
      method: init.method ?? 'GET',
      bearerToken: token,
      body: init.body,
      idempotencyKey: init.idempotencyKey,
      timeoutMs: init.timeoutMs,
      // Cashfree returns business-level failures as HTTP 200 with a subCode, and
      // uses 4xx for auth/shape problems. Both need to reach the normalisers
      // rather than being thrown as transport errors.
      expectStatuses: [200, 400, 403, 409, 422],
    });

    return response.data;
  }

  /**
   * No network call: a Cashfree beneficiary *is* the contact. This derives the
   * stable id the fund account will hang off and remembers the contact fields
   * Cashfree insists on collecting.
   */
  async createContact(input: PayoutContactInput): Promise<{ contactId: string; raw: unknown }> {
    const contactId = safeId(`u${input.referenceId}`, 60);
    contactCache.set(contactId, {
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
    });
    return {
      contactId,
      raw: { driver: 'cashfree', note: 'beneficiary-based model; no contact object', contactId },
    };
  }

  async createFundAccount(
    input: FundAccountInput,
  ): Promise<{ fundAccountId: string; raw: unknown }> {
    if (input.kind === 'bank' && (!input.accountNumber || !input.ifsc)) {
      throw new GatewayError({
        code: 'BAD_REQUEST_ERROR',
        message: 'cashfree: bank beneficiary requires accountNumber and ifsc',
        provider: 'cashfree',
        retryable: false,
      });
    }
    if (input.kind === 'upi' && !input.vpa) {
      throw new GatewayError({
        code: 'BAD_REQUEST_ERROR',
        message: 'cashfree: upi beneficiary requires vpa',
        provider: 'cashfree',
        retryable: false,
      });
    }

    // One beneId per instrument, so a user with two bank accounts gets two
    // beneficiaries rather than silently overwriting the first.
    const instrument =
      input.kind === 'bank' ? `${input.ifsc}:${input.accountNumber}` : `vpa:${input.vpa}`;
    const beneId = safeId(`${input.contactId}_${shortHash(instrument)}`, 90);

    const contact = contactCache.get(input.contactId);
    // Cashfree validates the *shape* of these fields but they play no part in
    // routing the money — the account number and IFSC do that. Placeholders on a
    // cache miss are therefore safe, and better than failing the withdrawal.
    const email = contact?.email ?? `payouts+${beneId}@lumenandco.example`;
    const phone = (contact?.phone ?? '9999999999').replace(/\D/g, '').slice(-10);

    const body: Record<string, unknown> = {
      beneId,
      name: input.accountHolderName.slice(0, 100),
      email,
      phone,
      address1: 'NA',
      city: 'NA',
      state: 'NA',
      pincode: '400001',
    };

    if (input.kind === 'bank') {
      body.bankAccount = input.accountNumber;
      body.ifsc = input.ifsc!.toUpperCase();
    } else {
      body.vpa = input.vpa!.toLowerCase();
    }

    const envelope = await this.call<Record<string, unknown>>({
      path: '/payout/v1/addBeneficiary',
      method: 'POST',
      body,
    });

    // 409 = this beneId already exists, which is exactly what we want when the
    // same customer withdraws to the same account again.
    const alreadyExists =
      envelope.subCode === '409' || /already exist/i.test(envelope.message ?? '');

    if (envelope.status !== 'SUCCESS' && !alreadyExists) {
      throw new GatewayError({
        code: envelope.subCode ?? 'BENEFICIARY_FAILED',
        message: `cashfree: ${envelope.message ?? 'could not register beneficiary'}`,
        provider: 'cashfree',
        retryable: false,
        raw: envelope,
        userMessage: 'The bank could not accept these account details. Please re-check them.',
      });
    }

    return {
      fundAccountId: beneId,
      raw: { ...envelope, reused: alreadyExists },
    };
  }

  async createPayout(input: CreatePayoutInput): Promise<PayoutResult> {
    if (input.amount <= 0) {
      throw new GatewayError({
        code: 'BAD_REQUEST_ERROR',
        message: 'cashfree: payout amount must be greater than zero',
        provider: 'cashfree',
        retryable: false,
      });
    }
    // Cashfree's minimum transfer is ₹1.00; below that the API rejects with a
    // shape error that reads like a validation bug.
    if (input.amount < 100) {
      throw new GatewayError({
        code: 'amount_below_minimum',
        message: 'cashfree: minimum transfer is ₹1.00',
        provider: 'cashfree',
        retryable: false,
        userMessage: 'The minimum withdrawal is ₹1.',
      });
    }

    // The transferId *is* the idempotency key at Cashfree, so it must be derived
    // from the caller's key and never randomised.
    const transferId = safeId(input.idempotencyKey, 40);

    const envelope = await this.call<CfTransfer>({
      path: '/payout/v1/requestTransfer',
      method: 'POST',
      idempotencyKey: input.idempotencyKey,
      timeoutMs: 30_000,
      body: {
        beneId: input.fundAccountId,
        // Rupees, not paise. See the class docstring.
        amount: toRupeeString(input.amount),
        transferId,
        transferMode: transferMode(input.mode),
        remarks: input.narration.slice(0, 70),
      },
    });

    // A duplicate transferId means we already sent this. Report the original's
    // real state — retrying under a new id would pay the customer twice.
    const duplicate =
      envelope.subCode === '409' || /already\s*(exist|processed)/i.test(envelope.message ?? '');
    if (duplicate) {
      return this.fetchPayout(transferId);
    }

    // Insufficient balance in the payout account is an operator problem, not a
    // customer one, and it is retryable once the float is topped up.
    if (envelope.subCode === '402') {
      throw new GatewayError({
        code: 'insufficient_payout_balance',
        message: `cashfree: ${envelope.message ?? 'insufficient balance in payout account'}`,
        provider: 'cashfree',
        retryable: true,
        raw: envelope,
        userMessage: 'This withdrawal could not be processed right now. Please try again shortly.',
      });
    }

    const accepted =
      envelope.status === 'SUCCESS' || envelope.subCode === '200' || envelope.subCode === '201';

    if (!accepted) {
      throw new GatewayError({
        code: envelope.subCode ?? 'TRANSFER_FAILED',
        message: `cashfree: ${envelope.message ?? 'transfer was not accepted'}`,
        provider: 'cashfree',
        retryable: false,
        raw: envelope,
      });
    }

    const transfer = envelope.data ?? {};

    return {
      providerPayoutId: transferId,
      amount: input.amount,
      // subCode 200 = settled immediately (rare), 201 = accepted for processing.
      status: transfer.status
        ? normalizeStatus(transfer.status)
        : envelope.subCode === '200'
          ? 'processing'
          : 'queued',
      mode: input.mode,
      utr: transfer.utr ?? null,
      // Cashfree bills payout fees on the monthly invoice, not per transfer.
      fees: 0,
      tax: 0,
      raw: envelope,
    };
  }

  async fetchPayout(providerPayoutId: string): Promise<PayoutResult> {
    const query = new URLSearchParams({ transferId: providerPayoutId }).toString();

    const envelope = await this.call<{ transfer?: CfTransfer } & CfTransfer>({
      path: `/payout/v1/getTransferStatus?${query}`,
    });

    const transfer = envelope.data?.transfer ?? envelope.data ?? {};

    if (!transfer.status && envelope.status !== 'SUCCESS') {
      throw new GatewayError({
        code: envelope.subCode ?? 'not_found',
        message: `cashfree: ${envelope.message ?? `no transfer found for ${providerPayoutId}`}`,
        provider: 'cashfree',
        retryable: false,
        raw: envelope,
      });
    }

    return {
      providerPayoutId,
      amount: fromRupees(transfer.amount),
      status: normalizeStatus(transfer.status),
      mode: transfer.transferMode ?? null,
      utr: transfer.utr ?? null,
      failureReason: transfer.reason ?? null,
      fees: 0,
      tax: 0,
      raw: envelope,
    };
  }

  /**
   * Cashfree signs payout webhooks with base64 HMAC-SHA256 keyed by the client
   * secret. Version 1 signs a concatenation of the posted values sorted by key;
   * later versions sign the raw body. Both are computed and compared in constant
   * time, because rejecting a legitimate "payout reversed" notification is how a
   * customer's wallet stays wrongly debited.
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!signature) return false;

    const candidates: string[] = [rawBody];

    try {
      const parsed = JSON.parse(rawBody) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const canonical = Object.keys(parsed)
          .filter((k) => k !== 'signature')
          .sort()
          .map((k) => String(parsed[k] ?? ''))
          .join('');
        candidates.push(canonical);
      }
    } catch {
      // Form-encoded or malformed bodies fall back to the raw comparison.
    }

    const provided = Buffer.from(signature, 'utf8');
    let matched = false;

    for (const candidate of candidates) {
      const expected = Buffer.from(
        crypto
          .createHmac('sha256', this.config.clientSecret)
          .update(candidate, 'utf8')
          .digest('base64'),
        'utf8',
      );

      if (expected.length !== provided.length) {
        // Burn an equivalent comparison so a length mismatch is not measurably
        // faster than a content mismatch.
        crypto.timingSafeEqual(expected, expected);
        continue;
      }
      if (crypto.timingSafeEqual(expected, provided)) matched = true;
    }

    return matched;
  }

  async fetchBalance(): Promise<{ balance: Paise; currency: string }> {
    const envelope = await this.call<CfBalanceData>({
      path: '/payout/v1/getBalance',
      timeoutMs: 8_000,
    });

    const data = envelope.data ?? {};
    // availableBalance excludes amounts already committed to queued transfers,
    // which is the number an operator actually needs before approving payouts.
    return {
      balance: fromRupees(data.availableBalance ?? data.balance),
      currency: 'INR',
    };
  }
}
