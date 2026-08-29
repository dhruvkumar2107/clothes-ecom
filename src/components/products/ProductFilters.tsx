'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, X, SlidersHorizontal } from 'lucide-react';
import { Button, Input, Checkbox } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';

interface ProductFiltersProps {
  categories: { id: string; slug: string; name: string }[];
  collections: { id: string; slug: string; name: string }[];
  initialParams: Record<string, string>;
  onChange: (params: Record<string, string>) => void;
}

const OCCASIONS = ['casual', 'party', 'formal', 'festive', 'resort'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const COLORS = [
  { name: 'Grey', hex: '#808080' },
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    category: true,
    collection: true,
    occasion: true,
    size: true,
    color: true,
    price: true,
  });
  const [priceRange, setPriceRange] = useState({ min: 0, max: 50000 });

  const handleChange = (key: string, value: string | null) => {
    const newParams = { ...initialParams };
    if (value) newParams[key] = value;
    else delete newParams[key];
    newParams.page = '1';
    onChange(newParams);
  };

  const handleMultiChange = (key: string, values: string[]) => {
    const newParams = { ...initialParams };
    if (values.length > 0) newParams[key] = values.join(',');
    else delete newParams[key];
    newParams.page = '1';
    onChange(newParams);
  };

  const clearAll = () => {
    onChange({});
  };

  const hasActiveFilters = Object.keys(initialParams).length > 0;

  return (
    <aside className="space-y-6" role="complementary" aria-label="Product filters">
      {/* Mobile filter toggle */}
      <div className="lg:hidden">
        <Button variant="outline" className="w-full justify-between" onClick={() => {}}>
          <span>Filters</span>
          <ChevronDown className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Category */}
      <FilterSection
        title="Category"
        key="category"
        expanded={expanded.category}
        onToggle={() => setExpanded(p => ({ ...p, category: !p.category }))}
      >
        <div className="space-y-2">
          {(categories || []).map((cat) => (
            <label key={cat.id} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={initialParams.category === cat.slug}
                onChange={(checked) => handleChange('category', checked ? cat.slug : null)}
              />
              <span className="text-sm text-ink">{cat.name}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Collection */}
      <FilterSection
        title="Collection"
        key="collection"
        expanded={expanded.collection}
        onToggle={() => setExpanded(p => ({ ...p, collection: !p.collection }))}
      >
        <div className="space-y-2">
          {(collections || []).map((col) => (
            <label key={col.id} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={initialParams.collection === col.slug}
                onChange={(checked) => handleChange('collection', checked ? col.slug : null)}
              />
              <span className="text-sm text-ink">{col.name}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Gender */}
      <FilterSection
        title="Gender"
        key="gender"
        expanded={expanded.gender ?? true}
        onToggle={() => setExpanded(p => ({ ...p, gender: !p.gender }))}
      >
        <div className="space-y-2">
          {['men', 'women', 'unisex'].map((g) => (
            <label key={g} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={initialParams.gender === g}
                onChange={(checked) => handleChange('gender', checked ? g : null)}
              />
              <span className="text-sm text-ink capitalize">{g}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Occasion */}
      <FilterSection
        title="Occasion"
        key="occasion"
        expanded={expanded.occasion}
        onToggle={() => setExpanded(p => ({ ...p, occasion: !p.occasion }))}
      >
        <div className="space-y-2">
          {OCCASIONS.map((o) => (
            <label key={o} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={initialParams.occasion?.split(',').includes(o)}
                onChange={(checked) => {
                  const current = initialParams.occasion?.split(',') || [];
                  const updated = checked ? [...current, o] : current.filter(x => x !== o);
                  handleMultiChange('occasion', updated);
                }}
              />
              <span className="text-sm text-ink capitalize">{o}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Size */}
      <FilterSection
        title="Size"
        key="size"
        expanded={expanded.size}
        onToggle={() => setExpanded(p => ({ ...p, size: !p.size }))}
      >
        <div className="flex flex-wrap gap-2">
          {SIZES.map((s) => (
            <label key={s} className="cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={initialParams.size?.split(',').includes(s)}
                onChange={(e) => {
                  const current = initialParams.size?.split(',') || [];
                  const updated = e.target.checked ? [...current, s] : current.filter(x => x !== s);
                  handleMultiChange('size', updated);
                }}
              />
              <span className="inline-flex items-center justify-center w-8 h-8 text-xs font-medium rounded-md border border-line peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper hover:border-ink transition-colors">
                {s}
              </span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Color */}
      <FilterSection
        title="Color"
        key="color"
        expanded={expanded.color}
        onToggle={() => setExpanded(p => ({ ...p, color: !p.color }))}
      >
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <label key={c.name} className="cursor-pointer group">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={initialParams.color?.split(',').includes(c.name)}
                onChange={(e) => {
                  const current = initialParams.color?.split(',') || [];
                  const updated = e.target.checked ? [...current, c.name] : current.filter(x => x !== c.name);
                  handleMultiChange('color', updated);
                }}
              />
              <span
                className="inline-flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all"
                style={{
                  backgroundColor: c.hex,
                  borderColor: c.hex === '#FFFFFF' ? '#E0DCD2' : c.hex,
                }}
              >
                <span className="w-4 h-4 rounded-full border-2 border-paper opacity-0 peer-checked:opacity-100" aria-hidden="true" />
              </span>
              <span className="sr-only">{c.name}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Price Range */}
      <FilterSection
        title="Price Range"
        key="price"
        expanded={expanded.price}
        onToggle={() => setExpanded(p => ({ ...p, price: !p.price }))}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={priceRange.min}
              onChange={(e) => setPriceRange(p => ({ ...p, min: parseInt(e.target.value) || 0 }))}
              className="w-24"
              min="0"
              max={priceRange.max}
            />
            <span className="text-muted flex-1">—</span>
            <Input
              type="number"
              placeholder="Max"
              value={priceRange.max}
              onChange={(e) => setPriceRange(p => ({ ...p, max: parseInt(e.target.value) || 50000 }))}
              className="w-24"
              min={priceRange.min}
              max="50000"
            />
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6 text-muted flex-1" aria-hidden="true" />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              const newParams = { ...initialParams };
              if (priceRange.min > 0) newParams.minPrice = String(priceRange.min * 100);
              else delete newParams.minPrice;
              if (priceRange.max < 50000) newParams.maxPrice = String(priceRange.max * 100);
              else delete newParams.maxPrice;
              newParams.page = '1';
              onChange(newParams);
            }}
          >
            Apply
          </Button>
        </div>
      </FilterSection>

      {/* Sort */}
      <FilterSection title="Sort By" key="sort">
        <select
          value={initialParams.sort || 'newest'}
          onChange={(e) => handleChange('sort', e.target.value === 'newest' ? null : e.target.value)}
          className="w-full px-3 py-2 border border-line rounded-md text-sm text-ink bg-paper focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </FilterSection>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button variant="outline" className="w-full justify-center gap-2 text-danger hover:text-danger hover:border-danger" onClick={clearAll}>
          <X className="w-4 h-4" aria-hidden="true" />
          Clear All Filters
        </Button>
      )}
    </aside>
  );
}

function FilterSection({ 
  title, 
  children, 
  expanded = true, 
  onToggle = () => {} 
}: { 
  title: string; 
  children: React.ReactNode; 
  expanded?: boolean; 
  onToggle?: () => void;
  key?: string;
}) {
  return (
    <details className="group" open={expanded}>
      <summary 
        onClick={(e) => { e.preventDefault(); onToggle(); }}
        className="flex items-center justify-between cursor-pointer u-label select-none"
        aria-expanded={expanded}
      >
        <span>{title}</span>
        <span className="transition-transform group-open:rotate-180">
          <ChevronDown className="w-4 h-4 text-muted" aria-hidden="true" />
        </span>
      </summary>
      <div className="mt-3 animate-in-up" style={{ animationDuration: '200ms' }}>
        {children}
      </div>
    </details>
  );
}