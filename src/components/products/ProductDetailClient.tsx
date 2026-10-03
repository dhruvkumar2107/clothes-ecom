'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { SmartImage } from '@/components/ui/SmartImage';
import { useProduct } from '@/app/providers';
import { useToast } from '@/app/providers';
import { apiPost } from '@/lib/api-client';
import { Heart, ShoppingBag, Loader2, X, ChevronDown, Search, Mail, Shield, Truck, Gift } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface Variant {
  id: string;
  size: string;
  color: string;
  colorHex: string;
  priceDelta: number;
  stock: number;
  reserved: number;
  lowStockThreshold: number;
}

interface ProductDetailProps {
  product: {
    id: string;
    slug: string;
    name: string;
    subtitle: string | null;
    description: string;
    story: string | null;
    careJson: string[];
    basePrice: number;
    compareAtPrice: number | null;
    fabric: string | null;
    occasion: string | null;
    fit: string | null;
    gender: string;
    hsnCode: string;
    gstRate: number;
    status: string;
    featured: boolean;
    spin360: boolean;
    arReady: boolean;
    ratingAvg: number;
    ratingCount: number;
    soldCount: number;
    viewCount: number;
    seoTitle: string | null;
    seoDescription: string | null;
    category: { id: string; slug: string; name: string };
    images: { id: string; url: string; alt: string; kind: string; colorKey: string | null; sortOrder: number }[];
    variants: Variant[];
    tags: any[];
    collections: any[];
    reviews: any[];
    wishlistedBy: any[];
    orderItems: any[];
    colors: { color: string; colorHex: string }[];
  };
}

