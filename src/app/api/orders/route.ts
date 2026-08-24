import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCustomerSession, requireCustomer } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { createOrder, CreateOrderInput } from '@/lib/orders/create';
import { apiOk, apiError } from '@/lib/api';
import { getCartView } from '@/lib/cart';

export const dynamic = 'force-dynamic';

const CreateOrderSchema = z.object({
  addressId: z.string().cuid(),
  billingAddressId: z.string().cuid().optional().nullable(),
  paymentMethod: z.enum(['cod', 'card', 'upi', 'netbanking', 'wallet', 'emi', 'bnpl']),
  couponCode: z.string().optional().nullable(),
  walletRequested: z.number().int().min(0).optional(),
  loyaltyPointsRequested: z.number().int().min(0).optional(),
  customerNote: z.string().max(500).optional().nullable(),
  giftWrap: z.boolean().optional(),
  expectedTotal: z.number().int().min(0).optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireCustomer();

  try {
    const body = await request.json();
    const parsed = CreateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
    }

    // Get the cart to find cartId
    const cartView = await getCartView({ userId: session.userId });
    if (!cartView.cartId) {
      return apiError('EMPTY_CART', 'Your bag is empty.', 409);
    }

    const input: CreateOrderInput = {
      userId: session.userId,
      cartId: cartView.cartId,
      ...parsed.data,
    };

    const result = await createOrder(input);

    return apiOk({ data: result }, { status: 201 });
  } catch (error: any) {
    if (error?.code) {
      return apiError(error.code, error.message, error.status || 500, error.details);
    }
    console.error('Create order error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to create order', 500);
  }
}

export async function GET(request: NextRequest) {
  const session = await requireCustomer();

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const status = searchParams.get('status');

    const where: any = { userId: session.userId };
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy: { placedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          fulfillmentStatus: true,
          grandTotal: true,
          amountPaid: true,
          amountDue: true,
          paymentMethod: true,
          placedAt: true,
          confirmedAt: true,
          deliveredAt: true,
          items: {
            select: {
              id: true,
              name: true,
              sku: true,
              size: true,
              color: true,
              imageUrl: true,
              qty: true,
              lineTotal: true,
              fulfillmentStatus: true,
            },
          },
          _count: { select: { shipments: true } },
        },
      }),
      db.order.count({ where }),
    ]);

    return apiOk({
      data: orders,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Orders list error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to load orders', 500);
  }
}