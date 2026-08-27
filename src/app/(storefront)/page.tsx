import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Rating } from '@/components/ui/Rating';
import { ProductCard } from '@/components/products/ProductCard';
import { NewsletterForm } from '@/components/marketing/NewsletterForm';
import { UGCWall } from '@/components/marketing/UGCWall';
import { getHomepage } from '@/lib/api-server';
import { ChevronRight, Truck, Shield, RotateCcw, Heart, Quote, ArrowRight, Play } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'LUMEN&CO — Light as couture',
  description:
    'Future-facing luxury fashion. Engineered fabrics, sculptural silhouettes, and limited drops — shipped across India.',
};

const FEATURES = [
  { icon: Truck, title: 'Free Shipping', desc: 'On orders above ₹2,999 across India' },
  { icon: Shield, title: 'Secure Payment', desc: 'UPI, cards, netbanking, wallets & COD' },
  { icon: RotateCcw, title: 'Easy Returns', desc: '14-day hassle-free return policy' },
  { icon: Heart, title: 'Loyalty Rewards', desc: 'Earn points on every purchase' },
];

const OCCASIONS = [
  { slug: 'office', name: 'Office Edit', description: 'Polished, professional', color: '#2a2b2e', emoji: '💼' },
  { slug: 'festive', name: 'Festive Edit', description: 'Bold, celebratory', color: '#8c5f56', emoji: '✨' },
  { slug: 'wedding', name: 'Wedding Edit', description: 'Statement pieces', color: '#b08d57', emoji: '💒' },
  { slug: 'casual', name: 'Everyday', description: 'Relaxed comfort', color: '#7c8b7a', emoji: '🌿' },
];

const FALLBACK_HERO = {
  eyebrow: null as string | null,
  headline: 'Light as couture',
  subhead: 'Engineered fabrics. Sculptural silhouettes. Limited drops shipped across India.',
  ctaLabel: 'Shop New Arrivals',
  ctaHref: '/products?sort=newest',
  imageUrl: null as string | null,
  mobileImageUrl: null as string | null,
  accentHex: null as string | null,
};