export function ProductDetailClient({ product }: ProductDetailProps) {
  const { wishlisted, toggleWishlist } = useProduct(product.id);
  const { toast } = useToast();
  const router = useRouter();
  const [adding, setAdding] = useState(false);

  const [activeColor, setActiveColor] = useState<string>(product.colors[0]?.color || '');
  const [activeVariant, setActiveVariant] = useState<object | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [showZoom, setShowZoom] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Find the active variant based on active color
  const activeColorData = useMemo(() => {
    if (!activeColor) return null;
    return product.colors.find((c: any) => c.color === activeColor);
  }, [activeColor]);

  // Get the active variant for the selected color
  const currentVariant = useMemo(() => {
    if (!activeColorData) return product.variants[0];
    return product.variants.find((v) => v.color === activeColor) || product.variants[0];
  }, [activeColor]);

  // Compute current price
  const currentPrice = useMemo(() => {
    return currentVariant ? product.basePrice + currentVariant.priceDelta : product.basePrice;
  }, [activeColor, product.basePrice, currentVariant]);

  // Compute MRP (compare at price)
  const currentMRP = useMemo(() => {
    return currentVariant && product.compareAtPrice
      ? product.compareAtPrice
      : null;
  }, [currentVariant, product.compareAtPrice]);

  // Calculate discount percentage
  const discountPercent = useMemo(() => {
    if (!currentMRP || !currentPrice || currentMRP <= currentPrice) return 0;
    return Math.round(((currentMRP - currentPrice) / currentMRP) * 100);
  }, [currentPrice, currentMRP]);

  // Available sizes for active color
  const availableSizes = useMemo(() => {
    if (!activeColorData) return product.variants.map((v) => v.size).filter((s: string, i: number, arr: string[]) => arr.indexOf(s) === i);
    return [...new Set(product.variants.filter((v: any) => v.color === activeColor).map((v: any) => v.size))];
  }, [activeColor]);

  // Available colors
  const availableColors = useMemo(() => {
    return [...new Set(product.variants.map((v: any) => v.color))];
  }, []);

  // Handle color change
  const handleColorChange = useCallback((color: string) => {
    setActiveColor(color);
    setActiveVariant(product.variants.find((v) => v.color === color) || product.variants[0]);
    setQuantity(1);
  }, [product.variants]);

  // Handle add to cart
  const handleAddToCart = useCallback(async () => {
    if (!currentVariant) {
      toast({ title: 'Error', message: 'No variant selected', tone: 'danger' });
      return;
    }

    const sellable = currentVariant.stock - currentVariant.reserved;
    if (sellable <= 0) {
      toast({ title: 'Unavailable', message: 'This product is out of stock', tone: 'warning' });
      return;
    }

    setAdding(true);
    try {
      await apiPost('/api/cart', {
        variantId: currentVariant.id,
        qty: quantity,
      });
      setAdding(false);
      router.push('/cart');
      toast({ title: 'Added to bag', message: product.name + ' added to your shopping bag', tone: 'success' });
    } catch (error: any) {
      setAdding(false);
      toast({ title: 'Error', message: error.message || 'Failed to add to bag', tone: 'danger' });
    }
  }, [currentVariant, quantity, product.name, toast, router]);

  // Handle buy now
  const handleBuyNow = useCallback(async () => {
    if (!currentVariant) {
      toast({ title: 'Error', message: 'No variant selected', tone: 'danger' });
      return;
    }

    // Navigate to checkout with this product
    const sellable = currentVariant.stock - currentVariant.reserved;
    if (sellable <= 0) {
      toast({ title: 'Unavailable', message: 'This product is out of stock', tone: 'warning' });
      return;
    }

    router.push('/cart');
  }, [currentVariant, router, toast]);

  // Handle wishlist
  const handleWishlist = useCallback(async () => {
    try {
      await apiPost('/api/account/wishlist', { productId: product.id });
      setShowWishlist(true);
      toast({ title: 'Saved', message: 'Added to your wishlist', tone: 'success' });
    } catch {
      toast({ title: 'Error', message: 'Failed to add to wishlist', tone: 'danger' });
    }
  }, [product.id, toast]);

  // Handle quantity change
  const handleQtyChange = useCallback((delta: number) => {
    setQuantity(prev => Math.max(1, Math.min(prev + delta, 10)));
  }, []);

  // Size guide data
  const sizeGuideData = useMemo(() => {
    // Would normally fetch from product or DB
    return {
      title: 'Size Guide',
      instructions: 'Measure over undergarments.',
      chart: [
        { label: 'XS', chest: '82cm', waist: '64cm', hip: '90cm' },
        { label: 'S', chest: '86cm', waist: '68cm', hip: '94cm' },
        { label: 'M', chest: '90cm', waist: '72cm', hip: '98cm' },
        { label: 'L', chest: '96cm', waist: '78cm', hip: '104cm' },
        { label: 'XL', chest: '102cm', waist: '84cm', hip: '110cm' },
      ],
    };
  }, []);

  return (
    <div className="min-h-screen">
      {/* Product Breadcrumbs */}
      <nav aria-label="Product breadcrumbs" className="bg-paper/50 border-b border-line">
        <div className="u-container max-w-2xl mx-auto px-4 py-3">
          <ol className="flex items-center gap-1 text-sm text-paper/60">
            <li>
              <Link href="/" className="hover:text-ink u-focus">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/products" className="hover:text-ink u-focus">
                Products
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-paper">{product.name}</li>
          </ol>
        </div>
      </nav>

      {/* Product Main Content */}
      <div className="u-container">
        {/* Image Gallery */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Main Product Image */}
          <div className="relative group">
            {/* LQIP Placeholder */}
            <div
              className="aspect-w-4 aspect-h-6 rounded-lg overflow-hidden bg-paper-2 border border-line mb-4"
              style={{
                backgroundImage: activeColorData
                  ? `url('${activeColorData.colorHex}')`
                  : undefined,
              }}
            >
              {activeColorData && (
                <span className="absolute inset-0 flex items-center justify-center text-paper/20 text-xs uppercase tracking-wider">
                  {activeColorData.color}
                </span>
              )}
            </div>

            {/* Main Product Image */}
            <SmartImage
              src={product.images[0]?.url || ''}
              alt={product.name}
              className="rounded-lg overflow-hidden transition-transform duration-300 group-hover:scale-[1.02]"
              fill
              sizes="(max-width: 768px) 100vw, 66vw"
              loading="lazy"
              fetchPriority="high"
            />

            {/* Zoom Icon */}
            {product.spin360 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowZoom(!showZoom);
                }}
                className="absolute top-4 right-4 p-2 rounded-full bg-paper/80 backdrop-blur-sm hover:bg-paper/90 transition-colors z-10"
                aria-label="View 360°"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 3a1 1 0 0 1 1 1v6h2V4a1 1 0 1 1 2 0v6h-2v-2h2v-4h-2V3zm-6 0a1 1 0 0 1 1 1v6H5v4a1 1 0 1 1-2 0v6H3a1 1 0 1 1 0-2v6H3a1 1 0 0 1 0-2v-4H1v2h2v4h2V3h6v4h2V3h-2z" />
                </svg>
              </button>
            )}

            {/* Favored Color Badge */}
            {activeColorData && (
              <div
                className="absolute bottom-3 left-3 flex items-center gap-2 bg-ink/80 backdrop-blur-sm px-3 py-1.5 rounded-md text-sm font-medium text-paper"
              >
                {activeColorData.color}
              </div>
            )}

            {/* Quick View Color Swatches */}
            {availableColors.length > 1 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 pt-2">
                {availableColors.slice(0, 5).map((c: any, i: number) => (
                  <button
                    key={c}
                    onClick={() => handleColorChange(c)}
                    className={`w-6 h-6 rounded-full ${
                      activeColor === c ? 'border-ink ring-2 ring-paper' : 'border-line'
                    } transition-colors`}
                    style={{ backgroundColor: c.colorHex || '#808080' }}
                    aria-pressed={activeColor === c}
                    aria-label={c}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Thumbnail Gallery */}
          <div className="space-y-3">
            {product.images.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveColor(product.colors[0]?.color || availableColors[0])}
                className={`flex flex-col items-center gap-1.5 px-2 py-2 rounded-lg border ${
                  activeColorData && activeColorData.color === img.colorKey
                    ? 'border-ink ring-1 ring-paper/20'
                    : 'border-transparent'
                } transition-colors`}
                style={{ background: img.colorKey ? `linear-gradient(135deg, ${img.colorKey} 0%, ${product.colors.find((c: any) => c.color === img.colorKey)?.colorHex || '#808080'} 100%)` : 'transparent' }}
                aria-label={`Product image ${i + 1}`}
                aria-pressed={!!activeColorData && activeColorData.color === img.colorKey}
              >
                <SmartImage
                  src={img.url}
                  alt={img.alt || product.name}
                  className="w-20 h-24 object-cover rounded-md"
                  sizes="auto"
                />
              </button>
            ))}
          </div>
        </div>

        {/* Product Info Side */}
        <div className="lg:col-span-2">
          {/* Product Name and Rating */}
          <div className="mb-6">
            <h1 className="u-display text-3xl md:text-4xl font-light text-ink mb-2">
              {product.name}
            </h1>
            {product.subtitle && (
              <p className="text-sm text-paper/60 mb-4">{product.subtitle}</p>
            )}

            {/* Rating */}
            <div className="flex items-center gap-2 mb-4">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  className="w-4 h-4"
                  fill={i < product.ratingAvg ? '#9c7c4e' : 'none'}
                  stroke="#9c7c4e"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                  />
                </svg>
              ))}
              <span className="text-xs text-paper/60 ml-2">({product.ratingCount} reviews)</span>
            </div>

            {/* Price Display */}
            <div className="flex items-baseline gap-4">
              {/* Current Price */}
              <div>
                <span className="text-5xl font-light tabular-nums text-ink">{formatCurrency(currentPrice)}</span>
              </div>

              {/* MRP and Discount */}
              {currentMRP && currentPrice < currentMRP && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-paper/60 line-through">Rs. {formatCurrency(currentMRP)}</span>
                  <span className="text-xs font-medium text-danger">
                    {discountPercent}% off
                  </span>
                </div>
              )}

              {/* In Stock Status */}
              {currentVariant && currentVariant.stock > 0 && (
                <span className="text-paper/60 text-xs">
                  {currentVariant.stock - currentVariant.reserved > 0 ? 'In stock' : 'Limited stock'}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mb-8">
            {/* Quantity Selector */}
            <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-paper-2 rounded-lg">
              <button
                onClick={() => handleQtyChange(-1)}
                disabled={quantity <= 1}
                className="w-10 h-10 rounded-lg bg-paper flex items-center justify-center hover:bg-paper/3 transition-colors"
                aria-label="Decrease quantity"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15 18l-6-6l6-6" />
                </svg>
              </button>
              <span className="font-medium text-ink">{quantity}</span>
              <button
                onClick={() => handleQtyChange(1)}
                disabled={quantity >= 10}
                className="w-10 h-10 rounded-lg bg-paper flex items-center justify-center hover:bg-paper/3 transition-colors"
                aria-label="Increase quantity"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 12l6 6l-6 6" />
                </svg>
              </button>
            </div>

            {/* Action Buttons Row */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Add to Bag Button */}
              <button
                onClick={handleAddToCart}
                className={`w-full sm:w-auto px-5 py-3 rounded-md bg-ink text-paper text-sm font-medium uppercase tracking-wider hover:bg-paper/3 transition-colors focus:outline-none focus:ring-2 focus:ring-paper ${adding ? 'opacity-80 not-allowed' : ''}`}
                disabled={adding}
                aria-busy={adding}
              >
                {adding ? 'Adding...' : 'Add to Bag'}
              </button>

              {/* Buy Now Button */}
              <Link href="/cart">
                <button
                  onClick={handleBuyNow}
                  className={`w-full sm:w-auto px-5 py-3 rounded-md border border-ink text-ink text-sm font-medium uppercase tracking-wider hover:bg-paper/3 transition-colors focus:outline-none focus:ring-2 focus:ring-paper`}
                >
                  Buy Now
                </button>
              </Link>
            </div>

            {/* Share Wishlist Buttons */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleWishlist}
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  wishlisted ? 'bg-ink text-paper' : 'bg-paper/80 text-ink hover:bg-paper'
                } transition-colors`}
                aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                <Heart
                  className={`w-4 h-4 transition-transform ${wishlisted ? 'fill-current scale-90' : ''}`}
                  aria-hidden="true"
                />
              </button>
              <button
                onClick={() => setShowShare(!showShare)}
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  showShare ? 'bg-ink text-paper' : 'bg-paper/80 text-ink hover:bg-paper'
                } transition-colors`}
                aria-label="Share"
              >
                <Search className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Product Information */}
          <div className="space-y-4 text-paper/70 text-sm">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" aria-hidden="true" />
              <span>Secure payment</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4" aria-hidden="true" />
              <span>Free shipping on orders above ₹2,999</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4" aria-hidden="true" />
              <span>Easy 14-day returns</span>
            </div>
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4" aria-hidden="true" />
              <span>Gift wrapping available</span>
            </div>
          </div>

          {/* Story and Care */}
          {product.story && (
            <div className="pt-6 border-t border-line">
              <h2 className="u-label text-accent text-xs uppercase tracking-wider mb-4">Story</h2>
              <p className="leading-relaxed">{product.story}</p>
            </div>
          )}

          {product.careJson && product.careJson.length > 0 && (
            <div className="pt-6 border-t border-line">
              <h2 className="u-label text-accent text-xs uppercase tracking-wider mb-4">Care Instructions</h2>
              <ul className="space-y-2 text-paper/70">
                {product.careJson.map((care, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-accent font-medium">•</span>
                    <span dangerouslySetInnerHTML={{ __html: care }} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Complete the Look / Similar Products */}
        <div className="mt-8 pt-8 border-t border-line">
          <h2 className="u-label text-accent text-xs uppercase tracking-wider mb-4">Complete the Look</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {product.collections?.length > 0 && product.collections.slice(0, 4).map((col: any) => (
              <div key={col.id}>
                <Link href={`/collections/${col.slug}`}>
                  <SmartImage
                    src={col.heroImage || product.images[0]?.url}
                    alt={col.name}
                    className="rounded-lg overflow-hidden aspect-[3/4]">
                  </SmartImage>
                </Link>
                <p className="text-xs mt-2 line-clamp-2">
                  {col.name}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}