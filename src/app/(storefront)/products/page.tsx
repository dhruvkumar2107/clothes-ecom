import { Suspense } from 'react';
import ProductsClient from './ProductsClient';

export const dynamic = 'force-dynamic';

interface PageProps {
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

export default function ProductsPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={
      <div className="py-8 md:py-12">
        <div className="u-container">
          <div className="mb-8 md:mb-12 space-y-3">
            <div className="h-8 w-48 bg-ink/10 rounded animate-pulse" />
            <div className="h-4 w-64 bg-ink/10 rounded animate-pulse" />
          </div>
          <div className="flex flex-col lg:flex-row gap-8">
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
            <main className="flex-1 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="space-y-3">
                    <div className="aspect-[3/4] bg-paper-2 rounded-lg animate-pulse" />
                    <div className="h-3 w-16 bg-paper-3 rounded animate-pulse" />
                    <div className="h-4 w-3/4 bg-paper-3 rounded animate-pulse" />
                    <div className="h-4 w-1/2 bg-paper-3 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </main>
          </div>
        </div>
      </div>
    }>
      <ProductsClient searchParams={searchParams} />
    </Suspense>
  );
}
