import type {
  BankVerifier,
  DriverMode,
  Mailer,
  PaymentGateway,
  PayoutGateway,
  ShippingProvider,
  SmsSender,
} from './types';

/**
 * Driver resolution.
 *
 * One rule, applied to every integration: **a driver goes live when its
 * credentials are present, and falls back to the mock when they are not.**
 * Nothing in the application checks `NODE_ENV` to decide whether payments are
 * real — that pattern produces the classic failure where staging silently
 * charges cards, or production silently doesn't.
 *
 *   PAYMENTS_DRIVER=auto (default)
 *     RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET present  → razorpay
 *     STRIPE_SECRET_KEY present                      → stripe
 *     otherwise                                      → mock
 *
 *   PAYMENTS_DRIVER=razorpay
 *     Forced. Missing credentials now throw at startup rather than degrading to
 *     mock, because an operator who names a driver explicitly is asserting that
 *     real money should move.
 *
 * `mode` is derived from the key itself where the vendor encodes it
 * (`rzp_test_…` vs `rzp_live_…`, `sk_test_…` vs `sk_live_…`) and surfaced in the
 * admin header, so nobody has to guess whether a settlement report is real.
 *
 * Instances are cached per process. `resetAdapters()` exists for tests and for
 * the admin action that re-reads configuration.
 */

// ── env helpers ─────────────────────────────────────────────────────────────

function env(key: string): string | undefined {
  const value = process.env[key];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  // Treat an empty or placeholder value as absent — a half-filled .env should
  // fall back to mock rather than produce confusing 401s from the vendor.
  if (!trimmed || trimmed.startsWith('your_') || trimmed === 'changeme') return undefined;
  return trimmed;
}

function requireEnv(key: string, driver: string): string {
  const value = env(key);
  if (!value) {
    throw new Error(
      `${key} is required because a driver was explicitly selected (${driver}). ` +
        `Either provide the credential or remove the *_DRIVER override to fall back to the mock driver.`,
    );
  }
  return value;
}

function has(...keys: string[]): boolean {
  return keys.every((k) => env(k) !== undefined);
}

/** Infer live/test from the credential itself where the vendor encodes it. */
function modeFromKey(key: string | undefined): DriverMode {
  if (!key) return 'mock';
  if (/_test_|_TEST_|^test/.test(key)) return 'test';
  return 'live';
}

/**
 * Cashfree and Decentro do not encode the environment in the credential, so it
 * has to come from the host. Both use a *separate hostname* per environment
 * rather than a flag, which makes the resolved base URL the only honest source
 * of truth — and the thing the admin banner must be derived from.
 *
 * `CASHFREE_ENV` / `DECENTRO_ENV` pick the default host, and an explicit
 * `*_BASE_URL` always wins. Inferring the mode from a substring of an
 * *unresolved* env var was the bug this replaces: with nothing set, the default
 * host is staging but the banner read "live".
 */
const CASHFREE_HOSTS = {
  test: 'https://payout-gamma.cashfree.com',
  live: 'https://payout-api.cashfree.com',
} as const;

const DECENTRO_HOSTS = {
  test: 'https://in.staging.decentro.tech',
  live: 'https://in.decentro.tech',
} as const;

/** True when the operator has asked for a sandbox by name. */
function wantsTestEnv(key: string): boolean {
  const value = (env(key) ?? '').toUpperCase();
  return value === 'TEST' || value === 'SANDBOX' || value === 'STAGING' || value === 'GAMMA';
}

function resolveHost(
  baseUrlKey: string,
  envKey: string,
  hosts: { test: string; live: string },
): { baseUrl: string; mode: DriverMode } {
  const explicit = env(baseUrlKey);
  const baseUrl = explicit ?? (wantsTestEnv(envKey) ? hosts.test : hosts.live);
  // Compare against the known sandbox host rather than sniffing for "sandbox":
  // Cashfree's is `payout-gamma`, Decentro's is `in.staging`, and neither
  // contains that word.
  const isTest =
    baseUrl === hosts.test ||
    /gamma|staging|sandbox|test|localhost/i.test(new URL(baseUrl).hostname);
  return { baseUrl, mode: isTest ? 'test' : 'live' };
}

