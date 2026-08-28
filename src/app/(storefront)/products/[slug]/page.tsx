import { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { ProductDetailClient } from '@/components/products/ProductDetailClient';
import { getProductBySlug } from '@/lib/api-server';

// Revalidate product pages every 60s — stock/pricing changes reflect quickly
// while product detail pages get the ISR speed benefit.
export const revalidate = 60;

// Deduplicate DB fetch: generateMetadata + page component run in the same
// request, so React.cache ensures a single DB round-trip instead of two.
const getProduct = cache((slug: string) => getProductBySlug(slug));

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  let product = null;
  try {
    product = await getProduct(slug);
  } catch {
    return { title: 'Product' };
  }
  
  if (!product) {
    return { title: 'Product Not Found' };
  }

  return {
    title: product.name,
    description: product.subtitle || product.description?.slice(0, 160),
    openGraph: {
      title: product.name,
      description: product.subtitle || product.description?.slice(0, 160),
      images: product.images[0]?.url ? [product.images[0].url] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description: product.subtitle || product.description?.slice(0, 160),
      images: product.images[0]?.url ? [product.images[0].url] : [],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  let product = null;

  try {
    product = await getProduct(slug);
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
  };

  return <ProductDetailClient product={productData} />;
}