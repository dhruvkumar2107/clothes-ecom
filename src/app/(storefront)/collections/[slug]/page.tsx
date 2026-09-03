import type { Metadata } from 'next';
import { cache } from 'react';
import Link from 'next/link';
import { SmartImage } from '@/components/ui/SmartImage';
import { notFound } from 'next/navigation';
import { getCollectionBySlug, getCollectionProducts } from '@/lib/api-server';
import { ProductCard } from '@/components/products/ProductCard';
import { EmptyState } from '@/components/ui/EmptyState';

// Revalidate collection pages every 60s.
export const dynamic = 'force-dynamic';

// Deduplicate DB fetch for metadata + page component.
const getCollection = cache((slug: string) => getCollectionBySlug(slug));

const PER_PAGE = 24;

/** Sorts the collection query already supports. `manual` honours curator order. */
const SORTS = [
  { value: 'manual', label: 'Curated' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price low to high' },
  { value: 'price_desc', label: 'Price high to low' },
  { value: 'popular', label: 'Popular' },
] as const;

type SortValue = (typeof SORTS)[number]['value'];

function isSort(v: string | undefined): v is SortValue {
  return !!v && SORTS.some((s) => s.value === v);
}

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  let collection = null;
  try {
    collection = await getCollection(slug);
  } catch {
    return { title: 'Collection' };
  }
  if (!collection) return { title: 'Collection not found' };

  const description =
    collection.description?.slice(0, 160) ??
    collection.tagline ??
    `Shop the ${collection.name} collection from LUMEN&CO.`;

  return {
    title: collection.name,
    description,
    openGraph: {
      title: `${collection.name} | LUMEN&CO`,
      description,
      images: collection.heroImage ? [collection.heroImage] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${collection.name} | LUMEN&CO`,
      description,
      images: collection.heroImage ? [collection.heroImage] : [],
    },
  };
}

export default async function CollectionPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { page: pageParam, sort: sortParam } = await searchParams;

  let collection: Awaited<ReturnType<typeof getCollection>> = null;
  let products: Awaited<ReturnType<typeof getCollectionProducts>>['products'] = [];
  let total = 0;
  const page = Math.max(1, Number(pageParam) || 1);
  const sort: SortValue = isSort(sortParam) ? sortParam : 'manual';

  try {
    collection = await getCollection(slug);
    if (!collection) notFound();

    const result = await getCollectionProducts(slug, page, PER_PAGE, sort);
    products = result.products;
    total = result.total;
  } catch {
    // DB unavailable during build — render empty state
  }

  if (!collection) notFound();

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const accent = collection.accentHex ?? undefined;

  /** Preserve sort when paging; changing sort resets to page 1. */
  const href = (next: { page?: number; sort?: SortValue }) => {
    const q = new URLSearchParams();
    const s = next.sort ?? sort;
    const p = next.page ?? 1;
    if (s !== 'manual') q.set('sort', s);
    if (p > 1) q.set('page', String(p));
    const qs = q.toString();
    return `/collections/${slug}${qs ? `?${qs}` : ''}`;
  };

  return (
    <div>
      <section
        className="relative flex items-end min-h-[52vh] md:min-h-[62vh] overflow-hidden bg-ink"
        aria-labelledby="collection-title"
      >
        {collection.heroImage ? (
          <SmartImage
            src={collection.heroImage}
            alt=""
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${accent ?? '#1a1b1e'} 0%, #0b0b0c 100%)`,
            }}
            aria-hidden="true"
          />
        )}
        <div
          className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-ink/20"
          aria-hidden="true"
        />

        <div className="u-container relative z-10 pb-12 md:pb-16 pt-24">
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex items-center gap-2 u-label text-paper/60">
              <li>
                <Link href="/" className="hover:text-paper u-focus">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/collections" className="hover:text-paper u-focus">
                  Collections
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-paper">{collection.name}</li>
            </ol>
          </nav>

          <h1
            id="collection-title"
            className="u-display text-4xl md:text-6xl lg:text-7xl font-light text-paper leading-[1.03] mb-4 max-w-3xl"
          >
            {collection.name}
          </h1>
          {collection.tagline ? (
            <p className="text-paper/75 text-lg md:text-xl max-w-xl leading-relaxed">
              {collection.tagline}
            </p>
          ) : null}
          {accent ? (
            <div
              className="mt-8 h-px w-24"
              style={{ backgroundColor: accent }}
              aria-hidden="true"
            />
          ) : null}
        </div>
      </section>

      <div className="u-container py-12 md:py-16">
        {collection.description ? (
          <p className="u-narrow text-ink/70 text-lg leading-relaxed mb-12 md:mb-16">
            {collection.description}
          </p>
        ) : null}

        {/* Sort as links, not a client <select>, so this stays a server component
            and every sorted view has a shareable URL. */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-8 border-b border-line">
          <p className="u-label text-ink/50">
            {total} {total === 1 ? 'piece' : 'pieces'}
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <span className="u-label text-ink/40 mr-2">Sort</span>
            {SORTS.map((s) => {
              const active = s.value === sort;
              return (
                <Link
                  key={s.value}
                  href={href({ sort: s.value })}
                  aria-current={active ? 'true' : undefined}
                  className={`u-label px-3 py-1.5 rounded-md transition-colors u-focus ${
                    active ? 'bg-ink text-paper' : 'text-ink/60 hover:bg-paper-3'
                  }`}
                >
                  {s.label}
                </Link>
              );
            })}
          </div>
        </div>

        {products.length === 0 ? (
          <EmptyState
            title="Nothing in this collection yet"
            description="Pieces are still being added. Browse the full catalogue in the meantime."
            action={
              <Link href="/products" className="u-label underline underline-offset-4 u-focus">
                Shop all products
              </Link>
            }
          />
        ) : (
          <>
            <ul className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-10 md:gap-x-6">
              {products.map((p) => (
                <li key={p.id}>
                  <ProductCard
                    id={p.id}
                    slug={p.slug}
                    name={p.name}
                    subtitle={p.subtitle}
                    basePrice={p.basePrice}
                    compareAtPrice={p.compareAtPrice}
                    images={p.images}
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

            {totalPages > 1 ? (
              <nav className="flex items-center justify-center gap-2 mt-16" aria-label="Pagination">
                {page > 1 ? (
                  <Link
                    href={href({ page: page - 1 })}
                    className="u-label px-4 py-2 rounded-md hover:bg-paper-3 u-focus"
                  >
                    Previous
                  </Link>
                ) : null}
                <span className="u-label text-ink/50 px-4">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages ? (
                  <Link
                    href={href({ page: page + 1 })}
                    className="u-label px-4 py-2 rounded-md hover:bg-paper-3 u-focus"
                  >
                    Next
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
