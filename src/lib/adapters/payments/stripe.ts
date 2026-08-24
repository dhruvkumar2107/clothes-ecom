import crypto from 'node:crypto';
import type { Paise } from '../../money';
import { formEncode, gatewayFetch } from '../http';
import {
  GatewayError,
  type CreateGatewayOrderInput,
  type DriverMode,
  type GatewayOrder,
  type GatewayPayment,
  type GatewayRefund,
  type ParsedWebhook,
  type PaymentGateway,
  type VerifyCallbackInput,
} from '../types';

/**
 * Stripe Payments — the international fallback.
 *
 * Razorpay is the primary for India (UPI, COD reconciliation, and payouts in one
 * ecosystem). Stripe exists here for cross-border card acceptance, and its model
 * is different enough that two things need explaining:
 *
 *   • **PaymentIntents, not orders.** Stripe has no "order" object; the
 *     PaymentIntent *is* the order. Its `client_secret` is what the browser SDK
 *     confirms against, so that is what `clientPayload` carries. It is
 *     scoped to a single intent and useless for anything else, which is why it
 *     is safe to send to the client — unlike an API key.
 *   • **There is no callback signature.** Razorpay hands the browser a signed
 *     `order_id|payment_id` pair; Stripe does not. So `verifyCallback` cannot
 *     verify a client claim — instead it *re-fetches the intent from Stripe* and
 *     believes only the server's answer. Same guarantee, different mechanism:
 *     the client is never the authority on whether money moved.
 *
 * Stripe's API is form-encoded, and `capture_method: manual` mirrors the
 * authorize-then-capture flow the Razorpay driver uses, so the order pipeline is
 * identical regardless of which gateway is resolved.
 */

const API_BASE = 'https://api.stripe.com/v1';

interface StripePaymentsConfig {
  secretKey: string;
  publishableKey: string | null;
  webhookSecret: string | null;
  mode: DriverMode;
}

interface StripeCharge {
  id: string;
  amount_refunded?: number;
  payment_method_details?: {
    type?: string;
    card?: { last4?: string; network?: string; brand?: string; funding?: string };
  };
  failure_code?: string | null;
  failure_message?: string | null;
  outcome?: { reason?: string | null; network_status?: string | null } | null;
}

interface StripePaymentIntent {
  id: string;
  object: string;
  amount: number;
  amount_received?: number;
  currency: string;
  status:
    | 'requires_payment_method'
    | 'requires_confirmation'
    | 'requires_action'
    | 'processing'
    | 'requires_capture'
    | 'succeeded'
    | 'canceled';
  client_secret?: string | null;
  payment_method?: string | null;
  payment_method_types?: string[];
  latest_charge?: StripeCharge | string | null;
  last_payment_error?: {
    code?: string;
    message?: string;
    type?: string;
    decline_code?: string;
  } | null;
  metadata?: Record<string, string>;
  created?: number;
}

interface StripeRefund {
  id: string;
  payment_intent?: string | null;
  charge?: string | null;
  amount: number;
  status: 'pending' | 'succeeded' | 'failed' | 'requires_action' | 'canceled';
}

interface StripeEvent {
  id: string;
  type: string;
  created?: number;
  data?: { object?: StripePaymentIntent | StripeRefund | Record<string, unknown> };
}

/** Stripe's intent lifecycle → our PaymentIntentStatus vocabulary. */
function normalizeStatus(status: StripePaymentIntent['status']): GatewayPayment['status'] {
  switch (status) {
    case 'succeeded':
      return 'captured';
    case 'requires_capture':
      return 'authorized';
    case 'canceled':
      return 'cancelled';
    case 'processing':
    case 'requires_action':
    case 'requires_confirmation':
      return 'pending';
    default:
      return 'created';
  }
}

export class StripePayments implements PaymentGateway {
  readonly name = 'stripe';
  readonly label: string;
  readonly mode: DriverMode;

  private readonly config: StripePaymentsConfig;

  constructor(config: StripePaymentsConfig) {
    this.config = config;
    this.mode = config.mode;
    this.label = `Stripe (${config.mode})`;
  }

