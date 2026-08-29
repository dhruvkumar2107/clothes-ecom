import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { apiOk, apiError, parseQuery } from '@/lib/api';

export const dynamic = 'force-dynamic';

const ReferralListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['invited', 'signed_up', 'converted', 'rejected']).optional(),
  referrerId: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(['newest', 'oldest', 'conversions_desc']).default('newest'),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(['referrals.read']);
    const params = parseQuery(request, ReferralListSchema);

    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.referrerId) where.referrerId = params.referrerId;
    if (params.search) {
      where.OR = [
        { code: { contains: params.search, mode: 'insensitive' } },
        { referrer: { name: { contains: params.search, mode: 'insensitive' } } },
        { referredUser: { name: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    let orderBy: any = { createdAt: 'desc' };
    if (params.sort === 'oldest') orderBy = { createdAt: 'asc' };
    if (params.sort === 'conversions_desc') orderBy = { commissions: { _count: 'desc' } };

    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    const [referrals, total] = await Promise.all([
      db.referral.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          referrer: { select: { id: true, name: true, email: true, referralCode: true } },
          referredUser: { select: { id: true, name: true, email: true, createdAt: true } },
          commissions: { orderBy: { createdAt: 'desc' } },
          flags: { where: { resolved: false } },
          _count: { select: { commissions: true } },
        },
      }),
      db.referral.count({ where }),
    ]);

    return apiOk({ data: referrals, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    console.error('Admin referrals list error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to load referrals', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(['referrals.write']);
    const body = await request.json();
    const { action, ...data } = body;

    if (action === 'recalculate') {
      const { referralId } = data;
      const referral = await db.referral.findUnique({ where: { id: referralId }, include: { commissions: true } });
      if (!referral) return apiError('NOT_FOUND', 'Referral not found', 404);

      const totalCommission = referral.commissions.reduce((sum, c) => sum + (c.commissionAmount || 0), 0);
      const totalPaid = referral.commissions
        .filter((c) => c.status === 'paid' || c.status === 'released')
        .reduce((sum, c) => sum + (c.commissionAmount || 0), 0);
      const pendingCommission = totalCommission - totalPaid;

      return apiOk({ data: { recalculated: true, referralId, totalCommission, totalPaid, pendingCommission, commissionCount: referral.commissions.length } });
    }

    if (action === 'override_commission') {
      const { commissionId, commissionAmount, note } = data;
      const commission = await db.referralCommission.update({
        where: { id: commissionId },
        data: { commissionAmount, isManualOverride: true, overrideNote: note, overriddenBy: 'admin' },
      });
      return apiOk({ data: commission });
    }

    return apiError('INVALID_ACTION', 'Unknown action', 400);
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    console.error('Admin referral action error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to process referral action', 500);
  }
}