import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { db } from '@/lib/db';
import { apiOk, apiError } from '@/lib/api';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const UpdateProductSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  story: z.string().optional(),
  basePrice: z.coerce.number().min(0).optional(),
  compareAtPrice: z.coerce.number().min(0).optional().nullable(),
  fabric: z.string().optional(),
  occasion: z.string().optional(),
  fit: z.string().optional(),
  gender: z.string().optional(),
  status: z.enum(['active', 'draft', 'archived']).optional(),
  featured: z.boolean().optional(),
  categoryId: z.string().cuid().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(['products.write']);
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateProductSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Invalid input', 400, { details: parsed.error.flatten().fieldErrors });
    }

    const product = await db.product.update({
      where: { id },
      data: parsed.data,
    });

    return apiOk({ data: product });
  } catch (error: any) {
    if (error?.code) {
      return apiError(error.code, error.message, error.status || 500);
    }
    console.error('Error updating product:', error);
    return apiError('INTERNAL_ERROR', 'Failed to update product.', 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(['products.delete']);
    const { id } = await params;

    await db.product.delete({
      where: { id },
    });

    return apiOk({ deleted: true });
  } catch (error: any) {
    if (error?.code) {
      return apiError(error.code, error.message, error.status || 500);
    }
    console.error('Error deleting product:', error);
    return apiError('INTERNAL_ERROR', 'Failed to delete product.', 500);
  }
}
