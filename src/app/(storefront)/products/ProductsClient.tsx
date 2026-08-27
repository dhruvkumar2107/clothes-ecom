'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { ProductGrid } from '@/components/products/ProductGrid';
import { ProductFilters } from '@/components/products/ProductFilters';

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
          <div className="max-w-md mx-auto text-center py-16">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-ink/10 flex items-center justify-center animate-spin">
              <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v15.944M19 4v15.944M10 4v15.944" />
              </svg>
            </div>
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
  };

  return (
    <div className="py-8 md:py-12">
      <div className="u-container">
        {/* Page Header */}
        <div className="mb-8 md:mb-12">
          <h1 className="u-display text-3xl md:text-4xl mb-2">All Products</h1>
          <p className="text-muted">Discover our complete collection of luxury fashion</p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters */}
          <aside className="lg:w-64 flex-shrink-0">
            <ProductFilters
              categories={categories}
              collections={collections}
              initialParams={params}
              onChange={handleFilterChange}
            />
          </aside>

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