// ── payments ────────────────────────────────────────────────────────────────

export type PaymentsDriverName = 'auto' | 'razorpay' | 'stripe' | 'mock';

function resolvePaymentsDriver(): Exclude<PaymentsDriverName, 'auto'> {
  const forced = (env('PAYMENTS_DRIVER') ?? 'auto') as PaymentsDriverName;
  if (forced !== 'auto') return forced;
  if (has('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET')) return 'razorpay';
  if (has('STRIPE_SECRET_KEY')) return 'stripe';
  return 'mock';
}

let paymentsInstance: PaymentGateway | null = null;

export function getPaymentGateway(): PaymentGateway {
  if (paymentsInstance) return paymentsInstance;

  const driver = resolvePaymentsDriver();

  switch (driver) {
    case 'razorpay': {
      const { RazorpayPayments } = require('./payments/razorpay') as typeof import('./payments/razorpay');
      paymentsInstance = new RazorpayPayments({
        keyId: requireEnv('RAZORPAY_KEY_ID', 'razorpay'),
        keySecret: requireEnv('RAZORPAY_KEY_SECRET', 'razorpay'),
        webhookSecret: env('RAZORPAY_WEBHOOK_SECRET') ?? null,
        mode: modeFromKey(env('RAZORPAY_KEY_ID')),
      });
      break;
    }
    case 'stripe': {
      const { StripePayments } = require('./payments/stripe') as typeof import('./payments/stripe');
      paymentsInstance = new StripePayments({
        secretKey: requireEnv('STRIPE_SECRET_KEY', 'stripe'),
        publishableKey: env('STRIPE_PUBLISHABLE_KEY') ?? null,
        webhookSecret: env('STRIPE_WEBHOOK_SECRET') ?? null,
        mode: modeFromKey(env('STRIPE_SECRET_KEY')),
      });
      break;
    }
    default: {
      const { MockPayments } = require('./payments/mock') as typeof import('./payments/mock');
      paymentsInstance = new MockPayments();
    }
  }

  return paymentsInstance;
}

// ── payouts (wallet → bank) ─────────────────────────────────────────────────

export type PayoutsDriverName = 'auto' | 'razorpayx' | 'cashfree' | 'mock';

function resolvePayoutsDriver(): Exclude<PayoutsDriverName, 'auto'> {
  const forced = (env('PAYOUTS_DRIVER') ?? 'auto') as PayoutsDriverName;
  if (forced !== 'auto') return forced;
  // RazorpayX reuses the Razorpay API keys but needs its own source account.
  if (has('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAYX_ACCOUNT_NUMBER')) return 'razorpayx';
  if (has('CASHFREE_CLIENT_ID', 'CASHFREE_CLIENT_SECRET')) return 'cashfree';
  return 'mock';
}

let payoutsInstance: PayoutGateway | null = null;

