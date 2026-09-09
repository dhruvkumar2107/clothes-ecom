import { Metadata } from 'next';
import Link from 'next/link';
import { SmartImage } from '@/components/ui/SmartImage';
import { ProductCard } from '@/components/products/ProductCard';
import { NewsletterForm } from '@/components/marketing/NewsletterForm';
import { CountdownDrop } from '@/components/products/CountdownDrop';
import { RecentlyViewed } from '@/components/products/RecentlyViewed';
import { getHomepage } from '@/lib/api-server';
import { ChevronRight, ArrowRight } from 'lucide-react';

export const revalidate = 30;

export const metadata: Metadata = {
  title: 'LUMEN&CO — Light as couture',
  description: 'Future-facing luxury fashion. Engineered fabrics, sculptural silhouettes, and limited drops — shipped across India.',
};

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

const CATEGORIES = [
  { slug: 'women', name: 'Women', image: '/images/product-wrap-dress.webp' },
  { slug: 'men', name: 'Men', image: '/images/product-linen-shirt.webp' },
];

export default async function HomePage() {
  const { banner, featured, newArrivals, categories, collections, reviews } = await getHomepage();

  const hero = banner ?? FALLBACK_HERO;
  const showcase = collections[0] ?? null;
  const heroImage = hero.imageUrl ?? showcase?.heroImage ?? newArrivals[0]?.images[0]?.url ?? null;

  const liveCategories = categories.filter((c) => c.count > 0);
  const arrivals = newArrivals.filter((p) => !featured.some((f) => f.id === p.id)).slice(0, 4);
  const editorialPicks = featured.slice(0, 3);

  return (
    <div className="flex-1">
      {/* ═══════════════════════════════════════════════════════════════════
       * HERO — Full-viewport editorial
       * ═══════════════════════════════════════════════════════════════════ */}
      <section
        className="relative min-h-[100dvh] flex items-end md:items-center overflow-hidden bg-ink"
        aria-labelledby="hero-title"
      >
        {heroImage ? (
          <SmartImage
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
              background: `linear-gradient(160deg, ${hero.accentHex ?? '#1a1a1a'} 0%, #0a0a0a 70%)`,
            }}
            aria-hidden="true"
          />
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent md:bg-gradient-to-r md:from-ink/70 md:via-ink/30 md:to-transparent" aria-hidden="true" />

        {/* Content */}
        <div className="u-container relative z-10 pb-24 md:py-0 w-full">
          <div className="max-w-2xl">
            {hero.eyebrow ? (
              <span className="u-label text-accent mb-4 block">{hero.eyebrow}</span>
            ) : null}

            <h1
              id="hero-title"
              className="u-display text-5xl md:text-7xl lg:text-[8rem] font-normal text-paper leading-[0.9] mb-6 tracking-[-0.02em]"
            >
              {hero.headline}
            </h1>

            {hero.subhead ? (
              <p className="text-sm md:text-base text-paper/60 mb-8 max-w-md leading-relaxed font-light">
                {hero.subhead}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Link href={hero.ctaHref ?? '/products'}>
                <button className="btn-primary bg-paper text-ink hover:bg-paper/90 text-xs">
                  {hero.ctaLabel ?? 'Shop the collection'}
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </Link>
              <Link href="/products">
                <button className="btn-secondary border-paper/30 text-paper hover:bg-paper/10 text-xs">
                  Explore All
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-2 text-paper/30">
          <span className="text-[10px] uppercase tracking-[0.2em]">Scroll</span>
          <div className="w-px h-6 bg-paper/20" />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
       * EDITORIAL GRID — Asymmetric magazine layout
       * ═══════════════════════════════════════════════════════════════════ */}
      {editorialPicks.length >= 2 && (
        <section className="section-padding u-content-visibility" aria-labelledby="editorial-title">
          <div className="u-container">
            <div className="flex items-end justify-between gap-6 mb-10">
              <div>
                <span className="u-label text-accent mb-2 block">The Edit</span>
                <h2 id="editorial-title" className="u-display text-3xl md:text-4xl">
                  Editor&apos;s Picks
                </h2>
              </div>
              <Link
                href="/products?featured=true"
                className="u-label hover:text-ink transition-colors flex items-center gap-1 u-focus whitespace-nowrap"
              >
                View all
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>

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
              )}
              {editorialPicks[2] && (
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
              )}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
       * NEW ARRIVALS
       * ═══════════════════════════════════════════════════════════════════ */}
      {arrivals.length > 0 && (
        <section className="section-padding bg-paper-2 u-content-visibility" aria-labelledby="arrivals-title">
          <div className="u-container">
            <div className="flex items-end justify-between gap-6 mb-10">
              <div>
                <span className="u-label text-accent mb-2 block">Just landed</span>
                <h2 id="arrivals-title" className="u-display text-3xl md:text-4xl">
                  New Arrivals
                </h2>
              </div>
              <Link
                href="/products?sort=newest"
                className="u-label hover:text-ink transition-colors flex items-center gap-1 u-focus whitespace-nowrap"
              >
                See everything
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
            <ul className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8 md:gap-x-6">
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
      )}

      {/* ═══════════════════════════════════════════════════════════════════
       * FULL-BLEED COLLECTION — Editorial spread
       * ═══════════════════════════════════════════════════════════════════ */}
      {showcase && (
        <section className="relative min-h-[60vh] md:min-h-[70vh] flex items-center overflow-hidden u-content-visibility" aria-labelledby="collection-title">
          {showcase.heroImage ? (
            <SmartImage
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
                background: `linear-gradient(160deg, ${showcase.accentHex ?? '#1a1a1a'} 0%, #0a0a0a 75%)`,
              }}
              aria-hidden="true"
            />
          )}
          <div className="absolute inset-0 bg-ink/50" aria-hidden="true" />

          <div className="u-container relative z-10 py-20 text-paper">
            <div className="max-w-xl">
              <span className="u-label mb-3 block text-accent">
                {showcase.kind === 'drop' ? 'Latest Drop' : showcase.kind === 'lookbook' ? 'Lookbook' : 'New Collection'}
              </span>
              <h2 id="collection-title" className="u-display text-4xl md:text-5xl lg:text-6xl mb-6">
                {showcase.name}
              </h2>
              <p className="text-paper/70 text-sm md:text-base mb-8 leading-relaxed max-w-md">
                {showcase.description ?? showcase.tagline ?? 'A curated selection of weightless fabrics and architectural forms.'}
              </p>
              <Link href={`/collections/${showcase.slug}`}>
                <button className="btn-secondary border-paper/30 text-paper hover:bg-paper/10 text-xs">
                  Shop the Collection
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
       * SHOP BY CATEGORY
       * ═══════════════════════════════════════════════════════════════════ */}
      {liveCategories.length > 0 && (
        <section className="section-padding u-content-visibility" aria-labelledby="categories-title">
          <div className="u-container">
            <div className="text-center mb-10">
              <span className="u-label text-accent mb-2 block">Browse</span>
              <h2 id="categories-title" className="u-display text-3xl md:text-4xl">
                Shop by Category
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4 md:gap-6">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/products?category=${cat.slug}`}
                  className="group relative aspect-[3/4] rounded-lg overflow-hidden bg-ink u-focus"
                >
                  <SmartImage
                    src={cat.image}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" aria-hidden="true" />
                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <h3 className="u-display text-2xl text-paper mb-1">{cat.name}</h3>
                    <span className="inline-flex items-center gap-1 text-xs text-paper/60 group-hover:text-paper transition-colors">
                      Shop Now <ChevronRight className="w-3 h-3" aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
       * BRAND STORY — Editorial typography
       * ═══════════════════════════════════════════════════════════════════ */}
      <section className="section-padding bg-ink text-paper u-content-visibility">
        <div className="u-container">
          <div className="max-w-3xl mx-auto text-center">
            <span className="u-label text-accent mb-4 block">Our Philosophy</span>
            <h2 className="u-display text-3xl md:text-5xl lg:text-6xl mb-6">
              Fashion should feel like freedom
            </h2>
            <p className="text-paper/50 text-sm md:text-base leading-relaxed max-w-lg mx-auto mb-8">
              Every piece is designed to move with you. Engineered fabrics. Sculptural silhouettes.
              A commitment to craft that never compromises on comfort.
            </p>
            <Link href="/about">
              <button className="btn-secondary border-paper/30 text-paper hover:bg-paper/10 text-xs">
                Our Story
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
       * COLLECTIONS
       * ═══════════════════════════════════════════════════════════════════ */}
      {collections.length > 1 && (
        <section className="section-padding u-content-visibility" aria-labelledby="collections-title">
          <div className="u-container">
            <div className="flex items-end justify-between gap-6 mb-10">
              <div>
                <span className="u-label text-accent mb-2 block">Curated</span>
                <h2 id="collections-title" className="u-display text-3xl md:text-4xl">
                  Collections
                </h2>
              </div>
              <Link
                href="/collections"
                className="u-label hover:text-ink transition-colors flex items-center gap-1 u-focus whitespace-nowrap"
              >
                All Collections
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {collections.slice(1).map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/collections/${c.slug}`}
                    className="group block relative aspect-[4/3] rounded-lg overflow-hidden bg-ink-2 u-focus"
                  >
                    {c.heroImage ? (
                      <SmartImage
                        src={c.heroImage}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div
                        className="absolute inset-0"
                        style={{
                          background: `linear-gradient(160deg, ${c.accentHex ?? '#2d2d2d'} 0%, #0a0a0a 80%)`,
                        }}
                        aria-hidden="true"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" aria-hidden="true" />
                    <div className="absolute inset-x-0 bottom-0 p-6">
                      <h3 className="u-display text-xl md:text-2xl text-paper">{c.name}</h3>
                      {c.tagline ? (
                        <p className="text-xs text-paper/50 mt-1 line-clamp-2">{c.tagline}</p>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
       * REVIEWS — Social proof
       * ═══════════════════════════════════════════════════════════════════ */}
      {reviews.length > 0 && (
        <section className="section-padding bg-paper-2 u-content-visibility" aria-labelledby="reviews-title">
          <div className="u-container">
            <h2 id="reviews-title" className="u-display text-3xl md:text-4xl mb-10 text-center">
              What Our Customers Say
            </h2>
            <ul className="grid md:grid-cols-3 gap-4 md:gap-6">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-lg border border-line p-6 bg-paper">
                  {/* Stars */}
                  <div className="flex items-center gap-0.5 mb-3" aria-label={r.rating + ' out of 5 stars'}>
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-4 h-4" fill={i < r.rating ? '#9c7c4e' : 'none'} stroke="#9c7c4e" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    ))}
                  </div>
                  {r.title ? <h3 className="u-label mb-2">{r.title}</h3> : null}
                  <p className="text-sm text-ink/70 leading-relaxed line-clamp-4">{r.body}</p>
                  <p className="text-xs text-muted mt-4">
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
      )}

      {/* ═══════════════════════════════════════════════════════════════════
       * NEWSLETTER
       * ═══════════════════════════════════════════════════════════════════ */}
      <section className="section-padding border-t border-line u-content-visibility" aria-labelledby="newsletter-title">
        <div className="u-container">
          <div className="max-w-xl mx-auto text-center">
            <h2 id="newsletter-title" className="u-display text-3xl md:text-4xl mb-3">
              Join the Collective
            </h2>
            <p className="text-muted text-sm mb-8">
              Early access to drops, exclusive previews, and styling inspiration — delivered weekly.
            </p>
            <NewsletterForm id="home-email" source="popup" className="max-w-sm mx-auto" />
            <p className="text-[11px] text-muted-2 mt-3">
              By subscribing you agree to our{' '}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-ink u-focus">
                Privacy Policy
              </Link>
              . Unsubscribe anytime.
            </p>
          </div>
        </div>
      </section>

      {/* Recently Viewed */}
      <RecentlyViewed />
    </div>
  );
}
