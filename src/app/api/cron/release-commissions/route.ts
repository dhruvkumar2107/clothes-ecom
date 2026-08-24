import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiOk, apiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return apiError('UNAUTHORIZED', 'Invalid cron secret', 401);
    }

    const now = new Date();

    const commissionsToRelease = await db.referralCommission.findMany({
      where: {
        status: 'held',
        holdUntil: { lte: now },
      },
      include: {
        referral: { include: { referrer: { include: { wallet: true } } } },
        order: true,
      },
    });

    let released = 0;
    let failed = 0;

    for (const commission of commissionsToRelease) {
      try {
        if (commission.order.status === 'returned' || commission.order.status === 'cancelled') {
          await db.referralCommission.update({
            where: { id: commission.id },
            data: { status: 'rejected', reversalReason: 'Order returned or cancelled' },
          });
          continue;
        }

        if (!commission.referral.referrer.wallet) {
          await db.wallet.create({ data: { userId: commission.referral.referrerId, balance: 0, lockedBalance: 0 } });
        }

        await db.$transaction(async (tx) => {
          await tx.referralCommission.update({
            where: { id: commission.id },
            data: { status: 'available', releasedAt: new Date() },
          });

          await tx.wallet.update({
            where: { userId: commission.referral.referrerId },
            data: {
              balance: { increment: commission.commissionAmount },
              lockedBalance: { decrement: commission.commissionAmount },
              totalEarned: { increment: commission.commissionAmount },
            },
          });

          await tx.walletTransaction.create({
            data: {
              walletId: commission.referral.referrer.wallet!.id,
              userId: commission.referral.referrerId,
              type: 'referral_commission',
              direction: 'credit',
              amount: commission.commissionAmount,
              status: 'completed',
              balanceAfter: commission.referral.referrer.wallet!.balance + commission.commissionAmount,
              lockedAfter: commission.referral.referrer.wallet!.lockedBalance - commission.commissionAmount,
              refType: 'ReferralCommission',
              refId: commission.id,
              description: `Commission from order ${commission.order.orderNumber}`,
              availableAt: new Date(),
            },
          });

          await tx.auditLog.create({
            data: {
              actorType: 'system',
              action: 'commission.release',
              entity: 'ReferralCommission',
              entityId: commission.id,
              summary: `Released ₹${(commission.commissionAmount / 100).toFixed(2)} to ${commission.referral.referrer.name}`,
            },
          });
        });

        released++;
      } catch (error) {
        console.error(`Failed to release commission ${commission.id}:`, error);
        failed++;
      }
    }

    return apiOk({ data: { processed: commissionsToRelease.length, released, failed } });
  } catch (error: any) {
    console.error('Release commissions cron error:', error);
    return apiError('INTERNAL_ERROR', 'Cron job failed', 500);
  }
}