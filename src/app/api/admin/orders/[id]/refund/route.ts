import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { apiOk, apiError } from '@/lib/api';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const RefundSchema = z.object({
  amount: z.coerce.number().positive('Refund amount must be positive'),
  reason: z.string().optional(),
  mode: z.enum(['wallet', 'source']).default('wallet'),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(['payments.refund']);
    const { id } = await params;
    const body = await req.json();
    const parsed = RefundSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid input', 400, { details: parsed.error.flatten().fieldErrors });
    }

    const { amount, reason, mode } = parsed.data;

    const order = await db.order.findUnique({
      where: { id },
      include: { refunds: true, user: true },
    });

    if (!order) {
      return apiError('NOT_FOUND', 'Order not found.', 404);
    }

    const refundAmountPaise = Math.round(amount * 100);
    const existingRefundedPaise = order.refunds.reduce((acc, r) => acc + r.amount, 0);

    if (refundAmountPaise + existingRefundedPaise > order.grandTotal) {
      return apiError('VALIDATION_ERROR', 'Total refunded amount cannot exceed grand total of the order.', 400);
    }

    const isFullRefund = refundAmountPaise + existingRefundedPaise === order.grandTotal;
    const newPaymentStatus = isFullRefund ? 'refunded' : 'partially_refunded';

    const result = await db.$transaction(async (tx) => {
      const refund = await tx.refund.create({
        data: {
          orderId: id,
          userId: order.userId,
          amount: refundAmountPaise,
          reason: reason || 'Admin initiated refund',
          mode,
          status: 'completed',
          completedAt: new Date(),
        },
      });

      const updatedOrder = await tx.order.update({
        where: { id },
        data: { paymentStatus: newPaymentStatus },
      });

      if (mode === 'wallet') {
        const wallet = await tx.wallet.upsert({
          where: { userId: order.userId },
          update: {
            balance: { increment: refundAmountPaise },
            totalEarned: { increment: refundAmountPaise },
          },
          create: {
            userId: order.userId,
            balance: refundAmountPaise,
            totalEarned: refundAmountPaise,
          },
        });

        const updatedWallet = await tx.wallet.findUnique({ where: { id: wallet.id } });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            userId: order.userId,
            type: 'refund',
            direction: 'credit',
            amount: refundAmountPaise,
            status: 'completed',
            balanceAfter: updatedWallet!.balance,
            refType: 'Order',
            refId: id,
            description: `Refund for Order #${order.orderNumber}: ${reason || 'Admin refund'}`,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorType: 'staff',
          actorLabel: 'Admin User',
          action: 'order.refund',
          entity: 'Order',
          entityId: id,
          summary: `Processed ${mode} refund of ₹${amount} for Order #${order.orderNumber}`,
        },
      });

      return { refund, updatedOrder };
    });

    return apiOk({ data: result });
  } catch (error: any) {
    if (error?.code) {
      return apiError(error.code, error.message, error.status || 500);
    }
    console.error('Error processing refund:', error);
    return apiError('INTERNAL_ERROR', 'Failed to process refund.', 500);
  }
}
