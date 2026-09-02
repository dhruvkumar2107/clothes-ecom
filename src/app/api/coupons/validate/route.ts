import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCustomerSession, requireCustomer } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { apiOk, apiError } from '@/lib/api';
import { validateCouponForCheckout } from '@/lib/coupons';

export const dynamic = 'force-dynamic';

const ValidateCouponSchema = z.object({
  code: z.string().min(3).max(20).toUpperCase(),
  cartValue: z.number().int().min(0),
  items: z.array(z.object({
    productId: z.string().cuid(),
    variantId: z.string().cuid(),
    qty: z.number().int().min(1),
    price: z.number().int().min(0),
  })),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getCustomerSession();
    const body = await request.json();
    const parsed = ValidateCouponSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
    }

    const { code, cartValue, items } = parsed.data;
    const customerId = session?.userId;

    const result = await validateCouponForCheckout({ code, cartValue, items, userId: customerId });

    if (!result.valid) {
      return apiOk({ data: { valid: false, reason: result.reason } });
    }

    return apiOk({ data: { valid: true, discount: result.discount, shippingDiscount: result.shippingDiscount, coupon: result.coupon } });
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    console.error('Coupon validate error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to validate coupon', 500);
  }
}