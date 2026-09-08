import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { ProductCard } from '@/components/products/ProductCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency } from '@/lib/utils';
import { Search, TrendingUp, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PER_PAGE = 24;

// Fashion intent keywords for search understanding
const FASHION_INTENTS = {
  colours: ['black', 'white', 'navy', 'beige', 'brown', 'green', 'red', 'blue', 'pink', 'grey', 'ivory', 'cream', 'camel', 'charcoal', 'olive', 'terracotta', 'rust', 'cobalt', 'emerald', 'blush', 'sage', 'mauve', 'lavender'],
  fabrics: ['linen', 'silk', 'cotton', 'wool', 'merino', 'cashmere', 'denim', 'chiffon', 'velvet', 'tweed', 'jersey', 'crepe', 'satin', 'organza', 'tencel', 'modal', 'rayon', 'polyester'],
  occasions: ['office', 'work', 'wedding', 'party', 'casual', 'formal', 'festive', 'travel', 'vacation', 'weekend', 'dinner', 'date', 'brunch', 'resort', 'evening', 'cocktail'],
  silhouettes: ['oversized', 'slim', 'relaxed', 'tailored', 'fitted', 'boxy', 'wide-leg', 'straight', 'skinny', 'flare', 'a-line', 'column', 'peplum', 'cigarette'],
  fits: ['relaxed', 'slim', 'regular', 'oversized', 'fitted', 'loose', 'tailored', 'skinny', 'comfort'],
  styles: ['minimal', 'bold', 'classic', 'bohemian', 'streetwear', 'avant-garde', 'quiet luxury', 'normcore', 'preppy', 'athleisure'],
};

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; sort?: string; minPrice?: string; maxPrice?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `Search: ${q}` : 'Search',
    description: q ? `Results for "${q}" at LUMEN&CO.` : 'Search the LUMEN&CO catalogue.',
    robots: { index: false, follow: true },
  };
}

