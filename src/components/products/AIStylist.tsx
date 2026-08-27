'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronRight, ShoppingCart, Heart, RefreshCw, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { apiPost } from '@/lib/api-client';
import { useCartStore } from '@/app/providers';

interface OutfitItem {
  id: string;
  name: string;
  imageUrl: string;
  slug: string;
  price: number;
  category: string;
  color: string;
}

interface OutfitRecommendation {
  id: string;
  name: string;
  items: OutfitItem[];
  total: number;
  reasoning: string;
}

interface AIStylistProps {
  currentProduct: {
    id: string;
    name: string;
    category: string;
    color: string;
    imageUrl: string;
  };
  className?: string;
}

export function AIStylist({ currentProduct, className }: AIStylistProps) {
  const { openDrawer } = useCartStore();
  const [isOpen, setIsOpen] = useState(false);
  const [recommendations, setRecommendations] = useState<OutfitRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());

  const fetchRecommendations = useCallback(async () => {
    if (recommendations.length > 0) return;
    setLoading(true);
    try {
      const result = await apiPost<{ data: OutfitRecommendation[] }>('/api/ai-stylist/recommend', {
        productId: currentProduct.id,
        category: currentProduct.category,
        color: currentProduct.color,
      });
      setRecommendations(result.data);
    } catch {
      // Fallback recommendations
      setRecommendations([
        {
          id: '1',
          name: 'Office Elegance',
          items: [
            { id: '1', name: currentProduct.name, imageUrl: currentProduct.imageUrl, slug: '', price: 4999, category: currentProduct.category, color: currentProduct.color },
            { id: '2', name: 'Tailored Trousers', imageUrl: '/placeholder-trousers.jpg', slug: 'tailored-trousers', price: 3499, category: 'bottoms', color: 'Navy' },
            { id: '3', name: 'Structured Blazer', imageUrl: '/placeholder-blazer.jpg', slug: 'structured-blazer', price: 6999, category: 'outerwear', color: 'Black' },
            { id: '4', name: 'Leather Oxford Shoes', imageUrl: '/placeholder-shoes.jpg', slug: 'leather-oxford', price: 5499, category: 'shoes', color: 'Brown' },
          ],
          total: 20996,
          reasoning: 'A polished ensemble pairing your piece with tailored staples for the modern professional.',
        },
        {
          id: '2',
          name: 'Weekend Relaxed',
          items: [
            { id: '1', name: currentProduct.name, imageUrl: currentProduct.imageUrl, slug: '', price: 4999, category: currentProduct.category, color: currentProduct.color },
            { id: '2', name: 'Relaxed Chinos', imageUrl: '/placeholder-chinos.jpg', slug: 'relaxed-chinos', price: 2499, category: 'bottoms', color: 'Khaki' },
            { id: '3', name: 'Minimal Sneakers', imageUrl: '/placeholder-sneakers.jpg', slug: 'minimal-sneakers', price: 4499, category: 'shoes', color: 'White' },
          ],
          total: 11997,
          reasoning: 'A laid-back look that lets your selected piece shine with effortless weekend style.',
        },
        {
          id: '3',
          name: 'Evening Statement',
          items: [
            { id: '1', name: currentProduct.name, imageUrl: currentProduct.imageUrl, slug: '', price: 4999, category: currentProduct.category, color: currentProduct.color },
            { id: '2', name: 'Silk Midi Skirt', imageUrl: '/placeholder-skirt.jpg', slug: 'silk-midi-skirt', price: 4999, category: 'bottoms', color: 'Black' },
            { id: '3', name: 'Strappy Heels', imageUrl: '/placeholder-heels.jpg', slug: 'strappy-heels', price: 5999, category: 'shoes', color: 'Gold' },
            { id: '4', name: 'Statement Earrings', imageUrl: '/placeholder-earrings.jpg', slug: 'statement-earrings', price: 1999, category: 'accessories', color: 'Gold' },
          ],
          total: 17996,
          reasoning: 'Elevate your piece for evening occasions with luxe textures and metallic accents.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [currentProduct, recommendations.length]);

  const handleOpen = () => {
    setIsOpen(true);
    fetchRecommendations();
  };

  const addToCart = async (item: OutfitItem) => {
    try {
      await apiPost('/api/cart', { productId: item.id, qty: 1 });
      openDrawer();
      setAddedItems((prev) => new Set([...prev, item.id]));
      setTimeout(() => {
        setAddedItems((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }, 2000);
    } catch {
      // Silently fail
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className={`flex items-center gap-2 px-4 py-2 text-sm text-accent border border-accent/30 rounded-md hover:bg-accent hover:text-paper transition-all ${className || ''}`}
      >
        <Sparkles className="w-4 h-4" aria-hidden="true" />
        Complete the Outfit
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-ink/95 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="AI outfit recommendations"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-paper rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between p-5 border-b border-line">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-accent" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="u-display text-lg font-medium text-ink">Complete the Outfit</h2>
                    <p className="text-xs text-muted">AI-styled combinations featuring your selected piece</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-10 h-10 rounded-full hover:bg-ink-2 flex items-center justify-center transition-colors u-focus"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-ink" />
                </button>
              </div>

              <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-5">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-12 h-12 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                    <p className="text-sm text-muted">Styling your outfit...</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {recommendations.map((rec, idx) => (
                      <motion.div
                        key={rec.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.15 }}
                        className="border border-line rounded-xl p-5 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="u-display text-lg font-medium text-ink">{rec.name}</h3>
                            <p className="text-xs text-muted mt-1">{rec.reasoning}</p>
                          </div>
                          <div className="text-right">
                            <p className="u-label text-xs text-muted">Outfit Total</p>
                            <p className="u-display text-lg text-ink font-medium">
                              ₹{(rec.total / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-3 overflow-x-auto pb-2">
                          {rec.items.map((item) => (
                            <div
                              key={item.id}
                              className="relative flex-shrink-0 w-32 group"
                            >
                              <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-paper-2 mb-2">
                                {item.imageUrl.startsWith('/') ? (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <span className="text-[10px] text-muted">Image</span>
                                  </div>
                                ) : (
                                  <Image
                                    src={item.imageUrl}
                                    alt={item.name}
                                    fill
                                    className="object-cover"
                                    sizes="128px"
                                  />
                                )}
                                <button
                                  onClick={() => addToCart(item)}
                                  className="absolute bottom-2 inset-x-2 py-1.5 bg-paper/95 backdrop-blur-sm rounded text-[10px] font-medium text-ink flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all hover:bg-paper"
                                  aria-label={`Add ${item.name} to cart`}
                                >
                                  {addedItems.has(item.id) ? (
                                    <>
                                      <Check className="w-3 h-3 text-green-600" aria-hidden="true" />
                                      Added
                                    </>
                                  ) : (
                                    <>
                                      <ShoppingCart className="w-3 h-3" aria-hidden="true" />
                                      Add
                                    </>
                                  )}
                                </button>
                              </div>
                              <p className="text-[11px] text-ink font-medium truncate">{item.name}</p>
                              <p className="text-[10px] text-muted">
                                ₹{(item.price / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={() => rec.items.forEach(item => addToCart(item))}
                            className="flex items-center gap-1 px-4 py-2 bg-ink text-paper text-xs rounded-md hover:bg-ink-2 transition-colors"
                          >
                            Add Entire Outfit
                            <ChevronRight className="w-3 h-3" aria-hidden="true" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
