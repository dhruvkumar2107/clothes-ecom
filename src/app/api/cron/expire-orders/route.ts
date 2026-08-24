import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiOk, apiError } from '@/lib/api';
import { cancelOrder } from '@/lib/orders/create';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return apiError('UNAUTHORIZED', 'Invalid cron secret', 401);
    }

    const now = new Date();
    const expiryMinutes = 30;

    const expiredOrders = await db.order.findMany({
      where: {
        status: 'pending',
        paymentStatus: 'unpaid',
        placedAt: { lt: new Date(now.getTime() - expiryMinutes * 60 * 1000) },
      },
      include: { items: true, intents: true },
    });

    let cancelled = 0;
    let failed = 0;

    for (const order of expiredOrders) {
      try {
        const hasActiveIntent = order.intents.some(i => ['created', 'pending', 'authorized'].includes(i.status));
        if (hasActiveIntent) continue;

        await cancelOrder(order.id, 'Payment not completed within 30 minutes', 'system');
        cancelled++;
      } catch (error) {
        console.error(`Failed to cancel order ${order.id}:`, error);
        failed++;
      }
    }

    return apiOk({ data: { found: expiredOrders.length, cancelled, failed } });
  } catch (error: any) {
    console.error('Expire orders cron error:', error);
    return apiError('INTERNAL_ERROR', 'Cron job failed', 500);
  }
}