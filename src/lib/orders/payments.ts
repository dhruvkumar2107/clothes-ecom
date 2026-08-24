import { db, tx, type PrismaTx } from '../db';
import { ApiFailure } from '../api';
import { clampToZero, type Paise } from '../money';
import { generateId } from '../ids';

/**
 * Payment intent creation and management.
 *
 * An intent represents a single checkout attempt on an order. Retries add
 * PaymentAttempts rather than new intents, so the funnel stays legible in the admin.
 */

export interface CreatePaymentIntentInput {
  orderId: string;
  provider: string; // razorpay | stripe | mock | cod | wallet
  providerOrderId?: string | null;
  amount: Paise; // paise to collect via gateway (grandTotal - walletApplied)
  walletApplied: Paise;
  currency: string;
  method: string; // cod | card | upi | netbanking | wallet | emi | bnpl
  emiBank?: string | null;
  emiTenure?: number | null;
  notesJson?: string | null;
}

export interface CreatedPaymentIntent {
  id: string;
  amount: Paise;
  provider: string;
  providerOrderId: string | null;
  status: string;
}

export async function createPaymentIntent(input: CreatePaymentIntentInput): Promise<CreatedPaymentIntent> {
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    select: { id: true, orderNumber: true, amountDue: true, paymentStatus: true, status: true },
  });

  if (!order) throw new ApiFailure('not_found', 'Order not found.', 404);
  if (order.status === 'cancelled') {
    throw new ApiFailure('order_cancelled', 'This order was cancelled.', 409);
  }
  if (order.paymentStatus === 'paid') {
    throw new ApiFailure('already_paid', 'This order is already paid.', 409);
  }

  // Validate amount matches order's amount due
  if (input.amount !== order.amountDue) {
    throw new ApiFailure(
      'amount_mismatch',
      'Payment amount does not match order amount due.',
      409,
      undefined,
      { expected: order.amountDue, received: input.amount }
    );
  }

  const intentId = generateId();

  const intent = await tx(async (client) => {
    const intent = await client.paymentIntent.create({
      data: {
        id: intentId,
        orderId: input.orderId,
        provider: input.provider,
        providerOrderId: input.providerOrderId ?? null,
        amount: input.amount,
        walletApplied: input.walletApplied,
        currency: input.currency,
        method: input.method,
        emiBank: input.emiBank ?? null,
        emiTenure: input.emiTenure ?? null,
        notesJson: input.notesJson ?? null,
        status: 'created',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      },
      select: { id: true },
    });

    return intent;
  });

  return {
    id: intent.id,
    amount: input.amount,
    provider: input.provider,
    providerOrderId: input.providerOrderId ?? null,
    status: 'created',
  };
}

export async function getPaymentIntent(intentId: string) {
  return db.paymentIntent.findUnique({
    where: { id: intentId },
    include: {
      order: { select: { orderNumber: true, userId: true, amountDue: true } },
      attempts: { orderBy: { createdAt: 'desc' } },
    },
  });
}

export async function updatePaymentIntentStatus(
  intentId: string,
  status: string,
  providerOrderId?: string,
  providerPaymentId?: string
) {
  return db.paymentIntent.update({
    where: { id: intentId },
    data: {
      status,
      providerOrderId: providerOrderId ?? undefined,
      updatedAt: new Date(),
    },
  });
}