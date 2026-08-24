import { NextRequest, NextResponse } from 'next/server';
import { getCustomerSession, requireCustomer } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { apiOk, apiError } from '@/lib/api';

export async function GET(request: NextRequest) {
  const session = await requireCustomer();

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const [wallet, transactions, total] = await Promise.all([
      db.wallet.findUnique({
        where: { userId: session.userId },
      }),
      db.walletTransaction.findMany({
        where: { userId: session.userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          type: true,
          direction: true,
          amount: true,
          status: true,
          balanceAfter: true,
          lockedAfter: true,
          refType: true,
          refId: true,
          description: true,
          availableAt: true,
          createdAt: true,
        },
      }),
      db.walletTransaction.count({ where: { userId: session.userId } }),
    ]);

    if (!wallet) {
      // Create wallet if doesn't exist
      const created = await db.wallet.create({
        data: { userId: session.userId },
      });
      return apiOk({
        data: { wallet: created, transactions: [], meta: { page, limit, total: 0, totalPages: 0 } },
      });
    }

    return apiOk({
      data: {
        wallet: {
          balance: wallet.balance,
          lockedBalance: wallet.lockedBalance,
          available: wallet.balance - wallet.lockedBalance,
          totalEarned: wallet.totalEarned,
          totalWithdrawn: wallet.totalWithdrawn,
        },
        transactions,
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('Wallet error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to load wallet', 500);
  }
}