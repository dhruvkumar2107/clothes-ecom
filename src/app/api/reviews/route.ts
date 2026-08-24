import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCustomer } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { apiOk, apiError, parseQuery } from '@/lib/api';

export const dynamic = 'force-dynamic';

const ReviewCreateSchema = z.object({
  productId: z.string().cuid(),
  orderId: z.string().cuid().optional(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(100).optional().nullable(),
  body: z.string().min(10).max(5000),
  fitFeedback: z.enum(['small', 'true_to_size', 'large']).optional().nullable(),
  sizePurchased: z.string().optional().nullable(),
  media: z.array(z.object({ url: z.string().url(), kind: z.enum(['image', 'video']).default('image') })).default([]),
});

const ReviewListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  productId: z.string().cuid().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  verifiedOnly: z.coerce.boolean().default(false),
  sort: z.enum(['newest', 'oldest', 'rating_desc', 'rating_asc', 'helpful_desc']).default('newest'),
});

export async function GET(request: NextRequest) {
  try {
    const params = parseQuery(request, ReviewListSchema);

    const where: any = {};
    if (params.productId) where.productId = params.productId;
    if (params.status) where.status = params.status;
    else where.status = 'approved';
    if (params.rating) where.rating = params.rating;
    if (params.verifiedOnly) where.verifiedPurchase = true;

    let orderBy: any = { createdAt: 'desc' };
    switch (params.sort) {
      case 'oldest': orderBy = { createdAt: 'asc' }; break;
      case 'rating_desc': orderBy = { rating: 'desc' }; break;
      case 'rating_asc': orderBy = { rating: 'asc' }; break;
      case 'helpful_desc': orderBy = { helpfulCount: 'desc' }; break;
    }

    const page = params.page ?? 1;
    const limit = params.limit ?? 10;

    const [reviews, total] = await Promise.all([
      db.review.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { id: true, name: true, photoUrl: true } },
          product: { select: { id: true, name: true, slug: true } },
          media: true,
        },
      }),
      db.review.count({ where }),
    ]);

    return apiOk({ data: reviews, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    console.error('Reviews list error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to load reviews', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireCustomer();
    const body = await request.json();
    const parsed = ReviewCreateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
    }

    const { productId, orderId, ...data } = parsed.data;

    let verifiedPurchase = false;
    if (orderId) {
      const orderItem = await db.orderItem.findFirst({
        where: { orderId, productId },
        select: { id: true },
      });
      verifiedPurchase = !!orderItem;
    }

    const review = await db.review.create({
      data: {
        ...data,
        productId,
        userId: session.userId,
        orderId,
        verifiedPurchase,
        status: 'pending',
        media: { create: data.media },
      },
      include: { media: true, user: { select: { name: true } } },
    });

    const user = await db.user.findUnique({ where: { id: session.userId }, select: { loyaltyPoints: true } });
    const balanceAfter = (user?.loyaltyPoints || 0) + 100;

    await db.loyaltyTransaction.create({
      data: {
        userId: session.userId,
        points: 100,
        direction: 'credit',
        reason: 'review',
        refType: 'Review',
        refId: review.id,
        balanceAfter,
      },
    });

    return apiOk({ data: review }, { status: 201 });
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    console.error('Review create error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to create review', 500);
  }
}