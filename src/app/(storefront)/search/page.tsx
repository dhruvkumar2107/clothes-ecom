import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { ProductCard } from '@/components/products/ProductCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Search } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PER_PAGE = 24;

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `Search: ${q}` : 'Search',
    description: q ? `Results for “${q}” at LUMEN&CO.` : 'Search the LUMEN&CO catalogue.',
    // Result pages are thin and near-duplicate; keep them out of the index.
    robots: { index: false, follow: true },
  };
}

/** Mirrors the tolerance in /api/search: one typo per ~4 characters. */
function tolerance(token: string) {
  if (token.length <= 3) return 0;
  if (token.length <= 6) return 1;
  return 2;
}

function normalise(s: string) {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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

const CARD_SELECT = {
  id: true,
  slug: true,
  name: true,
  subtitle: true,
  basePrice: true,
  compareAtPrice: true,
  gender: true,
  occasion: true,
  ratingAvg: true,
  ratingCount: true,
  images: {
    where: { kind: 'gallery' },
    orderBy: { sortOrder: 'asc' as const },
    take: 1,
    select: { url: true, alt: true },
  },
  variants: {
    where: { active: true },
    select: { id: true, size: true, color: true, colorHex: true, stock: true, reserved: true },
  },
} as const;

export default async function SearchPage({ searchParams }: PageProps) {
  const { q: rawQ, page: pageParam } = await searchParams;
  const q = (rawQ ?? '').trim().slice(0, 120);
  const page = Math.max(1, Number(pageParam) || 1);

  if (!q) {
    return (
      <div className="u-container py-16 md:py-24">
        <h1 className="u-display text-4xl md:text-5xl mb-4">Search</h1>
        <p className="text-muted text-lg mb-12">
          Look for a piece by name, fabric, colour or occasion.
        </p>
        <EmptyState
          icon={<Search className="w-8 h-8" aria-hidden="true" />}
          title="Nothing searched yet"
          description="Use the search icon in the header, or browse the full catalogue."
          action={
            <Link href="/products" className="u-label underline underline-offset-4 u-focus">
              Shop all products
            </Link>
          }
        />
      </div>
    );
  }

  const term = normalise(q);
  const tokens = term.split(' ').filter(Boolean);

  const where = {
    status: 'active',
    OR: [
      { name: { contains: q, mode: 'insensitive' as const } },
      { subtitle: { contains: q, mode: 'insensitive' as const } },
      { slug: { contains: term.replace(/ /g, '-'), mode: 'insensitive' as const } },
      { fabric: { contains: q, mode: 'insensitive' as const } },
      { description: { contains: q, mode: 'insensitive' as const } },
      { tags: { some: { tag: { name: { contains: q, mode: 'insensitive' as const } } } } },
    ],
  };

  let [rows, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: [{ featured: 'desc' }, { soldCount: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: CARD_SELECT,
    }),
    db.product.count({ where }),
  ]);

  /**
   * No literal match usually means a typo, so fall back to the same bounded
   * edit-distance pass the autocomplete API uses. Paginating that in SQL isn't
   * possible, so the fallback is capped to one page — deep paging over guesses
   * has no value anyway.
   */
  let didYouMean = false;
  if (total === 0 && tokens.length > 0) {
    const candidates = await db.product.findMany({
      where: { status: 'active' },
      orderBy: [{ featured: 'desc' }, { soldCount: 'desc' }],
      take: 500,
      select: { ...CARD_SELECT, fabric: true },
    });
    const matched = candidates.filter((p) =>
      fuzzyMatches(`${p.name} ${p.subtitle ?? ''} ${p.fabric ?? ''}`, tokens),
    );
    rows = matched.slice(0, PER_PAGE);
    total = matched.length;
    didYouMean = matched.length > 0;
  }

  const products = rows.map((p) => ({
    ...p,
    hasStock: p.variants.some((v) => v.stock - v.reserved > 0),
    colors: [...new Set(p.variants.map((v) => v.color))],
    sizes: [...new Set(p.variants.map((v) => v.size))],
  }));

  const totalPages = didYouMean ? 1 : Math.max(1, Math.ceil(total / PER_PAGE));
  const href = (p: number) =>
    `/search?q=${encodeURIComponent(q)}${p > 1 ? `&page=${p}` : ''}`;

  return (
    <div className="u-container py-12 md:py-16">
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex items-center gap-2 u-label text-ink/40">
          <li>
            <Link href="/" className="hover:text-accent u-focus">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-ink">Search</li>
        </ol>
      </nav>

      <h1 className="u-display text-3xl md:text-5xl mb-3">
        Results for <span className="text-accent">“{q}”</span>
      </h1>
      <p className="text-muted mb-2">
        {total} {total === 1 ? 'piece' : 'pieces'} found
      </p>
      {didYouMean ? (
        <p className="text-sm text-muted-2 mb-10">
          No exact match — showing the closest pieces we could find.
        </p>
      ) : (
        <div className="mb-10" />
      )}

      {products.length === 0 ? (
        <EmptyState
          icon={<Search className="w-8 h-8" aria-hidden="true" />}
          title="No matches"
          description="Try a shorter search, a different spelling, or browse the full catalogue."
          action={
            <Link href="/products" className="u-label underline underline-offset-4 u-focus">
              Shop all products
            </Link>
          }
        />
      ) : (
        <>
          <ul className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-10 md:gap-x-6">
            {products.map((p) => (
              <li key={p.id}>
                <ProductCard
                  id={p.id}
                  slug={p.slug}
                  name={p.name}
                  subtitle={p.subtitle}
                  basePrice={p.basePrice}
                  compareAtPrice={p.compareAtPrice}
                  images={p.images}
                  gender={p.gender}
                  occasion={p.occasion ?? undefined}
                  ratingAvg={p.ratingAvg}
                  ratingCount={p.ratingCount}
                  variants={p.variants}
                  inStock={p.hasStock}
                  colors={p.colors}
                  sizes={p.sizes}
                />
              </li>
            ))}
          </ul>

          {totalPages > 1 ? (
            <nav className="flex items-center justify-center gap-2 mt-16" aria-label="Pagination">
              {page > 1 ? (
                <Link
                  href={href(page - 1)}
                  className="u-label px-4 py-2 rounded-md hover:bg-paper-3 u-focus"
                >
                  Previous
                </Link>
              ) : null}
              <span className="u-label text-ink/50 px-4">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  href={href(page + 1)}
                  className="u-label px-4 py-2 rounded-md hover:bg-paper-3 u-focus"
                >
                  Next
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
