'use client';

import { useState, useCallback } from 'react';
import { ChevronDown, X, SlidersHorizontal } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { formatCurrency } from '@/lib/utils';

interface ProductFiltersProps {
  categories: { id: string; slug: string; name: string }[];
  collections: { id: string; slug: string; name: string }[];
  initialParams: Record<string, string>;
  onChange: (params: Record<string, string>) => void;
}

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const COLORS = [
  { name: 'Black', hex: '#0a0a0a' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Navy', hex: '#1B2A4A' },
  { name: 'Beige', hex: '#F5F0E1' },
  { name: 'Brown', hex: '#8B6B4A' },
  { name: 'Green', hex: '#2D5A3D' },
  { name: 'Red', hex: '#8F2F2A' },
  { name: 'Blue', hex: '#3C5A78' },
  { name: 'Pink', hex: '#E8B4B8' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'rating', label: 'Top Rated' },
];

export function ProductFilters({ categories, collections, initialParams, onChange }: ProductFiltersProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleChange = useCallback((key: string, value: string | null) => {
    const newParams = { ...initialParams };
    if (value) newParams[key] = value;
    else delete newParams[key];
    newParams.page = '1';
    onChange(newParams);
  }, [initialParams, onChange]);

  const handleMultiChange = useCallback((key: string, values: string[]) => {
    const newParams = { ...initialParams };
    if (values.length > 0) newParams[key] = values.join(',');
    else delete newParams[key];
    newParams.page = '1';
    onChange(newParams);
  }, [initialParams, onChange]);

  const clearAll = useCallback(() => onChange({}), [onChange]);

  const activeFilterCount = Object.keys(initialParams).filter(k => k !== 'page' && k !== 'sort').length;

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Sort */}
      <div>
        <h3 className="u-label mb-3">Sort By</h3>
        <select
          value={initialParams.sort || 'newest'}
          onChange={(e) => handleChange('sort', e.target.value === 'newest' ? null : e.target.value)}
          className="w-full px-3 py-2.5 border border-line rounded text-sm text-ink bg-paper focus:outline-none focus:border-ink transition-colors"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Category */}
      <div>
        <h3 className="u-label mb-3">Category</h3>
        <div className="space-y-2">
          {categories.map((cat) => (
            <label key={cat.id} className="flex items-center gap-2.5 cursor-pointer group">
              <div className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${
                initialParams.category === cat.slug ? 'bg-ink border-ink' : 'border-line group-hover:border-ink/40'
              }`}>
                {initialParams.category === cat.slug && (
                  <svg className="w-2.5 h-2.5 text-paper" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-ink">{cat.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Collection */}
      <div>
        <h3 className="u-label mb-3">Collection</h3>
        <div className="space-y-2">
          {collections.map((col) => (
            <label key={col.id} className="flex items-center gap-2.5 cursor-pointer group">
              <div className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${
                initialParams.collection === col.slug ? 'bg-ink border-ink' : 'border-line group-hover:border-ink/40'
              }`}>
                {initialParams.collection === col.slug && (
                  <svg className="w-2.5 h-2.5 text-paper" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-ink">{col.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Gender */}
      <div>
        <h3 className="u-label mb-3">Gender</h3>
        <div className="space-y-2">
          {['men', 'women', 'unisex'].map((g) => (
            <label key={g} className="flex items-center gap-2.5 cursor-pointer group">
              <div className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${
                initialParams.gender === g ? 'bg-ink border-ink' : 'border-line group-hover:border-ink/40'
              }`}>
                {initialParams.gender === g && (
                  <svg className="w-2.5 h-2.5 text-paper" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-sm text-ink capitalize">{g}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Size */}
      <div>
        <h3 className="u-label mb-3">Size</h3>
        <div className="flex flex-wrap gap-2">
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => {
                const current = initialParams.size?.split(',') || [];
                const updated = current.includes(s) ? current.filter(x => x !== s) : [...current, s];
                handleMultiChange('size', updated);
              }}
              className={`min-w-[40px] h-10 px-3 rounded border text-xs font-medium transition-all ${
                initialParams.size?.split(',').includes(s)
                  ? 'border-ink bg-ink text-paper'
                  : 'border-line text-ink hover:border-ink/40'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <div>
        <h3 className="u-label mb-3">Color</h3>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c.name}
              onClick={() => {
                const current = initialParams.color?.split(',') || [];
                const updated = current.includes(c.name) ? current.filter(x => x !== c.name) : [...current, c.name];
                handleMultiChange('color', updated);
              }}
              className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                initialParams.color?.split(',').includes(c.name) ? 'border-ink ring-1 ring-ink/10 ring-offset-1' : 'border-line hover:border-ink/40'
              }`}
              style={{ backgroundColor: c.hex }}
              aria-label={c.name}
            />
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <h3 className="u-label mb-3">Price Range</h3>
        <div className="flex items-center gap-3">
          <input
            type="number"
            placeholder="Min"
            defaultValue={initialParams.minPrice ? Number(initialParams.minPrice) / 100 : ''}
            onBlur={(e) => {
              const val = e.target.value;
              if (val) handleChange('minPrice', String(Number(val) * 100));
              else handleChange('minPrice', null);
            }}
            className="w-full px-3 py-2 border border-line rounded text-sm text-ink bg-paper focus:outline-none focus:border-ink transition-colors"
          />
          <span className="text-muted">—</span>
          <input
            type="number"
            placeholder="Max"
            defaultValue={initialParams.maxPrice ? Number(initialParams.maxPrice) / 100 : ''}
            onBlur={(e) => {
              const val = e.target.value;
              if (val) handleChange('maxPrice', String(Number(val) * 100));
              else handleChange('maxPrice', null);
            }}
            className="w-full px-3 py-2 border border-line rounded text-sm text-ink bg-paper focus:outline-none focus:border-ink transition-colors"
          />
        </div>
      </div>

      {/* Clear All */}
      {activeFilterCount > 0 && (
        <button
          onClick={clearAll}
          className="w-full py-2.5 text-xs font-medium text-danger hover:bg-danger/5 border border-danger/20 rounded transition-colors u-focus"
        >
          Clear All Filters
        </button>
      )}
    </div>
  );

  return (
    <>
      <aside className="space-y-6" role="complementary" aria-label="Product filters">
        {/* Mobile Filter Toggle */}
        <div className="lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="btn-secondary w-full justify-between text-xs"
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 text-[9px] font-bold rounded-full bg-ink text-paper">
                  {activeFilterCount}
                </span>
              )}
            </span>
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Desktop Filters */}
        <div className="hidden lg:block">
          <FilterContent />
        </div>
      </aside>

      {/* Mobile Filter Drawer */}
      <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} side="left" title="Filters">
        <FilterContent />
      </Drawer>
    </>
  );
}
