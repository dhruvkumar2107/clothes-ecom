import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { amount, reason, mode = 'wallet' } = body;

    if (!amount || parseFloat(amount) <= 0) {
      return NextResponse.json({ error: 'Valid refund amount is required.' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: { refunds: true, user: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const refundAmountPaise = Math.round(parseFloat(amount) * 100);
    const existingRefundedPaise = order.refunds.reduce((acc, r) => acc + r.amount, 0);

    if (refundAmountPaise + existingRefundedPaise > order.grandTotal) {
      return NextResponse.json(
        { error: 'Total refunded amount cannot exceed grand total of the order.' },
        { status: 400 }
      );
    }

    const isFullRefund = refundAmountPaise + existingRefundedPaise === order.grandTotal;
    const newPaymentStatus = isFullRefund ? 'refunded' : 'partially_refunded';

    const result = await prisma.$transaction(async (tx) => {
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

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            userId: order.userId,
            type: 'refund',
            direction: 'credit',
            amount: refundAmountPaise,
            status: 'completed',
            balanceAfter: wallet.balance,
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

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Error processing refund:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process refund.' },
      { status: 500 }
    );
  }
}
