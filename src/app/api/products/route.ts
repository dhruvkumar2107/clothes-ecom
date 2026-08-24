import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { apiOk, apiError, parseQuery } from '@/lib/api';

export const dynamic = 'force-dynamic';

const ProductListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  category: z.string().optional(),
  collection: z.string().optional(),
  gender: z.enum(['men', 'women', 'unisex']).optional(),
  occasion: z.string().optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  inStock: z.coerce.boolean().optional(),
  featured: z.coerce.boolean().optional(),
  new: z.coerce.boolean().optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'popular', 'rating']).default('newest'),
  search: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const params = parseQuery(request, ProductListSchema);

    const where: any = { status: 'active' };

    if (params.category) where.category = { slug: params.category };
    if (params.collection) where.collections = { some: { collection: { slug: params.collection } } };
    if (params.gender) where.gender = params.gender;
    if (params.occasion) where.occasion = params.occasion;
    if (params.featured) where.featured = true;

    if (params.minPrice !== undefined || params.maxPrice !== undefined) {
      where.basePrice = {};
      if (params.minPrice !== undefined) where.basePrice.gte = params.minPrice;
      if (params.maxPrice !== undefined) where.basePrice.lte = params.maxPrice;
    }

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
        { slug: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    // Build orderBy
    let orderBy: any = { createdAt: 'desc' };
    switch (params.sort) {
      case 'price_asc': orderBy = { basePrice: 'asc' }; break;
      case 'price_desc': orderBy = { basePrice: 'desc' }; break;
      case 'popular': orderBy = { soldCount: 'desc' }; break;
      case 'rating': orderBy = { ratingAvg: 'desc' }; break;
    }

    const page = params.page ?? 1;
    const limit = params.limit ?? 24;

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
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
          category: { select: { slug: true, name: true } },
          gender: true,
          occasion: true,
          ratingAvg: true,
          ratingCount: true,
          variants: {
            where: { active: true },
            select: {
              id: true,
              size: true,
              color: true,
              colorHex: true,
              stock: true,
              reserved: true,
              active: true,
            },
          },
        },
      }),
      db.product.count({ where }),
    ]);

    // Filter by size/color/inStock in memory (since we need variant-level filtering)
    let filtered = products;
    if (params.size || params.color || params.inStock) {
      filtered = products.filter((p) => {
        const variants = p.variants.filter((v) => {
          if (params.size && v.size !== params.size) return false;
          if (params.color && v.color !== params.color) return false;
          if (params.inStock && (v.stock - v.reserved) <= 0) return false;
          return true;
        });
        return variants.length > 0;
      });
    }

    // Compute min/max price per product
    const withPrices = filtered.map((p) => {
      const activeVariants = p.variants.filter((v) => v.active);
      const prices = activeVariants.map((v) => p.basePrice);
      return {
        ...p,
        priceRange: prices.length
          ? { min: Math.min(...prices), max: Math.max(...prices) }
          : { min: p.basePrice, max: p.basePrice },
        inStock: p.variants.some((v) => v.stock - v.reserved > 0),
        colors: [...new Set(p.variants.map((v) => v.color))],
        sizes: [...new Set(p.variants.map((v) => v.size))],
      };
    });

    return apiOk({
      data: withPrices,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Products list error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to load products', 500);
  }
}