export function getPayoutGateway(): PayoutGateway {
  if (payoutsInstance) return payoutsInstance;

  const driver = resolvePayoutsDriver();

  switch (driver) {
    case 'razorpayx': {
      const { RazorpayXPayouts } = require('./payouts/razorpayx') as typeof import('./payouts/razorpayx');
      payoutsInstance = new RazorpayXPayouts({
        keyId: requireEnv('RAZORPAY_KEY_ID', 'razorpayx'),
        keySecret: requireEnv('RAZORPAY_KEY_SECRET', 'razorpayx'),
        accountNumber: requireEnv('RAZORPAYX_ACCOUNT_NUMBER', 'razorpayx'),
        webhookSecret: env('RAZORPAY_WEBHOOK_SECRET') ?? null,
        mode: modeFromKey(env('RAZORPAY_KEY_ID')),
      });
      break;
    }
    case 'cashfree': {
      const { CashfreePayouts } = require('./payouts/cashfree') as typeof import('./payouts/cashfree');
      const host = resolveHost('CASHFREE_BASE_URL', 'CASHFREE_ENV', CASHFREE_HOSTS);
      payoutsInstance = new CashfreePayouts({
        clientId: requireEnv('CASHFREE_CLIENT_ID', 'cashfree'),
        clientSecret: requireEnv('CASHFREE_CLIENT_SECRET', 'cashfree'),
        baseUrl: host.baseUrl,
        mode: host.mode,
      });
      break;
    }
    default: {
      const { MockPayouts } = require('./payouts/mock') as typeof import('./payouts/mock');
      payoutsInstance = new MockPayouts();
    }
  }

  return payoutsInstance;
}

// ── bank verification (penny-drop) ──────────────────────────────────────────

export type VerificationDriverName =
  | 'auto'
  | 'razorpay'
  | 'cashfree'
  | 'decentro'
  | 'mock';

function resolveVerificationDriver(): Exclude<VerificationDriverName, 'auto'> {
  const forced = (env('BANK_VERIFICATION_DRIVER') ?? 'auto') as VerificationDriverName;
  if (forced !== 'auto') return forced;
  if (has('DECENTRO_CLIENT_ID', 'DECENTRO_CLIENT_SECRET', 'DECENTRO_MODULE_SECRET')) {
    return 'decentro';
  }
  if (has('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET')) return 'razorpay';
  if (has('CASHFREE_CLIENT_ID', 'CASHFREE_CLIENT_SECRET')) return 'cashfree';
  return 'mock';
}

let verifierInstance: BankVerifier | null = null;

export function getBankVerifier(): BankVerifier {
  if (verifierInstance) return verifierInstance;

  const driver = resolveVerificationDriver();

  switch (driver) {
    case 'razorpay': {
      const { RazorpayVerifier } =
        require('./verification/razorpay') as typeof import('./verification/razorpay');
      verifierInstance = new RazorpayVerifier({
        keyId: requireEnv('RAZORPAY_KEY_ID', 'razorpay'),
        keySecret: requireEnv('RAZORPAY_KEY_SECRET', 'razorpay'),
        // Optional here, but required to actually run a penny-drop — the ₹1 is
        // debited from the RazorpayX current account. The driver raises a clear
        // configuration error if a verification is attempted without it, rather
        // than this resolution failing and silently downgrading to mock.
        accountNumber: env('RAZORPAYX_ACCOUNT_NUMBER') ?? null,
        webhookSecret: env('RAZORPAY_WEBHOOK_SECRET') ?? null,
        mode: modeFromKey(env('RAZORPAY_KEY_ID')),
      });
      break;
    }
    case 'cashfree': {
      const { CashfreeVerifier } =
        require('./verification/cashfree') as typeof import('./verification/cashfree');
      const host = resolveHost('CASHFREE_BASE_URL', 'CASHFREE_ENV', CASHFREE_HOSTS);
      verifierInstance = new CashfreeVerifier({
        clientId: requireEnv('CASHFREE_CLIENT_ID', 'cashfree'),
        clientSecret: requireEnv('CASHFREE_CLIENT_SECRET', 'cashfree'),
        baseUrl: host.baseUrl,
        mode: host.mode,
      });
      break;
    }
    case 'decentro': {
      const { DecentroVerifier } =
        require('./verification/decentro') as typeof import('./verification/decentro');
      const host = resolveHost('DECENTRO_BASE_URL', 'DECENTRO_ENV', DECENTRO_HOSTS);
      verifierInstance = new DecentroVerifier({
        clientId: requireEnv('DECENTRO_CLIENT_ID', 'decentro'),
        clientSecret: requireEnv('DECENTRO_CLIENT_SECRET', 'decentro'),
        moduleSecret: requireEnv('DECENTRO_MODULE_SECRET', 'decentro'),
        baseUrl: host.baseUrl,
        providerCode: env('DECENTRO_PROVIDER_CODE') ?? 'YESB',
        mode: host.mode,
      });
      break;
    }
    default: {
      const { MockVerifier } =
        require('./verification/mock') as typeof import('./verification/mock');
      verifierInstance = new MockVerifier();
    }
  }

  return verifierInstance;
}

