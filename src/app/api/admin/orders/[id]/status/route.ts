import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { apiOk, apiError } from '@/lib/api';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'] as const;

const UpdateStatusSchema = z.object({
  status: z.enum(VALID_STATUSES),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(['orders.write']);
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateStatusSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid status value', 400, { details: parsed.error.flatten().fieldErrors });
    }

    const { status } = parsed.data;

    const order = await db.order.update({
      where: { id },
      data: {
        status,
        ...(status === 'confirmed' ? { confirmedAt: new Date() } : {}),
        ...(status === 'delivered' ? { deliveredAt: new Date() } : {}),
        ...(status === 'cancelled' ? { cancelledAt: new Date() } : {}),
      },
    });

    await db.orderEvent.create({
      data: {
        orderId: id,
        status,
        title: `Order status updated to ${status.toUpperCase()}`,
        description: `Fulfillment status modified by administrator.`,
        customerVisible: true,
      },
    });

    return apiOk({ data: order });
  } catch (error: any) {
    if (error?.code) {
      return apiError(error.code, error.message, error.status || 500);
    }
    console.error('Error updating order status:', error);
    return apiError('INTERNAL_ERROR', 'Failed to update order status.', 500);
  }
}
