/**
 * Adapter contracts.
 *
 * Every third-party dependency in the platform sits behind one of these
 * interfaces, and the application code never imports a vendor SDK directly.
 * That buys three things:
 *
 *   1. The whole app runs with no credentials. Each contract has a `mock`
 *      implementation that models the *real* state machine — including async
 *      pending states, webhook callbacks, and realistic failure codes — so
 *      checkout, payouts, and penny-drop verification are genuinely exercisable
 *      in development rather than stubbed out behind an `if (isDev)`.
 *   2. Swapping Razorpay for Cashfree is a registry change, not a refactor.
 *   3. Errors are normalised once. Vendors disagree about where a failure code
 *      lives in the response body; callers here always get a `GatewayError`
 *      with a stable `code` and an honest `retryable` flag.
 *
 * `mode` is surfaced through to the admin UI so an operator can always see
 * whether they are looking at live money or the mock driver.
 */

import type { Paise } from '../money';

export type DriverMode = 'live' | 'test' | 'mock';

export interface AdapterInfo {
  /** Vendor identifier persisted on records: 'razorpay' | 'mock' | … */
  readonly name: string;
  readonly mode: DriverMode;
  /** Shown in admin banners: "Razorpay (test)" / "Mock driver". */
  readonly label: string;
}

/**
 * Normalised failure from any external call.
 *
 * `retryable` distinguishes "the network blinked, try again" from "the bank
 * rejected this account, stop". Payout retry logic depends on getting that
 * right — retrying a genuine rejection burns the user's money on fees.
 */
export class GatewayError extends Error {
  readonly code: string;
  readonly httpStatus?: number;
  readonly retryable: boolean;
  readonly provider: string;
  readonly raw?: unknown;
  /** Safe to show a customer. Vendor messages often aren't. */
  readonly userMessage: string;

