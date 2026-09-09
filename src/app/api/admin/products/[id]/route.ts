import { NextRequest } from 'next/server';
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
  costPrice: z.coerce.number().min(0).optional().nullable(),
  fabric: z.string().optional(),
  occasion: z.string().optional(),
  fit: z.string().optional(),
  gender: z.string().optional(),
  status: z.enum(['active', 'draft', 'archived']).optional(),
  featured: z.boolean().optional(),
  categoryId: z.string().cuid().optional(),
  collectionIds: z.array(z.string()).optional(),
  variants: z.array(z.object({
    size: z.string().optional(),
    color: z.string().optional(),
    colorHex: z.string().optional(),
    stock: z.coerce.number().min(0).optional(),
  })).optional(),
  images: z.array(z.object({
    url: z.string(),
    alt: z.string().optional(),
    kind: z.string().optional(),
    colorKey: z.string().nullable().optional(),
    sortOrder: z.number().optional(),
  })).optional(),
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

    const { collectionIds, variants, images, ...updateData } = parsed.data;

    const product = await db.$transaction(async (tx) => {
      // Update product fields
      const updated = await tx.product.update({
        where: { id },
        data: updateData,
      });

      // Update collections if provided
      if (collectionIds !== undefined) {
        await tx.productCollection.deleteMany({ where: { productId: id } });
        if (collectionIds.length > 0) {
          await tx.productCollection.createMany({
            data: collectionIds.map(collectionId => ({ productId: id, collectionId })),
          });
        }
      }

      // Update variants if provided
      if (variants !== undefined) {
        await tx.productVariant.deleteMany({ where: { productId: id } });
        if (variants.length > 0) {
          await tx.productVariant.createMany({
            data: variants.map((v, i) => ({
              productId: id,
              sku: `${updated.slug.toUpperCase()}-${(v.size || 'M').toUpperCase()}-${(v.color || 'DEF').toUpperCase().slice(0, 3)}`,
              size: v.size || 'M',
              color: v.color || 'Default',
              colorHex: v.colorHex || '#111111',
              priceDelta: 0,
              stock: v.stock || 10,
              weightGrams: 300,
              sortOrder: i,
            })),
          });
        }
      }

      // Update images if provided
      if (images !== undefined) {
        await tx.productImage.deleteMany({ where: { productId: id } });
        if (images.length > 0) {
          await tx.productImage.createMany({
            data: images.map((img, i) => ({
              productId: id,
              url: img.url,
              alt: img.alt || updated.name,
              kind: img.kind || 'gallery',
              colorKey: img.colorKey || null,
              sortOrder: img.sortOrder ?? i,
            })),
          });
        }
      }

      return updated;
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

    await db.product.delete({ where: { id } });

    return apiOk({ deleted: true });
  } catch (error: any) {
    if (error?.code) {
      return apiError(error.code, error.message, error.status || 500);
    }
    console.error('Error deleting product:', error);
    return apiError('INTERNAL_ERROR', 'Failed to delete product.', 500);
  }
}
