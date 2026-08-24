import crypto from 'node:crypto';
import type { Paise } from '../../money';
import { gatewayFetch } from '../http';
import {
  GatewayError,
  type CreateGatewayOrderInput,
  type DriverMode,
  type EmiOption,
  type GatewayOrder,
  type GatewayPayment,
  type GatewayRefund,
  type ParsedWebhook,
  type PaymentGateway,
  type VerifyCallbackInput,
} from '../types';

/**
 * Razorpay Payments.
 *
 * Docs: https://razorpay.com/docs/api/payments/
 *
 * Razorpay is the right primary for an Indian storefront because one integration
 * covers cards, UPI, net banking, wallets, EMI and BNPL, and the same account
 * fronts RazorpayX for payouts and fund-account validation — so COD
 * reconciliation, referral payouts and penny-drops all settle in one ledger.
 *
 * Three details this driver gets deliberately right:
 *
 *   • **Manual capture.** Orders are created with `payment_capture: 0`, so a
 *     payment is *authorized* until we capture it. That means a payment can
 *     never be captured for an order we failed to persist — we capture only
 *     after the order row is committed and stock is reserved. An auto-captured
 *     payment against a lost order is a manual refund and an angry customer.
 *   • **Signature is the source of truth.** `verifyCallback` recomputes
 *     `HMAC-SHA256(order_id|payment_id, key_secret)` in constant time. The
 *     client-reported status is never consulted anywhere.
 *   • **Amounts are already paise.** Razorpay's smallest-currency-unit
 *     convention matches our internal representation exactly, so no conversion
 *     happens here — the class of bug where a ₹1,000 order charges ₹100,000
 *     cannot occur.
 */

const API_BASE = 'https://api.razorpay.com/v1';

interface RazorpayPaymentsConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string | null;
  mode: DriverMode;
}

interface RzpOrder {
  id: string;
  amount: number;
  amount_paid?: number;
  amount_due?: number;
  currency: string;
  receipt?: string | null;
  status: string;
  notes?: Record<string, string>;
}

interface RzpPayment {
  id: string;
  order_id?: string | null;
  amount: number;
  amount_refunded?: number;
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  method: string;
  captured?: boolean;
  bank?: string | null;
  wallet?: string | null;
  vpa?: string | null;
  card_id?: string | null;
  card?: {
    last4?: string;
    network?: string;
    type?: string;
    issuer?: string | null;
  } | null;
  token_id?: string | null;
  error_code?: string | null;
  error_description?: string | null;
  error_source?: string | null;
  error_reason?: string | null;
  created_at?: number;
  notes?: Record<string, string>;
  acquirer_data?: Record<string, unknown>;
}

interface RzpRefund {
  id: string;
  payment_id: string;
  amount: number;
  status: 'pending' | 'processed' | 'failed';
  speed_processed?: string;
  speed_requested?: string;
}

interface RzpWebhookEnvelope {
  entity: string;
  event: string;
  contains?: string[];
  payload?: {
    payment?: { entity?: RzpPayment };
    refund?: { entity?: RzpRefund };
    payout?: { entity?: Record<string, unknown> };
    'fund_account.validation'?: { entity?: Record<string, unknown> };
    settlement?: { entity?: Record<string, unknown> };
  };
  created_at?: number;
}

/** Razorpay → our PaymentIntentStatus vocabulary. */
function normalizeStatus(p: RzpPayment): GatewayPayment['status'] {
  switch (p.status) {
    case 'captured':
      return 'captured';
    case 'refunded':
      // Refund state lives on the order/refund records, not the intent. From the
      // intent's point of view the money was successfully captured.
      return 'captured';
    case 'authorized':
      return 'authorized';
    case 'failed':
      return 'failed';
    default:
      return 'pending';
  }
}

function methodDetail(p: RzpPayment): string | null {
  if (p.card?.last4) {
    const issuer = p.card.issuer ?? p.card.network ?? 'Card';
    return `${issuer} •••• ${p.card.last4}`;
  }
  if (p.vpa) return p.vpa;
  if (p.wallet) return p.wallet;
  if (p.bank) return p.bank;
  return null;
}

export class RazorpayPayments implements PaymentGateway {
  readonly name = 'razorpay';
  readonly label: string;
  readonly mode: DriverMode;

  private readonly config: RazorpayPaymentsConfig;

  constructor(config: RazorpayPaymentsConfig) {
    this.config = config;
    this.mode = config.mode;
    this.label = `Razorpay (${config.mode})`;
  }

  private get auth() {
    return { username: this.config.keyId, password: this.config.keySecret };
  }

