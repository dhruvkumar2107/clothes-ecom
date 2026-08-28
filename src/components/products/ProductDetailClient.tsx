'use client';

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, ShoppingBag, Truck, RotateCcw, Shield, ChevronRight, Loader2, X, Shirt, Camera } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { QtyStepper } from '@/components/ui/QtyStepper';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/Accordion';
import { useToast } from '@/app/providers';
import { apiPost } from '@/lib/api-client';
import { formatCurrency } from '@/lib/utils';

const FabricZoomViewer = lazy(() => import('./FabricZoomViewer').then(m => ({ default: m.FabricZoomViewer })));
const AnimatedSizeSlider = lazy(() => import('./AnimatedSizeSlider').then(m => ({ default: m.AnimatedSizeSlider })));
const FitPredictor = lazy(() => import('./FitPredictor').then(m => ({ default: m.FitPredictor })));
const AIStylist = lazy(() => import('./AIStylist').then(m => ({ default: m.AIStylist })));
const SustainabilityTags = lazy(() => import('./SustainabilityTags').then(m => ({ default: m.SustainabilityTags })));
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
  const [viewMode, setViewMode] = useState<'model' | 'flat'>('model');

  const currentColor = product.colors.find(c => c.color === selectedColor);
  const availableSizes = currentColor?.sizes.filter(s => s.stock > 0) || [];
  const selectedSizeData = availableSizes.find(s => s.size === selectedSize);

  useEffect(() => {
    if (availableSizes.length > 0) {
      setSelectedSize(availableSizes[0].size);
    } else {
      setSelectedSize('');
    }
  }, [selectedColor, availableSizes]);

  const colorImages = product.images.filter(
    img => img.kind === 'gallery' && (!img.colorKey || img.colorKey.toLowerCase() === selectedColor.toLowerCase())
  );
  const displayImages = colorImages.length > 0 ? colorImages : product.images.filter(img => img.kind === 'gallery');
  const flatLayImage = product.images.find(img => img.kind === 'flat') || null;
  const currentDisplayImages = viewMode === 'flat' && flatLayImage ? [flatLayImage, ...displayImages.filter(img => img.id !== flatLayImage.id)] : displayImages;

  const handleAddToCart = async () => {
    if (!selectedSizeData) {
      toast({ title: 'Select a size', message: 'Please choose a size before adding to bag', tone: 'warning' });
      return;
    }
    if (selectedSizeData.stock < qty) {
      toast({ title: 'Limited stock', message: 'Only ' + selectedSizeData.stock + ' available in this size', tone: 'warning' });
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
  };

  const handleWishlist = async () => {
    if (wishlisted) return;
    try {
      await apiPost('/api/account/wishlist', { productId: product.id });
      setWishlisted(true);
      toast({ title: 'Saved', message: 'Added to your wishlist', tone: 'success' });
    } catch {
      toast({ title: 'Error', message: 'Failed to add to wishlist', tone: 'danger' });
    }
  };

  const handleBuyNow = async () => {
    if (!selectedSizeData) {
      toast({ title: 'Select a size', message: 'Please choose a size', tone: 'warning' });
      return;
    }
    await handleAddToCart();
    router.push('/checkout');
  };

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: product.name, url: shareUrl }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: 'Link copied', message: 'Product link copied to clipboard', tone: 'success' });
    }
  };

  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.basePrice;
  const currentPrice = selectedSizeData?.price ?? product.basePrice;

  return (
    <div className="py-8 md:py-12">
      <div className="u-container">
        <nav className="mb-6 md:mb-8" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-sm text-muted flex-wrap">
            <li><Link href="/" className="hover:text-ink transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/products" className="hover:text-ink transition-colors">Shop</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-ink font-medium truncate max-w-[200px]">{product.name}</li>
          </ol>
        </nav>

        <div className="grid lg:grid-cols-2 gap-8 md:gap-12">
          <div className="relative">
            <div className="aspect-[3/4] rounded-lg overflow-hidden bg-paper-2 relative">
              <div key={(currentDisplayImages[activeImage]?.id || '') + '-' + viewMode} className="absolute inset-0 animate-fade-in">
                {currentDisplayImages[activeImage] ? (
                  <Image
                    src={currentDisplayImages[activeImage].url}
                    alt={currentDisplayImages[activeImage].alt || product.name}
                    fill
                    priority
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted">
                    <ShoppingBag className="w-16 h-16" aria-hidden="true" />
                  </div>
                )}
              </div>

              {flatLayImage && (
                <div className="absolute top-4 left-16 z-10 flex bg-paper/80 backdrop-blur-sm rounded-full p-0.5">
                  <button onClick={() => setViewMode('model')} className={'w-8 h-8 rounded-full flex items-center justify-center transition-all ' + (viewMode === 'model' ? 'bg-ink text-paper' : 'text-ink hover:bg-ink/10')} aria-label="View on model">
                    <Camera className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button onClick={() => setViewMode('flat')} className={'w-8 h-8 rounded-full flex items-center justify-center transition-all ' + (viewMode === 'flat' ? 'bg-ink text-paper' : 'text-ink hover:bg-ink/10')} aria-label="View flat lay">
                    <Shirt className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              )}

              <button onClick={() => setShowZoom(true)} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-paper/80 backdrop-blur-sm flex items-center justify-center hover:bg-paper transition-colors u-focus" aria-label="Zoom image">
                <svg className="w-5 h-5 text-ink" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>

              <button onClick={handleWishlist} className={'absolute top-4 left-4 w-10 h-10 rounded-full flex items-center justify-center transition-all ' + (wishlisted ? 'bg-accent text-paper' : 'bg-paper/80 text-ink hover:bg-paper')} aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}>
                <Heart className={'w-5 h-5 ' + (wishlisted ? 'fill-current' : '')} aria-hidden="true" />
              </button>

              <button onClick={handleShare} className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-paper/80 backdrop-blur-sm flex items-center justify-center hover:bg-paper transition-colors u-focus" aria-label="Share product">
                <svg className="w-5 h-5 text-ink" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              </button>
            </div>

            {currentDisplayImages.length > 1 && (
              <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                {currentDisplayImages.map((img, i) => (
                  <button key={img.id} onClick={() => setActiveImage(i)} className={'flex-shrink-0 w-20 h-24 rounded-md overflow-hidden border-2 transition-all ' + (i === activeImage ? 'border-accent' : 'border-transparent hover:border-line')} aria-label={'View image ' + (i + 1)} aria-current={i === activeImage ? 'true' : 'false'}>
                    <Image src={img.url} alt="" fill className="object-cover" sizes="80px" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {showZoom && (
            <div className="fixed inset-0 z-[200] bg-ink/95 flex items-center justify-center" onClick={() => setShowZoom(false)} role="dialog" aria-modal="true" aria-label="Image zoom">
              <button onClick={() => setShowZoom(false)} className="absolute top-6 right-6 w-12 h-12 rounded-full bg-paper/10 flex items-center justify-center u-focus" aria-label="Close zoom">
                <X className="w-6 h-6 text-paper" aria-hidden="true" />
              </button>
              <div className="max-w-5xl max-h-[90vh] relative">
                <Image src={currentDisplayImages[activeImage].url} alt={currentDisplayImages[activeImage].alt || product.name} width={1200} height={1600} className="max-w-full max-h-[90vh] object-contain" priority />
              </div>
              <button onClick={() => setActiveImage((activeImage - 1 + currentDisplayImages.length) % currentDisplayImages.length)} className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-paper/10 flex items-center justify-center u-focus" aria-label="Previous image">
                <svg className="w-6 h-6 text-paper" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button onClick={() => setActiveImage((activeImage + 1) % currentDisplayImages.length)} className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-paper/10 flex items-center justify-center u-focus" aria-label="Next image">
                <ChevronRight className="w-6 h-6 text-paper" />
              </button>
            </div>
          )}

          <div className="lg:sticky lg:top-24 lg:self-start space-y-6">
            {product.subtitle && <p className="u-label text-sm text-accent">{product.subtitle}</p>}
            <h1 className="u-display text-3xl md:text-4xl text-ink">{product.name}</h1>

            {product.ratingCount > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1" aria-label={product.ratingAvg + ' out of 5 stars'}>
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-5 h-5" fill={i < Math.round(product.ratingAvg) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  ))}
                </div>
                <span className="text-sm text-muted">{product.ratingAvg.toFixed(1)} ({product.ratingCount} reviews)</span>
              </div>
            )}

            <div className="flex items-baseline gap-4 flex-wrap">
              <span className="text-3xl md:text-4xl font-medium text-ink">{formatCurrency(currentPrice)}</span>
              {hasDiscount && <span className="text-xl text-muted line-through">{formatCurrency(product.compareAtPrice!)}</span>}
            </div>
            <p className="text-xs text-muted">Inclusive of all taxes</p>

            {product.colors.length > 1 && (
              <fieldset className="space-y-2">
                <legend className="u-label mb-2">Color</legend>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color options">
                  {product.colors.map((colorOpt) => (
                    <button key={colorOpt.color} onClick={() => setSelectedColor(colorOpt.color)} className={'relative w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ' + (selectedColor === colorOpt.color ? 'border-accent ring-2 ring-accent/20' : 'border-line hover:border-ink/50')} style={{ backgroundColor: colorOpt.colorHex }} aria-pressed={selectedColor === colorOpt.color} aria-label={colorOpt.color}>
                      {selectedColor === colorOpt.color && (
                        <svg className="w-5 h-5 text-paper" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      )}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            <fieldset className="space-y-2">
              <legend className="u-label mb-2 flex items-center gap-2">
                Size
                {availableSizes.length > 0 && <span className="text-sm text-muted font-normal">({availableSizes.length} available)</span>}
              </legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Size options">
                {availableSizes.map((sizeOpt) => (
                  <button key={sizeOpt.id} onClick={() => setSelectedSize(sizeOpt.size)} disabled={sizeOpt.stock === 0} className={'relative px-4 py-2.5 min-w-[52px] rounded-md border-2 font-medium text-sm transition-all ' + (selectedSize === sizeOpt.size ? 'border-ink bg-ink text-paper' : sizeOpt.stock === 0 ? 'border-line/50 text-muted line-through cursor-not-allowed' : 'border-line hover:border-ink hover:text-ink')} aria-pressed={selectedSize === sizeOpt.size} aria-disabled={sizeOpt.stock === 0} aria-label={sizeOpt.stock === 0 ? sizeOpt.size + ' - Out of stock' : sizeOpt.size}>
                    {sizeOpt.size}
                    {sizeOpt.lowStock && sizeOpt.stock > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-warning text-paper text-[9px] font-bold flex items-center justify-center">{sizeOpt.stock}</span>
                    )}
                  </button>
                ))}
                {availableSizes.length === 0 && <span className="text-sm text-muted px-4 py-2">Out of stock</span>}
              </div>
            </fieldset>

            <div className="flex items-center gap-4">
              <label htmlFor="qty" className="u-label whitespace-nowrap">Quantity</label>
              <QtyStepper value={qty} onChange={setQty} max={selectedSizeData?.stock || 10} min={1} />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button onClick={handleAddToCart} disabled={adding || !selectedSizeData} className="flex-1 sm:flex-none gap-2">
                <ShoppingBag className="w-5 h-5" aria-hidden="true" />
                {adding ? 'Adding...' : 'Add to Bag'}
              </Button>
              <Button variant="outline" onClick={handleBuyNow} disabled={!selectedSizeData} className="flex-1 sm:flex-none gap-2">
                Buy Now
                <ChevronRight className="w-5 h-5" aria-hidden="true" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-4 pt-4 border-t border-line">
              <div className="flex items-center gap-2 text-sm text-muted">
                <Truck className="w-4 h-4" aria-hidden="true" />
                <span>Free shipping on {'\u20B9'}2,999+</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted">
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                <span>14-day returns</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted">
                <Shield className="w-4 h-4" aria-hidden="true" />
                <span>Secure checkout</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Suspense fallback={null}>
                <FabricZoomViewer images={product.images} selectedColor={selectedColor} productName={product.name} />
                {product.sizeGuide && <AnimatedSizeSlider chart={product.sizeGuide} productName={product.name} />}
                <FitPredictor productId={product.id} productName={product.name} sizeChart={product.sizeGuide} />
                <AIStylist currentProduct={{ id: product.id, name: product.name, category: product.gender, color: selectedColor, imageUrl: product.images[0]?.url || '' }} />
              </Suspense>
            </div>

            <Accordion type="single" collapsible className="border border-line rounded-lg overflow-hidden">
              <AccordionItem value="details">
                <AccordionTrigger className="py-4">Details</AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="prose prose-sm max-w-none text-muted">
                    <p className="whitespace-pre-wrap">{product.description}</p>
                    {product.story && <p className="mt-4 whitespace-pre-wrap">{product.story}</p>}
                  </div>
                </AccordionContent>
              </AccordionItem>
              {product.fabric && (
                <AccordionItem value="fabric">
                  <AccordionTrigger className="py-4">Fabric &amp; Care</AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="space-y-3">
                      <div><p className="u-label mb-1">Composition</p><p className="text-sm text-muted">{product.fabric}</p></div>
                      {product.care.length > 0 && (
                        <div>
                          <p className="u-label mb-1">Care Instructions</p>
                          <ul className="list-disc list-inside text-sm text-muted space-y-1">{product.care.map((instruction, i) => <li key={i}>{instruction}</li>)}</ul>
                        </div>
                      )}
                      {product.fit && <div><p className="u-label mb-1">Fit</p><p className="text-sm text-muted capitalize">{product.fit}</p></div>}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
              {product.sizeGuide && (
                <AccordionItem value="sizeguide">
                  <AccordionTrigger className="py-4">Size Guide</AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-line">{product.sizeGuide.columns.map((col, i) => <th key={i} className="u-label py-2 px-3 text-left">{col}</th>)}</tr></thead>
                        <tbody>{product.sizeGuide.rows.map((row, i) => <tr key={i} className="border-b border-line/50">{row.map((cell, j) => <td key={j} className="py-2 px-3 text-muted">{cell}</td>)}</tr>)}</tbody>
                      </table>
                    </div>
                    {product.sizeGuide.notes && <p className="text-xs text-muted mt-3">{product.sizeGuide.notes}</p>}
                  </AccordionContent>
                </AccordionItem>
              )}
              <AccordionItem value="shipping">
                <AccordionTrigger className="py-4">Shipping &amp; Returns</AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-3 text-sm text-muted">
                    <p><strong>Standard Delivery:</strong> 4-6 business days</p>
                    <p><strong>Express Delivery:</strong> 2-3 business days (available in select pincodes)</p>
                    <p><strong>Free Shipping:</strong> On orders above {'\u20B9'}2,999</p>
                    <p><strong>Returns:</strong> 14-day hassle-free returns. Items must be unworn, unwashed, with original tags.</p>
                    <p><strong>Exchanges:</strong> Available for size/color within 14 days, subject to availability.</p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        {product.sustainability && (
          <div className="mt-12 border-t border-line pt-12">
            <Suspense fallback={null}><SustainabilityTags data={product.sustainability} /></Suspense>
          </div>
        )}

        {product.shopTheLook && product.shopTheLook.items.length > 0 && (
          <div className="mt-12 border-t border-line pt-12">
            <Suspense fallback={null}><ShopTheLook outfitName={product.shopTheLook.name} items={product.shopTheLook.items} heroImage={product.images[0]?.url || ''} /></Suspense>
          </div>
        )}
      </div>
    </div>
  );
}
