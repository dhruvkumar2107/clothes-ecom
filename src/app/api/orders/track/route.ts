import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { apiOk, apiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

const TrackSchema = z.object({
  orderNumber: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(10).optional(),
});

/**
 * Public order tracking endpoint.
 * Allows lookup by order number + email or phone (no auth required).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = TrackSchema.safeParse({
      orderNumber: searchParams.get('orderNumber'),
      email: searchParams.get('email'),
      phone: searchParams.get('phone'),
    });

    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Order number and email or phone are required', 400);
    }

    const { orderNumber, email, phone } = parsed.data;

    if (!email && !phone) {
      return apiError('VALIDATION_ERROR', 'Please provide either email or phone number', 400);
    }

    // Find the order by orderNumber, include user for identity check
    const order = await db.order.findFirst({
      where: { orderNumber },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        fulfillmentStatus: true,
        placedAt: true,
        confirmedAt: true,
        cancelledAt: true,
        deliveredAt: true,
        user: {
          select: { email: true, phone: true, name: true },
        },
        items: {
          select: {
            name: true,
            imageUrl: true,
            qty: true,
          },
        },
        shipments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            courier: true,
            courierName: true,
            awb: true,
            trackingUrl: true,
            status: true,
            shippedAt: true,
            deliveredAt: true,
            events: {
              orderBy: { occurredAt: 'desc' },
              select: { status: true, message: true, location: true, occurredAt: true },
            },
          },
        },
      },
    });

    if (!order) {
      return apiError('NOT_FOUND', 'Order not found. Please check your order number.', 404);
    }

    // Verify identity: email or phone must match
    const user = order.user;
    const emailMatch = email && user.email?.toLowerCase() === email.toLowerCase();
    const phoneMatch = phone && user.phone?.includes(phone.slice(-4));

    if (!emailMatch && !phoneMatch) {
      return apiError('FORBIDDEN', 'The email or phone number does not match this order.', 403);
    }

    // Return limited info (no financial details for unauthenticated access)
    return apiOk({
      data: {
        orderNumber: order.orderNumber,
        status: order.status,
        fulfillmentStatus: order.fulfillmentStatus,
        placedAt: order.placedAt,
        confirmedAt: order.confirmedAt,
        deliveredAt: order.deliveredAt,
        cancelledAt: order.cancelledAt,
        items: order.items,
        shipment: order.shipments[0] || null,
      },
    });
  } catch (err) {
    console.error('[track] error:', err);
    return apiError('INTERNAL_ERROR', 'Failed to track order', 500);
  }
}
