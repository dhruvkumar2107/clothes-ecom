'use client';

import { useState, useEffect } from 'react';
import { ProductCard } from './ProductCard';
import { Loader2, ChevronRight } from 'lucide-react';
import { apiGet } from '@/lib/api-client';

interface Product {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  images: { url: string; alt: string }[];
  gender: string;
  occasion: string;
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
  priceRange: { min: number; max: number };
  inStock: boolean;
  colors: string[];
  sizes: string[];
}

interface ProductGridProps {
  initialParams: Record<string, string>;
}

export function ProductGrid({ initialParams }: ProductGridProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [params, setParams] = useState<Record<string, string>>(initialParams);

  useEffect(() => {
    loadProducts();
  }, [params]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const searchParams = new URLSearchParams(params);
      const data = await apiGet<{ data: Product[]; meta: any }>(`/api/products?${searchParams.toString()}`);
      setProducts(Array.isArray(data?.data) ? data.data : []);
      setMeta(data?.meta ?? { page: 1, totalPages: 1, total: 0 });
    } catch (error) {
      console.error('Failed to load products:', error);
      setProducts([]);
      setMeta({ page: 1, totalPages: 1, total: 0 });
    } finally {
      setLoading(false);
    }
  };

  const updateParam = (key: string, value: string | null) => {
    const newParams = { ...params };
    if (value) newParams[key] = value;
    else delete newParams[key];
    newParams.page = '1';
    setParams(newParams);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading && products.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="aspect-[3/4] bg-paper-2 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-ink/10 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="u-display text-xl mb-2">No products found</h3>
        <p className="text-muted mb-6">Try adjusting your filters or search terms</p>
        <button
          onClick={() => setParams({})}
          className="text-accent hover:underline text-sm font-medium"
        >
          Clear all filters
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" role="list">
        {products.map((product) => (
          <ProductCard key={product.id} {...product} />
        ))}
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <nav className="mt-12 flex items-center justify-center gap-2" aria-label="Pagination">
          <button
            onClick={() => updateParam('page', String(meta.page - 1))}
            disabled={meta.page <= 1}
            className="w-10 h-10 rounded-md border border-line flex items-center justify-center hover:bg-ink-2 disabled:opacity-50 disabled:cursor-not-allowed u-focus"
            aria-label="Previous page"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {Array.from({ length: Math.min(5, meta.totalPages) }, (_, i) => {
            let pageNum: number;
            if (meta.totalPages <= 5) pageNum = i + 1;
            else if (meta.page <= 3) pageNum = i + 1;
            else if (meta.page >= meta.totalPages - 2) pageNum = meta.totalPages - 4 + i;
            else pageNum = meta.page - 2 + i;

            return (
              <button
                key={pageNum}
                onClick={() => updateParam('page', String(pageNum))}
                className={`w-10 h-10 rounded-md flex items-center justify-center font-medium transition-colors u-focus ${
                  meta.page === pageNum
                    ? 'bg-ink text-paper'
                    : 'text-ink hover:bg-ink-2'
                }`}
                aria-label={`Page ${pageNum}`}
                aria-current={meta.page === pageNum ? 'page' : undefined}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            onClick={() => updateParam('page', String(meta.page + 1))}
            disabled={meta.page >= meta.totalPages}
            className="w-10 h-10 rounded-md border border-line flex items-center justify-center hover:bg-ink-2 disabled:opacity-50 disabled:cursor-not-allowed u-focus"
            aria-label="Next page"
          >
            <ChevronRight className="w-5 h-5" aria-hidden="true" />
          </button>
        </nav>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        Showing {((meta.page - 1) * 24) + 1}–{Math.min(meta.page * 24, meta.total)} of {meta.total} products
      </p>
    </>
  );
}