import { db } from './db';

export async function getCategories() {
  return db.category.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, slug: true, name: true },
  });
}

export async function getCollections() {
  return db.collection.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, slug: true, name: true, heroImage: true },
  });
}

interface ProductWithRelations {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  description: string;
  story: string | null;
  careJson: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  fabric: string | null;
  occasion: string | null;
  fit: string | null;
  gender: string;
  hsnCode: string;
  gstRate: number;
  featured: boolean;
  spin360: boolean;
  arReady: boolean;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  viewCount: number;
  seoTitle: string | null;
  seoDescription: string | null;
  category: { id: string; slug: string; name: string };
  images: { id: string; url: string; alt: string; kind: string; colorKey: string | null; sortOrder: number }[];
  variants: { id: string; sku: string; size: string; color: string; colorHex: string; priceDelta: number; stock: number; reserved: number; lowStockThreshold: number; weightGrams: number; barcode: string | null }[];
  collections: { collection: { id: string; slug: string; name: string; tagline: string | null; heroImage: string | null; accentHex: string | null } }[];
  tags: { tag: { slug: string; name: string; kind: string } }[];
  
}

export async function getProductBySlug(slug: string): Promise<ProductWithRelations | null> {
  return db.product.findUnique({
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
        select: { tag: { select: { slug: true, name: true, kind: true } } },
      },
    },
  });
}

/**
 * Collections for the /collections index — needs the display fields and a
 * product count that `getCollections()` intentionally omits, since that one
 * feeds filter dropdowns and is kept narrow.
 *
 * Scheduling is respected here so a collection with a future `startsAt` (or a
 * passed `endsAt`) stays off the index without an operator having to toggle it.
 */
export async function getCollectionsForIndex() {
  const now = new Date();
  return db.collection.findMany({
    where: {
      active: true,
      // An empty collection is a dead end for a shopper — keep it out of the
      // public index until the merchandiser has actually filled it.
      products: { some: { product: { status: 'active' } } },
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      kind: true,
      tagline: true,
      heroImage: true,
      accentHex: true,
      featured: true,
      _count: { select: { products: true } },
    },
  });
}

export async function getCollectionBySlug(slug: string) {
  return db.collection.findUnique({
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
}

export type CollectionSort = 'manual' | 'newest' | 'price_asc' | 'price_desc' | 'popular';

/**
 * Products in a collection.
 *
 * `manual` is the curator's own order, which lives on the ProductCollection join
 * row rather than on Product — so that one sort has to be read through the join
 * table. Every other sort is a plain Product order and takes the simpler path.
 */
export async function getCollectionProducts(
  slug: string,
  page = 1,
  limit = 24,
  sort: CollectionSort = 'manual',
): Promise<{ products: ProductCardData[]; total: number }> {
  const collection = await db.collection.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!collection) return { products: [], total: 0 };

  const skip = (page - 1) * limit;
  const productWhere = {
    status: 'active',
    collections: { some: { collectionId: collection.id } },
  } as const;

  if (sort === 'manual') {
    const [rows, total] = await Promise.all([
      db.productCollection.findMany({
        where: { collectionId: collection.id, product: { status: 'active' } },
        orderBy: [{ sortOrder: 'asc' }, { product: { createdAt: 'desc' } }],
        skip,
        take: limit,
        select: { product: { select: CARD_SELECT } },
      }),
      db.productCollection.count({
        where: { collectionId: collection.id, product: { status: 'active' } },
      }),
    ]);
    return { products: rows.map((r) => toCard(r.product)), total };
  }

  const orderBy =
    sort === 'newest'
      ? { createdAt: 'desc' as const }
      : sort === 'price_asc'
        ? { basePrice: 'asc' as const }
        : sort === 'price_desc'
          ? { basePrice: 'desc' as const }
          : { soldCount: 'desc' as const };

  const [products, total] = await Promise.all([
    db.product.findMany({ where: productWhere, orderBy, skip, take: limit, select: CARD_SELECT }),
    db.product.count({ where: productWhere }),
  ]);

  return { products: products.map(toCard), total };
}

/* ---------------------------------------------------------------------------
 * Homepage
 * ------------------------------------------------------------------------- */

/** Everything ProductCard needs, in one place so every grid selects the same shape. */
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

/** The exact prop surface ProductCard consumes. */
export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  gender: string;
  occasion: string | null;
  ratingAvg: number;
  ratingCount: number;
  images: { url: string; alt: string }[];
  variants: {
    id: string;
    size: string;
    color: string;
    colorHex: string;
    stock: number;
    reserved: number;
  }[];
  hasStock: boolean;
  colors: string[];
  sizes: string[];
}

function toCard(p: Omit<ProductCardData, 'hasStock' | 'colors' | 'sizes'>): ProductCardData {
  return {
    ...p,
    hasStock: p.variants.some((v) => v.stock - v.reserved > 0),
    colors: [...new Set(p.variants.map((v) => v.color))],
    sizes: [...new Set(p.variants.map((v) => v.size))],
  };
}

