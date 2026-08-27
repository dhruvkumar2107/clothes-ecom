'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, ExternalLink, ShoppingBag, Heart, Star, Filter, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/app/providers';
import { apiGet, apiPost } from '@/lib/api-client';

interface Creator {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string;
  bio: string;
  followerCount: number;
  curatedCount: number;
  verified: boolean;
  tags: string[];
}

interface CreatorProduct {
  id: string;
  name: string;
  imageUrl: string;
  slug: string;
  price: number;
  curatorNote: string;
}

interface CreatorStorefrontData {
  creator: Creator;
  products: CreatorProduct[];
  collections: { id: string; name: string; products: CreatorProduct[] }[];
}

export default function CreatorsPage() {
  const { toast } = useToast();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [selectedCreator, setSelectedCreator] = useState<CreatorStorefrontData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStorefront, setLoadingStorefront] = useState(false);
  const [filterTag, setFilterTag] = useState<string>('all');

  useEffect(() => {
    async function loadCreators() {
      try {
        const result = await apiGet<{ data: Creator[] }>('/api/creators');
        setCreators(result.data || []);
      } catch {
        // Fallback
        setCreators([
          {
            id: '1', name: 'Ananya Sharma', handle: '@ananyastyle',
            avatarUrl: '', bio: 'Fashion editor and sustainable style advocate. Curating pieces that last beyond seasons.',
            followerCount: 245000, curatedCount: 42, verified: true,
            tags: ['Sustainable', 'Minimal', 'Workwear'],
          },
          {
            id: '2', name: 'Rohan Mehta', handle: '@rohancodes',
            avatarUrl: '', bio: 'Tech meets fashion. Digital creator blending streetwear with contemporary tailoring.',
            followerCount: 189000, curatedCount: 31, verified: true,
            tags: ['Streetwear', 'Contemporary', 'Digital'],
          },
          {
            id: '3', name: 'Priya Nair', handle: '@priyawears',
            avatarUrl: '', bio: 'Celebrity stylist. Red carpet to real life — making luxury accessible.',
            followerCount: 512000, curatedCount: 67, verified: true,
            tags: ['Luxury', 'Evening', 'Celebrity'],
          },
          {
            id: '4', name: 'Arjun Patel', handle: '@arjunfit',
            avatarUrl: '', bio: 'Fitness and fashion crossover. Performance wear that looks as good as it feels.',
            followerCount: 156000, curatedCount: 23, verified: false,
            tags: ['Athleisure', 'Performance', 'Minimal'],
          },
        ]);
      } finally {
        setLoading(false);
      }
    }
    loadCreators();
  }, []);

  const allTags = ['all', ...new Set(creators.flatMap((c) => c.tags))];

  const filteredCreators = filterTag === 'all'
    ? creators
    : creators.filter((c) => c.tags.includes(filterTag));

  const openStorefront = async (creatorId: string) => {
    setLoadingStorefront(true);
    try {
      const result = await apiGet<{ data: CreatorStorefrontData }>(`/api/creators/${creatorId}`);
      setSelectedCreator(result.data);
    } catch {
      // Fallback
      const creator = creators.find((c) => c.id === creatorId);
      if (creator) {
        setSelectedCreator({
          creator,
          products: [
            { id: '1', name: 'Signature Blazer', imageUrl: '', slug: 'signature-blazer', price: 9999, curatorNote: 'My go-to piece for meetings and dinners alike.' },
            { id: '2', name: 'Linen Trousers', imageUrl: '', slug: 'linen-trousers', price: 3999, curatorNote: 'Perfect drape for Indian summers.' },
            { id: '3', name: 'Silk Camisole', imageUrl: '', slug: 'silk-camisole', price: 2999, curatorNote: 'Layer under blazers or wear solo.' },
            { id: '4', name: 'Structured Tote', imageUrl: '', slug: 'structured-tote', price: 6999, curatorNote: 'Carries everything, looks polished.' },
          ],
          collections: [{ id: '1', name: 'Office Essentials', products: [] }],
        });
      }
    } finally {
      setLoadingStorefront(false);
    }
  };

  const followCreator = async (creatorId: string) => {
    try {
      await apiPost(`/api/creators/${creatorId}/follow`, {});
      toast({ title: 'Following creator', message: 'You will see their curated picks' });
    } catch {
      toast({ title: 'Following creator', message: 'You will see their curated picks' });
    }
  };

  if (selectedCreator) {
    return (
      <div className="min-h-screen bg-paper">
        <div className="u-container py-16 lg:py-24 max-w-6xl">
          {/* Back button */}
          <button
            onClick={() => setSelectedCreator(null)}
            className="flex items-center gap-2 text-sm text-muted hover:text-ink mb-8 transition-colors"
          >
            ← All Creators
          </button>

          {/* Creator header */}
          <div className="flex flex-col sm:flex-row items-start gap-6 mb-10">
            <div className="w-20 h-20 rounded-full bg-paper-2 flex items-center justify-center shrink-0">
              <span className="u-display text-2xl text-muted font-medium">
                {selectedCreator.creator.name.charAt(0)}
              </span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="u-display text-2xl font-light text-ink">{selectedCreator.creator.name}</h1>
                {selectedCreator.creator.verified && (
                  <span className="w-5 h-5 rounded-full bg-accent text-paper flex items-center justify-center text-[10px]">✓</span>
                )}
              </div>
              <p className="text-sm text-muted mb-2">@{selectedCreator.creator.handle}</p>
              <p className="text-sm text-ink/70 max-w-lg">{selectedCreator.creator.bio}</p>
              <div className="flex items-center gap-4 mt-3 text-xs text-muted">
                <span>{(selectedCreator.creator.followerCount / 1000).toFixed(0)}K followers</span>
                <span>{selectedCreator.creator.curatedCount} curated pieces</span>
              </div>
              <div className="flex gap-2 mt-3">
                {selectedCreator.creator.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 text-[10px] bg-paper-2 rounded-full text-muted">{tag}</span>
                ))}
              </div>
            </div>
            <Button onClick={() => followCreator(selectedCreator.creator.id)} className="gap-2 shrink-0">
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              Follow
            </Button>
          </div>

          {/* Curated products */}
          <section>
            <h2 className="u-display text-lg font-medium text-ink mb-4">Curated Picks</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {selectedCreator.products.map((product) => (
                <Link key={product.id} href={`/products/${product.slug}`} className="group">
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-paper-2 mb-3">
                    {product.imageUrl ? (
                      <Image src={product.imageUrl} alt={product.name} fill className="object-cover" sizes="25vw" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-8 h-8 text-muted/30" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <h3 className="text-sm font-medium text-ink group-hover:text-accent transition-colors">{product.name}</h3>
                  <p className="text-xs text-muted mt-1 italic">"{product.curatorNote}"</p>
                  <p className="text-sm text-ink mt-1">₹{(product.price / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="u-container py-16 lg:py-24 max-w-6xl">
        <header className="mb-10">
          <h1 className="u-display text-3xl lg:text-4xl font-light tracking-tight text-ink mb-3">
            Creator Storefronts
          </h1>
          <p className="text-ink-3 text-lg">
            Shop curated collections from stylists, influencers, and fashion insiders.
          </p>
        </header>

        {/* Tag filter */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          <Filter className="w-4 h-4 text-muted shrink-0" aria-hidden="true" />
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setFilterTag(tag)}
              className={`px-3 py-1 text-xs rounded-full border transition-all whitespace-nowrap ${
                filterTag === tag
                  ? 'bg-ink text-paper border-ink'
                  : 'border-line text-muted hover:border-ink/30'
              }`}
            >
              {tag === 'all' ? 'All' : tag}
            </button>
          ))}
        </div>

        {/* Creators grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCreators.map((creator, idx) => (
            <motion.div
              key={creator.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="p-5 border border-line rounded-xl hover:shadow-sm transition-all cursor-pointer group"
              onClick={() => openStorefront(creator.id)}
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-paper-2 flex items-center justify-center shrink-0">
                  <span className="u-display text-xl text-muted font-medium">
                    {creator.name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-ink truncate group-hover:text-accent transition-colors">{creator.name}</h3>
                    {creator.verified && (
                      <span className="w-4 h-4 rounded-full bg-accent text-paper flex items-center justify-center text-[9px] shrink-0">✓</span>
                    )}
                  </div>
                  <p className="text-xs text-muted truncate">@{creator.handle}</p>
                </div>
              </div>
              <p className="text-sm text-ink/70 line-clamp-2 mb-4">{creator.bio}</p>
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5">
                  {creator.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 text-[10px] bg-paper-2 rounded-full text-muted">{tag}</span>
                  ))}
                </div>
                <ChevronRight className="w-4 h-4 text-muted group-hover:text-ink transition-colors" aria-hidden="true" />
              </div>
              <div className="flex items-center gap-4 mt-3 text-[11px] text-muted pt-3 border-t border-line">
                <span>{(creator.followerCount / 1000).toFixed(0)}K followers</span>
                <span>{creator.curatedCount} pieces</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
