'use client';

import { useState, useEffect, useCallback, lazy, Suspense, useRef } from 'react';
import { SmartImage } from '@/components/ui/SmartImage';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, ShoppingBag, Truck, RotateCcw, Shield, ChevronRight, X, ZoomIn, Share2, Minus, Plus } from 'lucide-react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { useToast } from '@/app/providers';
import { apiPost } from '@/lib/api-client';
import { formatCurrency } from '@/lib/utils';

const FabricZoomViewer = lazy(() => import('./FabricZoomViewer').then(m => ({ default: m.FabricZoomViewer })));
const FitPredictor = lazy(() => import('./FitPredictor').then(m => ({ default: m.FitPredictor })));
const AIStylist = lazy(() => import('./AIStylist').then(m => ({ default: m.AIStylist })));
const ShopTheLook = lazy(() => import('./ShopTheLook').then(m => ({ default: m.ShopTheLook })));

interface SizeOption {
  id: string;
  sku: string;
  size: string;
  price: number;
  stock: number;
  lowStock: boolean;
}

interface ColorOption {
  color: string;
  colorHex: string;
  sizes: SizeOption[];
}

interface ProductData {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  description: string;
  story: string | null;
  care: string[];
  basePrice: number;
  compareAtPrice: number | null;
  fabric: string | null;
  occasion: string | null;
  fit: string | null;
  gender: string;
  images: { id: string; url: string; alt: string; kind: string; colorKey: string | null; sortOrder: number }[];
  colors: ColorOption[];
  sizeGuide: { id: string; name: string; unit: string; columns: string[]; rows: string[][]; notes: string | null } | null;
  ratingAvg: number;
  ratingCount: number;
  sustainability?: {
    fabricOrigin?: string;
    certifications?: string[];
    organicContent?: number;
    recycledContent?: number;
    recyclable?: boolean;
    biodegradable?: boolean;
    ethicalFactory?: string;
    waterUsage?: string;
    carbonFootprint?: string;
  } | null;
  shopTheLook?: {
    name: string;
    items: {
      id: string;
      slug: string;
      name: string;
      basePrice: number;
      imageUrl: string | null;
      color: string;
      position: { x: number; y: number };
    }[];
  } | null;
}

interface ProductDetailClientProps {
  product: ProductData;
}

