import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { apiOk, apiError, parseQuery } from '@/lib/api';

export const dynamic = 'force-dynamic';

const UserListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'flagged', 'banned']).optional(),
  loyaltyTier: z.enum(['bronze', 'silver', 'gold']).optional(),
  search: z.string().optional(),
  sort: z.enum(['newest', 'oldest', 'spend_desc', 'orders_desc']).default('newest'),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(['customers.read']);
    const params = parseQuery(request, UserListSchema);

    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.loyaltyTier) where.loyaltyTier = params.loyaltyTier;
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
        { phone: { contains: params.search, mode: 'insensitive' } },
        { referralCode: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    let orderBy: any = { createdAt: 'desc' };
    switch (params.sort) {
      case 'oldest': orderBy = { createdAt: 'asc' }; break;
      case 'spend_desc': orderBy = { lifetimeSpend: 'desc' }; break;
      case 'orders_desc': orderBy = { orderCount: 'desc' }; break;
    }

    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          phone: true,
          name: true,
          photoUrl: true,
          status: true,
          loyaltyTier: true,
          loyaltyPoints: true,
          lifetimeSpend: true,
          orderCount: true,
          referralCode: true,
          referredById: true,
          emailVerifiedAt: true,
          phoneVerifiedAt: true,
          createdAt: true,
          lastLoginAt: true,
          _count: { select: { orders: true, addresses: true, walletTxns: true } },
        },
      }),
      db.user.count({ where }),
    ]);

    return apiOk({ data: users, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    console.error('Admin users list error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to load users', 500);
  }
}