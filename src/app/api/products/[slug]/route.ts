import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiOk, apiError, parseQuery } from '@/lib/api';
import { z } from 'zod';

const QuerySchema = z.object({
  includeReviews: z.coerce.boolean().default(false),
  includeQuestions: z.coerce.boolean().default(false),
  includeRelated: z.coerce.boolean().default(false),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const { includeReviews, includeQuestions, includeRelated } = QuerySchema.parse(Object.fromEntries(searchParams));

    const product = await db.product.findUnique({
      where: { slug, status: 'active' },
      select: {
        id: true,
        slug: true,
        name: true,
        subtitle: true,
        description: true,
        story: true,
        careJson: true,
        basePrice: true,
        compareAtPrice: true,
        fabric: true,
        occasion: true,
        fit: true,
        gender: true,
        hsnCode: true,
        gstRate: true,
        featured: true,
        spin360: true,
        arReady: true,
        ratingAvg: true,
        ratingCount: true,
        soldCount: true,
        viewCount: true,
        seoTitle: true,
        seoDescription: true,
        category: { select: { id: true, slug: true, name: true } },
        images: {
          orderBy: { sortOrder: 'asc' },
          select: { id: true, url: true, alt: true, kind: true, colorKey: true, sortOrder: true },
        },
        variants: {
          where: { active: true },
          orderBy: [{ color: 'asc' }, { size: 'asc' }],
          select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            colorHex: true,
            priceDelta: true,
            stock: true,
            reserved: true,
            lowStockThreshold: true,
            weightGrams: true,
            barcode: true,
          },
        },
        collections: {
          select: {
            collection: {
              select: { id: true, slug: true, name: true, tagline: true, heroImage: true, accentHex: true },
            },
          },
        },
        tags: {
          select: { tag: { select: { id: true, slug: true, name: true, kind: true } } },
        },
      },
    });

    if (!product) {
      return apiError('NOT_FOUND', 'Product not found', 404);
    }

    // Increment view count (async, don't wait)
    db.product.update({
      where: { id: product.id },
      data: { viewCount: { increment: 1 } },
    }).catch(() => {});

    // Group variants by color for color swatches
    const colors = product.variants.reduce((acc, v) => {
      if (!acc[v.color]) {
        acc[v.color] = { color: v.color, colorHex: v.colorHex, sizes: [] };
      }
      acc[v.color].sizes.push({
        id: v.id,
        sku: v.sku,
        size: v.size,
        price: product.basePrice + v.priceDelta,
        stock: v.stock - v.reserved,
        lowStock: v.stock - v.reserved <= v.lowStockThreshold,
      });
      return acc;
    }, {} as Record<string, { color: string; colorHex: string; sizes: any[] }>);

    const result: any = {
      ...product,
      care: product.careJson ? JSON.parse(product.careJson) : [],
      colors: Object.values(colors),
      sizeGuide: null,
    };

    // Reviews
    if (includeReviews) {
      const reviews = await db.review.findMany({
        where: { productId: product.id, status: 'approved' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          rating: true,
          title: true,
          body: true,
          fitFeedback: true,
          sizePurchased: true,
          verifiedPurchase: true,
          helpfulCount: true,
          createdAt: true,
          user: { select: { id: true, name: true, photoUrl: true } },
          media: { select: { url: true, kind: true, thumbUrl: true } },
        },
      });
      result.reviews = reviews;
    }

    // Questions
    if (includeQuestions) {
      const questions = await db.question.findMany({
        where: { productId: product.id, status: 'approved' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          body: true,
          authorName: true,
          upvotes: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
          answers: {
            where: { status: 'approved' },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              body: true,
              createdAt: true,
              user: { select: { id: true, name: true, photoUrl: true } },
              staff: { select: { id: true, name: true, photoUrl: true } },
            },
          },
        },
      });
      result.questions = questions;
    }

    // Related products
    if (includeRelated) {
      const related = await db.product.findMany({
        where: {
          status: 'active',
          id: { not: product.id },
          OR: [
            { categoryId: product.category?.id },
            { collections: { some: { collectionId: { in: product.collections.map((c) => c.collection.id) } } } },
            { tags: { some: { tagId: { in: product.tags.map((t) => t.tag.id) } } } },
          ],
        },
        orderBy: { soldCount: 'desc' },
        take: 8,
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
        },
      });
      result.related = related;
    }

    return apiOk({ data: result });
  } catch (error) {
    console.error('Product detail error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to load product', 500);
  }
}