export function ProductDetailClient({ product }: ProductDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedColor, setSelectedColor] = useState(product.colors[0]?.color || '');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [showZoom, setShowZoom] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const addToCartRef = useRef<HTMLDivElement>(null);

  const currentColor = product.colors.find(c => c.color === selectedColor);
  const availableSizes = currentColor?.sizes || [];
  const selectedSizeData = availableSizes.find(s => s.size === selectedSize);

  useEffect(() => {
    if (availableSizes.length > 0) {
      const inStock = availableSizes.find(s => s.stock > 0);
      setSelectedSize(inStock ? inStock.size : availableSizes[0].size);
    } else {
      setSelectedSize('');
    }
  }, [selectedColor, availableSizes]);

  // Sticky add-to-bag bar
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyBar(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    if (addToCartRef.current) {
      observer.observe(addToCartRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const colorImages = product.images.filter(
    img => img.kind === 'gallery' && (!img.colorKey || img.colorKey.toLowerCase() === selectedColor.toLowerCase())
  );
  const displayImages = colorImages.length > 0 ? colorImages : product.images.filter(img => img.kind === 'gallery');

  // Preload adjacent images
  useEffect(() => {
    const preloadImage = (src: string) => {
      const img = new window.Image();
      img.src = src;
    };
    if (displayImages[activeImage + 1]) preloadImage(displayImages[activeImage + 1].url);
    if (activeImage > 0 && displayImages[activeImage - 1]) preloadImage(displayImages[activeImage - 1].url);
  }, [activeImage, displayImages]);

  // Scroll thumbnail into view
  useEffect(() => {
    if (thumbnailRefs.current[activeImage]) {
      thumbnailRefs.current[activeImage]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeImage]);

  const handleAddToCart = useCallback(async () => {
    if (!selectedSizeData) {
      toast({ title: 'Select a size', message: 'Please choose a size before adding to bag', tone: 'warning' });
      return;
    }
    if (selectedSizeData.stock < qty) {
      toast({ title: 'Limited stock', message: 'Only ' + selectedSizeData.stock + ' available', tone: 'warning' });
      return;
    }
    setAdding(true);
    try {
      await apiPost('/api/cart', { variantId: selectedSizeData.id, qty });
      toast({ title: 'Added to bag', message: product.name + ' added to your shopping bag', tone: 'success' });
    } catch (error: any) {
      toast({ title: 'Error', message: error.message || 'Failed to add to bag', tone: 'danger' });
    } finally {
      setAdding(false);
    }
  }, [selectedSizeData, qty, product.name, toast]);

  const handleWishlist = useCallback(async () => {
    if (wishlisted) return;
    try {
      await apiPost('/api/account/wishlist', { productId: product.id });
      setWishlisted(true);
      toast({ title: 'Saved', message: 'Added to your wishlist', tone: 'success' });
    } catch {
      toast({ title: 'Error', message: 'Failed to add to wishlist', tone: 'danger' });
    }
  }, [wishlisted, product.id, toast]);

  const handleBuyNow = useCallback(async () => {
    if (!selectedSizeData) {
      toast({ title: 'Select a size', message: 'Please choose a size', tone: 'warning' });
      return;
    }
    await handleAddToCart();
    router.push('/checkout');
  }, [selectedSizeData, handleAddToCart, router, toast]);

  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.basePrice;
  const currentPrice = selectedSizeData?.price ?? product.basePrice;

  return (
    <div className="py-6 md:py-10">
      <div className="u-container">
        {/* Breadcrumb */}
        <nav className="mb-6 md:mb-8" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-xs text-muted flex-wrap">
            <li><Link href="/" className="hover:text-ink transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/products" className="hover:text-ink transition-colors">Shop</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href={`/products?category=${product.gender}`} className="hover:text-ink transition-colors capitalize">{product.gender}</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-ink font-medium truncate max-w-[200px]">{product.name}</li>
          </ol>
        </nav>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-14">
          {/* Image Gallery */}
          <div className="relative">
            {/* Main Image */}
            <div className="aspect-[3/4] rounded-lg overflow-hidden bg-paper-2 relative">
              <div key={displayImages[activeImage]?.id || ''} className="absolute inset-0 animate-fade-in">
                {displayImages[activeImage] ? (
                  <SmartImage
                    src={displayImages[activeImage].url}
                    alt={displayImages[activeImage].alt || product.name}
                    fill
                    priority
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    placeholder="blur"
                    blurDataURL="data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc0MDAnIGhlaWdodD0nNTMzJz48cmVjdCB3aWR0aD0nMTAwJScgaGVpZ2h0PScxMDAlJyBmaWxsPScjZjRmMWUnLz48L3N2Zz4="
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted">
                    <ShoppingBag className="w-16 h-16" aria-hidden="true" />
                  </div>
                )}
              </div>

              {/* Zoom Button */}
              <button
                onClick={() => setShowZoom(true)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-paper/80 backdrop-blur-sm flex items-center justify-center hover:bg-paper transition-colors u-focus opacity-0 group-hover:opacity-100"
                aria-label="Zoom image"
              >
                <ZoomIn className="w-5 h-5" aria-hidden="true" />
              </button>

              {/* Wishlist */}
              <button
                onClick={handleWishlist}
                className={`absolute top-4 left-4 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                  wishlisted ? 'bg-ink text-paper' : 'bg-paper/80 text-ink hover:bg-paper'
                }`}
                aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                <Heart className={`w-5 h-5 transition-transform ${wishlisted ? 'fill-current scale-90' : ''}`} aria-hidden="true" />
              </button>

              {/* Image Counter */}
              <div className="absolute bottom-4 left-4 px-3 py-1 bg-ink/50 backdrop-blur-sm rounded-full text-[11px] text-paper font-medium">
                {activeImage + 1} / {displayImages.length}
              </div>
            </div>

            {/* Thumbnails */}
            {displayImages.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
                {displayImages.map((img, i) => (
                  <button
                    key={img.id}
                    ref={(el) => { thumbnailRefs.current[i] = el; }}
                    onClick={() => setActiveImage(i)}
                    className={`flex-shrink-0 w-16 h-20 rounded overflow-hidden border-2 transition-all duration-200 ${
                      i === activeImage ? 'border-ink' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                    aria-label={'View image ' + (i + 1)}
                    aria-current={i === activeImage ? 'true' : 'false'}
                  >
                    <SmartImage
                      src={img.url}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="64px"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Zoom Modal */}
          {showZoom && (
            <div className="fixed inset-0 z-[200] bg-ink/95 flex items-center justify-center p-4" onClick={() => setShowZoom(false)} role="dialog" aria-modal="true" aria-label="Image zoom">
              <button onClick={() => setShowZoom(false)} className="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors u-focus" aria-label="Close zoom">
                <X className="w-6 h-6 text-paper" aria-hidden="true" />
              </button>
              <div className="max-w-5xl max-h-[90vh] relative">
                <SmartImage
                  src={displayImages[activeImage].url}
                  alt={displayImages[activeImage].alt || product.name}
                  width={1200}
                  height={1600}
                  className="max-w-full max-h-[90vh] object-contain"
                  priority
                />
              </div>
              <button onClick={() => setActiveImage((activeImage - 1 + displayImages.length) % displayImages.length)} className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors u-focus" aria-label="Previous image">
                <svg className="w-6 h-6 text-paper" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button onClick={() => setActiveImage((activeImage + 1) % displayImages.length)} className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors u-focus" aria-label="Next image">
                <ChevronRight className="w-6 h-6 text-paper" />
              </button>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-ink/60 backdrop-blur-sm rounded-full text-sm text-paper">
                {activeImage + 1} / {displayImages.length}
              </div>
            </div>
          )}

          {/* Product Info */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            {/* Subtitle */}
            {product.subtitle && (
              <p className="u-label text-accent mb-2">{product.subtitle}</p>
            )}

            {/* Name */}
            <h1 className="u-display text-2xl md:text-3xl text-ink mb-3">{product.name}</h1>

            {/* Rating */}
            {product.ratingCount > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center gap-0.5" aria-label={product.ratingAvg + ' out of 5 stars'}>
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4" fill={i < Math.round(product.ratingAvg) ? '#9c7c4e' : 'none'} stroke="#9c7c4e" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  ))}
                </div>
                <span className="text-xs text-muted">{product.ratingAvg.toFixed(1)} ({product.ratingCount} reviews)</span>
              </div>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-3 flex-wrap mb-1">
              <span className="text-2xl font-medium text-ink tabular-nums">{formatCurrency(currentPrice)}</span>
              {hasDiscount && (
                <>
                  <span className="text-base text-muted line-through tabular-nums">{formatCurrency(product.compareAtPrice!)}</span>
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-success/10 text-success uppercase tracking-wider">
                    Save {formatCurrency(product.compareAtPrice! - currentPrice)}
                  </span>
                </>
              )}
            </div>
            <p className="text-[11px] text-muted mb-6">Inclusive of all taxes</p>

            {/* Color Selector */}
            {product.colors.length > 1 && (
              <fieldset className="mb-5">
                <legend className="u-label mb-3">
                  Color — <span className="text-ink font-normal normal-case">{selectedColor}</span>
                </legend>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color options">
                  {product.colors.map((colorOpt) => (
                    <button
                      key={colorOpt.color}
                      onClick={() => setSelectedColor(colorOpt.color)}
                      className={`relative w-10 h-10 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                        selectedColor === colorOpt.color
                          ? 'border-ink ring-2 ring-ink/10 ring-offset-2 scale-110'
                          : 'border-line hover:border-ink/40 hover:scale-105'
                      }`}
                      style={{ backgroundColor: colorOpt.colorHex }}
                      aria-pressed={selectedColor === colorOpt.color}
                      aria-label={colorOpt.color}
                    >
                      {selectedColor === colorOpt.color && (
                        <svg className="w-4 h-4 text-paper" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {/* Size Selector */}
            <fieldset className="mb-5">
              <legend className="u-label mb-3">
                Size
                {availableSizes.length > 0 && (
                  <span className="text-muted font-normal normal-case ml-1">
                    ({availableSizes.filter(s => s.stock > 0).length} available)
                  </span>
                )}
              </legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Size options">
                {availableSizes.map((sizeOpt) => (
                  <button
                    key={sizeOpt.id}
                    onClick={() => setSelectedSize(sizeOpt.size)}
                    disabled={sizeOpt.stock === 0}
                    className={`relative min-w-[48px] h-12 px-4 rounded border-2 font-medium text-sm transition-all duration-200 ${
                      selectedSize === sizeOpt.size
                        ? 'border-ink bg-ink text-paper'
                        : sizeOpt.stock === 0
                          ? 'border-line/50 text-muted/50 cursor-not-allowed line-through'
                          : 'border-line hover:border-ink text-ink active:scale-95'
                    }`}
                    aria-pressed={selectedSize === sizeOpt.size}
                    aria-disabled={sizeOpt.stock === 0}
                    aria-label={sizeOpt.stock === 0 ? sizeOpt.size + ' - Out of stock' : sizeOpt.size}
                  >
                    {sizeOpt.size}
                    {sizeOpt.lowStock && sizeOpt.stock > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-warning text-paper text-[8px] font-bold flex items-center justify-center">
                        {sizeOpt.stock}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {availableSizes.length === 0 && (
                <p className="text-sm text-muted mt-2">Out of stock</p>
              )}
            </fieldset>

            {/* Quantity */}
            <div className="flex items-center gap-4 mb-6">
              <label htmlFor="qty" className="u-label">Quantity</label>
              <div className="flex items-center border border-line rounded">
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  disabled={qty <= 1}
                  className="w-10 h-10 flex items-center justify-center hover:bg-paper-2 transition-colors disabled:opacity-30 u-focus"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <span className="w-10 text-center text-sm font-medium tabular-nums">{qty}</span>
                <button
                  onClick={() => setQty(Math.min(selectedSizeData?.stock || 10, qty + 1))}
                  disabled={qty >= (selectedSizeData?.stock || 10) || qty >= 10}
                  className="w-10 h-10 flex items-center justify-center hover:bg-paper-2 transition-colors disabled:opacity-30 u-focus"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Add to Cart / Buy Now */}
            <div ref={addToCartRef} className="space-y-3 mb-6">
              <button
                onClick={handleAddToCart}
                disabled={adding || !selectedSizeData}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Adding...
                  </span>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" aria-hidden="true" />
                    Add to Bag
                  </>
                )}
              </button>
              <button
                onClick={handleBuyNow}
                disabled={!selectedSizeData}
                className="btn-secondary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Buy Now
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Trust Signals */}
            <div className="flex flex-wrap gap-4 mb-6 pb-6 border-b border-line">
              {[
                { icon: Truck, text: 'Free shipping on ₹2,999+' },
                { icon: RotateCcw, text: '14-day returns' },
                { icon: Shield, text: 'Secure checkout' },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-1.5 text-xs text-muted">
                  <item.icon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>

            {/* AI Features */}
            <div className="flex flex-wrap gap-2 mb-6">
              <ErrorBoundary>
                <Suspense fallback={null}>
                  {product.sizeGuide && (
                    <button className="px-3 py-1.5 text-[11px] font-medium border border-line rounded-full text-muted hover:text-ink hover:border-ink transition-colors u-focus">
                      Size Guide
                    </button>
                  )}
                </Suspense>
              </ErrorBoundary>
              <ErrorBoundary>
                <Suspense fallback={null}>
                  <FitPredictor productId={product.id} productName={product.name} sizeChart={product.sizeGuide} />
                </Suspense>
              </ErrorBoundary>
              <ErrorBoundary>
                <Suspense fallback={null}>
                  <AIStylist currentProduct={{ id: product.id, name: product.name, category: product.gender, color: selectedColor, imageUrl: product.images[0]?.url || '' }} />
                </Suspense>
              </ErrorBoundary>
            </div>

            {/* Product Details Accordion */}
            <div className="border-t border-line">
              {/* Description */}
              <details className="group border-b border-line" open>
                <summary className="flex items-center justify-between py-4 cursor-pointer u-label select-none" aria-expanded="true">
                  <span>Details</span>
                  <ChevronRight className="w-4 h-4 text-muted transition-transform group-open:rotate-90" aria-hidden="true" />
                </summary>
                <div className="pb-4 text-sm text-muted leading-relaxed">
                  <p className="whitespace-pre-wrap">{product.description}</p>
                </div>
              </details>

              {/* Fabric & Care */}
              {(product.fabric || product.care.length > 0) && (
                <details className="group border-b border-line">
                  <summary className="flex items-center justify-between py-4 cursor-pointer u-label select-none">
                    <span>Fabric & Care</span>
                    <ChevronRight className="w-4 h-4 text-muted transition-transform group-open:rotate-90" aria-hidden="true" />
                  </summary>
                  <div className="pb-4 space-y-3">
                    {product.fabric && (
                      <div>
                        <p className="u-label mb-1">Composition</p>
                        <p className="text-sm text-muted">{product.fabric}</p>
                      </div>
                    )}
                    {product.care.length > 0 && (
                      <div>
                        <p className="u-label mb-1">Care</p>
                        <ul className="list-disc list-inside text-sm text-muted space-y-0.5">
                          {product.care.map((instruction, i) => <li key={i}>{instruction}</li>)}
                        </ul>
                      </div>
                    )}
                    {product.fit && (
                      <div>
                        <p className="u-label mb-1">Fit</p>
                        <p className="text-sm text-muted capitalize">{product.fit}</p>
                      </div>
                    )}
                  </div>
                </details>
              )}

              {/* Size Guide */}
              {product.sizeGuide && (
                <details className="group border-b border-line">
                  <summary className="flex items-center justify-between py-4 cursor-pointer u-label select-none">
                    <span>Size Guide</span>
                    <ChevronRight className="w-4 h-4 text-muted transition-transform group-open:rotate-90" aria-hidden="true" />
                  </summary>
                  <div className="pb-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-line">
                          {product.sizeGuide.columns.map((col, i) => (
                            <th key={i} className="u-label py-2 px-3 text-left">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {product.sizeGuide.rows.map((row, i) => (
                          <tr key={i} className="border-b border-line/50">
                            {row.map((cell, j) => (
                              <td key={j} className="py-2 px-3 text-muted">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {product.sizeGuide.notes && (
                      <p className="text-xs text-muted mt-3">{product.sizeGuide.notes}</p>
                    )}
                  </div>
                </details>
              )}

              {/* Shipping & Returns */}
              <details className="group border-b border-line">
                <summary className="flex items-center justify-between py-4 cursor-pointer u-label select-none">
                  <span>Shipping & Returns</span>
                  <ChevronRight className="w-4 h-4 text-muted transition-transform group-open:rotate-90" aria-hidden="true" />
                </summary>
                <div className="pb-4 space-y-2 text-sm text-muted">
                  <p><strong>Standard Delivery:</strong> 4-6 business days</p>
                  <p><strong>Express Delivery:</strong> 2-3 business days (select pincodes)</p>
                  <p><strong>Free Shipping:</strong> On orders above ₹2,999</p>
                  <p><strong>Returns:</strong> 14-day hassle-free returns. Items must be unworn with original tags.</p>
                </div>
              </details>

              {/* Story */}
              {product.story && (
                <details className="group border-b border-line">
                  <summary className="flex items-center justify-between py-4 cursor-pointer u-label select-none">
                    <span>The Story</span>
                    <ChevronRight className="w-4 h-4 text-muted transition-transform group-open:rotate-90" aria-hidden="true" />
                  </summary>
                  <div className="pb-4 text-sm text-muted leading-relaxed">
                    <p className="whitespace-pre-wrap">{product.story}</p>
                  </div>
                </details>
              )}
            </div>

            {/* Product Meta */}
            <div className="grid grid-cols-3 gap-3 mt-6">
              {[
                { label: 'Fabric', value: product.fabric ? product.fabric.split(',')[0] : 'Premium' },
                { label: 'Fit', value: product.fit || 'Regular' },
                { label: 'Occasion', value: product.occasion || 'Versatile' },
              ].map((item) => (
                <div key={item.label} className="text-center py-3 border border-line rounded">
                  <p className="u-label text-[10px] mb-0.5">{item.label}</p>
                  <p className="text-xs font-medium text-ink capitalize">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Shop the Look */}
        {product.shopTheLook && product.shopTheLook.items.length > 0 && (
          <div className="mt-16 pt-12 border-t border-line">
            <ErrorBoundary>
              <Suspense fallback={null}>
                <ShopTheLook outfitName={product.shopTheLook.name} items={product.shopTheLook.items} heroImage={product.images[0]?.url || ''} />
              </Suspense>
            </ErrorBoundary>
          </div>
        )}
      </div>

      {/* Sticky Mobile Add to Bar */}
      {showStickyBar && (
        <div className="fixed bottom-0 left-0 right-0 bg-paper border-t border-line z-50 p-4 animate-slide-in-up lg:hidden safe-area-pb">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-xs text-muted">{product.name}</p>
              <p className="text-base font-medium tabular-nums">{formatCurrency(currentPrice)}</p>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={adding || !selectedSizeData}
              className="btn-primary h-12 px-8 disabled:opacity-50"
            >
              {adding ? 'Adding...' : 'Add to Bag'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
