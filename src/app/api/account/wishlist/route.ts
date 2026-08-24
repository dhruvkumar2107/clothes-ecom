import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCustomerSession, requireCustomer } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { apiOk, apiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await requireCustomer();

  try {
    const wishlist = await db.wishlistItem.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        variantId: true,
        createdAt: true,
        product: {
          select: {
            id: true,
            slug: true,
            name: true,
            basePrice: true,
            compareAtPrice: true,
            images: {
              where: { kind: 'gallery' },
              orderBy: { sortOrder: 'asc' },
              take: 1,
              select: { url: true, alt: true },
            },
            status: true,
            variants: {
              where: { active: true },
              select: { id: true, size: true, color: true, colorHex: true, priceDelta: true, stock: true, reserved: true },
            },
          },
        },
        variant: {
          select: {
            id: true,
            size: true,
            color: true,
            colorHex: true,
            priceDelta: true,
            stock: true,
            reserved: true,
          },
        },
      },
    });

    return apiOk({ data: wishlist });
  } catch (error) {
    console.error('Wishlist error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to load wishlist', 500);
  }
}

const AddToWishlistSchema = z.object({
  productId: z.string().cuid(),
  variantId: z.string().cuid().optional(),
});

export async function POST(request: NextRequest) {
  const session = await requireCustomer();

  try {
    const body = await request.json();
    const parsed = AddToWishlistSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
    }

    const product = await db.product.findUnique({
      where: { id: parsed.data.productId },
      select: { id: true, status: true },
    });
    if (!product || product.status !== 'active') {
      return apiError('NOT_FOUND', 'Product not available', 404);
    }

    let variantId = parsed.data.variantId;
    if (!variantId) {
      const firstVariant = await db.productVariant.findFirst({
        where: { productId: parsed.data.productId, active: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true },
      });
      if (!firstVariant) {
        return apiError('NOT_FOUND', 'No variants available', 404);
      }
      variantId = firstVariant.id;
    }

    const item = await db.wishlistItem.upsert({
      where: { userId_productId_variantId: { userId: session.userId, productId: parsed.data.productId, variantId } },
      update: {},
      create: { userId: session.userId, productId: parsed.data.productId, variantId },
      select: { id: true, productId: true, variantId: true, createdAt: true },
    });

    return apiOk({ data: item }, { status: 201 });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to add to wishlist', 500);
  }
}