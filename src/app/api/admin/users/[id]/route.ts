import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { apiOk, apiError, parseQuery } from '@/lib/api';

export const dynamic = 'force-dynamic';

const UserUpdateSchema = z.object({
  status: z.enum(['active', 'flagged', 'banned']).optional(),
  banReason: z.string().optional().nullable(),
  flagNote: z.string().optional().nullable(),
  loyaltyTier: z.enum(['bronze', 'silver', 'gold']).optional(),
  loyaltyPoints: z.number().int().min(0).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(['customers.read']);
    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id },
      include: {
        addresses: true,
        wallet: true,
        bankAccounts: { include: { verifications: { orderBy: { createdAt: 'desc' } } } },
        orders: { orderBy: { placedAt: 'desc' }, take: 10, include: { items: true } },
        referralsMade: { include: { referredUser: { select: { id: true, name: true, email: true, createdAt: true } } } },
        withdrawals: { orderBy: { requestedAt: 'desc' } },
        _count: { select: { orders: true, addresses: true, referralsMade: true, withdrawals: true } },
      },
    });

    if (!user) return apiError('NOT_FOUND', 'User not found', 404);

    return apiOk({ data: user });
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    console.error('Admin user get error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to load user', 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(['customers.write']);
    const { id } = await params;
    const body = await request.json();
    const parsed = UserUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
    }

    const user = await db.user.update({ where: { id }, data: parsed.data });
    if (!user) return apiError('NOT_FOUND', 'User not found', 404);

    await db.auditLog.create({
      data: {
        actorType: 'staff',
        action: 'user.update',
        entity: 'User',
        entityId: id,
        summary: `Updated user: ${Object.keys(parsed.data).join(', ')}`,
      },
    });

    return apiOk({ data: user });
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    console.error('Admin user update error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to update user', 500);
  }
}