function normalise(s: string) {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tolerance(token: string) {
  if (token.length <= 3) return 0;
  if (token.length <= 6) return 1;
  return 2;
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

/** Extract fashion intent from search query */
function extractFashionIntent(query: string) {
  const lower = query.toLowerCase();
  const tokens = normalise(query).split(' ').filter(Boolean);

  const intents: { category: string; value: string; confidence: number }[] = [];

  // Extract colours
  for (const colour of FASHION_INTENTS.colours) {
    if (lower.includes(colour)) {
      intents.push({ category: 'colour', value: colour, confidence: 0.9 });
    }
  }

  // Extract fabrics
  for (const fabric of FASHION_INTENTS.fabrics) {
    if (lower.includes(fabric)) {
      intents.push({ category: 'fabric', value: fabric, confidence: 0.85 });
    }
  }

  // Extract occasions
  for (const occasion of FASHION_INTENTS.occasions) {
    if (lower.includes(occasion)) {
      intents.push({ category: 'occasion', value: occasion, confidence: 0.8 });
    }
  }

  // Extract silhouettes
  for (const silhouette of FASHION_INTENTS.silhouettes) {
    if (lower.includes(silhouette)) {
      intents.push({ category: 'silhouette', value: silhouette, confidence: 0.75 });
    }
  }

  // Extract fits
  for (const fit of FASHION_INTENTS.fits) {
    if (lower.includes(fit)) {
      intents.push({ category: 'fit', value: fit, confidence: 0.7 });
    }
  }

  // Extract styles
  for (const style of FASHION_INTENTS.styles) {
    if (lower.includes(style)) {
      intents.push({ category: 'style', value: style, confidence: 0.7 });
    }
  }

  // Detect price intent: "under ₹5000", "below 3000", etc.
  const priceMatch = lower.match(/(?:under|below|less than|max|budget)\s*(?:₹|rs\.?|inr)?\s*(\d+)/);
  if (priceMatch) {
    intents.push({ category: 'price', value: priceMatch[1], confidence: 0.85 });
  }

  return intents;
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
  fabric: true,
  fit: true,
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

const POPULAR_SEARCHES = [
  'minimal black dress',
  'linen outfit',
  'oversized shirt',
  'quiet luxury',
  'office wear',
  'wedding guest',
  'summer casual',
  'silk blouse',
];

const RELATED_CATEGORIES = [
  { name: 'New Arrivals', href: '/products?sort=newest' },
  { name: 'Bestsellers', href: '/products?sort=popular' },
  { name: 'Occasion Wear', href: '/occasions' },
  { name: 'Style Quiz', href: '/style-quiz' },
];

export default async function SearchPage({ searchParams }: PageProps) {
  const { q: rawQ, page: pageParam, sort: sortParam, minPrice, maxPrice } = await searchParams;
  const q = (rawQ ?? '').trim().slice(0, 120);
  const page = Math.max(1, Number(pageParam) || 1);
  const sort = sortParam || 'relevance';

  if (!q) {
    return (
      <div className="u-container py-16 md:py-24">
        <h1 className="u-display text-4xl md:text-5xl mb-4">Search</h1>
        <p className="text-muted text-lg mb-8">
          Look for a piece by name, fabric, colour or occasion.
        </p>

        {/* Popular searches */}
        <div className="mb-12">
          <h2 className="u-label mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent" aria-hidden="true" />
            Popular Searches
          </h2>
          <div className="flex flex-wrap gap-2">
            {POPULAR_SEARCHES.map((term) => (
              <Link
                key={term}
                href={`/search?q=${encodeURIComponent(term)}`}
                className="px-4 py-2 text-sm border border-line rounded-full hover:border-accent hover:text-accent transition-colors u-focus"
              >
                {term}
              </Link>
            ))}
          </div>
        </div>

        {/* Related categories */}
        <div>
          <h2 className="u-label mb-4">Browse Instead</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {RELATED_CATEGORIES.map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className="group p-4 border border-line rounded-lg hover:border-accent transition-all u-focus"
              >
                <span className="font-medium text-sm group-hover:text-accent transition-colors">{cat.name}</span>
                <ArrowRight className="w-4 h-4 mt-2 text-muted group-hover:text-accent transition-colors" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const term = normalise(q);
  const tokens = term.split(' ').filter(Boolean);
  const intents = extractFashionIntent(q);

  // Build smart where clause using extracted intents
  const where: Record<string, any> = {
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

  // Apply fashion intent filters
  const colourIntents = intents.filter((i) => i.category === 'colour');
  const fabricIntents = intents.filter((i) => i.category === 'fabric');
  const occasionIntents = intents.filter((i) => i.category === 'occasion');
  const priceIntents = intents.filter((i) => i.category === 'price');

  // If we have strong intent signals, add AND filters
  if (colourIntents.length > 0) {
    where.AND = where.AND || [];
    where.AND.push({
      variants: {
        some: {
          OR: colourIntents.map((i) => ({
            color: { contains: i.value, mode: 'insensitive' as const },
          })),
        },
      },
    });
  }

  if (fabricIntents.length > 0) {
    where.AND = where.AND || [];
    where.AND.push({
      OR: fabricIntents.map((i) => ({
        fabric: { contains: i.value, mode: 'insensitive' as const },
      })),
    });
  }

  if (occasionIntents.length > 0) {
    where.AND = where.AND || [];
    where.AND.push({
      OR: occasionIntents.map((i) => ({
        occasion: { contains: i.value, mode: 'insensitive' as const },
      })),
    });
  }

  // Price range filter (from explicit params or intent)
  const minP = parseInt(minPrice || '0', 10);
  const maxP = parseInt(maxPrice || '0', 10);
  const priceIntent = priceIntents[0];
  if (priceIntent && !maxP) {
    where.basePrice = { ...(where.basePrice || {}), lte: parseInt(priceIntent.value) * 100 };
  }
  if (minP > 0) where.basePrice = { ...(where.basePrice || {}), gte: minP * 100 };
  if (maxP > 0) where.basePrice = { ...(where.basePrice || {}), lte: maxP * 100 };

  const orderBy = sort === 'price_asc'
    ? { basePrice: 'asc' as const }
    : sort === 'price_desc'
      ? { basePrice: 'desc' as const }
      : sort === 'popular'
        ? { soldCount: 'desc' as const }
        : sort === 'newest'
          ? { createdAt: 'desc' as const }
          : [{ featured: 'desc' as const }, { soldCount: 'desc' as const }, { createdAt: 'desc' as const }];

  let rows: any[] = [];
  let total = 0;
  let didYouMean = false;
  let relatedCategories: { name: string; slug: string; count: number }[] = [];

  try {
    [rows, total] = await Promise.all([
      db.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * PER_PAGE,
        take: PER_PAGE,
        select: CARD_SELECT,
      }),
      db.product.count({ where }),
    ]);

    // Get related categories for zero-result recovery
    if (total === 0) {
      const cats = await db.category.findMany({
        where: { products: { some: { status: 'active' } } },
        select: {
          name: true,
          slug: true,
          _count: { select: { products: true } },
        },
        orderBy: { name: 'asc' },
      });
      relatedCategories = cats.map((c) => ({
        name: c.name,
        slug: c.slug,
        count: c._count.products,
      }));
    }

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
  } catch {
    rows = [];
    total = 0;
  }

  const products = rows.map((p: any) => ({
    ...p,
    hasStock: p.variants.some((v: any) => v.stock - v.reserved > 0),
    colors: [...new Set(p.variants.map((v: any) => v.color))],
    sizes: [...new Set(p.variants.map((v: any) => v.size))],
  }));

  const totalPages = didYouMean ? 1 : Math.max(1, Math.ceil(total / PER_PAGE));
  const href = (p: number) => {
    const params = new URLSearchParams();
    params.set('q', q);
    if (p > 1) params.set('page', String(p));
    if (sort !== 'relevance') params.set('sort', sort);
    if (minP > 0) params.set('minPrice', String(minP));
    if (maxP > 0) params.set('maxPrice', String(maxP));
    return `/search?${params.toString()}`;
  };

  const SORT_OPTIONS = [
    { value: 'relevance', label: 'Relevance' },
    { value: 'newest', label: 'Newest' },
    { value: 'price_asc', label: 'Price: Low to High' },
    { value: 'price_desc', label: 'Price: High to Low' },
    { value: 'popular', label: 'Most Popular' },
  ];

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
        Results for <span className="text-accent">&ldquo;{q}&rdquo;</span>
      </h1>

      {/* Fashion intent pills */}
      {intents.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4" role="list" aria-label="Detected search intent">
          {intents.map((intent, i) => (
            <span
              key={`${intent.category}-${intent.value}-${i}`}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-accent/10 text-accent rounded-full border border-accent/20"
            >
              {intent.category}: {intent.value}
            </span>
          ))}
        </div>
      )}

      <p className="text-muted mb-2">
        {total} {total === 1 ? 'piece' : 'pieces'} found
      </p>
      {didYouMean ? (
        <p className="text-sm text-muted-2 mb-6">
          No exact match — showing the closest pieces we could find.
        </p>
      ) : null}

      {/* Sort + Price Filter Bar */}
      <form className="flex flex-wrap items-center gap-3 mb-8" action="/search" method="get">
        <input type="hidden" name="q" value={q} />
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted">Sort:</label>
          <select name="sort" defaultValue={sort} className="text-xs bg-paper-2 border border-line rounded-md px-2 py-1.5 text-ink">
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="h-4 w-px bg-line hidden sm:block" />
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted">Price:</label>
          <input type="number" name="minPrice" placeholder="Min" defaultValue={minP || ''} className="w-20 text-xs bg-paper-2 border border-line rounded-md px-2 py-1.5 text-ink" />
          <span className="text-muted">&ndash;</span>
          <input type="number" name="maxPrice" placeholder="Max" defaultValue={maxP || ''} className="w-20 text-xs bg-paper-2 border border-line rounded-md px-2 py-1.5 text-ink" />
        </div>
        <button type="submit" className="text-xs bg-ink text-paper px-3 py-1.5 rounded-md hover:bg-ink/80 transition-colors">
          Apply
        </button>
      </form>

      {products.length === 0 ? (
        <div className="py-12">
          <EmptyState
            icon={<Search className="w-8 h-8" aria-hidden="true" />}
            title={`No pieces match "${q}"`}
            description="Try a different search, or explore our curated collections below."
            action={
              <Link href="/products" className="u-label underline underline-offset-4 u-focus">
                Shop all products
              </Link>
            }
          />

          {/* Intelligent zero-result recovery */}
          <div className="mt-12 space-y-8">
            {relatedCategories.length > 0 && (
              <div>
                <h2 className="u-label mb-4">Browse Categories</h2>
                <div className="flex flex-wrap gap-2">
                  {relatedCategories.slice(0, 6).map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/products?category=${cat.slug}`}
                      className="px-4 py-2 text-sm border border-line rounded-full hover:border-accent hover:text-accent transition-colors u-focus"
                    >
                      {cat.name} ({cat.count})
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="u-label mb-4">Popular Searches</h2>
              <div className="flex flex-wrap gap-2">
                {POPULAR_SEARCHES.map((term) => (
                  <Link
                    key={term}
                    href={`/search?q=${encodeURIComponent(term)}`}
                    className="px-4 py-2 text-sm border border-line rounded-full hover:border-accent hover:text-accent transition-colors u-focus"
                  >
                    {term}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h2 className="u-label mb-4">Quick Links</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {RELATED_CATEGORIES.map((cat) => (
                  <Link
                    key={cat.href}
                    href={cat.href}
                    className="group p-4 border border-line rounded-lg hover:border-accent transition-all u-focus"
                  >
                    <span className="font-medium text-sm group-hover:text-accent transition-colors">{cat.name}</span>
                    <ArrowRight className="w-4 h-4 mt-2 text-muted group-hover:text-accent transition-colors" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
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
