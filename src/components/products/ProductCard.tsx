'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Heart, ShoppingBag, Eye, Shirt, Camera } from 'lucide-react';
import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '@/lib/utils';
import { useCartStore, useToast } from '@/app/providers';
import { apiPost } from '@/lib/api-client';
import { FabricSwipe } from './FabricSwipe';
import { HangerToModel } from './HangerToModel';

interface ProductCardProps {
  id: string;
  slug: string;
  name: string;
  subtitle?: string | null;
  basePrice: number;
  compareAtPrice?: number | null;
  images: { url: string; alt: string; kind?: string; colorKey?: string }[];
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
  const [hoveredColor, setHoveredColor] = useState<string | null>(null);
  const [activeColor, setActiveColor] = useState<string>(colors[0] || '');
  const [viewMode, setViewMode] = useState<'model' | 'flat'>('model');
  const [imageLoaded, setImageLoaded] = useState(false);

  const hasDiscount = compareAtPrice && compareAtPrice > basePrice;

  // Get unique colors with hex values
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

  // Find image for active color
  const activeImage = useMemo(() => {
    const colorImage = images.find(
      (img) => img.colorKey?.toLowerCase() === activeColor.toLowerCase()
    );
    return colorImage || images[0];
  }, [images, activeColor]);

  // Find flat-lay image
  const flatLayImage = useMemo(() => {
    return images.find((img) => img.kind === 'flat') || null;
  }, [images]);

  const displayImage = viewMode === 'flat' && flatLayImage ? flatLayImage : activeImage;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!inStock) {
      toast({ title: 'Unavailable', message: 'This product is out of stock', tone: 'warning' });
      return;
    }

    // Find first available variant for the selected color
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
        {/* Main product image with Fabric Swipe on color change */}
        <div className="absolute inset-0">
          {activeColor && images.some((img) => img.colorKey) ? (
            <FabricSwipe
              images={images}
              selectedColor={activeColor}
              productName={name}
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${displayImage?.url}-${viewMode}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0"
              >
                {displayImage ? (
                  <Image
                    src={displayImage.url}
                    alt={displayImage.alt || name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    loading="lazy"
                    onLoad={() => setImageLoaded(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted">
                    <ShoppingBag className="w-12 h-12" aria-hidden="true" />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Model/Flat-lay toggle */}
        {flatLayImage && (
          <div
            className="absolute top-3 left-3 z-10 flex bg-paper/80 backdrop-blur-sm rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setViewMode('model');
              }}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                viewMode === 'model' ? 'bg-ink text-paper' : 'text-ink hover:bg-ink/10'
              }`}
              aria-label="View on model"
            >
              <Camera className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setViewMode('flat');
              }}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                viewMode === 'flat' ? 'bg-ink text-paper' : 'text-ink hover:bg-ink/10'
              }`}
              aria-label="View flat lay"
            >
              <Shirt className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Wishlist Button */}
        <button
          onClick={handleWishlist}
          className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 z-10 ${
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
          className={`absolute bottom-3 left-1/2 -translate-x-1/2 px-6 py-2.5 rounded-md text-sm font-medium transition-all duration-300 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 z-10 ${
            inStock ? 'bg-ink text-paper hover:bg-ink-2' : 'bg-muted text-paper/50 cursor-not-allowed'
          }`}
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
          <span className="absolute top-3 left-3 px-2 py-1 text-xs font-medium bg-danger text-paper rounded z-10">
            −{Math.round(((compareAtPrice! - basePrice) / compareAtPrice!) * 100)}%
          </span>
        )}
        {!inStock && (
          <span className="absolute top-3 left-3 px-2 py-1 text-xs font-medium bg-muted text-paper rounded z-10">
            Sold Out
          </span>
        )}

        {/* Hover zoom indicator */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-paper/80 backdrop-blur-sm rounded-full p-3">
            <Eye className="w-5 h-5 text-ink" aria-hidden="true" />
          </div>
        </div>
      </Link>

      <div className="p-4">
        {subtitle && (
          <p className="u-label text-xs mb-1">{subtitle}</p>
        )}
        <h3 className="font-medium text-sm text-ink line-clamp-2 mb-2 group-hover:text-accent transition-colors">
          <Link href={`/products/${slug}`} className="hover:underline">{name}</Link>
        </h3>

        {/* Interactive color swatches */}
        {colorOptions.length > 1 && (
          <div className="flex gap-1.5 mb-2" role="radiogroup" aria-label="Available colors">
            {colorOptions.slice(0, 6).map((opt) => {
              const isActive = activeColor === opt.color;
              const isHovered = hoveredColor === opt.color;
              return (
                <button
                  key={opt.color}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveColor(opt.color);
                  }}
                  onMouseEnter={() => setHoveredColor(opt.color)}
                  onMouseLeave={() => setHoveredColor(null)}
                  className={`relative w-6 h-6 rounded-full border-2 transition-all duration-200 ${
                    isActive
                      ? 'border-ink scale-110 ring-2 ring-ink/20'
                      : 'border-line/50 hover:scale-110 hover:border-ink/50'
                  }`}
                  style={{ backgroundColor: opt.colorHex || '#111' }}
                  aria-pressed={isActive}
                  aria-label={opt.color}
                >
                  {isActive && (
                    <motion.div
                      layoutId={`color-indicator-${id}`}
                      className="absolute inset-0 rounded-full border-2 border-ink"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
            {colorOptions.length > 6 && (
              <span className="w-6 h-6 rounded-full border border-line flex items-center justify-center text-[9px] text-muted">
                +{colorOptions.length - 6}
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
        {sizes.length > 0 && (
          <p className="text-xs text-muted mt-2">
            {sizes.length === 1 ? '1 size' : `${sizes.length} sizes`} available
          </p>
        )}
      </div>
    </article>
  );
}
