import crypto from 'node:crypto';
import { gatewayFetch } from '../http';
import { lookupIfscShared } from './ifsc';
import { isValidAccountNumberFormat, isValidVpaFormat, matchNames } from './name-match';
import {
  GatewayError,
  type BankVerificationResult,
  type BankVerifier,
  type DriverMode,
  type IfscDetails,
} from '../types';

/**
 * Cashfree Payouts — bank account & UPI validation.
 *
 * Docs: https://docs.cashfree.com/reference/payouts-version-1-validation
 *
 * Two things make this driver shaped differently from the Razorpay one:
 *
 *   • **Bearer tokens, not Basic auth.** Cashfree issues a short-lived token
 *     (300 seconds) from `/payout/v1/authorize` in exchange for the client id
 *     and secret. It's cached here and refreshed with a safety margin, because
 *     re-authorising on every call would triple the request count.
 *   • **Async validation is a separate endpoint.** The synchronous
 *     `/validation/bankDetails` blocks for up to 30 seconds, which is too long
 *     to hold a web request. We use the `/async` variant and poll, which also
 *     matches the `pending → verified` state machine the rest of the platform
 *     is built around.
 *
 * Cashfree returns the name the bank holds in `data.nameAtBank`; the actual
 * accept/reject decision is ours, made by comparing it with `matchNames`.
 */

interface CashfreeVerifierConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  mode: DriverMode;
}

interface CashfreeEnvelope<T> {
  status: 'SUCCESS' | 'ERROR' | 'PENDING';
  subCode: string;
  message?: string;
  data?: T;
}

interface CashfreeToken {
  token: string;
  expiry: number;
}

interface CashfreeBankValidation {
  /** 'YES' | 'NO' — whether the account resolves at all. */
  accountExists?: string;
  nameAtBank?: string | null;
  bankName?: string | null;
  branch?: string | null;
  city?: string | null;
  utr?: string | null;
  /** Present on the async initiate call. */
  referenceId?: number | string;
  /** 'VALID' | 'INVALID' | 'RECEIVED' | 'IN_PROCESS' | 'FAILED' */
  accountStatus?: string;
  accountStatusCode?: string;
  micr?: string | null;
  ifsc?: string | null;
  nameMatchResult?: string | null;
  nameMatchScore?: string | number | null;
}

interface CashfreeUpiValidation {
  nameAtBank?: string | null;
  accountExists?: string;
  vpa?: string;
}

export class CashfreeVerifier implements BankVerifier {
  readonly name = 'cashfree';
  readonly label: string;
  readonly mode: DriverMode;

  private readonly config: CashfreeVerifierConfig;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(config: CashfreeVerifierConfig) {
    this.config = { ...config, baseUrl: config.baseUrl.replace(/\/+$/, '') };
    this.mode = config.mode;
    this.label = `Cashfree Payouts verification (${config.mode})`;
  }

  /**
   * Cashfree tokens live 300s. Refresh at 60s remaining so a long-running
   * request can't have its token expire mid-flight.
   */
  private async authorize(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt - 60_000) {
      return this.token.value;
    }

    const response = await gatewayFetch<CashfreeEnvelope<CashfreeToken>>({
      provider: 'cashfree',
      url: `${this.config.baseUrl}/payout/v1/authorize`,
      method: 'POST',
      headers: {
        'X-Client-Id': this.config.clientId,
        'X-Client-Secret': this.config.clientSecret,
      },
      // Authorising is effectively idempotent — safe to retry on a 5xx.
      idempotencyKey: 'cashfree-authorize',
    });

    const token = response.data?.data?.token;
    if (!token) {
      throw new GatewayError({
        code: response.data?.subCode ?? 'auth_failed',
        message: `cashfree: authorization failed — ${response.data?.message ?? 'no token returned'}`,
        provider: 'cashfree',
        retryable: false,
      });
    }

