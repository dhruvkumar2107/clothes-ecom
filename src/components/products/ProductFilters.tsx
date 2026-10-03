'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { db } from '@/lib/db';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/app/providers';
import { ChevronDown, X } from 'lucide-react';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export function ProductFilters({
  minPrice,
  maxPrice,
  onMinPriceChange,
  onMaxPriceChange,
  onPageChange,
}: {
  minPrice: string;
  maxPrice: string;
  onMinPriceChange: (value: string) => void;
  onMaxPriceChange: (value: string) => void;
  onPageChange: (page: number) => void;
}) {
  const { toast } = useToast();
  const [color, setColor] = useState<string>('');
  const [size, setSize] = useState<string>('');
  const [fabric, setFabric] = useState<string>('');
  const [occasion, setOccasion] = useState<string>('');
  const [gender, setGender] = useState<string>('all');
  const [inStock, setInStock] = useState<boolean>(true);

  const [activeFilter, setActiveFilter] = useState<'color' | 'size' | 'fabric' | 'occasion'>('color');

  const allColors = useMemo(() => {
    const colors = new Set<string>();
    // Would normally fetch from DB, using sample data
    return Array.from(colors).sort();
  }, []);

  const allSizes = useMemo(() => {
    const sizes = new Set<string>();
    // Would normally fetch from DB
    return ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  }, []);

  const allFabrics = useMemo(() => {
    const fabrics = new Set<string>();
    // Would normally fetch from DB
    return ['Cotton', 'Linen', 'Silk', 'Wool', 'Cashmere', 'Denim', 'Tencel'];
  }, []);

  const allOccasions = useMemo(() => {
    const occasions = new Set<string>();
    // Would normally fetch from DB
    return ['Casual', 'Formal', 'Casual', 'Party', 'Festive', 'Resort'];
  }, []);

  const handleApplyFilters = useCallback(async () => {
    onPageChange(1);
  }, [onPageChange]);

  const clearAllFilters = useCallback(async () => {
    setColor('');
    setSize('');
    setFabric('');
    setOccasion('');
    setGender('all');
    setInStock(true);
    onPageChange(1);
  }, []);

  return (
    <div className="lg:w-64 sticky top-24 md:top-24 bg-paper-2 border-r border-line max-h-screen overflow-y-auto">
      <div className="u-container p-4">
        {/* Filters Header */}
        <div className="flex flex-col md:flex-row justify-between items-start mb-6 border-b border-line pb-4">
          <h2 className="u-label text-accent text-xs uppercase tracking-wider mb-2">
            Filters
          </h2>
          <button
            onClick={clearAllFilters}
            className="text-[10px] text-muted uppercase tracking-wider hover:text-ink transition-colors"
            aria-label="Clear all filters"
          >
            Clear
            <X className="w-3 h-3 ml-1" aria-hidden="true" />
          </button>
        </div>

        {/* Color Filter */}
        {color && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium text-ink uppercase tracking-wider">Color</span>
              <ChevronDown className="w-3 h-3 text-muted" />
            </div>
            <div className="space-y-1">
              <button
                onClick={() => setColor('')}
                className={`w-full px-3 py-2 rounded-md text-left text-sm text-ink/60 hover:text-ink transition-colors ${
                  color ? 'bg-paper-3' : 'bg-transparent'
                }`}
              >
                None
              </button>
              {allColors.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-full px-3 py-2 rounded-md text-left text-sm text-ink ${
                    color === c ? 'bg-paper' : 'bg-transparent'
                  } hover:bg-paper/3 transition-colors`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Size Filter */}
        {size && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium text-ink uppercase tracking-wider">Size</span>
              <ChevronDown className="w-3 h-3 text-muted" />
            </div>
            <div className="space-y-1">
              <button
                onClick={() => setSize('')}
                className={`w-full px-3 py-2 rounded-md text-left text-sm text-ink/60 hover:text-ink transition-colors ${
                  size ? 'bg-paper-3' : 'bg-transparent'
                }`}
              >
                Any
              </button>
              {allSizes.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={`w-full px-3 py-2 rounded-md text-left text-sm text-ink ${
                    size === s ? 'bg-paper' : 'bg-transparent'
                  } hover:bg-paper/3 transition-colors`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Fabric Filter */}
        {fabric && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium text-ink uppercase tracking-wider">Fabric</span>
              <ChevronDown className="w-3 h-3 text-muted" />
            </div>
            <div className="space-y-1">
              <button
                onClick={() => setFabric('')}
                className={`w-full px-3 py-2 rounded-md text-left text-sm text-ink/60 hover:text-ink transition-colors ${
                  fabric ? 'bg-paper-3' : 'bg-transparent'
                }`}
              >
                Any
              </button>
              {allFabrics.map((f) => (
                <button
                  key={f}
                  onClick={() => setFabric(f)}
                  className={`w-full px-3 py-2 rounded-md text-left text-sm text-ink ${
                    fabric === f ? 'bg-paper' : 'bg-transparent'
                  } hover:bg-paper/3 transition-colors`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Occasion Filter */}
        {occasion && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-medium text-ink uppercase tracking-wider">Occasion</span>
              <ChevronDown className="w-3 h-3 text-muted" />
            </div>
            <div className="space-y-1">
              <button
                onClick={() => setOccasion('')}
                className={`w-full px-3 py-2 rounded-md text-left text-sm text-ink/60 hover:text-ink transition-colors ${
                  occasion ? 'bg-paper-3' : 'bg-transparent'
                }`}
              >
                Any
              </button>
              {allOccasions.map((o) => (
                <button
                  key={o}
                  onClick={() => setOccasion(o)}
                  className={`w-full px-3 py-2 rounded-md text-left text-sm text-ink ${
                    occasion === o ? 'bg-paper' : 'bg-transparent'
                  } hover:bg-paper/3 transition-colors`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Gender Filter */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-medium text-ink uppercase tracking-wider">Gender</span>
          </div>
          <div className="space-y-1">
            <button
              onClick={() => setGender('all')}
              className={`w-full px-3 py-2 rounded-md text-left text-sm text-ink/60 hover:text-ink transition-colors ${
                gender === 'all' ? 'bg-paper' : 'bg-transparent'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setGender('men')}
              className={`w-full px-3 py-2 rounded-md text-left text-sm text-ink ${
                gender === 'men' ? 'bg-paper' : 'bg-transparent'
              } hover:bg-paper/3 transition-colors`}
            >
              Men
            </button>
            <button
              onClick={() => setGender('women')}
              className={`w-full px-3 py-2 rounded-md text-left text-sm text-ink ${
                gender === 'women' ? 'bg-paper' : 'bg-transparent'
              } hover:bg-paper/3 transition-colors`}
            >
              Women
            </button>
            <button
              onClick={() => setGender('unisex')}
              className={`w-full px-3 py-2 rounded-md text-left text-sm text-ink ${
                gender === 'unisex' ? 'bg-paper' : 'bg-transparent'
              } hover:bg-paper/3 transition-colors`}
            >
              Unisex
            </button>
          </div>
        </div>

        {/* Stock Filter */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-medium text-ink uppercase tracking-wider">Availability</span>
          </div>
          <div className="space-y-1">
            <button
              onClick={() => setInStock(true)}
              className={`w-full px-3 py-2 rounded-md text-left text-sm text-ink/60 hover:text-ink transition-colors ${
                inStock ? 'bg-paper' : 'bg-transparent'
              }`}
            >
              In stock + Out of stock
            </button>
            <button
              onClick={() => setInStock(false)}
              className={`w-full px-3 py-2 rounded-md text-left text-sm text-ink ${
                !inStock ? 'bg-paper' : 'bg-transparent'
              } hover:bg-paper/3 transition-colors`}
            >
              Out of stock only
            </button>
          </div>
        </div>

        {/* Price Filter */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-medium text-ink uppercase tracking-wider">Price</span>
          </div>
          <div className="space-y-2">
            <div>
              <span className="text-[9px] text-muted uppercase tracking-wider">Min</span>
              <input
                type="number"
                min="0"
                value={minPrice || ''}
                onChange={(e) => onMinPriceChange(e.target.value || '')}
                className="w-full px-3 py-2 rounded-md bg-transparent text-sm text-ink border border-line focus:outline-none focus:ring-2 focus:ring-paper"
                placeholder="0"
              />
            </div>
            <div>
              <span className="text-[9px] text-muted uppercase tracking-wider">Max</span>
              <input
                type="number"
                min="0"
                value={maxPrice || ''}
                onChange={(e) => onMaxPriceChange(e.target.value || '')}
                className="w-full px-3 py-2 rounded-md bg-transparent text-sm text-ink border border-line focus:outline-none focus:ring-2 focus:ring-paper"
                placeholder="∞"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-3">
            <button
              onClick={handleApplyFilters}
              className="flex-1 px-4 py-2 rounded-md bg-paper text-ink text-sm font-medium hover:bg-paper/3 transition-colors u-focus"
            >
              Apply
            </button>
            <button
              onClick={clearAllFilters}
              className="flex-1 px-4 py-2 rounded-md border border-line text-ink text-sm font-medium hover:bg-paper/5 transition-colors u-focus"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Apply Button */}
        <div className="mt-6 pt-6 border-t border-line">
          <button
            onClick={handleApplyFilters}
            className="w-full px-4 py-3 rounded-md bg-paper text-ink text-sm font-medium uppercase tracking-wider hover:bg-paper/3 transition-colors u-focus"
            aria-label="Apply filters"
          >
            Apply filters
          </button>
        </div>
      </div>
    </div>
  );
}