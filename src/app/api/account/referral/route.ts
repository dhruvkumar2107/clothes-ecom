import { NextRequest, NextResponse } from 'next/server';
import { getCustomerSession, requireCustomer } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { apiOk, apiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await requireCustomer();

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const [referrals, stats] = await Promise.all([
      db.referral.findMany({
        where: { referrerId: session.userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          code: true,
          status: true,
          referredUser: {
            select: { id: true, name: true, email: true, photoUrl: true, createdAt: true },
          },
          convertedAt: true,
          firstOrderId: true,
          commissions: {
            select: {
              id: true,
              commissionAmount: true,
              status: true,
              holdUntil: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      db.referral.aggregate({
        where: { referrerId: session.userId },
        _sum: { riskScore: true },
        _count: { status: true },
      }),
    ]);

    const totalConversions = await db.referral.count({
      where: { referrerId: session.userId, status: 'converted' },
    });

    const totalCommissions = await db.referralCommission.aggregate({
      where: { referrerId: session.userId, status: { in: ['available', 'paid'] } },
      _sum: { commissionAmount: true },
    });

    const pendingCommissions = await db.referralCommission.aggregate({
      where: { referrerId: session.userId, status: 'held' },
      _sum: { commissionAmount: true },
    });

    const tier = await db.user.findUnique({
      where: { id: session.userId },
      select: { loyaltyTier: true },
    });

    const referralTier = await db.referralTier.findFirst({
      where: { active: true, minConversions: { lte: totalConversions } },
      orderBy: { minConversions: 'desc' },
      select: { name: true, minConversions: true, bonusValue: true, badgeHex: true },
    });

    return apiOk({
      data: {
        referrals,
        stats: {
          totalReferrals: referrals.length,
          totalConversions,
          totalEarned: totalCommissions._sum.commissionAmount || 0,
          pendingEarnings: pendingCommissions._sum.commissionAmount || 0,
          referralCode: session.referralCode,
          currentTier: referralTier?.name || 'Bronze',
          nextTier: referralTier
            ? await db.referralTier.findFirst({
                where: { active: true, minConversions: { gt: referralTier.minConversions } },
                orderBy: { minConversions: 'asc' },
                select: { name: true, minConversions: true },
              })
            : null,
        },
      },
    });
  } catch (error) {
    console.error('Referral dashboard error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to load referral dashboard', 500);
  }
}