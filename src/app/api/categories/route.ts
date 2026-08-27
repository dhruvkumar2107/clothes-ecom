import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiOk, apiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const categories = await db.category.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        heroImage: true,
        _count: { select: { products: true } },
      },
    });

    return apiOk({ data: categories });
  } catch (error) {
    console.error('Categories list error:', error);
    return apiError('INTERNAL_ERROR', 'Failed to load categories', 500);
  }
}
