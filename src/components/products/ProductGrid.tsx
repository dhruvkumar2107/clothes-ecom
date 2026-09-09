'use client';

import { useState, useEffect, useCallback } from 'react';
import { ProductCard } from './ProductCard';
import { ProductGridSkeleton } from './ProductSkeleton';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { apiGet } from '@/lib/api-client';

interface Product {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  images: { url: string; alt: string; kind?: string; colorKey?: string }[];
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0, limit: 24 });
  const [params, setParams] = useState<Record<string, string>>(initialParams);

  useEffect(() => {
    loadProducts();
  }, [params]);

  const loadProducts = async (page = 1, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const searchParams = new URLSearchParams({ ...params, page: page.toString() });
      const data = await apiGet<{ data: Product[]; meta: any }>(`/api/products?${searchParams.toString()}`);
      const newProducts = Array.isArray(data?.data) ? data.data : [];
      setProducts(prev => append ? [...prev, ...newProducts] : newProducts);
      setMeta(data?.meta ?? { page: 1, totalPages: 1, total: 0, limit: 24 });
    } catch (error) {
      if (!append) setProducts([]);
      setMeta({ page: 1, totalPages: 1, total: 0, limit: 24 });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = useCallback(() => {
    if (meta.page < meta.totalPages) loadProducts(meta.page + 1, true);
  }, [meta.page, meta.totalPages, params]);

  const handleFilterChange = useCallback((newParams: Record<string, string>) => {
    const searchParams = new URLSearchParams(params);
    Object.entries(newParams).forEach(([key, value]) => {
      if (value) searchParams.set(key, value);
      else searchParams.delete(key);
    });
    searchParams.set('page', '1');
    setParams(Object.fromEntries(searchParams.entries()));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [params]);

  if (loading && products.length === 0) return <ProductGridSkeleton count={8} />;

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="u-display text-xl mb-2">No products found</p>
        <p className="text-sm text-muted mb-6">Try adjusting your filters or search terms</p>
        <button onClick={() => setParams({})} className="text-xs font-medium text-accent hover:underline u-focus">
          Clear all filters
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Active Filters */}
      {Object.keys(params).filter(k => k !== 'page' && k !== 'limit' && params[k]).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {Object.entries(params)
            .filter(([key, value]) => key !== 'page' && key !== 'limit' && value)
            .map(([key, value]) => (
              <button
                key={key}
                onClick={() => handleFilterChange({ [key]: '' })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-paper-2 text-ink rounded-full hover:bg-paper-3 transition-colors u-focus"
              >
                <span className="capitalize">{key}:</span>
                <span>{value}</span>
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            ))}
          <button
            onClick={() => setParams({})}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium text-danger hover:bg-danger/5 rounded-full transition-colors u-focus"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Product Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8 md:gap-x-6" role="list">
        {products.map((product) => (
          <div key={product.id}>
            <ProductCard {...product} />
          </div>
        ))}
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="mt-12 space-y-6">
          {meta.page < meta.totalPages ? (
            <div className="flex justify-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="btn-secondary text-xs disabled:opacity-50"
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          ) : (
            <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
              <button
                onClick={() => { handleFilterChange({ page: String(meta.page - 1) }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                disabled={meta.page <= 1}
                className="w-10 h-10 rounded border border-line flex items-center justify-center hover:bg-paper-2 disabled:opacity-30 u-focus"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
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
                    onClick={() => { handleFilterChange({ page: String(pageNum) }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className={`w-10 h-10 rounded flex items-center justify-center font-medium text-sm transition-colors u-focus ${
                      meta.page === pageNum ? 'bg-ink text-paper' : 'text-ink hover:bg-paper-2'
                    }`}
                    aria-label={`Page ${pageNum}`}
                    aria-current={meta.page === pageNum ? 'page' : undefined}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => { handleFilterChange({ page: String(meta.page + 1) }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                disabled={meta.page >= meta.totalPages}
                className="w-10 h-10 rounded border border-line flex items-center justify-center hover:bg-paper-2 disabled:opacity-30 u-focus"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </nav>
          )}
          <p className="text-center text-xs text-muted">
            Showing {((meta.page - 1) * meta.limit) + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total} products
          </p>
        </div>
      )}
    </>
  );
}
