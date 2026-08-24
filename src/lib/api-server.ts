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

export async function getCollectionProducts(slug: string, page = 1, limit = 24, sort = 'manual') {
  const collection = await db.collection.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!collection) return { products: [], total: 0 };

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
          select: { size: true, color: true, colorHex: true, stock: true, reserved: true },
        },
      },
    }),
    db.product.count({
      where: { status: 'active', collections: { some: { collectionId: collection.id } } },
    }),
  ]);

  return {
    products: products.map((p) => {
      const prices = p.variants.map((v) => p.basePrice);
      return {
        ...p,
        priceRange: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : { min: p.basePrice, max: p.basePrice },
        hasStock: p.variants.some((v) => v.stock - v.reserved > 0),
        colors: [...new Set(p.variants.map((v) => v.color))],
        sizes: [...new Set(p.variants.map((v) => v.size))],
      };
    }),
    total,
  };
}