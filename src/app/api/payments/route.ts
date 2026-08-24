import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCustomerSession, requireCustomer } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { apiOk, apiError } from '@/lib/api';
import { getPaymentAdapter } from '@/lib/adapters/registry';
import { confirmOrderPaid } from '@/lib/orders/create';

const VerifySchema = z.object({
  orderId: z.string().cuid(),
  paymentId: z.string(),
  signature: z.string().optional(),
  providerOrderId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireCustomer();

  try {
    const body = await request.json();
    const parsed = VerifySchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
    }

    const order = await db.order.findFirst({
      where: { id: parsed.data.orderId, userId: session.userId },
      select: { id: true, orderNumber: true, amountDue: true, paymentStatus: true, paymentMethod: true, status: true },
    });

    if (!order) {
      return apiError('NOT_FOUND', 'Order not found', 404);
    }

    if (order.paymentStatus === 'paid') {
      return apiOk({ data: { alreadyPaid: true } });
    }

    if (order.status === 'cancelled') {
      return apiError('ORDER_CANCELLED', 'This order was cancelled', 409);
    }

    // Verify with payment provider
    const provider = getPaymentProvider(order.paymentMethod || 'mock');
    const adapter = getPaymentAdapter();

    const verified = await adapter.verifyCallback({
      providerOrderId: parsed.data.providerOrderId || parsed.data.orderId,
      providerPaymentId: parsed.data.paymentId,
      signature: parsed.data.signature || '',
    });

    if (!verified) {
      return apiError('PAYMENT_VERIFICATION_FAILED', 'Payment verification failed', 400);
    }

    // Confirm the order
    const result = await confirmOrderPaid({
      orderId: order.id,
      amount: order.amountDue,
      method: order.paymentMethod as 'cod' | 'card' | 'upi' | 'netbanking' | 'wallet' | 'emi' | 'bnpl' | null,
      reference: parsed.data.paymentId,
    });

    const successUrl = `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?order=${order.orderNumber}`;

    return apiOk({
      data: {
        confirmed: result.confirmed,
        alreadyConfirmed: result.alreadyConfirmed,
        redirectUrl: successUrl,
      },
    });
  } catch (error: any) {
    if (error?.code) {
      return apiError(error.code, error.message, error.status || 500);
    }
    console.error('Payment verify error:', error);
    return apiError('INTERNAL_ERROR', 'Payment verification failed', 500);
  }
}

function getPaymentProvider(method: string): string {
  switch (method) {
    case 'card':
    case 'upi':
    case 'netbanking':
    case 'emi':
    case 'bnpl':
      return process.env.PAYMENT_PROVIDER || 'mock';
    default:
      return 'mock';
  }
}