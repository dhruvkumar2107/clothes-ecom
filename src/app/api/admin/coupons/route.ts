import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { apiOk, apiError, parseQuery } from '@/lib/api';

const CouponCreateSchema = z.object({
  code: z.string().min(3).max(20).regex(/^[A-Z0-9]+$/),
  name: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  kind: z.enum(['percent', 'flat', 'free_shipping']),
  value: z.number().int().min(0),
  maxDiscount: z.number().int().min(0).optional().nullable(),
  minCartValue: z.number().int().min(0).default(0),
  firstOrderOnly: z.boolean().default(false),
  autoApply: z.boolean().default(false),
  stackable: z.boolean().default(false),
  perUserLimit: z.number().int().min(1).optional().nullable(),
  totalLimit: z.number().int().min(1).optional().nullable(),
  appliesTo: z.enum(['all', 'category', 'collection', 'product']).default('all'),
  targetIdsCsv: z.string().optional().nullable(),
  isReferralWelcome: z.boolean().default(false),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  active: z.boolean().default(true),
});

const CouponUpdateSchema = CouponCreateSchema.partial().extend({ id: z.string().cuid() });

const CouponListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  active: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(['settings.read']);
    const params = parseQuery(request, CouponListSchema);

    const where: any = {};
    if (params.active !== undefined) where.active = params.active;
    if (params.search) where.OR = [{ code: { contains: params.search, mode: 'insensitive' } }, { name: { contains: params.search, mode: 'insensitive' } }];

    const page = params.page ?? 1;
    const limit = params.limit ?? 20;

    const [coupons, total] = await Promise.all([
      db.coupon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { redemptions: true } } },
      }),
      db.coupon.count({ where }),
    ]);

    return apiOk({ data: coupons, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    console.error('Admin coupons list error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to load coupons', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(['settings.write']);
    const body = await request.json();
    const parsed = CouponCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
    }

    const codeExists = await db.coupon.findUnique({ where: { code: parsed.data.code }, select: { id: true } });
    if (codeExists) return apiError('CONFLICT', 'Coupon code already exists', 409);

    const coupon = await db.coupon.create({ data: parsed.data });
    return apiOk({ data: coupon }, { status: 201 });
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    console.error('Admin coupon create error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to create coupon', 500);
  }
}