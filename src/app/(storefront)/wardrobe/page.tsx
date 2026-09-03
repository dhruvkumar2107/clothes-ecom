'use client';

import { useState, useEffect } from 'react';
import { SmartImage } from '@/components/ui/SmartImage';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, GripVertical, Trash2, ShoppingBag, Eye, Sparkles, Filter } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/app/providers';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';

interface WardrobeItem {
  id: string;
  name: string;
  imageUrl: string;
  slug: string;
  price: number;
  category: string;
  color: string;
  size: string;
  addedAt: string;
  purchased: boolean;
}

interface Outfit {
  id: string;
  name: string;
  items: string[];
  createdAt: string;
}

export default function VirtualWardrobePage() {
  const { toast } = useToast();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'items' | 'outfits' | 'shop'>('items');
  const [loading, setLoading] = useState(true);
  const [creatingOutfit, setCreatingOutfit] = useState(false);
  const [outfitName, setOutfitName] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    async function loadWardrobe() {
      try {
        const result = await apiGet<{ data: { items: WardrobeItem[]; outfits: Outfit[] } }>('/api/wardrobe');
        setItems(result.data?.items || []);
        setOutfits(result.data?.outfits || []);
      } catch {
        // Fallback demo data
        setItems([
          { id: '1', name: 'Merino Wool Blazer', imageUrl: '', slug: 'merino-blazer', price: 12999, category: 'outerwear', color: 'Charcoal', size: 'M', addedAt: '2024-01-15', purchased: true },
          { id: '2', name: 'Silk Blend Shirt', imageUrl: '', slug: 'silk-shirt', price: 4999, category: 'tops', color: 'Ivory', size: 'M', addedAt: '2024-01-20', purchased: true },
          { id: '3', name: 'Tailored Chinos', imageUrl: '', slug: 'tailored-chinos', price: 3499, category: 'bottoms', color: 'Navy', size: 'M', addedAt: '2024-02-01', purchased: true },
          { id: '4', name: 'Cashmere Sweater', imageUrl: '', slug: 'cashmere-sweater', price: 8999, category: 'tops', color: 'Camel', size: 'M', addedAt: '2024-02-10', purchased: true },
          { id: '5', name: 'Leather Oxford Shoes', imageUrl: '', slug: 'leather-oxford', price: 5499, category: 'shoes', color: 'Brown', size: '10', addedAt: '2024-02-15', purchased: true },
        ]);
        setOutfits([
          { id: '1', name: 'Office Ready', items: ['1', '2', '3', '5'], createdAt: '2024-02-20' },
        ]);
      } finally {
        setLoading(false);
      }
    }
    loadWardrobe();
  }, []);

  const categories = ['all', ...new Set(items.map((item) => item.category))];

  const filteredItems = filterCategory === 'all'
    ? items
    : items.filter((item) => item.category === filterCategory);

  const toggleSelectItem = (id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeItem = async (id: string) => {
    try {
      await apiDelete(`/api/wardrobe/items/${id}`);
      setItems((prev) => prev.filter((item) => item.id !== id));
      toast({ title: 'Removed from wardrobe', message: 'Item removed from your virtual closet' });
    } catch {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const createOutfit = async () => {
    if (!outfitName.trim() || selectedItems.size < 2) return;
    setCreatingOutfit(true);
    try {
      const result = await apiPost<{ data: Outfit }>('/api/wardrobe/outfits', {
        name: outfitName,
        itemIds: Array.from(selectedItems),
      });
      setOutfits((prev) => [...prev, result.data || { id: Date.now().toString(), name: outfitName, items: Array.from(selectedItems), createdAt: new Date().toISOString() }]);
      setSelectedItems(new Set());
      setOutfitName('');
      toast({ title: 'Outfit created!', message: 'Your outfit combination has been saved' });
    } catch {
      setOutfits((prev) => [...prev, { id: Date.now().toString(), name: outfitName, items: Array.from(selectedItems), createdAt: new Date().toISOString() }]);
      setSelectedItems(new Set());
      setOutfitName('');
    } finally {
      setCreatingOutfit(false);
    }
  };

  const deleteOutfit = async (id: string) => {
    try {
      await apiDelete(`/api/wardrobe/outfits/${id}`);
      setOutfits((prev) => prev.filter((o) => o.id !== id));
    } catch {
      setOutfits((prev) => prev.filter((o) => o.id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-paper">
      <div className="u-container py-16 lg:py-24 max-w-6xl">
        <header className="mb-10">
          <h1 className="u-display text-3xl lg:text-4xl font-light tracking-tight text-ink mb-3">
            Virtual Wardrobe
          </h1>
          <p className="text-ink-3 text-lg">
            Your digital closet — saved items, curated outfits, and mix-match styling.
          </p>
        </header>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-line mb-8">
          {(['items', 'outfits', 'shop'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium capitalize transition-colors border-b-2 -mb-[1px] ${
                activeTab === tab ? 'text-ink border-ink' : 'text-muted border-transparent hover:text-ink'
              }`}
            >
              {tab === 'items' ? `My Pieces (${items.length})` : tab === 'outfits' ? `Outfits (${outfits.length})` : 'Shop'}
            </button>
          ))}
        </div>

        {/* Items Tab */}
        <AnimatePresence mode="wait">
          {activeTab === 'items' && (
            <motion.div
              key="items"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Category filter */}
              <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
                <Filter className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-3 py-1 text-xs rounded-full border transition-all whitespace-nowrap ${
                      filterCategory === cat
                        ? 'bg-ink text-paper border-ink'
                        : 'border-line text-muted hover:border-ink/30'
                    }`}
                  >
                    {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>

              {/* Create outfit bar */}
              {selectedItems.size > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 mb-6 p-4 bg-accent/5 border border-accent/20 rounded-xl"
                >
                  <span className="text-sm text-ink">{selectedItems.size} items selected</span>
                  <input
                    type="text"
                    placeholder="Outfit name..."
                    value={outfitName}
                    onChange={(e) => setOutfitName(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm border border-line rounded-md focus:outline-none focus:border-ink"
                  />
                  <Button
                    onClick={createOutfit}
                    disabled={!outfitName.trim() || creatingOutfit}
                    size="sm"
                    className="gap-2"
                  >
                    <Plus className="w-3 h-3" aria-hidden="true" />
                    Create Outfit
                  </Button>
                  <button
                    onClick={() => setSelectedItems(new Set())}
                    className="text-xs text-muted hover:text-ink"
                  >
                    Clear
                  </button>
                </motion.div>
              )}

              {/* Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredItems.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`relative group cursor-pointer rounded-xl overflow-hidden border-2 transition-all ${
                      selectedItems.has(item.id)
                        ? 'border-accent ring-2 ring-accent/20'
                        : 'border-transparent hover:border-line'
                    }`}
                    onClick={() => toggleSelectItem(item.id)}
                  >
                    <div className="relative aspect-[3/4] bg-paper-2">
                      {item.imageUrl ? (
                        <SmartImage src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="(max-width: 640px) 50vw, 25vw" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="w-8 h-8 text-muted/30" aria-hidden="true" />
                        </div>
                      )}
                      {/* Selection overlay */}
                      <AnimatePresence>
                        {selectedItems.has(item.id) && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-accent/10 flex items-center justify-center"
                          >
                            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                              <span className="text-paper text-sm font-bold">{selectedItems.size}</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      {/* Remove button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-paper/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`Remove ${item.name} from wardrobe`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-ink" />
                      </button>
                    </div>
                    <div className="p-3">
                      <p className="text-sm text-ink font-medium truncate">{item.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted">{item.color}</span>
                        <span className="text-[10px] text-muted">•</span>
                        <span className="text-[10px] text-muted">{item.size}</span>
                      </div>
                      <p className="text-xs text-ink mt-1">
                        ₹{(item.price / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Outfits Tab */}
          {activeTab === 'outfits' && (
            <motion.div
              key="outfits"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {outfits.length === 0 ? (
                <div className="text-center py-20">
                  <Sparkles className="w-12 h-12 text-muted/30 mx-auto mb-4" aria-hidden="true" />
                  <p className="text-ink-3">No outfits yet.</p>
                  <p className="text-sm text-muted mt-1">Select items and create your first outfit combination.</p>
                  <Button onClick={() => setActiveTab('items')} className="mt-4 gap-2">
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    Go to My Pieces
                  </Button>
                </div>
              ) : (
                outfits.map((outfit) => {
                  const outfitItems = items.filter((item) => outfit.items.includes(item.id));
                  return (
                    <motion.div
                      key={outfit.id}
                      layout
                      className="p-5 border border-line rounded-xl hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-medium text-ink">{outfit.name}</h3>
                          <p className="text-xs text-muted">{outfitItems.length} pieces • Created {new Date(outfit.createdAt).toLocaleDateString('en-IN')}</p>
                        </div>
                        <button
                          onClick={() => deleteOutfit(outfit.id)}
                          className="w-8 h-8 rounded-full hover:bg-paper-2 flex items-center justify-center"
                          aria-label={`Delete outfit ${outfit.name}`}
                        >
                          <Trash2 className="w-4 h-4 text-muted" />
                        </button>
                      </div>
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {outfitItems.map((item) => (
                          <div key={item.id} className="flex-shrink-0 w-24">
                            <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-paper-2 mb-1">
                              {item.imageUrl ? (
                                <SmartImage src={item.imageUrl} alt={item.name} fill className="object-cover" sizes="96px" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ShoppingBag className="w-5 h-5 text-muted/30" aria-hidden="true" />
                                </div>
                              )}
                            </div>
                            <p className="text-[10px] text-ink truncate">{item.name}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}

          {/* Shop Tab */}
          {activeTab === 'shop' && (
            <motion.div
              key="shop"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center py-20"
            >
              <ShoppingBag className="w-12 h-12 text-muted/30 mx-auto mb-4" aria-hidden="true" />
              <p className="text-ink-3 mb-2">Discover new pieces for your wardrobe</p>
              <p className="text-sm text-muted mb-6">Browse our latest collection and add items to your virtual closet.</p>
              <Link href="/products">
                <Button className="gap-2">
                  Browse Collection
                  <Eye className="w-4 h-4" aria-hidden="true" />
                </Button>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
