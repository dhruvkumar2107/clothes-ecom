import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { apiOk, apiError, parseQuery } from '@/lib/api';

export const dynamic = 'force-dynamic';

const SearchSchema = z.object({
  q: z.string().trim().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(24).default(6),
});

/** Cheap normaliser — casefold, strip punctuation, collapse whitespace. */
function normalise(s: string) {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Bounded Levenshtein. Returns `max + 1` as soon as the distance provably
 * exceeds `max`, so a long non-match costs a couple of rows instead of a full
 * matrix.
 */
function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** One typo per 4 characters, so "shrt" finds "shirt" but "cat" never finds "hat". */
function tolerance(token: string) {
  if (token.length <= 3) return 0;
  if (token.length <= 6) return 1;
  return 2;
}

/**
 * Does `haystack` contain every query token, allowing a bounded number of typos
 * per token? Tokens are matched against words, and against word prefixes of the
 * same length, so "lin shi" still finds "Linen Oversized Shirt".
 */
function fuzzyMatches(haystack: string, tokens: string[]): boolean {
  const words = normalise(haystack).split(' ').filter(Boolean);
  return tokens.every((token) => {
    const max = tolerance(token);
    return words.some((word) => {
      if (word.startsWith(token)) return true;
      if (max === 0) return false;
      const prefix = word.slice(0, token.length + max);
      return editDistance(token, prefix, max) <= max || editDistance(token, word, max) <= max;
    });
  });
}

const PRODUCT_SELECT = {
  id: true,
  slug: true,
  name: true,
  subtitle: true,
  basePrice: true,
  compareAtPrice: true,
  fabric: true,
  gender: true,
  images: {
    where: { kind: 'gallery' },
    orderBy: { sortOrder: 'asc' as const },
    take: 1,
    select: { url: true, alt: true },
  },
} as const;

/**
 * Storefront search.
 *
 * Two passes. The first is an indexed `contains` query, which answers almost
 * every real search. Only when that comes back short does the second pass pull a
 * bounded slice of the catalogue and re-rank it with a token-level edit distance
 * — that is where the typo tolerance lives. Postgres trigram search would be
 * better, but it needs `pg_trgm` installed on the database, and this keeps the
 * feature working on a stock instance.
 */
export async function GET(request: NextRequest) {
  try {
    const { q, limit } = parseQuery(request, SearchSchema);
    const term = normalise(q);
    const tokens = term.split(' ').filter(Boolean);

    if (tokens.length === 0) {
      return apiOk({ products: [], collections: [], suggestions: [], fuzzy: false, total: 0 });
    }

    const [exactProducts, exactCollections, categories] = await Promise.all([
      db.product.findMany({
        where: {
          status: 'active',
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { subtitle: { contains: q, mode: 'insensitive' } },
            { slug: { contains: term.replace(/ /g, '-'), mode: 'insensitive' } },
            { fabric: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { tags: { some: { tag: { name: { contains: q, mode: 'insensitive' } } } } },
          ],
        },
        orderBy: [{ featured: 'desc' }, { soldCount: 'desc' }],
        take: limit,
        select: PRODUCT_SELECT,
      }),
      db.collection.findMany({
        where: {
          active: true,
          products: { some: { product: { status: 'active' } } },
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { tagline: { contains: q, mode: 'insensitive' } },
          ],
        },
        orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }],
        take: 4,
        select: { id: true, slug: true, name: true, heroImage: true },
      }),
      db.category.findMany({
        where: { active: true, name: { contains: q, mode: 'insensitive' } },
        take: 4,
        select: { slug: true, name: true },
      }),
    ]);

    let products = exactProducts;
    let fuzzy = false;

    if (products.length === 0) {
      // Nothing matched literally — most likely a typo. Re-rank a bounded slice
      // of the catalogue by how close each name is to the query.
      const candidates = await db.product.findMany({
        where: { status: 'active' },
        orderBy: [{ featured: 'desc' }, { soldCount: 'desc' }],
        take: 500,
        select: PRODUCT_SELECT,
      });

      products = candidates
        .filter((p) => fuzzyMatches(`${p.name} ${p.subtitle ?? ''} ${p.fabric ?? ''}`, tokens))
        .slice(0, limit);
      fuzzy = products.length > 0;
    }

    const suggestions = [
      ...exactCollections.map((c) => ({ label: c.name, href: `/collections/${c.slug}` })),
      ...categories.map((c) => ({ label: c.name, href: `/products?category=${c.slug}` })),
    ].slice(0, 5);

    return apiOk({
      products,
      collections: exactCollections,
      suggestions,
      fuzzy,
      total: products.length,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return apiError('VALIDATION_ERROR', 'Invalid search query', 400, { details: err.issues });
    }
    console.error('[search] failed:', err);
    return apiError('INTERNAL_ERROR', 'Search is unavailable right now', 500);
  }
}
