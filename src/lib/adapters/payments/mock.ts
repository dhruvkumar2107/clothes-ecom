import crypto from 'node:crypto';
import type { Paise } from '../../money';
import {
  GatewayError,
  type CreateGatewayOrderInput,
  type EmiOption,
  type GatewayOrder,
  type GatewayPayment,
  type GatewayRefund,
  type ParsedWebhook,
  type PaymentGateway,
  type VerifyCallbackInput,
} from '../types';

/**
 * Mock payment gateway.
 *
 * The important property this preserves is the security one: **the browser
 * cannot declare its own payment successful.** A fake gateway that trusts
 * `{ success: true }` from the client trains the codebase into a shape that is
 * catastrophically wrong the moment real keys arrive.
 *
 * So this driver reproduces Razorpay's actual handshake:
 *
 *   1. `createOrder()` mints `order_mock_…` server-side.
 *   2. The mock checkout UI collects a method and posts to
 *      `/api/payments/mock/authorize`, which runs **on the server**, mints the
 *      payment id, and signs `order_id|payment_id` with an HMAC the client never
 *      sees (`signCallback`).
 *   3. `verifyCallback()` recomputes that HMAC in constant time. A forged or
 *      replayed id fails exactly as it would against Razorpay.
 *
 * Outcomes are deterministic so every checkout branch is reachable without
 * touching code — the mock checkout screen exposes these as buttons:
 *
 *   success        → captured
 *   failure        → failed with `BAD_REQUEST_PAYMENT_FAILED`
 *   insufficient   → failed with `insufficient_balance` (retryable path)
 *   timeout        → stays `pending` (tests the "we're confirming…" state)
 *   authorize_only → authorized but not captured (tests manual capture)
 *
 * The signing key is derived from AUTH_SECRET rather than being a constant, so
 * two developers' mock payments are not interchangeable and a mock signature
 * can never validate against a real deployment.
 */

export type MockOutcome =
  | 'success'
  | 'failure'
  | 'insufficient'
  | 'timeout'
  | 'authorize_only';

const MOCK_OUTCOMES: readonly MockOutcome[] = [
  'success',
  'failure',
  'insufficient',
  'timeout',
  'authorize_only',
];

export function isMockOutcome(value: string): value is MockOutcome {
  return (MOCK_OUTCOMES as readonly string[]).includes(value);
}

function signingKey(): Buffer {
  const secret = process.env.AUTH_SECRET ?? 'dev-only-insecure-secret';
  return crypto.scryptSync(secret, 'lumenco:mock-gateway:v1', 32);
}

interface MockOrderPayload {
  amount: number;
  currency: string;
  receipt: string;
  createdAt: number;
}

interface MockPaymentPayload {
  orderId: string;
  amount: number;
  currency: string;
  method: string;
  outcome: MockOutcome;
  createdAt: number;
  detail?: string;
}

function encode(prefix: string, payload: unknown): string {
  return `${prefix}${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')}`;
}

