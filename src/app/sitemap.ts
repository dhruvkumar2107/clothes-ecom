import { MetadataRoute } from 'next';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lumenandco.com';

  let products: { slug: string; updatedAt: Date }[] = [];
  let categories: { slug: string; createdAt: Date }[] = [];
  let collections: { slug: string; createdAt: Date }[] = [];

  try {
    [products, categories, collections] = await Promise.all([
      db.product.findMany({
        where: { status: 'active' },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
      db.category.findMany({
        where: { active: true },
        select: { slug: true, createdAt: true },
      }),
      db.collection.findMany({
        where: { active: true },
        select: { slug: true, createdAt: true },
      }),
    ]);
  } catch (err) {
    // Sitemap is best-effort: serve the static routes rather than a 500.
    console.error('sitemap: database unreachable, serving static routes only', err);
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/products`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/collections`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/signup`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/cart`, lastModified: new Date(), changeFrequency: 'always', priority: 0.3 },
    { url: `${baseUrl}/checkout`, lastModified: new Date(), changeFrequency: 'always', priority: 0.3 },
  ];

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${baseUrl}/products/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${baseUrl}/products?category=${c.slug}`,
    lastModified: c.createdAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const collectionRoutes: MetadataRoute.Sitemap = collections.map((c) => ({
    url: `${baseUrl}/collections/${c.slug}`,
    lastModified: c.createdAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticRoutes, ...productRoutes, ...categoryRoutes, ...collectionRoutes];
}