/**
 * One round-trip batch for the landing page.
 *
 * Reads are fail-soft on purpose: the homepage is the single most-linked URL on
 * the site, so a database blip must degrade it to a static shell rather than a
 * 500. Every consumer below treats empty arrays as "hide that section".
 */
async function loadHomepage() {
  const empty = {
    banner: null as {
      eyebrow: string | null;
      headline: string;
      subhead: string | null;
      ctaLabel: string | null;
      ctaHref: string | null;
      imageUrl: string | null;
      mobileImageUrl: string | null;
      accentHex: string | null;
    } | null,
    featured: [] as ProductCardData[],
    newArrivals: [] as ProductCardData[],
    categories: [] as { slug: string; name: string; count: number; image: string | null }[],
    collections: [] as {
      slug: string;
      name: string;
      kind: string;
      tagline: string | null;
      description: string | null;
      heroImage: string | null;
      accentHex: string | null;
    }[],
    reviews: [] as { id: string; rating: number; title: string | null; body: string; authorName: string; productName: string; productSlug: string }[],
  };

  const now = new Date();

  try {
    const [banner, featured, newArrivals, topCategories, collections, reviews] = await Promise.all([
      db.banner.findFirst({
        where: {
          placement: 'home_hero',
          active: true,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        },
        orderBy: { sortOrder: 'asc' },
        select: {
          eyebrow: true,
          headline: true,
          subhead: true,
          ctaLabel: true,
          ctaHref: true,
          imageUrl: true,
          mobileImageUrl: true,
          accentHex: true,
        },
      }),
      db.product.findMany({
        where: { status: 'active', featured: true },
        orderBy: [{ soldCount: 'desc' }, { createdAt: 'desc' }],
        take: 8,
        select: CARD_SELECT,
      }),
      db.product.findMany({
        where: { status: 'active' },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: CARD_SELECT,
      }),
      // Top-level tiles only; the count rolls up direct + child products so a
      // parent that merchandises through subcategories still reads honestly.
      db.category.findMany({
        where: { active: true, parentId: null },
        orderBy: { sortOrder: 'asc' },
        select: {
          slug: true,
          name: true,
          heroImage: true,
          _count: { select: { products: true } },
          children: {
            where: { active: true },
            select: { _count: { select: { products: true } } },
          },
          products: {
            where: { status: 'active' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              images: {
                where: { kind: 'gallery' },
                orderBy: { sortOrder: 'asc' },
                take: 1,
                select: { url: true },
              },
            },
          },
        },
      }),
      db.collection.findMany({
        where: {
          active: true,
          products: { some: { product: { status: 'active' } } },
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        },
        orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }],
        take: 3,
        select: {
          slug: true,
          name: true,
          kind: true,
          tagline: true,
          description: true,
          heroImage: true,
          accentHex: true,
        },
      }),
      db.review.findMany({
        where: { status: 'approved', rating: { gte: 4 }, body: { not: '' } },
        orderBy: [{ helpfulCount: 'desc' }, { createdAt: 'desc' }],
        take: 3,
        select: {
          id: true,
          rating: true,
          title: true,
          body: true,
          user: { select: { name: true } },
          product: { select: { name: true, slug: true } },
        },
      }),
    ]);

    return {
      banner,
      featured: featured.map(toCard),
      newArrivals: newArrivals.map(toCard),
      categories: topCategories.map((c) => ({
        slug: c.slug,
        name: c.name,
        count: c._count.products + c.children.reduce((n, ch) => n + ch._count.products, 0),
        image: c.heroImage ?? c.products[0]?.images[0]?.url ?? null,
      })),
      collections,
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        authorName: r.user?.name ?? 'Verified buyer',
        productName: r.product.name,
        productSlug: r.product.slug,
      })),
    };
  } catch (err) {
    console.error('[homepage] read failed — rendering static shell:', err);
    return empty;
  }
}

/**
 * Short-lived process cache. The landing page is dynamically rendered (the root
 * layout needs live theme settings), so without this every visitor would pay a
 * round-trip to the database region. 60s is short enough that a merchandising
 * change lands almost immediately and long enough to flatten a traffic spike.
 */
const HOME_TTL_MS = 60_000;
let homeCache: Awaited<ReturnType<typeof loadHomepage>> | null = null;
let homeCacheExpiresAt = 0;

export type HomepageData = Awaited<ReturnType<typeof loadHomepage>>;

export async function getHomepage(): Promise<HomepageData> {
  const now = Date.now();
  if (homeCache && now < homeCacheExpiresAt) return homeCache;
  homeCache = await loadHomepage();
  homeCacheExpiresAt = now + HOME_TTL_MS;
  return homeCache;
}

/** Call after any catalogue/CMS write so the next request re-reads. */
export function invalidateHomepage() {
  homeCache = null;
  homeCacheExpiresAt = 0;
}
