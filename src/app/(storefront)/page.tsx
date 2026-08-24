import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ChevronRight, Sparkles, Truck, Shield, RotateCcw, Heart } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'LUMEN&CO — Light as couture',
  description: 'Future-facing luxury fashion. Engineered fabrics, sculptural silhouettes, and limited drops — shipped across India.',
};

const FEATURES = [
  { icon: Truck, title: 'Free Shipping', desc: 'On orders above ₹2,999 across India' },
  { icon: Shield, title: 'Secure Payment', desc: '100% secure checkout with multiple options' },
  { icon: RotateCcw, title: 'Easy Returns', desc: '14-day hassle-free return policy' },
  { icon: Heart, title: 'Loyalty Rewards', desc: 'Earn points on every purchase' },
];

const CATEGORIES = [
  { name: 'Women', slug: 'women', image: '/images/category-women.jpg', count: 120 },
  { name: 'Men', slug: 'men', image: '/images/category-men.jpg', count: 85 },
  { name: 'Unisex', slug: 'unisex', image: '/images/category-unisex.jpg', count: 45 },
  { name: 'Accessories', slug: 'accessories', image: '/images/category-accessories.jpg', count: 30 },
];

export default function HomePage() {
  return (
    <div className="flex-1">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden" aria-labelledby="hero-title">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/images/hero.jpg)' }} aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink/80 via-ink/40 to-transparent" aria-hidden="true" />
        
        <div className="u-container relative z-10">
          <div className="max-w-3xl">
            <h1 id="hero-title" className="u-display text-5xl md:text-7xl lg:text-8xl font-light text-paper leading-[1.02] mb-6">
              Light as <br /> couture
            </h1>
            <p className="text-lg md:text-xl text-paper/80 mb-10 max-w-xl leading-relaxed">
              Engineered fabrics. Sculptural silhouettes. Limited drops shipped across India.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/products?new=true">
                <Button size="lg" className="gap-2">
                  Shop New Arrivals
                  <ChevronRight className="w-5 h-5" aria-hidden="true" />
                </Button>
              </Link>
              <Link href="/collections">
                <Button variant="outline" size="lg" className="bg-transparent border-paper/30 text-paper hover:bg-paper/10 gap-2">
                  Explore Collections
                  <ChevronRight className="w-5 h-5" aria-hidden="true" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce" aria-hidden="true">
          <ChevronRight className="w-6 h-6 text-paper/60 rotate-90" />
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-24 border-y border-line" aria-label="Features">
        <div className="u-container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {FEATURES.map((feature, i) => (
              <div key={i} className="text-center">
                <div className="w-14 h-14 mx-auto mb-4 rounded-lg bg-ink flex items-center justify-center">
                  <feature.icon className="w-7 h-7 text-accent" aria-hidden="true" />
                </div>
                <h3 className="u-label mb-2">{feature.title}</h3>
                <p className="text-sm text-muted">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Shop by Category */}
      <section className="py-16 md:py-24" aria-labelledby="categories-title">
        <div className="u-container">
          <div className="flex items-center justify-between mb-12">
            <h2 id="categories-title" className="u-display text-3xl md:text-4xl">Shop by Category</h2>
            <Link href="/products" className="u-label hover:text-accent transition-colors flex items-center gap-1 u-focus">
              View All
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {CATEGORIES.map((cat, i) => (
              <Link
                key={i}
                href={`/products?gender=${cat.slug}`}
                className="group relative rounded-lg overflow-hidden bg-paper-2 u-focus"
              >
                <div className="aspect-[3/4] bg-ink-2 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" aria-hidden="true" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-12 h-12 text-paper/50 group-hover:text-paper transition-colors" aria-hidden="true" />
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="u-display text-xl font-medium text-ink group-hover:text-accent transition-colors">{cat.name}</h3>
                  <p className="text-sm text-muted mt-1">{cat.count} styles</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Collection */}
      <section className="py-16 md:py-24 bg-ink text-paper" aria-labelledby="collection-title">
        <div className="u-container">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="u-label text-accent mb-3 block">New Collection</span>
              <h2 id="collection-title" className="u-display text-3xl md:text-4xl mb-6">The Lumen Edit</h2>
              <p className="text-paper/70 text-lg mb-8 leading-relaxed">
                A curated selection of weightless fabrics and architectural forms. 
                Each piece designed for the modern wardrobe — versatile, timeless, and unmistakably LUMEN&CO.
              </p>
              <Link href="/collections/the-lumen-edit">
                <Button variant="outline" className="border-paper/30 text-paper hover:bg-paper/10 gap-2">
                  Shop the Collection
                  <ChevronRight className="w-5 h-5" aria-hidden="true" />
                </Button>
              </Link>
            </div>
            <div className="relative aspect-[4/5] bg-ink-3 rounded-lg overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-24 h-24 text-paper/30" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-16 md:py-24" aria-labelledby="newsletter-title">
        <div className="u-container">
          <div className="max-w-2xl mx-auto text-center">
            <h2 id="newsletter-title" className="u-display text-3xl md:text-4xl mb-4">Join the Collective</h2>
            <p className="text-muted text-lg mb-8">
              Early access to drops, exclusive previews, and styling inspiration — delivered weekly.
            </p>
            <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto" action="/api/newsletter" method="POST">
              <label htmlFor="hero-email" className="sr-only">Email address</label>
              <input
                type="email"
                id="hero-email"
                name="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-4 bg-paper border border-line rounded-md text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                required
              />
              <button type="submit" className="px-8 py-4 bg-ink text-paper font-medium rounded-md hover:bg-ink-2 transition-colors u-focus whitespace-nowrap">
                Subscribe
              </button>
            </form>
            <p className="text-xs text-muted-2 mt-4">By subscribing you agree to our Privacy Policy. Unsubscribe anytime.</p>
          </div>
        </div>
      </section>
    </div>
  );
}