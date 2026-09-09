'use client';

import Link from 'next/link';
import { SmartImage } from '@/components/ui/SmartImage';
import { useState, useMemo, useCallback } from 'react';
import { formatCurrency } from '@/lib/utils';
import { useCartStore, useToast } from '@/app/providers';
import { apiPost } from '@/lib/api-client';
import { Heart, ShoppingBag } from 'lucide-react';

interface ProductCardProps {
  id: string;
  slug: string;
  name: string;
  subtitle?: string | null;
  basePrice: number;
  compareAtPrice?: number | null;
  images: { url: string; alt: string; kind?: string; colorKey?: string }[];
  gender?: string;
  occasion?: string | null;
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
  const [activeColor, setActiveColor] = useState<string>(colors[0] || '');
  const [hovered, setHovered] = useState(false);

  const hasDiscount = compareAtPrice && compareAtPrice > basePrice;

  const colorOptions = useMemo(() => {
    const seen = new Set<string>();
    return variants
      .filter((v) => {
        if (seen.has(v.color)) return false;
        seen.add(v.color);
        return v.stock - v.reserved > 0;
      })
      .map((v) => ({ color: v.color, colorHex: v.colorHex }));
  }, [variants]);

  const activeImage = useMemo(() => {
    const colorImage = images.find(
      (img) => img.colorKey?.toLowerCase() === activeColor.toLowerCase()
    );
    return colorImage || images[0];
  }, [images, activeColor]);

  const hoverImage = useMemo(() => {
    const secondImage = images.find(
      (img) => img.url !== activeImage?.url && (!img.colorKey || img.colorKey.toLowerCase() === activeColor.toLowerCase())
    );
    return secondImage || activeImage;
  }, [images, activeImage, activeColor]);

  const handleAddToCart = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!inStock) {
      toast({ title: 'Unavailable', message: 'This product is out of stock', tone: 'warning' });
      return;
    }

    const variant = variants.find(
      (v) => v.color === activeColor && v.stock - v.reserved > 0
    ) || variants.find((v) => v.stock - v.reserved > 0);

    if (!variant) {
      toast({ title: 'Unavailable', message: 'No sizes available', tone: 'warning' });
      return;
    }

    setAdding(true);
    try {
      await apiPost('/api/cart', { variantId: variant.id, qty: 1 });
      openDrawer();
      toast({ title: 'Added to bag', message: name + ' added to your shopping bag', tone: 'success' });
    } catch (error: any) {
      toast({ title: 'Error', message: error.message || 'Failed to add to bag', tone: 'danger' });
    } finally {
      setAdding(false);
    }
  }, [inStock, variants, activeColor, openDrawer, toast, name]);

  const handleWishlist = useCallback(async (e: React.MouseEvent) => {
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
  }, [wishlisted, id, toast]);

  return (
    <article
      className="group relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image Container */}
      <Link
        href={'/products/' + slug}
        className="block relative product-card-image u-focus"
        aria-label={'View ' + name}
      >
        {/* Primary Image */}
        <div className="absolute inset-0 transition-opacity duration-500" style={{ opacity: hovered && hoverImage?.url !== activeImage?.url ? 0 : 1 }}>
          {activeImage ? (
            <SmartImage
              src={activeImage.url}
              alt={activeImage.alt || name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              loading="lazy"
              placeholder="blur"
              blurDataURL="data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMjAnIGhlaWdodD0nMTYwJz48cmVjdCB3aWR0aD0nMTAwJScgaGVpZ2h0PScxMDAlJyBmaWxsPScjZjRmMWUnLz48L3N2Zz4="
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted">
              <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
          )}
        </div>

        {/* Hover Image */}
        {hoverImage && hoverImage.url !== activeImage?.url && (
          <div className="absolute inset-0 transition-opacity duration-500" style={{ opacity: hovered ? 1 : 0 }}>
            <SmartImage
              src={hoverImage.url}
              alt={hoverImage.alt || name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              loading="lazy"
            />
          </div>
        )}

        {/* Wishlist Button */}
        <button
          onClick={handleWishlist}
          className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 z-10 ${
            wishlisted
              ? 'bg-ink text-paper'
              : 'bg-paper/80 text-ink hover:bg-paper opacity-0 group-hover:opacity-100'
          }`}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart
            className={`w-4 h-4 transition-transform ${wishlisted ? 'fill-current scale-90' : ''}`}
            aria-hidden="true"
          />
        </button>

        {/* Quick Add */}
        <button
          onClick={handleAddToCart}
          disabled={adding || !inStock}
          className={`absolute bottom-0 left-0 right-0 py-3 text-center text-xs font-medium uppercase tracking-[0.12em] transition-all duration-300 z-10 ${
            inStock
              ? 'bg-ink text-paper hover:bg-ink-2 opacity-0 translate-y-full group-hover:opacity-100 group-hover:translate-y-0'
              : 'bg-muted/50 text-paper/50 cursor-not-allowed'
          }`}
          aria-label={inStock ? 'Add ' + name + ' to bag' : 'Out of stock'}
        >
          {adding ? 'Adding...' : inStock ? 'Quick Add' : 'Sold Out'}
        </button>

        {/* Badges */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
          {hasDiscount && (
            <span className="px-2 py-0.5 text-[10px] font-medium bg-ink text-paper uppercase tracking-wider">
              {'\u2212'}{Math.round(((compareAtPrice! - basePrice) / compareAtPrice!) * 100)}%
            </span>
          )}
          {!inStock && (
            <span className="px-2 py-0.5 text-[10px] font-medium bg-muted text-paper uppercase tracking-wider">
              Sold Out
            </span>
          )}
        </div>
      </Link>

      {/* Product Info */}
      <div className="pt-3">
        {/* Color Swatches */}
        {colorOptions.length > 1 && (
          <div className="flex gap-1.5 mb-2" role="radiogroup" aria-label="Available colors">
            {colorOptions.slice(0, 5).map((opt) => {
              const isActive = activeColor === opt.color;
              return (
                <button
                  key={opt.color}
                  onClick={(e) => { e.preventDefault(); setActiveColor(opt.color); }}
                  className={`w-3.5 h-3.5 rounded-full border transition-all duration-150 ${
                    isActive ? 'border-ink ring-1 ring-ink/20 ring-offset-1' : 'border-line hover:border-ink/40'
                  }`}
                  style={{ backgroundColor: opt.colorHex || '#808080' }}
                  aria-pressed={isActive}
                  aria-label={opt.color}
                />
              );
            })}
            {colorOptions.length > 5 && (
              <span className="text-[10px] text-muted">+{colorOptions.length - 5}</span>
            )}
          </div>
        )}

        {/* Product Name */}
        <h3 className="text-sm font-medium text-ink line-clamp-1 mb-0.5">
          <Link href={'/products/' + slug} className="hover:underline u-focus">
            {name}
          </Link>
        </h3>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-[11px] text-muted uppercase tracking-wider mb-1">{subtitle}</p>
        )}

        {/* Price */}
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-ink tabular-nums">{formatCurrency(basePrice)}</span>
          {hasDiscount && (
            <span className="text-xs text-muted line-through tabular-nums">{formatCurrency(compareAtPrice!)}</span>
          )}
        </div>
      </div>
    </article>
  );
}
