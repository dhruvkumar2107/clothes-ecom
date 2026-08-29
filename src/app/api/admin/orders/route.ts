import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { apiOk, apiError, parseQuery } from '@/lib/api';
import { confirmOrderPaid, cancelOrder } from '@/lib/orders/create';

export const dynamic = 'force-dynamic';

const OrderListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned']).optional(),
  paymentStatus: z.enum(['unpaid', 'authorized', 'paid', 'partially_paid', 'failed', 'refunded', 'partially_refunded']).optional(),
  userId: z.string().optional(),
  orderNumber: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  sort: z.enum(['newest', 'oldest', 'amount_asc', 'amount_desc']).default('newest'),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(['orders.read']);
    const params = parseQuery(request, OrderListSchema);

    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.paymentStatus) where.paymentStatus = params.paymentStatus;
    if (params.userId) where.userId = params.userId;
    if (params.orderNumber) where.orderNumber = { contains: params.orderNumber, mode: 'insensitive' };
    if (params.dateFrom || params.dateTo) {
      where.placedAt = {};
      if (params.dateFrom) where.placedAt.gte = new Date(params.dateFrom);
      if (params.dateTo) where.placedAt.lte = new Date(params.dateTo);
    }

    let orderBy: any = { placedAt: 'desc' };
    switch (params.sort) {
      case 'oldest': orderBy = { placedAt: 'asc' }; break;
      case 'amount_asc': orderBy = { grandTotal: 'asc' }; break;
      case 'amount_desc': orderBy = { grandTotal: 'desc' }; break;
    }

    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          items: { include: { product: { select: { name: true, slug: true } }, variant: { select: { size: true, color: true } } } },
          shipments: { include: { events: { orderBy: { occurredAt: 'asc' } } } },
          events: { orderBy: { createdAt: 'asc' } },
          _count: { select: { items: true, shipments: true, refunds: true, returns: true } },
        },
      }),
      db.order.count({ where }),
    ]);

    return apiOk({ data: orders, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    console.error('Admin orders list error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to load orders', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(['orders.write']);
    const body = await request.json();
    const { orderId, action, ...data } = body;

    const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) return apiError('NOT_FOUND', 'Order not found', 404);

    let result;
    switch (action) {
      case 'confirm':
        if (order.status !== 'pending') return apiError('INVALID_STATE', 'Only pending orders can be confirmed', 409);
        await db.order.update({ where: { id: orderId }, data: { status: 'confirmed', confirmedAt: new Date() } });
        await db.orderEvent.create({ data: { orderId, status: 'confirmed', title: 'Order Confirmed', description: 'Order confirmed by admin' } });
        result = { confirmed: true };
        break;
      case 'pack':
        if (order.status !== 'confirmed') return apiError('INVALID_STATE', 'Only confirmed orders can be packed', 409);
        await db.order.update({ where: { id: orderId }, data: { status: 'packed', fulfillmentStatus: 'partial' } });
        await db.orderEvent.create({ data: { orderId, status: 'packed', title: 'Order Packed', description: 'Order packed and ready for pickup' } });
        result = { packed: true };
        break;
      case 'ship':
        if (!['confirmed', 'packed'].includes(order.status)) return apiError('INVALID_STATE', 'Order must be confirmed or packed to ship', 409);
        const { courier, awb, trackingUrl } = data;
        const shipment = await db.shipment.create({ data: { orderId, courier, awb, trackingUrl, status: 'pickup_scheduled' } });
        await db.order.update({ where: { id: orderId }, data: { status: 'shipped', fulfillmentStatus: 'fulfilled' } });
        await db.orderEvent.create({ data: { orderId, status: 'shipped', title: 'Order Shipped', description: `Shipped via ${courier} (AWB: ${awb})` } });
        result = { shipped: true, shipment };
        break;
      case 'deliver':
        if (order.status !== 'shipped') return apiError('INVALID_STATE', 'Only shipped orders can be delivered', 409);
        await db.order.update({ where: { id: orderId }, data: { status: 'delivered', deliveredAt: new Date(), returnWindowEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) } });
        await db.orderEvent.create({ data: { orderId, status: 'delivered', title: 'Order Delivered', description: 'Order delivered to customer' } });
        result = { delivered: true };
        break;
      case 'cancel':
        if (['delivered', 'cancelled', 'returned'].includes(order.status)) return apiError('INVALID_STATE', 'Cannot cancel this order', 409);
        const cancelResult = await cancelOrder(orderId, data.reason || 'Cancelled by admin', 'admin');
        result = cancelResult;
        break;
      case 'refund': {
        if (order.paymentStatus !== 'paid') return apiError('INVALID_STATE', 'Only paid orders can be refunded', 409);
        const refundAmount = data.amount || order.grandTotal;
        const refundMode = data.mode || 'wallet';
        const existingRefunds = await db.refund.findMany({ where: { orderId } });
        const existingRefundedPaise = existingRefunds.reduce((acc: number, r: any) => acc + r.amount, 0);
        const refundAmountPaise = Math.round(refundAmount * 100);
        if (refundAmountPaise + existingRefundedPaise > order.grandTotal) {
          return apiError('VALIDATION_ERROR', 'Total refunded amount cannot exceed grand total', 400);
        }
        const isFullRefund = refundAmountPaise + existingRefundedPaise === order.grandTotal;
        const newPaymentStatus = isFullRefund ? 'refunded' : 'partially_refunded';
        const orderWithUser = await db.order.findUnique({ where: { id: orderId }, select: { userId: true } });
        result = await db.$transaction(async (tx) => {
          const refund = await tx.refund.create({
            data: {
              orderId,
              userId: orderWithUser!.userId,
              amount: refundAmountPaise,
              reason: data.reason || 'Admin initiated refund',
              mode: refundMode,
              status: 'completed',
              completedAt: new Date(),
            },
          });
          await tx.order.update({ where: { id: orderId }, data: { paymentStatus: newPaymentStatus } });
          if (refundMode === 'wallet') {
            const wallet = await tx.wallet.upsert({
              where: { userId: orderWithUser!.userId },
              update: { balance: { increment: refundAmountPaise }, totalEarned: { increment: refundAmountPaise } },
              create: { userId: orderWithUser!.userId, balance: refundAmountPaise, totalEarned: refundAmountPaise },
            });
            const updatedWallet = await tx.wallet.findUnique({ where: { id: wallet.id } });
            await tx.walletTransaction.create({
              data: {
                walletId: wallet.id,
                userId: orderWithUser!.userId,
                type: 'refund',
                direction: 'credit',
                amount: refundAmountPaise,
                status: 'completed',
                balanceAfter: updatedWallet!.balance,
                refType: 'Order',
                refId: orderId,
                description: `Refund for Order #${order.orderNumber}`,
              },
            });
          }
          return { refunded: true, refundId: refund.id };
        });
        break;
      }
      default:
        return apiError('INVALID_ACTION', 'Unknown action', 400);
    }

    return apiOk({ data: result });
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    console.error('Admin order action error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to process order action', 500);
  }
}