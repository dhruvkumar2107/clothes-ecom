'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Loader2, X, Music, Heart, ShoppingBag } from 'lucide-react';
import { useToast } from '@/app/providers';
import { apiGet } from '@/lib/api-client';
import { formatCurrency } from '@/lib/utils';

interface StylistRecommendation {
  product: {
    id: string;
    slug: string;
    name: string;
    subtitle: string | null;
    basePrice: number;
    compareAtPrice: number | null;
    images: { url: string; alt: string }[];
    colors: { color: string; colorHex: string }[];
    variants: { size: string; color: string; priceDelta: number }[];
  };
  reason: string;
}

interface AIStylistProps {
  prompt: string;
}

export function AIStylist({ prompt }: AIStylistProps) {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<StylistRecommendation[]>([]);
  const { toast } = useToast();

  const handleSearch = useCallback(async (userPrompt: string) => {
    setLoading(true);
    try {
      // In a real implementation, this would call an AI styling API
      // For now, we filter the product catalogue based on the prompt
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Parse the prompt for key terms
      const lowerPrompt = userPrompt.toLowerCase();
      const hasWedding = lowerPrompt.includes('wedding') || lowerPrompt.includes('wedding outfit');
      const hasUnder = lowerPrompt.includes('under');
      const priceLimit = hasUnder ? parseInt(lowerPrompt.match(/under\s₹?(\d+)/)?.[1] ?? '0') : null;
      const colorTerms = ['black', 'red', 'white', 'blue', 'green'].filter(term => lowerPrompt.includes(term));
      const fabricTerms = ['linen', 'silk', 'cotton', 'wool', 'cashmere'].filter(term => lowerPrompt.includes(term));

      // Fetch products from API
      const result = await apiGet<{ products: any[] }>('/api/products?limit=50');
      let products = result.products || [];

      // Filter based on prompt
      products = products.filter((p: any) => {
        const nameLower = (p.name + ' ' + (p.subtitle || '')).toLowerCase();

        // Check for wedding outfit
        if (hasWedding) {
          // Look for formal, party, or festive occasion
          const suitableOccasions = ['formal', 'party', 'festive'];
          return suitableOccasions.some(occ => p.occasion === occ);
        }

        // Check price filter
        if (priceLimit !== null) {
          const maxPrice = priceLimit * 100; // Convert to paise
          if (p.basePrice > maxPrice * 100) return false;
        }

        // Check color preference
        if (colorTerms.length > 0) {
          const hasColorMatch = p.colors?.some((c: any) => colorTerms.some(term => c.colorHex?.toLowerCase().includes(term) || c.name?.toLowerCase().includes(term)));
          if (!hasColorMatch) return false;
        }

        // Check fabric preference
        if (fabricTerms.length > 0) {
          const hasFabricMatch = p.fabric?.toLowerCase().some((f: any) => fabricTerms.some(term => f.toLowerCase().includes(term)));
          if (!hasFabricMatch) return false;
        }

        return true;
      });

      // Map to recommendation format
      const recs = products.slice(0, 3).map((p: any) => {
        const firstVariant = p.variants?.[0] || {};
        const colorOptions = p.colors || [];
        const primaryColor = colorOptions[0] || { color: 'N/A', colorHex: '#808080' };

        return {
          product: {
            id: p.id,
            slug: p.slug,
            name: p.name,
            subtitle: p.subtitle,
            basePrice: p.basePrice,
            compareAtPrice: p.compareAtPrice,
            images: p.images?.map((img: any) => ({ url: img.url, alt: img.alt })) || [],
            colors: colorOptions.map((c: any) => ({ color: c.color, colorHex: c.colorHex })) || [],
            variants: p.variants?.map((v: any) => ({
              size: v.size,
              color: v.color,
              priceDelta: v.priceDelta,
            })) || [],
          },
          reason: generateRecommendationReason(p, userPrompt),
        };
      });

      setRecommendations(recs);
    } catch (error) {
      toast({ title: 'Error', message: 'Failed to get style recommendations', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const generateRecommendationReason = (product: any, prompt: string): string => {
    const lowerPrompt = prompt.toLowerCase();
    if (lowerPrompt.includes('wedding')) {
      return 'Selected for wedding occasion - formal and elegant style';
    }
    if (lowerPrompt.includes('under')) {
      return `Fits within your budget of ₹${product.basePrice / 100}`;
    }
    return 'Recommended based on your style preferences';
  };

  const handleClose = useCallback(() => {
    setRecommendations([]);
    setLoading(false);
  }, []);

  if (loading && recommendations.length === 0) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-16 h-16 text-accent mx-auto mb-4" />
        <p className="text-paper/60">Finding the perfect look...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-paper rounded-lg border border-line max-w-2xl mx-auto">
      {/* Prompt Input */}
      <div className="mb-4">
        <textarea
          placeholder="e.g. 'I need a wedding outfit under ₹5000'"
          value={prompt}
          onChange={(e) => {/* handle prompt change */}}
          className="w-full px-4 py-3 rounded-md bg-paper-2 border border-line text-sm text-ink focus:outline-none focus:ring-2 focus:ring-paper resize-none min-h-[120px]"
          aria-label="Describe your style need"
        />
      </div>

      {/* Search Button */}
      <button
        onClick={() => handleSearch(prompt)}
        className="w-full px-6 py-3 rounded-md bg-ink text-paper text-sm font-medium uppercase tracking-wider hover:bg-paper/3 transition-colors"
        disabled={loading}
      >
        {loading ? 'Finding...' : 'STYLE ME'}
      </button>

      {/* Results */}
      {recommendations.length > 0 && (
        <div className="mt-6 space-y-4">
          {recommendations.map((rec, i) => (
            <div key={i} className="p-4 bg-paper-2 rounded-lg border border-line">
              {/* Product Image */}
              <div className="rounded-lg overflow-hidden mb-4">
                <img
                  src={rec.product.images[0]?.url || '/placeholder.jpg'}
                  alt={rec.product.name}
                  className="w-full h-40 object-cover"
                />
              </div>

              {/* Product Details */}
              <div className="flex flex-col gap-2">
                <h3 className="font-medium text-ink truncate">
                  <Link href={`/products/${rec.product.slug}`} className="hover:text-accent transition-colors">
                    {rec.product.name}
                  </Link>
                </h3>
                <p className="text-xs text-paper/60 line-clamp-2">
                  {rec.product.subtitle || 'No description available'}
                </p>

                {/* Price */}
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-light tabular-nums text-ink">{formatCurrency(rec.product.basePrice)}</span>
                  {rec.product.compareAtPrice && rec.product.compareAtPrice > rec.product.basePrice && (
                    <span className="text-xs text-paper/60 line-through">Rs. {formatCurrency(rec.product.compareAtPrice)}</span>
                  )}
                </div>

                {/* Reason */}
                <p className="text-[10px] text-paper/60 uppercase tracking-wider">{rec.reason}</p>

                {/* Action */}
                <div className="mt-3">
                  <button
                    onClick={() => window.location.href = `/products/${rec.product.slug}`}
                    className="text-[10px] text-accent hover:underline transition-colors"
                  >
                    View Product
                  </button>
                  <button
                    onClick={() => {/* Add to bag logic */}}
                    className="text-[10px] text-paper hover:text-ink transition-colors"
                  >
                    Add to Bag
                  </button>
                </div>
              </div>
            </div>
          ))}

          <button onClick={handleClose} className="mt-4 flex justify-center text-[10px] text-paper/60 uppercase tracking-wider">
            Close
          </button>
        </div>
      )}

      {/* No results yet */}
      {recommendations.length === 0 && !loading && (
        <p className="text-center text-paper/60 mt-4">
          Try a different style prompt like 'wedding outfit under ₹5000' or 'linen shirt in blue'
        </p>
      )}
    </div>
  );
}