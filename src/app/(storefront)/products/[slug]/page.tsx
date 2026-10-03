import { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ProductDetailClient } from '@/components/products/ProductDetailClient';
import { ProductCard } from '@/components/products/ProductCard';
import { RecentlyViewed } from '@/components/products/RecentlyViewed';
import { getProductBySlug, getRelatedProducts } from '@/lib/api-server';
import { SmartImage } from '@/components/ui/SmartImage';
import { ArrowRight, ChevronDown, Heart, ShoppingBag, Loader2 } from 'lucide-react';
import { useToast } from '@/app/providers';
import { useRouter } from 'next/navigation';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let product = null;
  try {
    product = await getProductBySlug(slug);
  } catch {
    return { title: 'Product' };
  }

  if (!product) {
    return { title: 'Product Not Found' };
  }

  const firstImage = product.images[0]?.url;

  return {
    title: product.name,
    description: product.subtitle || product.description?.slice(0, 160),
    openGraph: {
      title: product.name,
      description: product.subtitle || product.description?.slice(0, 160),
      images: firstImage ? [firstImage] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description: product.subtitle || product.description?.slice(0, 160),
      images: firstImage ? [firstImage] : [],
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let product = null;

  try {
    product = await getProductBySlug(slug);
  } catch {
    // DB unavailable during build
  }

  if (!product) {
    notFound();
  }

  // Process variants for client
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

const productData = {
    ...product,
    care: product.careJson ? JSON.parse(product.careJson) : [],
    colors: Object.values(colors),
    sizeGuide: null,
    status: 'active',
    reviews: product.ratingCount > 0 ? [{ rating: 5, comment: 'Verified purchase' }] : [],
    wishlistedBy: [],
    orderItems: [],
    careJson: product.careJson ? JSON.parse(product.careJson) : [],
  };

  // Fetch related products (same category or shared collection)
  let relatedProducts: any[] = [];
  try {
    relatedProducts = await getRelatedProducts(product.id, product.category?.id || '', 4);
  } catch {
    // Fail silently — related products are non-critical
  }

  // JSON-LD structured data for rich search results
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.subtitle || product.description?.slice(0, 500),
    image: product.images.map((img) => img.url),
    sku: product.variants[0]?.sku,
    mpn: product.variants[0]?.sku,
    brand: { '@type': 'Brand', name: 'LUMEN&CO' },
    category: product.category?.name,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'INR',
      lowPrice: Math.min(...product.variants.map((v) => (product.basePrice + v.priceDelta) / 100)),
      highPrice: Math.max(...product.variants.map((v) => (product.basePrice + v.priceDelta) / 100)),
      availability: product.variants.some((v) => v.stock - v.reserved > 0)
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://lumenandco.com'}/products/${product.slug}`,
    },
    aggregateRating: product.ratingCount > 0 ? {
      '@type': 'AggregateRating',
      ratingValue: product.ratingAvg,
      reviewCount: product.ratingCount,
    } : undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetailClient product={productData} />

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="u-container py-12 md:py-16">
          <h2 className="u-display text-2xl md:text-3xl mb-8">You may also like</h2>
          <ul className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8 md:gap-x-6">
            {relatedProducts.map((p) => (
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
        </section>
      )}

      {/* Recently Viewed */}
      <div className="u-container py-8">
        <RecentlyViewed />
      </div>
    </>
  );
}