  private async call<T>(init: {
    path: string;
    method?: 'GET' | 'POST';
    form?: Record<string, string>;
    idempotencyKey?: string;
  }): Promise<T> {
    const response = await gatewayFetch<T>({
      provider: 'stripe',
      url: `${API_BASE}${init.path}`,
      method: init.method ?? 'GET',
      bearerToken: this.config.secretKey,
      headers: init.form
        ? { 'Content-Type': 'application/x-www-form-urlencoded' }
        : undefined,
      body: init.form ? formEncode(init.form) : undefined,
      idempotencyKey: init.idempotencyKey,
    });
    return response.data;
  }

  async createOrder(input: CreateGatewayOrderInput): Promise<GatewayOrder> {
    if (input.amount <= 0) {
      throw new GatewayError({
        code: 'BAD_REQUEST_ERROR',
        message: 'stripe: amount must be greater than zero',
        provider: 'stripe',
        retryable: false,
      });
    }

    const form: Record<string, string> = {
      amount: String(input.amount),
      currency: input.currency.toLowerCase(),
      // Mirrors Razorpay's payment_capture: 0 — never capture against an order
      // we haven't committed.
      capture_method: 'manual',
      'automatic_payment_methods[enabled]': 'true',
      description: `Order ${input.receipt}`,
      'metadata[receipt]': input.receipt,
    };

    for (const [key, value] of Object.entries(input.notes ?? {})) {
      form[`metadata[${key}]`] = String(value).slice(0, 500);
    }
    if (input.customer?.email) form.receipt_email = input.customer.email;

    const intent = await this.call<StripePaymentIntent>({
      path: '/payment_intents',
      method: 'POST',
      form,
      idempotencyKey: `intent:${input.receipt}`,
    });

    return {
      providerOrderId: intent.id,
      amount: intent.amount,
      currency: intent.currency.toUpperCase(),
      status: intent.status,
      clientPayload: {
        provider: 'stripe',
        publishableKey: this.config.publishableKey,
        // Single-intent scoped secret; cannot be used to read or create anything
        // else on the account.
        clientSecret: intent.client_secret,
        intentId: intent.id,
        amount: intent.amount,
        currency: intent.currency.toUpperCase(),
      },
    };
  }

  /**
   * Stripe has no client-side handshake signature, so a client claim is worth
   * nothing on its own. Re-fetch the intent and let Stripe's own record decide.
   */
  async verifyCallback(input: VerifyCallbackInput): Promise<boolean> {
    if (!input.providerOrderId) return false;

    const intent = await this.call<StripePaymentIntent>({
      path: `/payment_intents/${encodeURIComponent(input.providerOrderId)}`,
    });

    return intent.status === 'succeeded' || intent.status === 'requires_capture';
  }

  async fetchPayment(providerPaymentId: string): Promise<GatewayPayment> {
    const intent = await this.call<StripePaymentIntent>({
      path: `/payment_intents/${encodeURIComponent(providerPaymentId)}?expand[]=latest_charge`,
    });
    return this.toPayment(intent);
  }

  async capture(providerPaymentId: string, amount: Paise): Promise<GatewayPayment> {
    const intent = await this.call<StripePaymentIntent>({
      path: `/payment_intents/${encodeURIComponent(providerPaymentId)}/capture`,
      method: 'POST',
      form: { amount_to_capture: String(amount) },
      idempotencyKey: `capture:${providerPaymentId}`,
    });
    return this.toPayment(intent);
  }

  async refund(input: {
    providerPaymentId: string;
    amount: Paise;
    speed?: 'normal' | 'instant';
    notes?: Record<string, string>;
    idempotencyKey?: string;
  }): Promise<GatewayRefund> {
    const form: Record<string, string> = {
      payment_intent: input.providerPaymentId,
      amount: String(input.amount),
    };
    for (const [key, value] of Object.entries(input.notes ?? {})) {
      form[`metadata[${key}]`] = String(value).slice(0, 500);
    }

    const refund = await this.call<StripeRefund>({
      path: '/refunds',
      method: 'POST',
      form,
      idempotencyKey: input.idempotencyKey ?? `refund:${input.providerPaymentId}:${input.amount}`,
    });

    return {
      providerRefundId: refund.id,
      providerPaymentId: input.providerPaymentId,
      amount: refund.amount,
      status:
        refund.status === 'succeeded'
          ? 'completed'
          : refund.status === 'failed' || refund.status === 'canceled'
            ? 'failed'
            : 'processing',
      // Stripe has no instant-refund rail; claiming otherwise would set a false
      // expectation in the customer's refund timeline.
      speed: 'normal',
      raw: refund,
    };
  }

