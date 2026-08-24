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
 * Razorpay Fund Account Validation — a real ₹1 penny-drop.
 *
 * Docs: https://razorpay.com/docs/api/x/fund-accounts/validations/
 *
 * The flow is three calls, because Razorpay models the beneficiary as a
 * first-class object before you can validate it:
 *
 *   1. POST /v1/contacts               → cont_xxx   (the person)
 *   2. POST /v1/fund_accounts          → fa_xxx     (their bank account or VPA)
 *   3. POST /v1/fund_accounts/validations → fav_xxx (deposits ₹1, returns the
 *                                                    name the bank holds)
 *
 * Step 3 returns `status: "created"` and settles asynchronously — the registered
 * name is not available on the initial response. The terminal state arrives via
 * the `fund_account.validation.completed` / `.failed` webhook, or by polling
 * `fetchVerification`. That is why `BankVerificationResult.status` has `pending`
 * as a first-class value.
 *
 * The same contact/fund-account pair is reused for the eventual payout, so the
 * ids returned here are persisted on the BankAccount row.
 *
 * Note: validation debits the RazorpayX current account, so
 * `RAZORPAYX_ACCOUNT_NUMBER` is required for penny-drops even though plain
 * Razorpay keys are enough to resolve this driver.
 */

const API_BASE = 'https://api.razorpay.com/v1';

interface RazorpayVerifierConfig {
  keyId: string;
  keySecret: string;
  /** RazorpayX source account the ₹1 is debited from. */
  accountNumber: string | null;
  webhookSecret: string | null;
  mode: DriverMode;
}

interface RzpContact {
  id: string;
}

interface RzpFundAccount {
  id: string;
  bank_account?: { name?: string; ifsc?: string; account_number?: string };
  vpa?: { address?: string; username?: string; handle?: string };
}

interface RzpValidation {
  id: string;
  entity: string;
  fund_account?: RzpFundAccount;
  status: 'created' | 'completed' | 'failed';
  amount?: number;
  currency?: string;
  utr?: string | null;
  results?: {
    /** 'active' | 'invalid' | … */
    account_status?: string;
    registered_name?: string | null;
  } | null;
  error?: { description?: string; reason?: string } | null;
  created_at?: number;
}

export class RazorpayVerifier implements BankVerifier {
  readonly name = 'razorpay';
  readonly label: string;
  readonly mode: DriverMode;

  private readonly config: RazorpayVerifierConfig;

  constructor(config: RazorpayVerifierConfig) {
    this.config = config;
    this.mode = config.mode;
    this.label = `Razorpay Fund Account Validation (${config.mode})`;
  }

  private get auth() {
    return { username: this.config.keyId, password: this.config.keySecret };
  }

  private requireSourceAccount(): string {
    if (!this.config.accountNumber) {
      throw new GatewayError({
        code: 'configuration_error',
        message:
          'RAZORPAYX_ACCOUNT_NUMBER is required for Razorpay fund account validation — ' +
          'the ₹1 penny-drop is debited from your RazorpayX current account.',
        provider: 'razorpay',
        retryable: false,
        userMessage: 'Bank verification is temporarily unavailable. Please try again later.',
      });
    }
    return this.config.accountNumber;
  }

  /** Contacts are idempotent by reference_id, so this is safe to call per attempt. */
  private async ensureContact(input: {
    referenceId: string;
    name: string;
  }): Promise<string> {
    const response = await gatewayFetch<RzpContact>({
      provider: 'razorpay',
      url: `${API_BASE}/contacts`,
      method: 'POST',
      basicAuth: this.auth,
      idempotencyKey: `contact:${input.referenceId}`,
      body: {
        name: input.name.slice(0, 50),
        type: 'customer',
        reference_id: input.referenceId,
      },
    });
    return response.data.id;
  }

  private async createBankFundAccount(input: {
    contactId: string;
    accountHolderName: string;
    accountNumber: string;
    ifsc: string;
    idempotencyKey: string;
  }): Promise<string> {
    const response = await gatewayFetch<RzpFundAccount>({
      provider: 'razorpay',
      url: `${API_BASE}/fund_accounts`,
      method: 'POST',
      basicAuth: this.auth,
      idempotencyKey: `fa:${input.idempotencyKey}`,
      body: {
        contact_id: input.contactId,
        account_type: 'bank_account',
        bank_account: {
          name: input.accountHolderName,
          ifsc: input.ifsc.toUpperCase(),
          account_number: input.accountNumber,
        },
      },
    });
    return response.data.id;
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
    const sourceAccount = this.requireSourceAccount();

    if (!isValidAccountNumberFormat(accountNumber)) {
      throw new GatewayError({
        code: 'account_invalid',
        message: 'Account number must be 9–18 digits',
        provider: 'razorpay',
        retryable: false,
        userMessage: 'That account number does not look right. Please check your passbook.',
      });
    }

    // Validate the IFSC before spending a penny-drop on it — a bad IFSC is the
    // most common input error and the directory lookup is free.
    const branch = await lookupIfscShared(input.ifsc);
    if (!branch) {
      throw new GatewayError({
        code: 'invalid_ifsc',
        message: `IFSC ${input.ifsc} not found in the RBI branch directory`,
        provider: 'razorpay',
        retryable: false,
        userMessage: 'That IFSC code could not be found. Please check and try again.',
      });
    }

    const contactId =
      input.contactId ??
      (await this.ensureContact({
        referenceId: input.referenceId,
        name: input.accountHolderName,
      }));

    const fundAccountId = await this.createBankFundAccount({
      contactId,
      accountHolderName: input.accountHolderName,
      accountNumber,
      ifsc: input.ifsc,
      idempotencyKey: input.idempotencyKey,
    });

    const response = await gatewayFetch<RzpValidation>({
      provider: 'razorpay',
      url: `${API_BASE}/fund_accounts/validations`,
      method: 'POST',
      basicAuth: this.auth,
      // Critical: without this, a timed-out request retried would debit a second ₹1.
      idempotencyKey: input.idempotencyKey,
      body: {
        account_number: sourceAccount,
        fund_account: { id: fundAccountId },
        amount: 100, // ₹1 in paise — Razorpay's only supported validation amount
        currency: 'INR',
        notes: { reference_id: input.referenceId },
      },
    });

    return this.normalize(response.data, input.accountHolderName, {
      contactId,
      fundAccountId,
      bankName: branch.bank,
      branch: branch.branch,
    });
  }