  constructor(init: {
    code: string;
    message: string;
    provider: string;
    httpStatus?: number;
    retryable?: boolean;
    userMessage?: string;
    raw?: unknown;
  }) {
    super(init.message);
    this.name = 'GatewayError';
    this.code = init.code;
    this.provider = init.provider;
    this.httpStatus = init.httpStatus;
    this.retryable = init.retryable ?? false;
    this.userMessage =
      init.userMessage ?? 'Something went wrong on the payment network. Please try again.';
    this.raw = init.raw;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════

export interface CreateGatewayOrderInput {
  /** Amount to collect through the gateway (order total minus wallet part-payment). */
  amount: Paise;
  currency: string;
  /** Our order number — appears on the customer's bank statement narration. */
  receipt: string;
  /** Business metadata echoed back on the webhook. */
  notes?: Record<string, string>;
  /** Restricts the checkout to one instrument when the user pre-selected it. */
  method?: string;
  customer?: {
    id?: string;
    name: string;
    email?: string | null;
    phone?: string | null;
  };
}

export interface GatewayOrder {
  /** Provider's order id, e.g. `order_NqABC123`. */
  providerOrderId: string;
  amount: Paise;
  currency: string;
  status: string;
  /** Everything the browser SDK needs to open checkout. Never includes secrets. */
  clientPayload: Record<string, unknown>;
}

export interface GatewayPayment {
  providerPaymentId: string;
  providerOrderId?: string | null;
  amount: Paise;
  amountRefunded?: Paise;
  currency: string;
  /** Normalised to our PaymentIntentStatus vocabulary. */
  status: 'created' | 'pending' | 'authorized' | 'captured' | 'failed' | 'cancelled';
  method: string;
  /** Display string: "HDFC •••• 4242", "user@ybl", "PhonePe". */
  methodDetail?: string | null;
  bank?: string | null;
  wallet?: string | null;
  vpa?: string | null;
  cardLast4?: string | null;
  cardNetwork?: string | null;
  cardType?: string | null;
  /** Present when the customer opted to save the instrument. */
  token?: string | null;
  errorCode?: string | null;
  errorDescription?: string | null;
  errorSource?: string | null;
  errorReason?: string | null;
  capturedAt?: Date | null;
  raw: unknown;
}

export interface GatewayRefund {
  providerRefundId: string;
  providerPaymentId: string;
  amount: Paise;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  speed: 'normal' | 'instant';
  raw: unknown;
}

/** The signed handshake a browser returns after checkout closes. */
export interface VerifyCallbackInput {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

export interface ParsedWebhook {
  eventId: string;
  eventType: string;
  /** Normalised subject so handlers don't re-parse vendor payload shapes. */
  subject:
    | { kind: 'payment'; payment: GatewayPayment }
    | { kind: 'refund'; refund: GatewayRefund }
    | { kind: 'payout'; payout: PayoutResult }
    | { kind: 'verification'; verification: BankVerificationResult }
    | { kind: 'settlement'; settlementId: string; amount: Paise; utr?: string | null }
    | { kind: 'unknown' };
  raw: unknown;
}

export interface EmiOption {
  bank: string;
  bankName: string;
  tenureMonths: number;
  interestRate: number;
  /** Per-month instalment for the requested amount. */
  monthlyInstalment: Paise;
  totalPayable: Paise;
  processingFee: Paise;
  noCostEmi: boolean;
  kind: 'emi' | 'bnpl';
}

export interface PaymentGateway extends AdapterInfo {
  createOrder(input: CreateGatewayOrderInput): Promise<GatewayOrder>;

  /**
   * Verify the browser handshake. MUST be constant-time and MUST be the only
   * thing that decides a payment succeeded — never trust a client-reported
   * status.
   */
  verifyCallback(input: VerifyCallbackInput): Promise<boolean>;

  fetchPayment(providerPaymentId: string): Promise<GatewayPayment>;
  capture(providerPaymentId: string, amount: Paise, currency: string): Promise<GatewayPayment>;
  refund(input: {
    providerPaymentId: string;
    amount: Paise;
    speed?: 'normal' | 'instant';
    notes?: Record<string, string>;
    idempotencyKey?: string;
  }): Promise<GatewayRefund>;

  verifyWebhookSignature(rawBody: string, signature: string): boolean;
  parseWebhook(rawBody: string): ParsedWebhook;

  /** Public config for the browser SDK. Must contain no secret material. */
  clientConfig(): { provider: string; keyId: string | null; mode: DriverMode };

  emiOptions?(amount: Paise): Promise<EmiOption[]>;
}

// ═══════════════════════════════════════════════════════════════════════════
// PAYOUTS  (wallet → bank)
// ═══════════════════════════════════════════════════════════════════════════

export interface PayoutContactInput {
  referenceId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  type?: 'customer' | 'vendor' | 'employee';
}

export interface FundAccountInput {
  contactId: string;
  kind: 'bank' | 'upi';
  accountHolderName: string;
  accountNumber?: string;
  ifsc?: string;
  vpa?: string;
}

export interface CreatePayoutInput {
  fundAccountId: string;
  amount: Paise;
  currency: string;
  mode: 'IMPS' | 'NEFT' | 'RTGS' | 'UPI';
  /** Appears on the recipient's bank statement — max 30 chars for IMPS. */
  narration: string;
  referenceId: string;
  /** Prevents a double transfer if our request times out and we retry. */
  idempotencyKey: string;
  notes?: Record<string, string>;
}

export interface PayoutResult {
  providerPayoutId: string;
  amount: Paise;
  /** Normalised: 'processed' is terminal success, 'reversed' means the bank sent it back. */
  status: 'queued' | 'processing' | 'processed' | 'reversed' | 'failed';
  mode?: string | null;
  /** Unique Transaction Reference — the customer's proof of transfer. */
  utr?: string | null;
  failureReason?: string | null;
  fees?: Paise;
  tax?: Paise;
  raw: unknown;
}

export interface PayoutGateway extends AdapterInfo {
  /** Idempotent by `referenceId` — safe to call on every withdrawal. */
  createContact(input: PayoutContactInput): Promise<{ contactId: string; raw: unknown }>;
  createFundAccount(input: FundAccountInput): Promise<{ fundAccountId: string; raw: unknown }>;
  createPayout(input: CreatePayoutInput): Promise<PayoutResult>;
  fetchPayout(providerPayoutId: string): Promise<PayoutResult>;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
  /** Available balance in the payout account, when the vendor exposes it. */
  fetchBalance?(): Promise<{ balance: Paise; currency: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// BANK VERIFICATION  (penny-drop / IFSC + name match / VPA validate)
// ═══════════════════════════════════════════════════════════════════════════

export interface BankVerificationResult {
  providerRefId: string;
  /**
   * `pending` is a first-class outcome, not an error: a real penny-drop is
   * asynchronous. It can take seconds to minutes and completes via webhook or
   * polling. Any UI that treats verification as synchronous is wrong.
   */
  status: 'pending' | 'processing' | 'verified' | 'failed';
  /** The name the bank has on file — the whole point of a penny-drop. */
  registeredName?: string | null;
  /** 0–100 similarity against the name the customer entered. */
  nameMatchScore?: number | null;
  nameMatchResult?: 'exact' | 'partial' | 'mismatch' | null;
  /** Amount actually credited (₹1 = 100 paise for most providers). */
  amountDeposited?: Paise | null;
  utr?: string | null;
  failureReason?: string | null;
  bankName?: string | null;
  branch?: string | null;
  raw: unknown;
}

export interface IfscDetails {
  ifsc: string;
  bank: string;
  bankCode?: string | null;
  branch: string;
  address?: string | null;
  city: string;
  district?: string | null;
  state: string;
  /** Rails the branch supports — decides which payout modes we may offer. */
  imps: boolean;
  neft: boolean;
  rtgs: boolean;
  upi: boolean;
}

export interface BankVerifier extends AdapterInfo {
  /**
   * Initiate a penny-drop. Returns immediately with `pending` for real
   * providers; the terminal state arrives via `fetchVerification` or webhook.
   */
  verifyBankAccount(input: {
    accountNumber: string;
    ifsc: string;
    accountHolderName: string;
    /** Some providers require a contact/fund-account to exist first. */
    contactId?: string;
    referenceId: string;
    idempotencyKey: string;
  }): Promise<BankVerificationResult>;

  fetchVerification(providerRefId: string): Promise<BankVerificationResult>;

  verifyVpa(input: {
    vpa: string;
    accountHolderName: string;
    referenceId: string;
  }): Promise<BankVerificationResult>;

  /** Key-less public lookup — validates the IFSC and names the branch. */
  lookupIfsc(ifsc: string): Promise<IfscDetails | null>;

  verifyWebhookSignature?(rawBody: string, signature: string): boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// SHIPPING
// ═══════════════════════════════════════════════════════════════════════════

export interface ShipmentCreateInput {
  orderNumber: string;
  pickupLocation?: string;
  consignee: {
    name: string;
    phone: string;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    pincode: string;
    country: string;
    email?: string | null;
  };
  items: { name: string; sku: string; qty: number; unitPrice: Paise; hsn?: string }[];
  weightGrams: number;
  dimensionsCm?: { length: number; breadth: number; height: number };
  /** Paise to collect on delivery; 0 for prepaid. */
  codAmount: Paise;
  declaredValue: Paise;
}

export interface ShipmentResult {
  providerShipmentId: string;
  awb: string | null;
  courierName: string | null;
  labelUrl: string | null;
  manifestUrl: string | null;
  trackingUrl: string | null;
  status: string;
  estimatedDeliveryDays?: number | null;
  charges?: Paise;
  raw: unknown;
}

export interface TrackingEvent {
  status: string;
  message: string;
  location?: string | null;
  occurredAt: Date;
}

export interface ServiceabilityResult {
  serviceable: boolean;
  codAvailable: boolean;
  prepaidAvailable: boolean;
  expressAvailable: boolean;
  etaDays: number | null;
  couriers: { name: string; etaDays: number; rate: Paise; codCharge: Paise }[];
}

export interface ShippingProvider extends AdapterInfo {
  checkServiceability(input: {
    fromPincode: string;
    toPincode: string;
    weightGrams: number;
    cod: boolean;
    declaredValue: Paise;
  }): Promise<ServiceabilityResult>;

  createShipment(input: ShipmentCreateInput): Promise<ShipmentResult>;
  generateLabel(providerShipmentId: string): Promise<{ labelUrl: string }>;
  generateManifest(providerShipmentIds: string[]): Promise<{ manifestUrl: string }>;
  schedulePickup(providerShipmentId: string): Promise<{ scheduledAt: Date }>;
  track(awb: string): Promise<{ status: string; events: TrackingEvent[] }>;
  cancelShipment(providerShipmentId: string): Promise<{ cancelled: boolean }>;
  /** Reverse pickup for a return. */
  createReturnPickup(input: ShipmentCreateInput & { originalAwb?: string }): Promise<ShipmentResult>;
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGING
// ═══════════════════════════════════════════════════════════════════════════

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Correlates the Outbox row with a template for analytics. */
  template?: string;
  meta?: Record<string, unknown>;
  campaignId?: string;
}

export interface Mailer extends AdapterInfo {
  send(message: MailMessage): Promise<{ id: string; accepted: boolean }>;
}

export interface SmsMessage {
  to: string;
  body: string;
  template?: string;
  /** WhatsApp needs an approved template name; SMS does not. */
  channel?: 'sms' | 'whatsapp';
  meta?: Record<string, unknown>;
}

export interface SmsSender extends AdapterInfo {
  send(message: SmsMessage): Promise<{ id: string; accepted: boolean }>;
}