export default async function HomePage() {
  const { banner, featured, newArrivals, categories, collections, reviews } = await getHomepage();

  const hero = banner ?? FALLBACK_HERO;
  const showcase = collections[0] ?? null;

  const heroImage =
    hero.imageUrl ?? showcase?.heroImage ?? newArrivals[0]?.images[0]?.url ?? null;

  const liveCategories = categories.filter((c) => c.count > 0);
  const catCols =
    liveCategories.length >= 4 ? 'md:grid-cols-4' : liveCategories.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2';

  const arrivals = newArrivals.filter((p) => !featured.some((f) => f.id === p.id)).slice(0, 4);
  const editorialPicks = featured.slice(0, 3);

  return (
    <div className="flex-1">
      {/* ═══════════════════════════════════════════════════════════════════
       * HERO — Full-bleed editorial with magazine-style typography
       * ═══════════════════════════════════════════════════════════════════ */}
      <section
        className="relative min-h-[100vh] flex items-end md:items-center overflow-hidden bg-ink"
        aria-labelledby="hero-title"
      >
        {heroImage ? (
          <Image
            src={heroImage}
            alt=""
            fill
            priority
            fetchPriority="high"
            sizes="100vw"
            quality={85}
            className="object-cover object-center"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${hero.accentHex ?? '#1a1b1e'} 0%, #0b0b0c 70%)`,
            }}
            aria-hidden="true"
          />
        )}

        {/* Layered gradients for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent md:bg-gradient-to-r md:from-ink/80 md:via-ink/40 md:to-transparent" aria-hidden="true" />

        {/* Editorial typography — large, serif, fashion-magazine style */}
        <div className="u-container relative z-10 pb-20 md:py-0 w-full">
          <div className="max-w-3xl">
            {hero.eyebrow ? (
              <span className="u-label text-accent mb-4 block">
                {hero.eyebrow}
              </span>
            ) : null}

            {/* Magazine-style headline — ultra-large serif */}
            <h1
              id="hero-title"
              className="u-display text-6xl md:text-8xl lg:text-[10rem] font-light text-paper leading-[0.9] mb-6 tracking-tight"
            >
              {hero.headline}
            </h1>

            {hero.subhead ? (
              <p className="text-lg md:text-xl text-paper/70 mb-10 max-w-lg leading-relaxed font-light">
                {hero.subhead}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-4">
              <Link href={hero.ctaHref ?? '/products'}>
                <Button size="lg" className="gap-2 bg-paper text-ink hover:bg-paper/90">
                  {hero.ctaLabel ?? 'Shop the collection'}
                  <ArrowRight className="w-5 h-5" aria-hidden="true" />
                </Button>
              </Link>
              <Link href="/size-guide">
                <Button
                  variant="outline"
                  size="lg"
                  className="bg-transparent border-paper/30 text-paper hover:bg-paper/10 gap-2"
                >
                  Find your size
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-2 text-paper/40">
          <span className="text-[10px] uppercase tracking-widest">Scroll</span>
          <div className="w-px h-8 bg-paper/20 animate-pulse" />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
       * EDITORIAL GRID — Asymmetric magazine layout
       * ═══════════════════════════════════════════════════════════════════ */}
      {editorialPicks.length >= 2 && (
        <section className="py-16 md:py-24" aria-labelledby="editorial-title">
          <div className="u-container">
            <div className="flex items-end justify-between gap-6 mb-12">
              <div>
                <span className="u-label text-accent mb-3 block">The Edit</span>
                <h2 id="editorial-title" className="u-display text-3xl md:text-5xl">
                  Editor&apos;s Picks
                </h2>
              </div>
              <Link
                href="/products?featured=true"
                className="u-label hover:text-accent transition-colors flex items-center gap-1 u-focus whitespace-nowrap"
              >
                View all
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>

            {/* Asymmetric editorial grid — large + 2 stacked */}
            <div className="grid md:grid-cols-2 gap-4 md:gap-6">
              <div className="md:row-span-2">
                <ProductCard
                  id={editorialPicks[0].id}
                  slug={editorialPicks[0].slug}
                  name={editorialPicks[0].name}
                  subtitle={editorialPicks[0].subtitle}
                  basePrice={editorialPicks[0].basePrice}
                  compareAtPrice={editorialPicks[0].compareAtPrice}
                  images={editorialPicks[0].images}
                  gender={editorialPicks[0].gender}
                  occasion={editorialPicks[0].occasion ?? undefined}
                  ratingAvg={editorialPicks[0].ratingAvg}
                  ratingCount={editorialPicks[0].ratingCount}
                  variants={editorialPicks[0].variants}
                  inStock={editorialPicks[0].hasStock}
                  colors={editorialPicks[0].colors}
                  sizes={editorialPicks[0].sizes}
                />
              </div>
              {editorialPicks[1] && (
                <div>
                  <ProductCard
                    id={editorialPicks[1].id}
                    slug={editorialPicks[1].slug}
                    name={editorialPicks[1].name}
                    subtitle={editorialPicks[1].subtitle}
                    basePrice={editorialPicks[1].basePrice}
                    compareAtPrice={editorialPicks[1].compareAtPrice}
                    images={editorialPicks[1].images}
                    gender={editorialPicks[1].gender}
                    occasion={editorialPicks[1].occasion ?? undefined}
                    ratingAvg={editorialPicks[1].ratingAvg}
                    ratingCount={editorialPicks[1].ratingCount}
                    variants={editorialPicks[1].variants}
                    inStock={editorialPicks[1].hasStock}
                    colors={editorialPicks[1].colors}
                    sizes={editorialPicks[1].sizes}
                  />
                </div>
              )}
              {editorialPicks[2] && (
                <div>
                  <ProductCard
                    id={editorialPicks[2].id}
                    slug={editorialPicks[2].slug}
                    name={editorialPicks[2].name}
                    subtitle={editorialPicks[2].subtitle}
                    basePrice={editorialPicks[2].basePrice}
                    compareAtPrice={editorialPicks[2].compareAtPrice}
                    images={editorialPicks[2].images}
                    gender={editorialPicks[2].gender}
                    occasion={editorialPicks[2].occasion ?? undefined}
                    ratingAvg={editorialPicks[2].ratingAvg}
                    ratingCount={editorialPicks[2].ratingCount}
                    variants={editorialPicks[2].variants}
                    inStock={editorialPicks[2].hasStock}
                    colors={editorialPicks[2].colors}
                    sizes={editorialPicks[2].sizes}
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
       * OCCASION SHOPPING — Curated collections by occasion
       * ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-16 md:py-24 bg-ink text-paper" aria-labelledby="occasions-title">
        <div className="u-container">
          <div className="text-center mb-12">
            <span className="u-label text-accent mb-3 block">Shop by Occasion</span>
            <h2 id="occasions-title" className="u-display text-3xl md:text-5xl">
              Dress for the Moment
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {OCCASIONS.map((occasion, i) => (
              <Link
                key={occasion.slug}
                href={`/products?occasion=${occasion.slug}`}
                className="group relative aspect-[3/4] rounded-lg overflow-hidden u-focus"
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
                  <h3 className="u-display text-xl md:text-2xl text-paper mb-1">{occasion.name}</h3>
                  <p className="text-sm text-paper/50">{occasion.description}</p>
                  <span className="mt-4 flex items-center gap-1 text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                    Explore <ChevronRight className="w-3 h-3" aria-hidden="true" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
       * FULL-BLEED COLLECTION — Editorial magazine spread
       * ═══════════════════════════════════════════════════════════════════ */}
      {showcase && (
        <section className="relative min-h-[70vh] flex items-center overflow-hidden" aria-labelledby="collection-title">
          {showcase.heroImage ? (
            <Image
              src={showcase.heroImage}
              alt=""
              fill
              sizes="100vw"
              className="object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${showcase.accentHex ?? '#1a1b1e'} 0%, #0b0b0c 75%)`,
              }}
              aria-hidden="true"
            />
          )}
          <div className="absolute inset-0 bg-ink/50" aria-hidden="true" />

          <div className="u-container relative z-10 py-20 text-paper">
            <div className="max-w-xl">
              <span className="u-label mb-3 block" style={{ color: showcase.accentHex ?? undefined }}>
                {showcase.kind === 'drop'
                  ? 'Latest Drop'
                  : showcase.kind === 'lookbook'
                    ? 'Lookbook'
                    : showcase.kind === 'editorial'
                      ? 'Editorial'
                      : 'New Collection'}
              </span>
              <h2 id="collection-title" className="u-display text-4xl md:text-6xl lg:text-7xl mb-6">
                {showcase.name}
              </h2>
              <p className="text-paper/70 text-lg mb-8 leading-relaxed">
                {showcase.description ??
                  showcase.tagline ??
                  'A curated selection of weightless fabrics and architectural forms.'}
              </p>
              <Link href={`/collections/${showcase.slug}`}>
                <Button
                  variant="outline"
                  className="border-paper/30 text-paper hover:bg-paper/10 gap-2"
                >
                  Shop the Collection
                  <ArrowRight className="w-5 h-5" aria-hidden="true" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
       * SHOP BY CATEGORY — Horizontal scroll cards
       * ═══════════════════════════════════════════════════════════════════ */}
      {liveCategories.length > 0 ? (
        <section className="py-16 md:py-24" aria-labelledby="categories-title">
          <div className="u-container">
            <div className="flex items-end justify-between gap-6 mb-12">
              <div>
                <span className="u-label text-accent mb-3 block">Browse</span>
                <h2 id="categories-title" className="u-display text-3xl md:text-4xl">
                  Shop by Category
                </h2>
              </div>
              <Link
                href="/products"
                className="u-label hover:text-accent transition-colors flex items-center gap-1 u-focus whitespace-nowrap"
              >
                View All
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
            <ul className={`grid grid-cols-2 ${catCols} gap-4 md:gap-6`}>
              {liveCategories.map((cat, i) => (
                <li key={cat.slug}>
                  <Link
                    href={`/products?category=${cat.slug}`}
                    className="group block relative rounded-lg overflow-hidden bg-ink-2 u-focus"
                  >
                    <div className="aspect-[3/4] relative overflow-hidden">
                      {cat.image ? (
                        <Image
                          src={cat.image}
                          alt=""
                          fill
                          sizes="(max-width: 768px) 50vw, 25vw"
                          loading={i < 2 ? 'eager' : 'lazy'}
                          className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                        />
                      ) : null}
                      <div
                        className="absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-transparent"
                        aria-hidden="true"
                      />
                      <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
                        <h3 className="u-display text-xl md:text-2xl font-medium text-paper">
                          {cat.name}
                        </h3>
                        <p className="text-sm text-paper/60 mt-1">
                          {cat.count} {cat.count === 1 ? 'style' : 'styles'}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════════
       * NEW ARRIVALS — Horizontal product scroll
       * ═══════════════════════════════════════════════════════════════════ */}
      {arrivals.length > 0 ? (
        <section className="py-16 md:py-24 bg-paper-2" aria-labelledby="arrivals-title">
          <div className="u-container">
            <div className="flex items-end justify-between gap-6 mb-12">
              <div>
                <span className="u-label text-accent mb-3 block">Just landed</span>
                <h2 id="arrivals-title" className="u-display text-3xl md:text-4xl">
                  New Arrivals
                </h2>
              </div>
              <Link
                href="/products?sort=newest"
                className="u-label hover:text-accent transition-colors flex items-center gap-1 u-focus whitespace-nowrap"
              >
                See Everything
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
            <ul className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10 md:gap-x-6">
              {arrivals.map((p) => (
                <li key={p.id}>
                  <ProductCard
                    id={p.id}
                    slug={p.slug}
                    name={p.name}
                    subtitle={p.subtitle}
                    basePrice={p.basePrice}
                    compareAtPrice={p.compareAtPrice}
                    images={p.images}
                    gender={p.gender}
                    occasion={p.occasion ?? undefined}
                    ratingAvg={p.ratingAvg}
                    ratingCount={p.ratingCount}
                    variants={p.variants}
                    inStock={p.hasStock}
                    colors={p.colors}
                    sizes={p.sizes}
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════════
       * TRUST STRIP
       * ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-12 md:py-16 border-y border-line" aria-label="Why shop with us">
        <div className="u-container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="text-center">
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

      {/* ═══════════════════════════════════════════════════════════════════
       * OTHER COLLECTIONS
       * ═══════════════════════════════════════════════════════════════════ */}
      {collections.length > 1 ? (
        <section className="py-16 md:py-24" aria-labelledby="more-collections-title">
          <div className="u-container">
            <div className="flex items-end justify-between gap-6 mb-12">
              <h2 id="more-collections-title" className="u-display text-3xl md:text-4xl">
                Collections
              </h2>
              <Link
                href="/collections"
                className="u-label hover:text-accent transition-colors flex items-center gap-1 u-focus whitespace-nowrap"
              >
                All Collections
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {collections.slice(1).map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/collections/${c.slug}`}
                    className="group block relative aspect-[4/3] rounded-lg overflow-hidden bg-ink-2 u-focus"
                  >
                    {c.heroImage ? (
                      <Image
                        src={c.heroImage}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div
                        className="absolute inset-0"
                        style={{
                          background: `linear-gradient(135deg, ${c.accentHex ?? '#2a2b2e'} 0%, #0b0b0c 80%)`,
                        }}
                        aria-hidden="true"
                      />
                    )}
                    <div
                      className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent"
                      aria-hidden="true"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-6">
                      <h3 className="u-display text-2xl text-paper">{c.name}</h3>
                      {c.tagline ? (
                        <p className="text-sm text-paper/65 mt-1 line-clamp-2">{c.tagline}</p>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════════
       * REVIEWS
       * ═══════════════════════════════════════════════════════════════════ */}
      {reviews.length > 0 ? (
        <section className="py-16 md:py-24 bg-paper-2" aria-labelledby="reviews-title">
          <div className="u-container">
            <h2 id="reviews-title" className="u-display text-3xl md:text-4xl mb-12 text-center">
              What Our Customers Say
            </h2>
            <ul className="grid md:grid-cols-3 gap-6">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-lg border border-line p-6 bg-paper">
                  <Quote className="w-6 h-6 text-accent mb-4" aria-hidden="true" />
                  <Rating value={r.rating} count={0} size="sm" />
                  {r.title ? <h3 className="u-label mt-4">{r.title}</h3> : null}
                  <p className="text-sm text-ink/70 mt-2 leading-relaxed line-clamp-5">{r.body}</p>
                  <p className="text-xs text-muted-2 mt-4">
                    {r.authorName} —{' '}
                    <Link href={`/products/${r.productSlug}`} className="hover:text-accent u-focus">
                      {r.productName}
                    </Link>
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ═══════════════════════════════════════════════════════════════════
       * NEWSLETTER
       * ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-16 md:py-24 border-t border-line" aria-labelledby="newsletter-title">
        <div className="u-container">
          <div className="max-w-2xl mx-auto text-center">
            <h2 id="newsletter-title" className="u-display text-3xl md:text-4xl mb-4">
              Join the Collective
            </h2>
            <p className="text-muted text-lg mb-8">
              Early access to drops, exclusive previews, and styling inspiration — delivered weekly.
            </p>
            <NewsletterForm id="home-email" source="popup" className="max-w-md mx-auto" />
            <p className="text-xs text-muted-2 mt-4">
              By subscribing you agree to our{' '}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-ink u-focus">
                Privacy Policy
              </Link>
              . Unsubscribe anytime.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
