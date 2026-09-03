'use client';

import Link from 'next/link';
import { SmartImage } from '@/components/ui/SmartImage';
import { useState, useMemo, useCallback } from 'react';
import { formatCurrency } from '@/lib/utils';
import { useCartStore, useToast } from '@/app/providers';
import { apiPost } from '@/lib/api-client';

interface FabricSwipeProps {
  images: { url: string; alt: string; kind?: string; colorKey?: string }[];
  selectedColor: string;
  productName: string;
}

function FabricSwipe({ images, selectedColor, productName }: FabricSwipeProps) {
  const colorImage = images.find(
    (img) => img.colorKey?.toLowerCase() === selectedColor.toLowerCase()
  );
  const activeImage = colorImage || images[0];

  if (!activeImage) return null;

  return (
    <div className="absolute inset-0 overflow-hidden">
      <SmartImage
        src={activeImage.url}
        alt={activeImage.alt || productName}
        fill
        className="object-cover animate-fade-in"
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        loading="lazy"
        placeholder="blur"
        blurDataURL="data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMjAnIGhlaWdodD0nMTYwJz48cmVjdCB3aWR0aD0nMTAwJScgaGVpZ2h0PScxMDAlJyBmaWxsPScjZjRmMmVjJy8+PHJlY3Qgd2lkdGg9JzYwJScgaGVpZ2h0PSc4MCUnIHg9JzIwJScgeT0nMTAlJyBmaWxsPScjZWJlOGUwJyByeD0nNicvPjwvc3ZnPg=="
      />
    </div>
  );
}

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
  const [viewMode, setViewMode] = useState<'model' | 'flat'>('model');
  const [imageLoaded, setImageLoaded] = useState(false);

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

  const flatLayImage = useMemo(() => {
    return images.find((img) => img.kind === 'flat') || null;
  }, [images]);

  const displayImage = viewMode === 'flat' && flatLayImage ? flatLayImage : activeImage;

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

  const sizeLabel = sizes.length === 1 ? '1 size' : sizes.length + ' sizes';

  return (
    <article className="group relative bg-paper overflow-hidden u-focus">
      <Link
        href={'/products/' + slug}
        className="block relative aspect-[3/4] overflow-hidden bg-paper-2"
        aria-label={'View ' + name}
      >
        <div className="absolute inset-0">
          {activeColor && images.some((img) => img.colorKey) ? (
            <FabricSwipe
              images={images}
              selectedColor={activeColor}
              productName={name}
            />
          ) : (
            <div key={(displayImage?.url || '') + '-' + viewMode} className="absolute inset-0 animate-fade-in">
              {displayImage ? (
                <SmartImage
                  src={displayImage.url}
                  alt={displayImage.alt || name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  loading="lazy"
                  placeholder="blur"
                  blurDataURL="data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMjAnIGhlaWdodD0nMTYwJz48cmVjdCB3aWR0aD0nMTAwJScgaGVpZ2h0PScxMDAlJyBmaWxsPScjZjRmMmVjJy8+PHJlY3Qgd2lkdGg9JzYwJScgaGVpZ2h0PSc4MCUnIHg9JzIwJScgeT0nMTAlJyBmaWxsPScjZWJlOGUwJyByeD0nNicvPjwvc3ZnPg=="
                  onLoad={() => setImageLoaded(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted">
                  <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
              )}
            </div>
          )}
        </div>

        {flatLayImage && (
          <div
            className="absolute top-3 left-3 z-10 flex bg-paper/80 backdrop-blur-sm rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setViewMode('model'); }}
              className={'w-7 h-7 rounded-full flex items-center justify-center transition-all ' + (viewMode === 'model' ? 'bg-ink text-paper' : 'text-ink hover:bg-ink/10')}
              aria-label="View on model"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </button>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setViewMode('flat'); }}
              className={'w-7 h-7 rounded-full flex items-center justify-center transition-all ' + (viewMode === 'flat' ? 'bg-ink text-paper' : 'text-ink hover:bg-ink/10')}
              aria-label="View flat lay"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.38 3.46L16 2 12 3.46 8 2 3.62 3.46a2 2 0 00-1.34 1.89v13.3a2 2 0 002.66 1.89L8 19l4-1.46L16 19l4.38-1.46a2 2 0 001.34-1.89V5.35a2 2 0 00-1.34-1.89z"/><line x1="12" y1="2" x2="12" y2="17.54"/></svg>
            </button>
          </div>
        )}

        <button
          onClick={handleWishlist}
          className={'absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 z-10 ' + (wishlisted ? 'bg-accent text-paper scale-110' : 'bg-paper/80 text-ink hover:bg-paper hover:scale-110')}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <svg className={'w-5 h-5 transition-transform ' + (wishlisted ? 'fill-current scale-90' : '')} viewBox="0 0 24 24" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
        </button>

        <button
          onClick={handleAddToCart}
          disabled={adding || !inStock}
          className={'absolute bottom-3 left-1/2 -translate-x-1/2 px-6 py-2.5 rounded-md text-sm font-medium transition-all duration-200 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 z-10 ' + (inStock ? 'bg-ink text-paper hover:bg-ink-2 active:scale-95' : 'bg-muted text-paper/50 cursor-not-allowed')}
          aria-label={inStock ? 'Add ' + name + ' to bag' : 'Out of stock'}
        >
          {adding ? (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
              Adding...
            </span>
          ) : inStock ? 'Add to Bag' : 'Out of Stock'}
        </button>

        {hasDiscount && (
          <span className="absolute top-3 left-3 px-2 py-1 text-xs font-medium bg-danger text-paper rounded z-10">
            {'\u2212'}{Math.round(((compareAtPrice! - basePrice) / compareAtPrice!) * 100)}%
          </span>
        )}
        {!inStock && !hasDiscount && (
          <span className="absolute top-3 left-3 px-2 py-1 text-xs font-medium bg-muted text-paper rounded z-10">
            Sold Out
          </span>
        )}

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-paper/80 backdrop-blur-sm rounded-full p-3">
            <svg className="w-5 h-5 text-ink" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
        </div>
      </Link>

      <div className="p-3 md:p-4">
        {subtitle && <p className="u-label text-[10px] mb-0.5">{subtitle}</p>}
        <h3 className="font-medium text-sm text-ink line-clamp-1 mb-1">
          <Link href={'/products/' + slug} className="hover:underline">{name}</Link>
        </h3>

        {colorOptions.length > 1 && (
          <div className="flex gap-1 mb-2" role="radiogroup" aria-label="Available colors">
            {colorOptions.slice(0, 6).map((opt) => {
              const isActive = activeColor === opt.color;
              return (
                <button
                  key={opt.color}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveColor(opt.color); }}
                  className={'w-4 h-4 rounded-full border transition-all duration-150 ' + (isActive ? 'border-ink ring-1 ring-ink/20' : 'border-line hover:border-ink/50')}
                  style={{ backgroundColor: opt.colorHex || '#808080' }}
                  aria-pressed={isActive}
                  aria-label={opt.color}
                />
              );
            })}
            {colorOptions.length > 6 && (
              <span className="w-4 h-4 rounded-full border border-line flex items-center justify-center text-[8px] text-muted">
                +{colorOptions.length - 6}
              </span>
            )}
          </div>
        )}

        <div className="flex items-baseline gap-2">
          <span className="font-medium text-sm text-ink">{formatCurrency(basePrice)}</span>
          {hasDiscount && (
            <span className="text-xs text-muted line-through">{formatCurrency(compareAtPrice!)}</span>
          )}
        </div>
      </div>
    </article>
  );
}