  async fetchVerification(providerRefId: string): Promise<BankVerificationResult> {
    const response = await gatewayFetch<RzpValidation>({
      provider: 'razorpay',
      url: `${API_BASE}/fund_accounts/validations/${providerRefId}`,
      method: 'GET',
      basicAuth: this.auth,
    });

    // On a poll we no longer hold the claimed name in memory; the caller
    // re-derives the match from `registeredName` against the stored BankAccount.
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
        provider: 'razorpay',
        retryable: false,
        userMessage: 'That UPI ID does not look valid. It should look like name@bank.',
      });
    }

    const contactId = await this.ensureContact({
      referenceId: input.referenceId,
      name: input.accountHolderName,
    });

    const fundAccount = await gatewayFetch<RzpFundAccount>({
      provider: 'razorpay',
      url: `${API_BASE}/fund_accounts`,
      method: 'POST',
      basicAuth: this.auth,
      idempotencyKey: `fa-vpa:${input.referenceId}`,
      body: {
        contact_id: contactId,
        account_type: 'vpa',
        vpa: { address: vpa },
      },
    });

    // VPA validation costs ₹0 at Razorpay and resolves against the PSP
    // directory, so unlike a bank penny-drop it usually returns terminal.
    const response = await gatewayFetch<RzpValidation>({
      provider: 'razorpay',
      url: `${API_BASE}/fund_accounts/validations`,
      method: 'POST',
      basicAuth: this.auth,
      idempotencyKey: `vpa:${input.referenceId}`,
      body: {
        account_number: this.requireSourceAccount(),
        fund_account: { id: fundAccount.data.id },
        amount: 100,
        currency: 'INR',
        notes: { reference_id: input.referenceId, kind: 'vpa' },
      },
    });

    return this.normalize(response.data, input.accountHolderName, {
      contactId,
      fundAccountId: fundAccount.data.id,
      bankName: vpa.split('@')[1] ?? null,
    });
  }

  lookupIfsc(ifsc: string): Promise<IfscDetails | null> {
    return lookupIfscShared(ifsc);
  }

  /**
   * Razorpay signs webhooks with HMAC-SHA256 over the raw body. Must be
   * constant-time: a timing-variable compare leaks the expected digest one byte
   * at a time and would let an attacker forge a "verification completed" event.
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.config.webhookSecret) return false;

    const expected = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(rawBody, 'utf8')
      .digest('hex');

    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature ?? '', 'utf8');
    if (a.length !== b.length) {
      // Still burn a comparison so a length mismatch isn't observably faster.
      crypto.timingSafeEqual(a, a);
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  }

  /** Map a Razorpay validation object onto our normalised result. */
  private normalize(
    v: RzpValidation,
    claimedName: string | null,
    extra: {
      contactId?: string;
      fundAccountId?: string;
      bankName?: string | null;
      branch?: string | null;
    },
  ): BankVerificationResult {
    const registeredName = v.results?.registered_name ?? null;
    const accountStatus = v.results?.account_status ?? null;

    let status: BankVerificationResult['status'];
    if (v.status === 'created') status = 'pending';
    else if (v.status === 'failed') status = 'failed';
    else if (accountStatus && accountStatus !== 'active') status = 'failed';
    else status = 'verified';

    const match =
      claimedName && registeredName ? matchNames(claimedName, registeredName) : null;

    // A completed penny-drop that returns a completely different person is a
    // failure regardless of what Razorpay says about the account being active.
    if (status === 'verified' && match && match.result === 'mismatch') {
      status = 'failed';
    }

    return {
      providerRefId: v.id,
      status,
      registeredName,
      nameMatchScore: match?.score ?? null,
      nameMatchResult: match?.result ?? null,
      amountDeposited: status === 'verified' ? (v.amount ?? 100) : null,
      utr: v.utr ?? null,
      failureReason:
        status === 'failed'
          ? (v.error?.description ??
            (match?.result === 'mismatch'
              ? `Name on account (${registeredName}) does not match the name provided`
              : accountStatus && accountStatus !== 'active'
                ? `Account status reported as "${accountStatus}"`
                : 'Bank rejected the account'))
          : null,
      bankName: extra.bankName ?? v.fund_account?.bank_account?.ifsc ?? null,
      branch: extra.branch ?? null,
      raw: {
        validation: v,
        contactId: extra.contactId ?? null,
        fundAccountId: extra.fundAccountId ?? v.fund_account?.id ?? null,
        matchExplanation: match?.explanation ?? null,
      },
    };
  }
}