  async createOrder(input: CreateGatewayOrderInput): Promise<GatewayOrder> {
    if (input.amount <= 0) {
      throw new GatewayError({
        code: 'BAD_REQUEST_ERROR',
        message: 'razorpay: order amount must be greater than zero',
        provider: 'razorpay',
        retryable: false,
      });
    }

    const response = await gatewayFetch<RzpOrder>({
      provider: 'razorpay',
      url: `${API_BASE}/orders`,
      method: 'POST',
      basicAuth: this.auth,
      // Receipt is unique per order, making this safe to retry.
      idempotencyKey: `order:${input.receipt}`,
      body: {
        amount: input.amount,
        currency: input.currency,
        receipt: input.receipt.slice(0, 40), // Razorpay's hard limit
        // Manual capture — see the class docstring.
        payment_capture: 0,
        notes: input.notes ?? {},
      },
    });

    const order = response.data;

    return {
      providerOrderId: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      clientPayload: {
        provider: 'razorpay',
        // Public key — safe in the browser. The secret never leaves the server.
        key: this.config.keyId,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        name: 'LUMEN&CO',
        description: `Order ${input.receipt}`,
        prefill: {
          name: input.customer?.name ?? '',
          email: input.customer?.email ?? '',
          contact: input.customer?.phone ?? '',
        },
        notes: input.notes ?? {},
        theme: { color: '#8B5CF6' },
        ...(input.method ? { method: input.method } : {}),
      },
    };
  }

