import { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/Button';
import { ProductCard } from '@/components/products/ProductCard';
import { ChevronRight, Briefcase, Sparkles, PartyPopper, Palmtree } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Shop by Occasion | LUMEN&CO',
  description: 'Find the perfect outfit for any occasion — office, festive celebrations, weddings, or casual everyday wear.',
};

const OCCASIONS = [
  {
    slug: 'office',
    name: 'Office Edit',
    description: 'Polished, professional pieces that command attention in the boardroom.',
    icon: Briefcase,
    color: '#2a2b2e',
    emoji: '💼',
  },
  {
    slug: 'festive',
    name: 'Festive Edit',
    description: 'Bold, celebratory pieces for festivals and special occasions.',
    icon: Sparkles,
    color: '#8c5f56',
    emoji: '✨',
  },
  {
    slug: 'wedding',
    name: 'Wedding Edit',
    description: 'Statement formal wear for weddings and grand celebrations.',
    icon: PartyPopper,
    color: '#b08d57',
    emoji: '💒',
  },
  {
    slug: 'casual',
    name: 'Everyday',
    description: 'Relaxed, everyday comfort that still looks effortlessly stylish.',
    icon: Palmtree,
    color: '#7c8b7a',
    emoji: '🌿',
  },
];

export default async function OccasionPage() {
  let products: {
    id: string;
    slug: string;
    name: string;
    subtitle: string | null;
    basePrice: number;
    compareAtPrice: number | null;
    gender: string;
    occasion: string | null;
    images: { url: string; alt: string | null }[];
    variants: { size: string; color: string; colorHex: string; stock: number; reserved: number }[];
  }[] = [];
  try {
    products = await db.product.findMany({
      where: { status: 'active' },
      include: {
        images: { take: 2, orderBy: { sortOrder: 'asc' } },
        variants: { select: { size: true, color: true, colorHex: true, stock: true, reserved: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  } catch {
    // DB unavailable (e.g. build time) — render with empty product list
  }

  const formattedProducts = products.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    subtitle: p.subtitle,
    basePrice: p.basePrice,
    compareAtPrice: p.compareAtPrice,
    images: p.images.map((img) => ({ url: img.url, alt: img.alt || p.name })),
    gender: p.gender,
    occasion: p.occasion ?? undefined,
    ratingAvg: 0,
    ratingCount: 0,
    variants: p.variants.map((v, i) => ({
      id: `${p.id}-${i}`,
      size: v.size,
      color: v.color,
      colorHex: v.colorHex,
      stock: v.stock,
      reserved: v.reserved,
    })),
    inStock: p.variants.some((v) => v.stock - v.reserved > 0),
    colors: [...new Set(p.variants.filter((v) => v.stock - v.reserved > 0).map((v) => v.color))],
    sizes: [...new Set(p.variants.filter((v) => v.stock - v.reserved > 0).map((v) => v.size))],
  }));

  return (
    <div className="min-h-screen bg-paper">
      <div className="u-container py-16 lg:py-24">
        <header className="mb-14 max-w-2xl">
          <p className="u-label text-accent mb-3">Shop by Occasion</p>
          <h1 className="u-display text-3xl lg:text-5xl font-light tracking-tight text-ink mb-5">
            Dress for the Moment
          </h1>
          <p className="text-ink-3 text-lg leading-relaxed">
            Whether it is a boardroom presentation, a festive celebration, or a casual brunch — we have
            curated collections for every occasion in your life.
          </p>
        </header>

        {/* Occasion cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {OCCASIONS.map((occasion) => {
            const Icon = occasion.icon;
            return (
              <Link
                key={occasion.slug}
                href={`/products?occasion=${occasion.slug}`}
                className="group relative aspect-[3/4] rounded-xl overflow-hidden u-focus"
              >
                <div
                  className="absolute inset-0 transition-transform duration-700 group-hover:scale-105"
                  style={{
                    background: `linear-gradient(135deg, ${occasion.color} 0%, #0b0b0c 80%)`,
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                  <span className="text-4xl mb-3" aria-hidden="true">{occasion.emoji}</span>
                  <h2 className="u-display text-xl md:text-2xl text-paper mb-1">{occasion.name}</h2>
                  <p className="text-sm text-paper/50 line-clamp-2">{occasion.description}</p>
                  <span className="mt-4 flex items-center gap-1 text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                    Explore <ChevronRight className="w-3 h-3" aria-hidden="true" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* All occasion products */}
        <section>
          <div className="flex items-end justify-between gap-6 mb-8">
            <h2 className="u-display text-2xl md:text-3xl">All Occasion Wear</h2>
            <Link
              href="/products"
              className="u-label hover:text-accent transition-colors flex items-center gap-1 u-focus whitespace-nowrap"
            >
              View All
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          {formattedProducts.length > 0 ? (
            <ul className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10 md:gap-x-6">
              {formattedProducts.map((p) => (
                <li key={p.id}>
                  <ProductCard {...p} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-16 text-muted">
              <p className="text-lg mb-4">No products available yet.</p>
              <Link href="/products">
                <Button>Browse All Products</Button>
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