// ── shipping ────────────────────────────────────────────────────────────────

export type ShippingDriverName = 'auto' | 'shiprocket' | 'delhivery' | 'mock';

function resolveShippingDriver(): Exclude<ShippingDriverName, 'auto'> {
  const forced = (env('SHIPPING_DRIVER') ?? 'auto') as ShippingDriverName;
  if (forced !== 'auto') return forced;
  if (has('SHIPROCKET_EMAIL', 'SHIPROCKET_PASSWORD')) return 'shiprocket';
  if (has('DELHIVERY_API_TOKEN')) return 'delhivery';
  return 'mock';
}

let shippingInstance: ShippingProvider | null = null;

export function getShippingProvider(): ShippingProvider {
  if (shippingInstance) return shippingInstance;

  const driver = resolveShippingDriver();

  switch (driver) {
    case 'shiprocket': {
      const { ShiprocketShipping } =
        require('./shipping/shiprocket') as typeof import('./shipping/shiprocket');
      shippingInstance = new ShiprocketShipping({
        email: requireEnv('SHIPROCKET_EMAIL', 'shiprocket'),
        password: requireEnv('SHIPROCKET_PASSWORD', 'shiprocket'),
        pickupLocation: env('SHIPROCKET_PICKUP_LOCATION') ?? 'Primary',
        pickupPincode: env('WAREHOUSE_PINCODE') ?? '400013',
      });
      break;
    }
    case 'delhivery': {
      const { DelhiveryShipping } =
        require('./shipping/delhivery') as typeof import('./shipping/delhivery');
      shippingInstance = new DelhiveryShipping({
        apiToken: requireEnv('DELHIVERY_API_TOKEN', 'delhivery'),
        baseUrl: env('DELHIVERY_BASE_URL') ?? 'https://track.delhivery.com',
        clientName: env('DELHIVERY_CLIENT_NAME') ?? 'LUMEN AND CO',
        pickupPincode: env('WAREHOUSE_PINCODE') ?? '400013',
      });
      break;
    }
    default: {
      const { MockShipping } = require('./shipping/mock') as typeof import('./shipping/mock');
      shippingInstance = new MockShipping();
    }
  }

  return shippingInstance;
}

// ── mail ────────────────────────────────────────────────────────────────────

let mailerInstance: Mailer | null = null;

export function getMailer(): Mailer {
  if (mailerInstance) return mailerInstance;

  const forced = env('MAIL_DRIVER') ?? 'auto';
  const useSmtp = forced === 'smtp' || (forced === 'auto' && has('SMTP_HOST', 'SMTP_USER'));

  if (useSmtp) {
    const { SmtpMailer } = require('./mail/smtp') as typeof import('./mail/smtp');
    mailerInstance = new SmtpMailer({
      host: requireEnv('SMTP_HOST', 'smtp'),
      port: Number(env('SMTP_PORT') ?? 587),
      user: requireEnv('SMTP_USER', 'smtp'),
      password: env('SMTP_PASSWORD') ?? '',
      from: env('MAIL_FROM') ?? 'LUMEN&CO <no-reply@lumenandco.example>',
      secure: env('SMTP_SECURE') === 'true',
    });
  } else {
    const { MockMailer } = require('./mail/mock') as typeof import('./mail/mock');
    mailerInstance = new MockMailer();
  }

  return mailerInstance;
}

// ── SMS / WhatsApp ──────────────────────────────────────────────────────────

