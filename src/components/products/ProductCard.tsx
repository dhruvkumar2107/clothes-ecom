'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Heart, ShoppingBag, Eye } from 'lucide-react';
import { useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { useCartStore, useToast } from '@/app/providers';
import { apiPost } from '@/lib/api-client';

interface ProductCardProps {
  id: string;
  slug: string;
  name: string;
  subtitle?: string | null;
  basePrice: number;
  compareAtPrice?: number | null;
  images: { url: string; alt: string }[];
  gender?: string;
  occasion?: string;
  ratingAvg?: number;
  ratingCount?: number;
  variants: {
    id: string;
    size: string;
    color: string;
    colorHex: string;
    stock: number;
    reserved: number;
  }[];
  inStock: boolean;
  colors: string[];
  sizes: string[];
}

export function ProductCard({
  id,
  slug,
  name,
  subtitle,
  basePrice,
  compareAtPrice,
  images,
  variants,
  inStock,
  colors,
  sizes,
}: ProductCardProps) {
  const { openDrawer } = useCartStore();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);

  const firstImage = images[0]?.url;
  const hasDiscount = compareAtPrice && compareAtPrice > basePrice;
  const availableSizes = [...new Set(variants.filter(v => v.stock - v.reserved > 0).map(v => v.size))];
  const availableColors = [...new Set(variants.filter(v => v.stock - v.reserved > 0).map(v => v.color))];

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!inStock) {
      toast({ title: 'Unavailable', message: 'This product is out of stock', tone: 'warning' });
      return;
    }

    // Find first available variant
    const variant = variants.find(v => v.stock - v.reserved > 0);
    if (!variant) {
      toast({ title: 'Unavailable', message: 'No sizes available', tone: 'warning' });
      return;
    }

    setAdding(true);
    try {
      await apiPost('/api/cart', { variantId: variant.id, qty: 1 });
      openDrawer();
      toast({ title: 'Added to bag', message: `${name} added to your shopping bag`, tone: 'success' });
    } catch (error: any) {
      toast({ title: 'Error', message: error.message || 'Failed to add to bag', tone: 'danger' });
    } finally {
      setAdding(false);
    }
  };

  const handleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (wishlisted) return;
    
    try {
      await apiPost('/api/account/wishlist', { productId: id });
      setWishlisted(true);
      toast({ title: 'Saved', message: 'Added to your wishlist', tone: 'success' });
    } catch {
      toast({ title: 'Error', message: 'Failed to add to wishlist', tone: 'danger' });
    }
  };

  return (
    <article className="group relative bg-paper rounded-lg border border-line overflow-hidden transition-all duration-300 hover:shadow-lg u-focus">
      <Link
        href={`/products/${slug}`}
        className="block relative aspect-[3/4] overflow-hidden bg-paper-2"
        aria-label={`View ${name}`}
      >
        {firstImage ? (
          <Image
            src={firstImage}
            alt=""
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted">
            <ShoppingBag className="w-12 h-12" aria-hidden="true" />
          </div>
        )}

        {/* Wishlist Button */}
        <button
          onClick={handleWishlist}
          className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
            wishlisted ? 'bg-accent text-paper' : 'bg-paper/80 text-ink hover:bg-paper'
          }`}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart className={`w-5 h-5 ${wishlisted ? 'fill-current' : ''}`} aria-hidden="true" />
        </button>

        {/* Quick Add */}
        <button
          onClick={handleAddToCart}
          disabled={adding || !inStock}
          className={`absolute bottom-3 left-1/2 -translate-x-1/2 px-6 py-2.5 rounded-md text-sm font-medium transition-all duration-300 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 ${inStock ? 'bg-ink text-paper hover:bg-ink-2' : 'bg-muted text-paper/50 cursor-not-allowed'}`}
          aria-label={inStock ? `Add ${name} to bag` : 'Out of stock'}
        >
          {adding ? (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Adding...
            </span>
          ) : inStock ? (
            'Add to Bag'
          ) : (
            'Out of Stock'
          )}
        </button>

        {/* Badges */}
        {hasDiscount && (
          <span className="absolute top-3 left-3 px-2 py-1 text-xs font-medium bg-danger text-paper rounded">
            −{Math.round(((compareAtPrice! - basePrice) / compareAtPrice!) * 100)}%
          </span>
        )}
        {!inStock && (
          <span className="absolute top-3 left-3 px-2 py-1 text-xs font-medium bg-muted text-paper rounded">
            Sold Out
          </span>
        )}
      </Link>

      <div className="p-4">
        {subtitle && (
          <p className="u-label text-xs mb-1">{subtitle}</p>
        )}
        <h3 className="font-medium text-sm text-ink line-clamp-2 mb-2 group-hover:text-accent transition-colors">
          <Link href={`/products/${slug}`} className="hover:underline">{name}</Link>
        </h3>

        {/* Color swatches */}
        {availableColors.length > 1 && (
          <div className="flex gap-1.5 mb-2" aria-label="Available colors">
            {availableColors.slice(0, 5).map((color, i) => {
              const variant = variants.find(v => v.color === color && v.stock - v.reserved > 0);
              return (
                <button
                  key={i}
                  className="w-5 h-5 rounded-full border border-line/50 transition-transform hover:scale-110"
                  style={{ backgroundColor: variant?.colorHex || '#111' }}
                  aria-label={color}
                  disabled
                />
              );
            })}
            {availableColors.length > 5 && (
              <span className="w-5 h-5 rounded-full border border-line flex items-center justify-center text-[9px] text-muted">
                +{availableColors.length - 5}
              </span>
            )}
          </div>
        )}

        {/* Price */}
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-sm text-ink">
            {formatCurrency(basePrice)}
          </span>
          {hasDiscount && (
            <span className="text-sm text-muted line-through">
              {formatCurrency(compareAtPrice!)}
            </span>
          )}
        </div>

        {/* Size availability hint */}
        {availableSizes.length > 0 && (
          <p className="text-xs text-muted mt-2">
            {availableSizes.length === 1 ? '1 size' : `${availableSizes.length} sizes`} available
          </p>
        )}
      </div>
    </article>
  );
}