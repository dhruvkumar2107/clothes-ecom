import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCustomerSession, requireCustomer } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { createOrder, CreateOrderInput } from '@/lib/orders/create';
import { getCartView } from '@/lib/cart';
import { createPaymentIntent } from '@/lib/orders/payments';
import { apiOk, apiError } from '@/lib/api';
import { getPaymentAdapter } from '@/lib/adapters/registry';

export const dynamic = 'force-dynamic';

const CheckoutSchema = z.object({
  addressId: z.string().cuid(),
  billingAddressId: z.string().cuid().optional().nullable(),
  paymentMethod: z.enum(['cod', 'card', 'upi', 'netbanking', 'wallet', 'emi', 'bnpl']),
  couponCode: z.string().optional().nullable(),
  walletRequested: z.number().int().min(0).optional(),
  loyaltyPointsRequested: z.number().int().min(0).optional(),
  customerNote: z.string().max(500).optional().nullable(),
  giftWrap: z.boolean().optional(),
  expectedTotal: z.number().int().min(0).optional(),
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireCustomer();

  try {
    const body = await request.json();
    const parsed = CheckoutSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
    }

    const cartView = await getCartView({ userId: session.userId });
    if (!cartView.cartId) {
      return apiError('EMPTY_CART', 'Your bag is empty.', 409);
    }

    const input: CreateOrderInput = {
      userId: session.userId,
      cartId: cartView.cartId,
      ...parsed.data,
    };

    const order = await createOrder(input);

    // If fully paid (wallet), redirect to success
    if (order.fullyPaid) {
      const successUrl = parsed.data.returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?order=${order.orderNumber}`;
      return apiOk({ data: { order, redirectUrl: successUrl } });
    }

    // For COD, order is created and confirmed immediately
    if (order.paymentMethod === 'cod') {
      const successUrl = parsed.data.returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?order=${order.orderNumber}`;
      return apiOk({ data: { order, redirectUrl: successUrl } });
    }

    // For gateway payments, create payment intent
    const intent = await createPaymentIntent({
      orderId: order.orderId,
      provider: getPaymentProvider(order.paymentMethod),
      amount: order.amountDue,
      walletApplied: order.walletApplied,
      currency: 'INR',
      method: order.paymentMethod,
    });

    const adapter = getPaymentAdapter();
    const clientToken = await adapter.createOrder({
      amount: intent.amount,
      currency: 'INR',
      receipt: order.orderNumber,
      notes: { orderNumber: order.orderNumber },
    });

    return apiOk({
      data: {
        order,
        paymentIntent: {
          id: intent.id,
          amount: intent.amount,
          clientToken,
        },
      },
    });
  } catch (error: any) {
    if (error?.code) {
      return apiError(error.code, error.message, error.status || 500, error.details);
    }
    console.error('Checkout error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to process checkout', 500);
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