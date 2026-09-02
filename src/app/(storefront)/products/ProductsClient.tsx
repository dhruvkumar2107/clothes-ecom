'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { ProductGrid } from '@/components/products/ProductGrid';
import { ProductFilters } from '@/components/products/ProductFilters';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ProductsPageProps {
  searchParams: Promise<{
    page?: string;
    category?: string;
    collection?: string;
    gender?: string;
    occasion?: string;
    minPrice?: string;
    maxPrice?: string;
    size?: string;
    color?: string;
    inStock?: string;
    featured?: string;
    new?: string;
    sort?: string;
    search?: string;
  }>;
}

export default function ProductsPage({ searchParams }: ProductsPageProps) {
  const searchParamsSync = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [categories, setCategories] = useState<{ id: string; slug: string; name: string }[]>([]);
  const [collections, setCollections] = useState<{ id: string; slug: string; name: string; heroImage: string | null }[]>([]);
  const [mounted, setMounted] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    setMounted(true);
    async function loadData() {
      try {
        const [catRes, colRes] = await Promise.all([
          fetch('/api/categories'),
          fetch('/api/collections'),
        ]);
        const catJson = catRes.ok ? await catRes.json() : { data: [] };
        const colJson = colRes.ok ? await colRes.json() : { data: [] };
        setCategories(Array.isArray(catJson.data) ? catJson.data : []);
        setCollections(Array.isArray(colJson.data) ? colJson.data : []);
      } catch {
        setCategories([]);
        setCollections([]);
      }
    }
    loadData();
  }, []);

  if (!mounted) {
    return (
      <div className="py-8 md:py-12">
        <div className="u-container">
          {/* Header skeleton */}
          <div className="mb-8 md:mb-12 space-y-3">
            <div className="h-8 w-48 bg-ink/10 rounded animate-pulse" />
            <div className="h-4 w-64 bg-ink/10 rounded animate-pulse" />
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar skeleton */}
            <aside className="lg:w-64 flex-shrink-0 space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-20 bg-ink/10 rounded animate-pulse" />
                  <div className="space-y-1.5">
                    {[...Array(3)].map((_, j) => (
                      <div key={j} className="h-3 w-full bg-ink/5 rounded animate-pulse" />
                    ))}
                  </div>
                </div>
              ))}
            </aside>

            {/* Product grid skeleton */}
            <main className="flex-1 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="space-y-3">
                    <div className="aspect-[3/4] bg-paper-2 rounded-lg animate-pulse" />
                    <div className="h-3 w-16 bg-paper-3 rounded" />
                    <div className="h-4 w-3/4 bg-paper-3 rounded" />
                    <div className="h-4 w-1/2 bg-paper-3 rounded" />
                  </div>
                ))}
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  const params = Object.fromEntries(searchParamsSync.entries());
  const page = parseInt(params.page || '1', 10);
  const limit = 24;

  const handleFilterChange = (newParams: Record<string, string>) => {
    const searchParams = new URLSearchParams(searchParamsSync.toString());
    Object.entries(newParams).forEach(([key, value]) => {
      if (value) {
        searchParams.set(key, value);
      } else {
        searchParams.delete(key);
      }
    });
    searchParams.set('page', '1');
    router.push(`${pathname}?${searchParams.toString()}`);
    setShowMobileFilters(false);
  };

  const activeFilterCount = Object.keys(params).filter(k => k !== 'page' && k !== 'limit' && params[k]).length;

  return (
    <div className="py-8 md:py-12">
      <div className="u-container">
        {/* Page Header */}
        <div className="mb-8 md:mb-12">
          <h1 className="u-display text-3xl md:text-4xl mb-2">
            {params.search ? `Results for "${params.search}"` : 'All Products'}
          </h1>
          <p className="text-muted">Discover our complete collection of luxury fashion</p>
        </div>

        {/* Mobile filter toggle */}
        <div className="lg:hidden mb-6">
          <Button
            variant="outline"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="w-full justify-center gap-2"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-accent text-paper text-xs flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters - Desktop */}
          <aside className="hidden lg:block lg:w-64 flex-shrink-0">
            <ProductFilters
              categories={categories}
              collections={collections}
              initialParams={params}
              onChange={handleFilterChange}
            />
          </aside>

          {/* Sidebar Filters - Mobile */}
          {showMobileFilters && (
            <div className="lg:hidden fixed inset-0 z-[80] bg-paper overflow-y-auto">
              <div className="sticky top-0 bg-paper border-b border-line p-4 flex items-center justify-between">
                <h2 className="u-display text-lg font-medium">Filters</h2>
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="w-10 h-10 rounded-md hover:bg-ink-2 flex items-center justify-center transition-colors u-focus"
                  aria-label="Close filters"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4">
                <ProductFilters
                  categories={categories}
                  collections={collections}
                  initialParams={params}
                  onChange={handleFilterChange}
                />
              </div>
            </div>
          )}

          {/* Product Grid */}
          <main className="flex-1 min-w-0">
            <ProductGrid
              initialParams={{
                ...params,
                page: page.toString(),
                limit: limit.toString(),
              }}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
