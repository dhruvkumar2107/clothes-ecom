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
 * Decentro — bank account validation (penny-drop) and UPI handle validation.
 *
 * Docs: https://docs.decentro.tech (Financial Services → Validation)
 *
 * Decentro is the most direct of the three verifiers: a single POST does the
 * penny-drop, and it returns the bank's registered name plus its *own*
 * name-match verdict when you pass a `name`. Authentication is three static
 * headers rather than a token exchange.
 *
 * Two Decentro-specific behaviours the rest of the platform has to respect:
 *
 *   • `type: "PENNY_DROP"` actually moves ₹1 and can take up to ~30s; `"BASIC"`
 *     only checks the account's existence with no deposit and no name. We always
 *     request PENNY_DROP because the registered name is the entire point — a
 *     BASIC check cannot tell you whose account it is.
 *   • A `PENDING` response is normal, not an error. Decentro settles it and we
 *     either poll the transaction-status endpoint or receive their callback.
 *
 * `responseCode` is the field that actually carries meaning: `S00000` is
 * success, everything beginning `E` is a specific rejection worth logging.
 */

interface DecentroVerifierConfig {
  clientId: string;
  clientSecret: string;
  moduleSecret: string;
  baseUrl: string;
  /** Bank partner code that fronts the penny-drop, e.g. 'YESB'. */
  providerCode: string;
  mode: DriverMode;
}

interface DecentroResponse<T> {
  decentroTxnId?: string;
  status?: 'SUCCESS' | 'PENDING' | 'FAILURE' | 'ERROR';
  responseCode?: string;
  message?: string;
  data?: T;
}

interface DecentroBankData {
  /** 'VALID' | 'INVALID' | 'PENDING' */
  accountStatus?: string;
  accountStatusDescription?: string;
  beneficiaryName?: string | null;
  /** Decentro's own verdict when a `name` was supplied. */
  nameMatchResult?: string | null;
  nameMatchScore?: number | string | null;
  bankReferenceNumber?: string | null;
  utr?: string | null;
  ifsc?: string | null;
  bankName?: string | null;
  branch?: string | null;
  upiId?: string | null;
}

/** Response codes that mean "this will never succeed, stop retrying". */
const TERMINAL_ERROR_CODES = new Set([
  'E00021', // invalid account number
  'E00022', // invalid IFSC
  'E00040', // beneficiary account does not exist
  'E00041', // account frozen / dormant
  'E00051', // invalid VPA
]);

export class DecentroVerifier implements BankVerifier {
  readonly name = 'decentro';
  readonly label: string;
  readonly mode: DriverMode;

  private readonly config: DecentroVerifierConfig;

  constructor(config: DecentroVerifierConfig) {
    this.config = { ...config, baseUrl: config.baseUrl.replace(/\/+$/, '') };
    this.mode = config.mode;
    this.label = `Decentro validation (${config.mode})`;
  }