  /**
   * Stripe signs with a timestamped scheme:
   *   Stripe-Signature: t=<ts>,v1=<hmac_sha256(t + "." + body)>
   *
   * The timestamp must be checked too — without it, a captured webhook can be
   * replayed forever with a signature that still validates.
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.config.webhookSecret || !signature) return false;

    const parts = new Map(
      signature.split(',').map((pair) => {
        const idx = pair.indexOf('=');
        return [pair.slice(0, idx).trim(), pair.slice(idx + 1).trim()] as const;
      }),
    );

    const timestamp = parts.get('t');
    const provided = parts.get('v1');
    if (!timestamp || !provided) return false;

    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(age) || age > 300) return false; // 5-minute replay window

    const expected = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(`${timestamp}.${rawBody}`, 'utf8')
      .digest('hex');

    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    if (a.length !== b.length) {
      crypto.timingSafeEqual(a, a);
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  }

  parseWebhook(rawBody: string): ParsedWebhook {
    let event: StripeEvent;
    try {
      event = JSON.parse(rawBody) as StripeEvent;
    } catch {
      return {
        eventId: `unparseable_${crypto.createHash('sha256').update(rawBody).digest('hex').slice(0, 16)}`,
        eventType: 'unparseable',
        subject: { kind: 'unknown' },
        raw: rawBody,
      };
    }

    const object = event.data?.object ?? {};

    if (event.type.startsWith('payment_intent.')) {
      return {
        eventId: event.id,
        eventType: event.type,
        subject: { kind: 'payment', payment: this.toPayment(object as StripePaymentIntent) },
        raw: event,
      };
    }

    if (event.type.startsWith('charge.refund') || event.type.startsWith('refund.')) {
      const r = object as StripeRefund;
      return {
        eventId: event.id,
        eventType: event.type,
        subject: {
          kind: 'refund',
          refund: {
            providerRefundId: r.id,
            providerPaymentId: r.payment_intent ?? '',
            amount: r.amount,
            status:
              r.status === 'succeeded'
                ? 'completed'
                : r.status === 'failed' || r.status === 'canceled'
                  ? 'failed'
                  : 'processing',
            speed: 'normal',
            raw: r,
          },
        },
        raw: event,
      };
    }

    return { eventId: event.id, eventType: event.type, subject: { kind: 'unknown' }, raw: event };
  }

  clientConfig() {
    return { provider: 'stripe', keyId: this.config.publishableKey, mode: this.mode };
  }

  private toPayment(intent: StripePaymentIntent): GatewayPayment {
    const charge =
      typeof intent.latest_charge === 'object' && intent.latest_charge
        ? intent.latest_charge
        : null;
    const card = charge?.payment_method_details?.card;
    const type = charge?.payment_method_details?.type ?? intent.payment_method_types?.[0] ?? 'card';
    const error = intent.last_payment_error;

    return {
      // Stripe's intent id doubles as both order and payment handle.
      providerPaymentId: intent.id,
      providerOrderId: intent.id,
      amount: intent.amount,
      amountRefunded: charge?.amount_refunded ?? 0,
      currency: intent.currency.toUpperCase(),
      status: error && intent.status === 'requires_payment_method' ? 'failed' : normalizeStatus(intent.status),
      method: type === 'card' ? 'card' : type,
      methodDetail: card?.last4
        ? `${card.brand ?? card.network ?? 'Card'} •••• ${card.last4}`
        : null,
      bank: null,
      wallet: null,
      vpa: null,
      cardLast4: card?.last4 ?? null,
      cardNetwork: card?.network ?? card?.brand ?? null,
      cardType: card?.funding ?? null,
      // Stripe's saved-instrument handle. A PaymentMethod id, never card data.
      token: intent.payment_method ?? null,
      errorCode: error?.decline_code ?? error?.code ?? charge?.failure_code ?? null,
      errorDescription: error?.message ?? charge?.failure_message ?? null,
      errorSource: error?.type ?? null,
      errorReason: charge?.outcome?.reason ?? null,
      capturedAt:
        intent.status === 'succeeded' && intent.created ? new Date(intent.created * 1000) : null,
      raw: intent,
    };
  }
}