  /**
   * The only thing that may decide a payment succeeded.
   *
   * Constant-time by construction: a byte-by-byte early return would let an
   * attacker discover the expected digest one character at a time and forge a
   * successful checkout for an unpaid order.
   */
  async verifyCallback(input: VerifyCallbackInput): Promise<boolean> {
    if (!input.providerOrderId || !input.providerPaymentId || !input.signature) return false;

    const expected = crypto
      .createHmac('sha256', this.config.keySecret)
      .update(`${input.providerOrderId}|${input.providerPaymentId}`, 'utf8')
      .digest('hex');

    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(input.signature, 'utf8');
    if (a.length !== b.length) {
      crypto.timingSafeEqual(a, a);
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  }

  async fetchPayment(providerPaymentId: string): Promise<GatewayPayment> {
    const response = await gatewayFetch<RzpPayment>({
      provider: 'razorpay',
      url: `${API_BASE}/payments/${providerPaymentId}`,
      method: 'GET',
      basicAuth: this.auth,
    });
    return this.toPayment(response.data);
  }

  async capture(
    providerPaymentId: string,
    amount: Paise,
    currency: string,
  ): Promise<GatewayPayment> {
    const response = await gatewayFetch<RzpPayment>({
      provider: 'razorpay',
      url: `${API_BASE}/payments/${providerPaymentId}/capture`,
      method: 'POST',
      basicAuth: this.auth,
      // Capture is idempotent at Razorpay by payment id, but the key also makes
      // our own HTTP layer willing to retry a timeout — which matters, because a
      // timed-out capture that actually succeeded must not be re-authorized.
      idempotencyKey: `capture:${providerPaymentId}`,
      body: { amount, currency },
    });
    return this.toPayment(response.data);
  }

  async refund(input: {
    providerPaymentId: string;
    amount: Paise;
    speed?: 'normal' | 'instant';
    notes?: Record<string, string>;
    idempotencyKey?: string;
  }): Promise<GatewayRefund> {
    const response = await gatewayFetch<RzpRefund>({
      provider: 'razorpay',
      url: `${API_BASE}/payments/${input.providerPaymentId}/refunds`,
      method: 'POST',
      basicAuth: this.auth,
      idempotencyKey: input.idempotencyKey ?? `refund:${input.providerPaymentId}:${input.amount}`,
      body: {
        amount: input.amount,
        // Razorpay calls instant refunds "optimum" — it uses the fastest rail
        // available and silently falls back to normal if none is.
        speed: input.speed === 'instant' ? 'optimum' : 'normal',
        notes: input.notes ?? {},
      },
    });

    const r = response.data;

    return {
      providerRefundId: r.id,
      providerPaymentId: r.payment_id,
      amount: r.amount,
      status:
        r.status === 'processed' ? 'completed' : r.status === 'failed' ? 'failed' : 'processing',
      speed: (r.speed_processed ?? r.speed_requested) === 'optimum' ? 'instant' : 'normal',
      raw: r,
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.config.webhookSecret) {
      // Fail closed. An unsigned webhook that we accept is an open endpoint for
      // marking arbitrary orders paid.
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

  parseWebhook(rawBody: string): ParsedWebhook {
    let envelope: RzpWebhookEnvelope;
    try {
      envelope = JSON.parse(rawBody) as RzpWebhookEnvelope;
    } catch {
      return {
        eventId: `unparseable_${crypto.createHash('sha256').update(rawBody).digest('hex').slice(0, 16)}`,
        eventType: 'unparseable',
        subject: { kind: 'unknown' },
        raw: rawBody,
      };
    }

    /**
     * Razorpay does not put an event id in the body — it arrives in the
     * `x-razorpay-event-id` header, which the route passes through separately.
     * Deriving a stable id from the payload gives the WebhookEvent uniqueness
     * constraint something to work with either way, so a redelivery is still
     * recognised as a duplicate.
     */
    const entityId =
      envelope.payload?.payment?.entity?.id ??
      envelope.payload?.refund?.entity?.id ??
      (envelope.payload?.payout?.entity?.id as string | undefined) ??
      (envelope.payload?.['fund_account.validation']?.entity?.id as string | undefined) ??
      'unknown';

    const eventId = `${envelope.event}:${entityId}:${envelope.created_at ?? 0}`;

    const payment = envelope.payload?.payment?.entity;
    if (payment) {
      return {
        eventId,
        eventType: envelope.event,
        subject: { kind: 'payment', payment: this.toPayment(payment) },
        raw: envelope,
      };
    }

    const refund = envelope.payload?.refund?.entity;
    if (refund) {
      return {
        eventId,
        eventType: envelope.event,
        subject: {
          kind: 'refund',
          refund: {
            providerRefundId: refund.id,
            providerPaymentId: refund.payment_id,
            amount: refund.amount,
            status:
              refund.status === 'processed'
                ? 'completed'
                : refund.status === 'failed'
                  ? 'failed'
                  : 'processing',
            speed: (refund.speed_processed ?? 'normal') === 'optimum' ? 'instant' : 'normal',
            raw: refund,
          },
        },
        raw: envelope,
      };
    }

    // Payout and validation events share this webhook endpoint when RazorpayX
    // is on the same account; those are normalised by their own drivers, so we
    // hand them back as `unknown` with the raw body intact for the router.
    return { eventId, eventType: envelope.event, subject: { kind: 'unknown' }, raw: envelope };
  }

  clientConfig() {
    return { provider: 'razorpay', keyId: this.config.keyId, mode: this.mode };
  }

  /**
   * EMI plans available on the account. Razorpay's `/methods` endpoint returns
   * the bank grid and interest rates; we amortise locally so the instalment the
   * customer sees on the product page matches what checkout will charge.
   */
  async emiOptions(amount: Paise): Promise<EmiOption[]> {
    interface RzpMethods {
      emi_options?: Record<
        string,
        { plans?: Record<string, number>; min_amount?: number; name?: string }[]
      >;
      emi?: Record<string, unknown>;
    }

    const response = await gatewayFetch<RzpMethods>({
      provider: 'razorpay',
      url: `${API_BASE}/methods?key_id=${encodeURIComponent(this.config.keyId)}`,
      method: 'GET',
      basicAuth: this.auth,
      timeoutMs: 8_000,
    });

    const options: EmiOption[] = [];
    const grid = response.data.emi_options ?? {};

    for (const [bankCode, entries] of Object.entries(grid)) {
      for (const entry of entries ?? []) {
        const minAmount = entry.min_amount ?? 0;
        if (amount < minAmount) continue;

        for (const [tenureStr, rate] of Object.entries(entry.plans ?? {})) {
          const months = Number(tenureStr);
          if (!Number.isFinite(months) || months <= 0) continue;

          const monthlyRate = rate / 12 / 100;
          let monthlyInstalment: number;
          if (monthlyRate === 0) {
            monthlyInstalment = Math.round(amount / months);
          } else {
            const factor = (1 + monthlyRate) ** months;
            monthlyInstalment = Math.round((amount * monthlyRate * factor) / (factor - 1));
          }

          options.push({
            bank: bankCode,
            bankName: entry.name ?? bankCode,
            tenureMonths: months,
            interestRate: rate,
            monthlyInstalment,
            totalPayable: monthlyInstalment * months,
            processingFee: 0,
            noCostEmi: rate === 0,
            kind: 'emi',
          });
        }
      }
    }

    return options.sort(
      (a, b) => a.tenureMonths - b.tenureMonths || a.monthlyInstalment - b.monthlyInstalment,
    );
  }

  private toPayment(p: RzpPayment): GatewayPayment {
    return {
      providerPaymentId: p.id,
      providerOrderId: p.order_id ?? null,
      amount: p.amount,
      amountRefunded: p.amount_refunded ?? 0,
      currency: p.currency,
      status: normalizeStatus(p),
      method: p.method,
      methodDetail: methodDetail(p),
      bank: p.bank ?? null,
      wallet: p.wallet ?? null,
      vpa: p.vpa ?? null,
      cardLast4: p.card?.last4 ?? null,
      cardNetwork: p.card?.network ?? null,
      cardType: p.card?.type ?? null,
      // A token is only present when the customer consented to saving the
      // instrument. It is a gateway handle, never card data — PCI scope stays
      // entirely with Razorpay.
      token: p.token_id ?? null,
      errorCode: p.error_code ?? null,
      errorDescription: p.error_description ?? null,
      errorSource: p.error_source ?? null,
      errorReason: p.error_reason ?? null,
      capturedAt: p.status === 'captured' && p.created_at ? new Date(p.created_at * 1000) : null,
      raw: p,
    };
  }
}