    this.token = { value: token, expiresAt: Date.now() + 300_000 };
    return token;
  }

  private async call<T>(init: {
    path: string;
    method?: 'GET' | 'POST';
    body?: unknown;
    query?: Record<string, string>;
    idempotencyKey?: string;
  }): Promise<CashfreeEnvelope<T>> {
    const token = await this.authorize();
    const query = init.query ? `?${new URLSearchParams(init.query).toString()}` : '';

    const response = await gatewayFetch<CashfreeEnvelope<T>>({
      provider: 'cashfree',
      url: `${this.config.baseUrl}${init.path}${query}`,
      method: init.method ?? 'GET',
      bearerToken: token,
      body: init.body,
      idempotencyKey: init.idempotencyKey,
      // Cashfree signals business-level failures with 200 + subCode, and uses
      // 4xx for auth/shape problems. Accept both so we can read the envelope.
      expectStatuses: [200, 400, 409, 422],
      timeoutMs: 30_000,
    });

    return response.data;
  }

  async verifyBankAccount(input: {
    accountNumber: string;
    ifsc: string;
    accountHolderName: string;
    contactId?: string;
    referenceId: string;
    idempotencyKey: string;
  }): Promise<BankVerificationResult> {
    const accountNumber = input.accountNumber.replace(/\s/g, '');

    if (!isValidAccountNumberFormat(accountNumber)) {
      throw new GatewayError({
        code: 'account_invalid',
        message: 'Account number must be 9–18 digits',
        provider: 'cashfree',
        retryable: false,
        userMessage: 'That account number does not look right. Please check your passbook.',
      });
    }

    const branch = await lookupIfscShared(input.ifsc);
    if (!branch) {
      throw new GatewayError({
        code: 'invalid_ifsc',
        message: `IFSC ${input.ifsc} not found in the RBI branch directory`,
        provider: 'cashfree',
        retryable: false,
        userMessage: 'That IFSC code could not be found. Please check and try again.',
      });
    }

    const envelope = await this.call<CashfreeBankValidation>({
      path: '/payout/v1.2/validation/bankDetails/async',
      method: 'POST',
      idempotencyKey: input.idempotencyKey,
      body: {
        name: input.accountHolderName,
        bankAccount: accountNumber,
        ifsc: input.ifsc.toUpperCase(),
      },
    });

    if (envelope.status === 'ERROR') {
      throw new GatewayError({
        code: envelope.subCode ?? 'validation_failed',
        message: `cashfree: ${envelope.message ?? 'validation request rejected'}`,
        provider: 'cashfree',
        httpStatus: Number(envelope.subCode) || undefined,
        retryable: false,
        raw: envelope,
      });
    }

    const referenceId = envelope.data?.referenceId;
    if (referenceId === undefined || referenceId === null) {
      throw new GatewayError({
        code: 'no_reference',
        message: 'cashfree: async validation returned no referenceId',
        provider: 'cashfree',
        retryable: true,
        raw: envelope,
      });
    }

    return {
      providerRefId: String(referenceId),
      status: 'pending',
      amountDeposited: null,
      bankName: branch.bank,
      branch: branch.branch,
      raw: {
        driver: 'cashfree',
        initiated: envelope,
        note: 'Async penny-drop queued; poll fetchVerification for the terminal state.',
      },
    };
  }

  async fetchVerification(providerRefId: string): Promise<BankVerificationResult> {
    const envelope = await this.call<CashfreeBankValidation>({
      path: '/payout/v1.2/validation/bankDetails',
      method: 'GET',
      query: { referenceId: providerRefId },
    });

    return this.normalizeBank(providerRefId, envelope, null);
  }

  async verifyVpa(input: {
    vpa: string;
    accountHolderName: string;
    referenceId: string;
  }): Promise<BankVerificationResult> {
    const vpa = input.vpa.trim().toLowerCase();

    if (!isValidVpaFormat(vpa)) {
      throw new GatewayError({
        code: 'invalid_vpa',
        message: 'Malformed VPA',
        provider: 'cashfree',
        retryable: false,
        userMessage: 'That UPI ID does not look valid. It should look like name@bank.',
      });
    }

    const envelope = await this.call<CashfreeUpiValidation>({
      path: '/payout/v1.2/validation/upiDetails',
      method: 'GET',
      query: { vpa, name: input.accountHolderName },
    });

    const registeredName = envelope.data?.nameAtBank ?? null;
    const exists = (envelope.data?.accountExists ?? '').toUpperCase() === 'YES';
    const match = registeredName ? matchNames(input.accountHolderName, registeredName) : null;

    const failed = !exists || envelope.status === 'ERROR' || match?.result === 'mismatch';

    return {
      providerRefId: `vpa:${vpa}`,
      status: failed ? 'failed' : 'verified',
      registeredName,
      nameMatchScore: match?.score ?? null,
      nameMatchResult: match?.result ?? null,
      bankName: vpa.split('@')[1] ?? null,
      failureReason: failed
        ? !exists
          ? 'UPI ID does not exist'
          : match?.result === 'mismatch'
            ? `Name on UPI ID (${registeredName}) does not match the name provided`
            : (envelope.message ?? 'UPI validation failed')
        : null,
      raw: { driver: 'cashfree', envelope, matchExplanation: match?.explanation ?? null },
    };
  }

  lookupIfsc(ifsc: string): Promise<IfscDetails | null> {
    return lookupIfscShared(ifsc);
  }

  /** Cashfree signs webhooks with HMAC-SHA256 over the raw body, base64-encoded. */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', this.config.clientSecret)
      .update(rawBody, 'utf8')
      .digest('base64');

    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature ?? '', 'utf8');
    if (a.length !== b.length) {
      crypto.timingSafeEqual(a, a);
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  }

  private normalizeBank(
    providerRefId: string,
    envelope: CashfreeEnvelope<CashfreeBankValidation>,
    claimedName: string | null,
  ): BankVerificationResult {
    const data = envelope.data ?? {};
    const accountStatus = (data.accountStatus ?? '').toUpperCase();
    const exists = (data.accountExists ?? '').toUpperCase() === 'YES';
    const registeredName = data.nameAtBank ?? null;

    let status: BankVerificationResult['status'];
    if (accountStatus === 'RECEIVED' || accountStatus === 'IN_PROCESS' || envelope.status === 'PENDING') {
      status = 'processing';
    } else if (accountStatus === 'VALID' && exists) {
      status = 'verified';
    } else if (!accountStatus && !registeredName) {
      // No verdict yet — treat as still in flight rather than a failure, so a
      // slow bank doesn't permanently mark a legitimate account as invalid.
      status = 'pending';
    } else {
      status = 'failed';
    }

    const match =
      claimedName && registeredName ? matchNames(claimedName, registeredName) : null;
    if (status === 'verified' && match?.result === 'mismatch') status = 'failed';

    // Cashfree can return its own name-match verdict; keep ours as the decision
    // but record theirs for the admin verification log.
    const providerScore =
      data.nameMatchScore === null || data.nameMatchScore === undefined
        ? null
        : Number(data.nameMatchScore);

    return {
      providerRefId,
      status,
      registeredName,
      nameMatchScore: match?.score ?? (Number.isFinite(providerScore) ? providerScore : null),
      nameMatchResult: match?.result ?? null,
      amountDeposited: status === 'verified' ? 100 : null,
      utr: data.utr ?? null,
      bankName: data.bankName ?? null,
      branch: data.branch ?? null,
      failureReason:
        status === 'failed'
          ? !exists
            ? 'Account does not exist at the given IFSC'
            : match?.result === 'mismatch'
              ? `Name on account (${registeredName}) does not match the name provided`
              : (envelope.message ?? `Account status reported as "${accountStatus}"`)
          : null,
      raw: {
        driver: 'cashfree',
        envelope,
        providerNameMatch: data.nameMatchResult ?? null,
        matchExplanation: match?.explanation ?? null,
      },
    };
  }
}
