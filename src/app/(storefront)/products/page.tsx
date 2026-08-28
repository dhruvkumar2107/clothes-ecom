import { Suspense } from 'react';
import ProductsClient from './ProductsClient';

export const revalidate = 60;

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
          <div className="max-w-md mx-auto text-center py-16">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-ink/10 flex items-center justify-center animate-spin">
              <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v15.944M19 4v15.944M10 4v15.944" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    }>
      <ProductsClient searchParams={searchParams} />
    </Suspense>
  );
}