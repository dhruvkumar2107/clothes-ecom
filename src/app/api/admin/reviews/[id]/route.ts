import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { apiOk, apiError, parseQuery } from '@/lib/api';

const ReviewUpdateSchema = z.object({
  status: z.enum(['approved', 'rejected']).optional(),
  adminReply: z.string().max(2000).optional().nullable(),
  rejectionReason: z.string().optional().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(['reviews.moderate']);
    const { id } = await params;
    const body = await request.json();
    const parsed = ReviewUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
    }

    const { status, adminReply, rejectionReason } = parsed.data;
    const updateData: any = {};

    if (status) updateData.status = status;
    if (adminReply !== undefined) {
      updateData.adminReply = adminReply;
      updateData.adminRepliedAt = new Date();
      updateData.adminRepliedBy = 'admin';
    }
    if (rejectionReason) updateData.rejectionReason = rejectionReason;

    const review = await db.review.update({ where: { id }, data: updateData, include: { user: true, product: true } });

    if (status === 'approved') {
      await db.product.update({
        where: { id: review.productId },
        data: {
          ratingAvg: { increment: 0 },
          ratingCount: { increment: 1 },
        },
      });
    }

    return apiOk({ data: review });
  } catch (error: any) {
    if (error?.code) return apiError(error.code, error.message, error.status || 500);
    console.error('Review moderate error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to moderate review', 500);
  }
}