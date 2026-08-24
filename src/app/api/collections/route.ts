import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiOk, apiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const featured = searchParams.get('featured') === 'true';
    const active = searchParams.get('active') !== 'false';

    const where: any = {};
    if (active) {
      where.active = true;
      where.OR = [
        { startsAt: null },
        { startsAt: { lte: new Date() } },
      ];
      where.AND = [
        { OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
      ];
    }
    if (featured) where.featured = true;

    const collections = await db.collection.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        slug: true,
        name: true,
        kind: true,
        tagline: true,
        description: true,
        heroImage: true,
        accentHex: true,
        startsAt: true,
        endsAt: true,
        featured: true,
        _count: { select: { products: true } },
      },
    });

    return apiOk({ data: collections });
  } catch (error) {
    console.error('Collections list error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to load collections', 500);
  }
}