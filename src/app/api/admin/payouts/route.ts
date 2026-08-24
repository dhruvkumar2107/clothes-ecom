import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { apiOk, apiError, parseQuery } from '@/lib/api';
import { getPayoutGateway } from '@/lib/adapters/registry';

export const dynamic = 'force-dynamic';

const PayoutListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'approved', 'rejected', 'processing', 'completed', 'failed', 'cancelled']).optional(),
  userId: z.string().optional(),
  sort: z.enum(['newest', 'oldest', 'amount_desc']).default('newest'),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(['payouts.read']);
    const params = parseQuery(request, PayoutListSchema);

    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.userId) where.userId = params.userId;

    let orderBy: any = { requestedAt: 'desc' };
    if (params.sort === 'oldest') orderBy = { requestedAt: 'asc' };
    if (params.sort === 'amount_desc') orderBy = { amount: 'desc' };

    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    const [withdrawals, total] = await Promise.all([
      db.withdrawalRequest.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, email: true, referralCode: true } },
          bankAccount: { select: { id: true, accountHolderName: true, accountNumberLast4: true, bankName: true, ifsc: true, vpa: true, kind: true } },
          attempts: { orderBy: { createdAt: 'desc' } },
        },
      }),
      db.withdrawalRequest.count({ where }),
    ]);

    return apiOk({ data: withdrawals, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    console.error('Admin payouts list error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to load payouts', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(['payouts.approve']);
    const body = await request.json();
    const { withdrawalId, action, note, amount, mode } = body;

    const withdrawal = await db.withdrawalRequest.findUnique({ where: { id: withdrawalId }, include: { bankAccount: true } });
    if (!withdrawal) return apiError('NOT_FOUND', 'Withdrawal request not found', 404);

    if (action === 'approve') {
      if (withdrawal.status !== 'pending') return apiError('INVALID_STATE', 'Only pending withdrawals can be approved', 409);

      const payoutGateway = getPayoutGateway();
      // Note: In production, the bank account would need to be pre-registered as a contact/fund account
      // with the payout gateway, and we'd use the fundAccountId here
      const fundAccountId = withdrawal.bankAccount.providerRefId || '';
      const payout = await payoutGateway.createPayout({
        fundAccountId,
        amount: withdrawal.netAmount,
        currency: 'INR',
        mode: withdrawal.mode as any,
        narration: `Payout ${withdrawal.requestNumber}`,
        referenceId: withdrawal.requestNumber,
        idempotencyKey: `payout:${withdrawalId}`,
      });

      await db.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: {
          status: 'processing',
          reviewedAt: new Date(),
          reviewNote: note,
          provider: payoutGateway.name,
          providerPayoutId: payout.providerPayoutId,
        },
      });

      await db.auditLog.create({
        data: { actorType: 'staff', action: 'payout.approve', entity: 'WithdrawalRequest', entityId: withdrawalId, summary: `Approved payout ${withdrawal.requestNumber}` },
      });

      return apiOk({ data: { approved: true, payout } });
    }

    if (action === 'reject') {
      if (withdrawal.status !== 'pending') return apiError('INVALID_STATE', 'Only pending withdrawals can be rejected', 409);

      const body = await request.json();
      const { note, reason } = body;

      await db.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: { status: 'rejected', reviewedAt: new Date(), reviewNote: note, rejectionReason: reason },
      });

      // Reverse wallet hold
      if (withdrawal.walletTxnId) {
        await db.walletTransaction.update({ where: { id: withdrawal.walletTxnId }, data: { status: 'reversed', releasedAt: new Date() } });
        await db.wallet.update({ where: { userId: withdrawal.userId }, data: { lockedBalance: { decrement: withdrawal.amount }, balance: { increment: withdrawal.amount } } });
      }

      await db.auditLog.create({
        data: { actorType: 'staff', action: 'payout.reject', entity: 'WithdrawalRequest', entityId: withdrawalId, summary: `Rejected payout ${withdrawal.requestNumber}` },
      });

      return apiOk({ data: { rejected: true } });
    }

    return apiError('INVALID_ACTION', 'Unknown action', 400);
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    console.error('Admin payout action error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to process payout action', 500);
  }
}