function decode<T>(prefix: string, id: string): T | null {
  if (!id.startsWith(prefix)) return null;
  try {
    return JSON.parse(Buffer.from(id.slice(prefix.length), 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

const ORDER_PREFIX = 'order_mock_';
const PAYMENT_PREFIX = 'pay_mock_';
const REFUND_PREFIX = 'rfnd_mock_';

/** Deterministic per-method display detail, so the UI has realistic strings. */
function detailFor(method: string, seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 100000;

  switch (method) {
    case 'card':
      return `HDFC •••• ${String(hash % 10000).padStart(4, '0')}`;
    case 'upi':
      return `${['rahul', 'priya', 'arjun', 'meera'][hash % 4]}@ybl`;
    case 'netbanking':
      return ['HDFC Bank', 'ICICI Bank', 'Axis Bank', 'State Bank of India'][hash % 4];
    case 'wallet':
      return ['Paytm', 'PhonePe', 'Amazon Pay'][hash % 3];
    case 'emi':
      return `HDFC Bank EMI · ${[3, 6, 9, 12][hash % 4]} months`;
    default:
      return 'Mock instrument';
  }
}

export class MockPayments implements PaymentGateway {
  readonly name = 'mock';
  readonly mode = 'mock' as const;
  readonly label = 'Mock payment gateway';

  async createOrder(input: CreateGatewayOrderInput): Promise<GatewayOrder> {
    if (input.amount <= 0) {
      throw new GatewayError({
        code: 'BAD_REQUEST_ERROR',
        message: 'mock: order amount must be greater than zero',
        provider: 'mock',
        retryable: false,
      });
    }

    const providerOrderId = encode(ORDER_PREFIX, {
      amount: input.amount,
      currency: input.currency,
      receipt: input.receipt,
      createdAt: Date.now(),
    } satisfies MockOrderPayload);

    return {
      providerOrderId,
      amount: input.amount,
      currency: input.currency,
      status: 'created',
      clientPayload: {
        provider: 'mock',
        orderId: providerOrderId,
        amount: input.amount,
        currency: input.currency,
        receipt: input.receipt,
        name: 'LUMEN&CO',
        prefill: {
          name: input.customer?.name ?? '',
          email: input.customer?.email ?? '',
          contact: input.customer?.phone ?? '',
        },
        /** The mock checkout screen renders one button per outcome. */
        outcomes: MOCK_OUTCOMES,
        notes: input.notes ?? {},
      },
    };
  }

  /**
   * Server-side only. Called by /api/payments/mock/authorize to mint a signed
   * payment. Deliberately not on the PaymentGateway interface — nothing in the
   * shared code path may depend on being able to fabricate a payment.
   */
  signCallback(input: {
    providerOrderId: string;
    method: string;
    outcome: MockOutcome;
  }): { providerPaymentId: string; signature: string } {
    const order = decode<MockOrderPayload>(ORDER_PREFIX, input.providerOrderId);
    if (!order) {
      throw new GatewayError({
        code: 'BAD_REQUEST_ERROR',
        message: `mock: unknown order ${input.providerOrderId}`,
        provider: 'mock',
        retryable: false,
      });
    }

    const providerPaymentId = encode(PAYMENT_PREFIX, {
      orderId: input.providerOrderId,
      amount: order.amount,
      currency: order.currency,
      method: input.method,
      outcome: input.outcome,
      createdAt: Date.now(),
      detail: detailFor(input.method, input.providerOrderId),
    } satisfies MockPaymentPayload);

    return {
      providerPaymentId,
      signature: this.sign(input.providerOrderId, providerPaymentId),
    };
  }

  private sign(orderId: string, paymentId: string): string {
    return crypto
      .createHmac('sha256', signingKey())
      .update(`${orderId}|${paymentId}`, 'utf8')
      .digest('hex');
  }

  async verifyCallback(input: VerifyCallbackInput): Promise<boolean> {
    const expected = this.sign(input.providerOrderId, input.providerPaymentId);
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(input.signature ?? '', 'utf8');
    if (a.length !== b.length) {
      crypto.timingSafeEqual(a, a);
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  }

  async fetchPayment(providerPaymentId: string): Promise<GatewayPayment> {
    const p = decode<MockPaymentPayload>(PAYMENT_PREFIX, providerPaymentId);
    if (!p) {
      throw new GatewayError({
        code: 'BAD_REQUEST_ERROR',
        message: `mock: unknown payment ${providerPaymentId}`,
        provider: 'mock',
        retryable: false,
      });
    }
    return this.toPayment(providerPaymentId, p);
  }

  async capture(providerPaymentId: string, amount: Paise): Promise<GatewayPayment> {
    const p = decode<MockPaymentPayload>(PAYMENT_PREFIX, providerPaymentId);
    if (!p) {
      throw new GatewayError({
        code: 'BAD_REQUEST_ERROR',
        message: `mock: unknown payment ${providerPaymentId}`,
        provider: 'mock',
        retryable: false,
      });
    }

    if (amount > p.amount) {
      throw new GatewayError({
        code: 'BAD_REQUEST_ERROR',
        message: `mock: cannot capture ${amount} against an authorization of ${p.amount}`,
        provider: 'mock',
        retryable: false,
      });
    }

    // Capturing an authorize_only payment is the whole point of manual capture.
    const captured = this.toPayment(providerPaymentId, { ...p, outcome: 'success' });
    return { ...captured, amount, capturedAt: new Date() };
  }

  async refund(input: {
    providerPaymentId: string;
    amount: Paise;
    speed?: 'normal' | 'instant';
  }): Promise<GatewayRefund> {
    const p = decode<MockPaymentPayload>(PAYMENT_PREFIX, input.providerPaymentId);
    if (!p) {
      throw new GatewayError({
        code: 'BAD_REQUEST_ERROR',
        message: `mock: unknown payment ${input.providerPaymentId}`,
        provider: 'mock',
        retryable: false,
      });
    }

    if (input.amount > p.amount) {
      throw new GatewayError({
        code: 'BAD_REQUEST_ERROR',
        message: `mock: refund of ${input.amount} exceeds captured ${p.amount}`,
        provider: 'mock',
        retryable: false,
        userMessage: 'That refund amount is larger than the original payment.',
      });
    }

    return {
      providerRefundId: encode(REFUND_PREFIX, {
        paymentId: input.providerPaymentId,
        amount: input.amount,
        createdAt: Date.now(),
      }),
      providerPaymentId: input.providerPaymentId,
      amount: input.amount,
      // Instant refunds settle immediately; normal ones take days, so the
      // honest initial state is 'processing'.
      status: input.speed === 'instant' ? 'completed' : 'processing',
      speed: input.speed ?? 'normal',
      raw: { driver: 'mock' },
    };
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const expected = crypto
      .createHmac('sha256', signingKey())
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
    let body: { event?: string; id?: string; paymentId?: string };
    try {
      body = JSON.parse(rawBody);
    } catch {
      return { eventId: `mock_${Date.now()}`, eventType: 'unparseable', subject: { kind: 'unknown' }, raw: rawBody };
    }

    const eventId = body.id ?? `mock_${crypto.randomUUID()}`;
    const eventType = body.event ?? 'payment.captured';

    if (body.paymentId) {
      const p = decode<MockPaymentPayload>(PAYMENT_PREFIX, body.paymentId);
      if (p) {
        return {
          eventId,
          eventType,
          subject: { kind: 'payment', payment: this.toPayment(body.paymentId, p) },
          raw: body,
        };
      }
    }

    return { eventId, eventType, subject: { kind: 'unknown' }, raw: body };
  }

  clientConfig() {
    return { provider: 'mock', keyId: null, mode: 'mock' as const };
  }

  /**
   * Realistic EMI grid. The amortisation is the real formula, not invented
   * numbers, so the totals a customer sees add up and the "no-cost EMI" line
   * genuinely equals principal ÷ tenure.
   */
  async emiOptions(amount: Paise): Promise<EmiOption[]> {
    const banks = [
      { code: 'HDFC', name: 'HDFC Bank', rate: 13 },
      { code: 'ICIC', name: 'ICICI Bank', rate: 14 },
      { code: 'UTIB', name: 'Axis Bank', rate: 15 },
      { code: 'KKBK', name: 'Kotak Mahindra Bank', rate: 14.5 },
      { code: 'SBIN', name: 'State Bank of India', rate: 13.5 },
    ];
    const tenures = [3, 6, 9, 12, 18, 24];

    const options: EmiOption[] = [];

    for (const bank of banks) {
      for (const months of tenures) {
        // Brands subsidise interest on short tenures — that is what makes an
        // EMI "no cost" to the customer.
        const noCost = months <= 6;
        const monthlyRate = bank.rate / 12 / 100;

        let monthlyInstalment: number;
        if (noCost) {
          monthlyInstalment = Math.round(amount / months);
        } else {
          const factor = (1 + monthlyRate) ** months;
          monthlyInstalment = Math.round((amount * monthlyRate * factor) / (factor - 1));
        }

        options.push({
          bank: bank.code,
          bankName: bank.name,
          tenureMonths: months,
          interestRate: noCost ? 0 : bank.rate,
          monthlyInstalment,
          totalPayable: monthlyInstalment * months,
          processingFee: noCost ? 0 : 19900,
          noCostEmi: noCost,
          kind: months <= 3 ? 'bnpl' : 'emi',
        });
      }
    }

    return options;
  }

  private toPayment(id: string, p: MockPaymentPayload): GatewayPayment {
    const base = {
      providerPaymentId: id,
      providerOrderId: p.orderId,
      amount: p.amount,
      amountRefunded: 0 as Paise,
      currency: p.currency,
      method: p.method,
      methodDetail: p.detail ?? null,
      raw: { driver: 'mock', payload: p },
    };

    const instrument = {
      bank: p.method === 'netbanking' ? p.detail : null,
      wallet: p.method === 'wallet' ? p.detail : null,
      vpa: p.method === 'upi' ? p.detail : null,
      cardLast4: p.method === 'card' ? (p.detail?.slice(-4) ?? null) : null,
      cardNetwork: p.method === 'card' ? 'Visa' : null,
      cardType: p.method === 'card' ? 'credit' : null,
    };

    switch (p.outcome) {
      case 'success':
        return {
          ...base,
          ...instrument,
          status: 'captured',
          capturedAt: new Date(p.createdAt),
          // Only card/UPI produce a reusable token at a real gateway.
          token:
            p.method === 'card' || p.method === 'upi'
              ? `token_mock_${crypto.createHash('sha256').update(id).digest('hex').slice(0, 16)}`
              : null,
        };
      case 'authorize_only':
        return { ...base, ...instrument, status: 'authorized', capturedAt: null };
      case 'timeout':
        return { ...base, ...instrument, status: 'pending', capturedAt: null };
      case 'insufficient':
        return {
          ...base,
          ...instrument,
          status: 'failed',
          errorCode: 'insufficient_balance',
          errorDescription: 'Insufficient balance in the selected account',
          errorSource: 'bank',
          errorReason: 'insufficient_funds',
        };
      default:
        return {
          ...base,
          ...instrument,
          status: 'failed',
          errorCode: 'BAD_REQUEST_PAYMENT_FAILED',
          errorDescription: 'Payment was declined by the issuing bank',
          errorSource: 'bank',
          errorReason: 'payment_failed',
        };
    }
  }
}
