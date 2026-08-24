'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useSearchOverlay } from '@/app/providers';
import { Button, Input } from '@/components/ui';
import { X, Search, Loader2, ChevronRight } from 'lucide-react';
import { debounce } from '@/lib/utils';
import { apiGet } from '@/lib/api-client';

interface SearchResult {
  products: {
    id: string;
    slug: string;
    name: string;
    basePrice: number;
    compareAtPrice: number | null;
    images: { url: string; alt: string }[];
  }[];
  collections: {
    id: string;
    slug: string;
    name: string;
    heroImage: string | null;
  }[];
}

export function SearchOverlay() {
  const { open, closeOverlay } = useSearchOverlay();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') closeOverlay();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, (results?.products.length ?? 0) + (results?.collections.length ?? 0) - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, -1));
      }
      if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        const allResults = [
          ...(results?.products ?? []).map((p) => ({ type: 'product', data: p })),
          ...(results?.collections ?? []).map((c) => ({ type: 'collection', data: c })),
        ];
        const selected = allResults[selectedIndex];
        if (selected) {
          if (selected.type === 'product') {
            closeOverlay();
            window.location.href = `/products/${selected.data.slug}`;
          } else {
            closeOverlay();
            window.location.href = `/collections/${selected.data.slug}`;
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, results, selectedIndex, closeOverlay]);

  const debouncedSearch = useRef(
    debounce(async (q: string) => {
      if (!q.trim() || q.length < 2) {
        setResults(null);
        return;
      }
      setLoading(true);
      try {
        const data = await apiGet<SearchResult>(`/api/search?q=${encodeURIComponent(q)}`);
        setResults(data);
      } catch {
        setResults(null);
      } finally {
        setLoading(false);
      }
    }, 300)
  ).current;

  useEffect(() => {
    debouncedSearch(query);
    return () => debouncedSearch.cancel();
  }, [query]);

  if (!open) return null;

  const allResults = [
    ...(results?.products ?? []).map((p) => ({ type: 'product' as const, data: p })),
    ...(results?.collections ?? []).map((c) => ({ type: 'collection' as const, data: c })),
  ];

  return (
    <>
      <div
        className="fixed inset-0 bg-ink/60 z-[95] animate-in"
        onClick={closeOverlay}
        aria-hidden="true"
      />
      <div className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-2xl z-[100] animate-in-up" role="search" aria-modal="true">
        <div className="bg-paper rounded-lg shadow-xl border border-line overflow-hidden">
          <div className="p-4 border-b border-line flex items-center gap-3">
            <Search className="w-5 h-5 text-muted flex-shrink-0" aria-hidden="true" />
            <Input
              ref={inputRef}
              type="search"
              placeholder="Search products, collections..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(-1);
              }}
              className="flex-1 bg-transparent border-none focus:ring-0 px-0"
              autoComplete="off"
              aria-label="Search"
            />
            {loading && <Loader2 className="w-5 h-5 text-accent animate-spin" aria-hidden="true" />}
            <button
              onClick={closeOverlay}
              className="w-10 h-10 rounded-md hover:bg-ink-2 flex items-center justify-center transition-colors u-focus ml-2"
              aria-label="Close search"
            >
              <X className="w-5 h-5 text-ink" aria-hidden="true" />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {query.length < 2 ? (
              <div className="p-8 text-center text-muted">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-30" aria-hidden="true" />
                <p className="text-sm">Type at least 2 characters to search</p>
              </div>
            ) : results === null && !loading ? (
              <div className="p-8 text-center text-muted">
                <p className="text-sm">Search for products or collections</p>
              </div>
            ) : allResults.length === 0 ? (
              <div className="p-8 text-center text-muted">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-30" aria-hidden="true" />
                <p className="text-sm">No results for &ldquo;{query}&rdquo;</p>
                <p className="text-xs mt-1">Try different keywords or browse our collections</p>
              </div>
            ) : (
              <>
                {results?.products && results.products.length > 0 && (
                  <>
                    <div className="px-4 py-3 border-b border-line">
                      <h3 className="u-label">Products</h3>
                    </div>
                    <ul role="listbox" aria-label="Products">
                      {results?.products?.map((product, i) => (
                        <li key={product.id} role="option" aria-selected={selectedIndex === i}>
                          <Link
                            href={`/products/${product.slug}`}
                            onClick={closeOverlay}
                            className={`flex items-center gap-4 p-3 hover:bg-ink-2 transition-colors ${selectedIndex === i ? 'bg-ink-2' : ''}`}
                          >
                            <div className="w-12 h-16 flex-shrink-0 rounded overflow-hidden bg-paper-2">
                              {product.images[0]?.url ? (
                                <img src={product.images[0].url} alt="" className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted">
                                  <Search className="w-5 h-5" aria-hidden="true" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-ink truncate">{product.name}</p>
                              <p className="text-sm text-accent font-medium">
                                {product.compareAtPrice && product.compareAtPrice > product.basePrice ? (
                                  <>
                                    <span className="line-through text-muted text-xs mr-2">
                                      {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(product.compareAtPrice / 100)}
                                    </span>
                                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(product.basePrice / 100)}
                                  </>
                                ) : (
                                  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(product.basePrice / 100)
                                )}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" aria-hidden="true" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {results?.collections && results.collections.length > 0 && (
                  <>
                    <div className="px-4 py-3 border-b border-line">
                      <h3 className="u-label">Collections</h3>
                    </div>
                    <ul role="listbox" aria-label="Collections">
                      {results.collections.map((collection, i) => (
                        <li key={collection.id} role="option" aria-selected={selectedIndex === results.products.length + i}>
                          <Link
                            href={`/collections/${collection.slug}`}
                            onClick={closeOverlay}
                            className={`flex items-center gap-4 p-3 hover:bg-ink-2 transition-colors ${selectedIndex === results.products.length + i ? 'bg-ink-2' : ''}`}
                          >
                            <div className="w-12 h-16 flex-shrink-0 rounded overflow-hidden bg-paper-2 relative">
                              {collection.heroImage ? (
                                <img src={collection.heroImage} alt="" className="w-full h-full object-cover" loading="lazy" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted">
                                  <Search className="w-5 h-5" aria-hidden="true" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm text-ink truncate">{collection.name}</p>
                              <p className="text-xs text-muted">Collection</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" aria-hidden="true" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>

          <div className="p-4 border-t border-line">
            <Link
              href={`/search?q=${encodeURIComponent(query)}`}
              onClick={closeOverlay}
              className="flex items-center justify-center gap-2 text-sm text-accent hover:text-accent/80 transition-colors u-focus"
            >
              View all results for &ldquo;{query}&rdquo;
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}