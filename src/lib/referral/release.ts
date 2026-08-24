import { db } from '../db';
import { addDays } from '../utils';

/**
 * Release held referral commissions that are past their hold period.
 *
 * Called by the daily cron. Commissions become available once:
 *   1. The hold period (default 14 days) has passed since the commission was created
 *   2. The source order is past its return window (delivered + 14 days)
 *
 * Once both conditions are met, the commission is moved to the referrer's wallet
 * and a WalletTransaction is created.
 */
export async function releaseHeldCommissions(): Promise<{
  released: number;
  totalAmount: number;
}> {
  const now = new Date();

  // Find commissions that are held and past their hold period
  const heldCommissions = await db.referralCommission.findMany({
    where: {
      status: 'held',
      holdUntil: { lte: now },
    },
    include: {
      referral: { select: { referrerId: true } },
      order: { select: { deliveredAt: true, returnWindowEndsAt: true } },
    },
  });

  let released = 0;
  let totalAmount = 0;

  for (const commission of heldCommissions) {
    // Check if order is delivered and past return window
    if (commission.order.deliveredAt) {
      const returnWindowEnd = commission.order.returnWindowEndsAt ?? addDays(commission.order.deliveredAt, 14);
      if (returnWindowEnd > now) {
        continue; // Still in return window
      }
    } else if (commission.holdUntil && commission.holdUntil > now) {
      continue; // Hold period not over
    } else {
      continue; // Order not delivered yet
    }

    // Release the commission
    await db.$transaction(async (tx) => {
      await tx.referralCommission.update({
        where: { id: commission.id },
        data: {
          status: 'available',
          releasedAt: new Date(),
        },
      });

      // Credit to wallet
      const wallet = await tx.wallet.findUnique({
        where: { userId: commission.referral.referrerId },
      });

      if (wallet) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: { increment: commission.commissionAmount },
            totalEarned: { increment: commission.commissionAmount },
          },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            userId: commission.referral.referrerId,
            type: 'referral_commission',
            direction: 'credit',
            amount: commission.commissionAmount,
            status: 'completed',
            balanceAfter: wallet.balance + commission.commissionAmount,
            refType: 'ReferralCommission',
            refId: commission.id,
            description: `Referral commission from order ${commission.orderId}`,
            availableAt: new Date(),
          },
        });
      }
    });

    released++;
    totalAmount += commission.commissionAmount;
  }

  return { released, totalAmount };
}