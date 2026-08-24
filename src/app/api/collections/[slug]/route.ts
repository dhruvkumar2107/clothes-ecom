import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { apiOk, apiError, parseQuery } from '@/lib/api';

const CollectionProductsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'popular', 'manual']).default('manual'),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { page = 1, limit = 24, sort } = parseQuery(request, CollectionProductsSchema);

    const collection = await db.collection.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        description: true,
        heroImage: true,
        accentHex: true,
        kind: true,
        featured: true,
      },
    });

    if (!collection) {
      return apiError('NOT_FOUND', 'Collection not found', 404);
    }

    let orderBy: any = { sortOrder: 'asc' };
    if (sort !== 'manual') {
      switch (sort) {
        case 'newest': orderBy = { createdAt: 'desc' }; break;
        case 'price_asc': orderBy = { basePrice: 'asc' }; break;
        case 'price_desc': orderBy = { basePrice: 'desc' }; break;
        case 'popular': orderBy = { soldCount: 'desc' }; break;
      }
    }

    const [products, total] = await Promise.all([
      db.product.findMany({
        where: {
          status: 'active',
          collections: { some: { collectionId: collection.id } },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          slug: true,
          name: true,
          subtitle: true,
          basePrice: true,
          compareAtPrice: true,
          images: {
            where: { kind: 'gallery' },
            orderBy: { sortOrder: 'asc' },
            take: 1,
            select: { url: true, alt: true },
          },
          ratingAvg: true,
          ratingCount: true,
          variants: {
            where: { active: true },
            select: { size: true, color: true, colorHex: true, stock: true, reserved: true, active: true },
          },
        },
      }),
      db.product.count({
        where: { status: 'active', collections: { some: { collectionId: collection.id } } },
      }),
    ]);

    const withMeta = products.map((p) => {
      const activeVariants = p.variants.filter((v) => v.active);
      const prices = activeVariants.map((v) => p.basePrice);
      return {
        ...p,
        priceRange: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : { min: p.basePrice, max: p.basePrice },
        hasStock: p.variants.some((v) => v.stock - v.reserved > 0),
        colors: [...new Set(p.variants.map((v) => v.color))],
        sizes: [...new Set(p.variants.map((v) => v.size))],
      };
    });

    return apiOk({
      data: { collection, products: withMeta },
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Collection products error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to load collection', 500);
  }
}