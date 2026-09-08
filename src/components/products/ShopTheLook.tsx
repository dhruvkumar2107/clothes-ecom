'use client';

import { useState, useCallback } from 'react';
import { SmartImage } from '@/components/ui/SmartImage';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Eye, ChevronRight, Loader2, Check } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { apiPost } from '@/lib/api-client';
import { useCartStore, useToast } from '@/app/providers';

interface OutfitItem {
  id: string;
  slug: string;
  name: string;
  basePrice: number;
  imageUrl: string | null;
  color: string;
  position: { x: number; y: number };
}

interface ShopTheLookProps {
  outfitName: string;
  items: OutfitItem[];
  heroImage: string;
}

export function ShopTheLook({ outfitName, items, heroImage }: ShopTheLookProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [addingAll, setAddingAll] = useState(false);
  const [allAdded, setAllAdded] = useState(false);
  const { refresh: refreshCart } = useCartStore();
  const { toast } = useToast();

  const addAllToBag = useCallback(async () => {
    if (addingAll || allAdded) return;
    setAddingAll(true);
    let successCount = 0;
    for (const item of items) {
      try {
        const product = await apiPost<{ id: string; variants: { id: string; size: string; color: string; stock: number }[] }>(`/api/products/${item.slug}`, {});
        if (product?.variants?.length) {
          const variant = product.variants.find((v) => v.stock > 0) || product.variants[0];
          if (variant) {
            await apiPost('/api/cart', { variantId: variant.id, qty: 1 });
            successCount++;
          }
        }
      } catch {
        // Continue with remaining items
      }
    }
    await refreshCart();
    setAddingAll(false);
    if (successCount > 0) {
      setAllAdded(true);
      toast({ title: 'Added to bag', message: `${successCount} ${successCount === 1 ? 'piece' : 'pieces'} added to your bag`, tone: 'success' });
    } else {
      toast({ title: 'Could not add items', message: 'Some items may be out of stock', tone: 'warning' });
    }
  }, [items, addingAll, allAdded, refreshCart, toast]);

  return (
    <div className="relative">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <span className="u-label text-accent mb-2 block">Styled Set</span>
          <h3 className="u-display text-xl md:text-2xl text-ink">{outfitName}</h3>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 u-label text-accent hover:text-ink transition-colors u-focus"
        >
          {expanded ? 'Collapse' : 'Shop the look'}
          <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} aria-hidden="true" />
        </button>
      </div>

      <div className="relative aspect-[16/10] rounded-lg overflow-hidden bg-paper-2">
        <SmartImage
          src={heroImage}
          alt={outfitName}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 60vw"
        />

        {/* Hotspots */}
        {items.map((item) => (
          <div
            key={item.id}
            className="absolute group/hotspot"
            style={{ left: `${item.position.x}%`, top: `${item.position.y}%`, transform: 'translate(-50%, -50%)' }}
            onMouseEnter={() => setHoveredItem(item.id)}
            onMouseLeave={() => setHoveredItem(null)}
          >
            {/* Pulse ring */}
            <div className="absolute inset-0 w-8 h-8 -translate-x-1/2 -translate-y-1/2">
              <div className="absolute inset-0 rounded-full bg-accent/30 animate-ping" />
              <div className="absolute inset-0 rounded-full bg-accent/50" />
              <div className="absolute inset-1 rounded-full bg-accent flex items-center justify-center">
                <span className="text-paper text-[9px] font-bold">
                  {items.indexOf(item) + 1}
                </span>
              </div>
            </div>

            {/* Hover tooltip */}
            <AnimatePresence>
              {hoveredItem === item.id && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 w-52 bg-paper rounded-lg shadow-xl border border-line overflow-hidden z-10"
                >
                  {item.imageUrl && (
                    <div className="relative h-28 w-full">
                      <SmartImage src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="208px" />
                    </div>
                  )}
                  <div className="p-3">
                    <p className="font-medium text-sm text-ink line-clamp-1">{item.name}</p>
                    <p className="text-xs text-muted mt-0.5">{item.color}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-semibold text-sm text-ink">{formatCurrency(item.basePrice)}</span>
                      <Link
                        href={`/products/${item.slug}`}
                        className="text-xs text-accent hover:text-ink transition-colors flex items-center gap-1"
                      >
                        View <ChevronRight className="w-3 h-3" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Expanded item grid */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
              {items.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Link
                    href={`/products/${item.slug}`}
                    className="group block relative aspect-[3/4] rounded-lg overflow-hidden bg-paper-2 border border-line hover:border-accent transition-all"
                  >
                    {item.imageUrl && (
                      <SmartImage
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 640px) 50vw, 25vw"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                      <p className="text-paper text-xs font-medium line-clamp-1">{item.name}</p>
                      <p className="text-paper/70 text-xs mt-0.5">{formatCurrency(item.basePrice)}</p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            <div className="flex justify-center mt-6">
              <button
                onClick={addAllToBag}
                disabled={addingAll || allAdded}
                className="flex items-center gap-2 px-6 py-3 bg-ink text-paper rounded-md text-sm font-medium hover:bg-ink-2 transition-colors u-focus disabled:opacity-60"
              >
                {addingAll ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : allAdded ? (
                  <Check className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <ShoppingBag className="w-4 h-4" aria-hidden="true" />
                )}
                {allAdded ? 'Added to bag' : 'Add entire outfit to bag'}
                <span className="text-paper/60 ml-2">
                  {formatCurrency(items.reduce((acc, item) => acc + item.basePrice, 0))}
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
