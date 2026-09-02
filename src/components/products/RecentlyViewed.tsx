'use client';

import { useState, useEffect } from 'react';
import { ProductCard } from './ProductCard';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface RecentProduct {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  images: { url: string; alt: string; kind?: string; colorKey?: string }[];
  gender: string;
  occasion?: string | null;
  ratingAvg: number;
  ratingCount: number;
  variants: {
    id: string;
    size: string;
    color: string;
    colorHex: string;
    stock: number;
    reserved: number;
  }[];
  inStock: boolean;
  colors: string[];
  sizes: string[];
}

const STORAGE_KEY = 'lumen_recently_viewed';
const MAX_ITEMS = 8;

export function trackRecentlyViewed(product: RecentProduct) {
  if (typeof window === 'undefined') return;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const recent: RecentProduct[] = stored ? JSON.parse(stored) : [];
    const filtered = recent.filter((p) => p.id !== product.id);
    filtered.unshift(product);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, MAX_ITEMS)));
  } catch {
    // localStorage might be full or disabled
  }
}

export function RecentlyViewed() {
  const [products, setProducts] = useState<RecentProduct[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setProducts(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  if (products.length === 0) return null;

  return (
    <section className="py-16 md:py-24" aria-labelledby="recent-title">
      <div className="u-container">
        <div className="flex items-end justify-between gap-6 mb-12">
          <div>
            <span className="u-label text-accent mb-3 block">Browsed</span>
            <h2 id="recent-title" className="u-display text-3xl md:text-4xl">
              Recently Viewed
            </h2>
          </div>
          <Link
            href="/products"
            className="u-label hover:text-accent transition-colors flex items-center gap-1 u-focus whitespace-nowrap"
          >
            View All
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10 md:gap-x-6">
          {products.slice(0, 4).map((product) => (
            <ProductCard key={product.id} {...product} />
          ))}
        </div>
      </div>
    </section>
  );
}