let smsInstance: SmsSender | null = null;

export function getSmsSender(): SmsSender {
  if (smsInstance) return smsInstance;

  const forced = env('SMS_DRIVER') ?? 'auto';

  if (forced === 'msg91' || (forced === 'auto' && has('MSG91_AUTH_KEY'))) {
    const { Msg91Sender } = require('./sms/msg91') as typeof import('./sms/msg91');
    smsInstance = new Msg91Sender({
      authKey: requireEnv('MSG91_AUTH_KEY', 'msg91'),
      senderId: env('MSG91_SENDER_ID') ?? 'LUMENC',
      dltTemplateId: env('MSG91_TEMPLATE_ID') ?? null,
    });
  } else if (forced === 'twilio' || (forced === 'auto' && has('TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'))) {
    const { TwilioSender } = require('./sms/twilio') as typeof import('./sms/twilio');
    smsInstance = new TwilioSender({
      accountSid: requireEnv('TWILIO_ACCOUNT_SID', 'twilio'),
      authToken: requireEnv('TWILIO_AUTH_TOKEN', 'twilio'),
      fromNumber: env('TWILIO_FROM_NUMBER') ?? '',
      whatsappFrom: env('TWILIO_WHATSAPP_FROM') ?? null,
    });
  } else {
    const { MockSmsSender } = require('./sms/mock') as typeof import('./sms/mock');
    smsInstance = new MockSmsSender();
  }

  return smsInstance;
}

// ── introspection ───────────────────────────────────────────────────────────

export interface AdapterStatusRow {
  slot: 'payments' | 'payouts' | 'verification' | 'shipping' | 'mail' | 'sms';
  driver: string;
  mode: DriverMode;
  label: string;
  /** What to add to .env to take this slot live. */
  liveHint: string;
}

/**
 * Snapshot of every resolved driver, rendered in the admin header and on
 * /admin/settings. An operator should never have to read source to find out
 * whether they are moving real money.
 */
export function adapterStatus(): AdapterStatusRow[] {
  const rows: AdapterStatusRow[] = [];

  const collect = (
    slot: AdapterStatusRow['slot'],
    liveHint: string,
    resolve: () => { name: string; mode: DriverMode; label: string },
  ) => {
    try {
      const a = resolve();
      rows.push({ slot, driver: a.name, mode: a.mode, label: a.label, liveHint });
    } catch (error) {
      rows.push({
        slot,
        driver: 'error',
        mode: 'mock',
        label: `Misconfigured: ${(error as Error).message.slice(0, 140)}`,
        liveHint,
      });
    }
  };

  collect('payments', 'RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET', getPaymentGateway);
  collect('payouts', 'RAZORPAYX_ACCOUNT_NUMBER (with Razorpay keys)', getPayoutGateway);
  collect('verification', 'DECENTRO_* or Razorpay/Cashfree keys', getBankVerifier);
  collect('shipping', 'SHIPROCKET_EMAIL + SHIPROCKET_PASSWORD', getShippingProvider);
  collect('mail', 'SMTP_HOST + SMTP_USER', getMailer);
  collect('sms', 'MSG91_AUTH_KEY or TWILIO_*', getSmsSender);

  return rows;
}

/** True when any money-moving slot is still on a mock driver. */
export function hasMockMoneyDrivers(): boolean {
  return adapterStatus()
    .filter((r) => r.slot === 'payments' || r.slot === 'payouts' || r.slot === 'verification')
    .some((r) => r.mode === 'mock');
}

/** Alias for getPaymentGateway for backward compatibility */
export const getPaymentAdapter = getPaymentGateway;

/** Drop cached instances — used by tests and the admin "reload config" action. */
export function resetAdapters(): void {
  paymentsInstance = null;
  payoutsInstance = null;
  verifierInstance = null;
  shippingInstance = null;
  mailerInstance = null;
  smsInstance = null;
}