  private get headers(): Record<string, string> {
    return {
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      module_secret: this.config.moduleSecret,
      provider_secret: this.config.providerCode,
    };
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
        provider: 'decentro',
        retryable: false,
        userMessage: 'That account number does not look right. Please check your passbook.',
      });
    }

    const branch = await lookupIfscShared(input.ifsc);
    if (!branch) {
      throw new GatewayError({
        code: 'invalid_ifsc',
        message: `IFSC ${input.ifsc} not found in the RBI branch directory`,
        provider: 'decentro',
        retryable: false,
        userMessage: 'That IFSC code could not be found. Please check and try again.',
      });
    }

    const response = await gatewayFetch<DecentroResponse<DecentroBankData>>({
      provider: 'decentro',
      url: `${this.config.baseUrl}/v2/financial_services/validation/bank_account`,
      method: 'POST',
      headers: this.headers,
      idempotencyKey: input.idempotencyKey,
      // A penny-drop can legitimately take most of a minute.
      timeoutMs: 45_000,
      expectStatuses: [200, 202, 400, 422],
      body: {
        reference_id: input.referenceId,
        purpose: 'Beneficiary bank account verification for wallet withdrawal',
        beneficiary_account_number: accountNumber,
        beneficiary_ifsc: input.ifsc.toUpperCase(),
        // Supplying the name asks Decentro to run its own match alongside ours.
        name: input.accountHolderName,
        // BASIC would skip the deposit — and skip the registered name with it.
        type: 'PENNY_DROP',
      },
    });

    return this.normalize(response.data, input.accountHolderName, {
      bankName: branch.bank,
      branch: branch.branch,
    });
  }

  async fetchVerification(providerRefId: string): Promise<BankVerificationResult> {
    const query = new URLSearchParams({ decentro_txn_id: providerRefId }).toString();

    const response = await gatewayFetch<DecentroResponse<DecentroBankData>>({
      provider: 'decentro',
      url: `${this.config.baseUrl}/v2/payments/transaction/status?${query}`,
      method: 'GET',
      headers: this.headers,
      expectStatuses: [200, 404],
    });

    if (response.status === 404) {
      throw new GatewayError({
        code: 'not_found',
        message: `decentro: no transaction found for ${providerRefId}`,
        provider: 'decentro',
        retryable: false,
      });
    }

    return this.normalize(response.data, null, {});
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
        provider: 'decentro',
        retryable: false,
        userMessage: 'That UPI ID does not look valid. It should look like name@bank.',
      });
    }

    const response = await gatewayFetch<DecentroResponse<DecentroBankData>>({
      provider: 'decentro',
      url: `${this.config.baseUrl}/v2/payments/vpa/validate`,
      method: 'POST',
      headers: this.headers,
      idempotencyKey: `vpa:${input.referenceId}`,
      expectStatuses: [200, 400, 422],
      body: {
        reference_id: input.referenceId,
        vpa,
        type: 'BASIC',
      },
    });

    const result = this.normalize(response.data, input.accountHolderName, {
      bankName: vpa.split('@')[1] ?? null,
    });

    // VPA validation is synchronous at Decentro — a `pending` here means the
    // handle could not be resolved, which for UPI is a failure, not a wait.
    if (result.status === 'pending' || result.status === 'processing') {
      return {
        ...result,
        status: 'failed',
        failureReason: result.failureReason ?? 'UPI ID could not be resolved',
      };
    }

    return result;
  }

  lookupIfsc(ifsc: string): Promise<IfscDetails | null> {
    return lookupIfscShared(ifsc);
  }

  /**
   * Decentro signs callbacks with HMAC-SHA256 over the raw body using the
   * module secret.
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', this.config.moduleSecret)
      .update(rawBody, 'utf8')
      .digest('hex');

    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from((signature ?? '').replace(/^sha256=/, ''), 'utf8');
    if (a.length !== b.length) {
      crypto.timingSafeEqual(a, a);
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  }

  private normalize(
    body: DecentroResponse<DecentroBankData>,
    claimedName: string | null,
    extra: { bankName?: string | null; branch?: string | null },
  ): BankVerificationResult {
    const data = body.data ?? {};
    const code = body.responseCode ?? '';
    const accountStatus = (data.accountStatus ?? '').toUpperCase();
    const registeredName = data.beneficiaryName ?? null;

    let status: BankVerificationResult['status'];
    if (body.status === 'PENDING' || accountStatus === 'PENDING') {
      status = 'processing';
    } else if (body.status === 'SUCCESS' && accountStatus === 'VALID') {
      status = 'verified';
    } else if (body.status === 'FAILURE' || body.status === 'ERROR' || TERMINAL_ERROR_CODES.has(code)) {
      status = 'failed';
    } else if (!accountStatus && !registeredName) {
      status = 'pending';
    } else {
      status = 'failed';
    }

    const match =
      claimedName && registeredName ? matchNames(claimedName, registeredName) : null;
    if (status === 'verified' && match?.result === 'mismatch') status = 'failed';

    const providerScore =
      data.nameMatchScore === null || data.nameMatchScore === undefined
        ? null
        : Number(data.nameMatchScore);

    return {
      // Decentro's txn id is the handle for polling and for their support team.
      providerRefId: body.decentroTxnId ?? `decentro_${code || 'unknown'}`,
      status,
      registeredName,
      nameMatchScore: match?.score ?? (Number.isFinite(providerScore) ? providerScore : null),
      nameMatchResult: match?.result ?? null,
      amountDeposited: status === 'verified' ? 100 : null,
      utr: data.utr ?? data.bankReferenceNumber ?? null,
      bankName: data.bankName ?? extra.bankName ?? null,
      branch: data.branch ?? extra.branch ?? null,
      failureReason:
        status === 'failed'
          ? match?.result === 'mismatch'
            ? `Name on account (${registeredName}) does not match the name provided`
            : (data.accountStatusDescription ??
              body.message ??
              `Verification failed (${code || 'no response code'})`)
          : null,
      raw: {
        driver: 'decentro',
        responseCode: code,
        response: body,
        providerNameMatch: data.nameMatchResult ?? null,
        matchExplanation: match?.explanation ?? null,
      },
    };
  }
}
