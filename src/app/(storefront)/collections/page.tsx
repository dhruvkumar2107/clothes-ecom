import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { getCollectionsForIndex } from '@/lib/api-server';
import { EmptyState } from '@/components/ui/EmptyState';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Collections',
  description:
    'Seasonal edits, editorial lookbooks and limited drops from LUMEN&CO — engineered fabrics and sculptural silhouettes.',
  openGraph: {
    title: 'Collections | LUMEN&CO',
    description: 'Seasonal edits, editorial lookbooks and limited drops from LUMEN&CO.',
  },
};

/** Human labels for Collection.kind (seasonal | editorial | lookbook | drop). */
const KIND_LABEL: Record<string, string> = {
  seasonal: 'Seasonal',
  editorial: 'Editorial',
  lookbook: 'Lookbook',
  drop: 'Limited drop',
};

export default async function CollectionsPage() {
  let collections: Awaited<ReturnType<typeof getCollectionsForIndex>> = [];
  try {
    collections = await getCollectionsForIndex();
  } catch {
    // DB unavailable during build — render empty state
  }

  return (
    <div className="py-12 md:py-20">
      <div className="u-container">
        <header className="max-w-2xl mb-12 md:mb-16">
          <p className="u-label text-ink/50 mb-4">Collections</p>
          <h1 className="u-display text-4xl md:text-6xl font-light text-ink leading-[1.05] mb-6">
            Edits, drops <br /> and lookbooks
          </h1>
          <p className="text-ink/60 text-lg leading-relaxed">
            Each collection is a closed set — designed together, released
            together, and never restocked once it closes.
          </p>
        </header>

        {collections.length === 0 ? (
          <EmptyState
            title="No collections yet"
            description="New edits are being prepared. In the meantime, browse the full catalogue."
            action={
              <Link href="/products" className="u-label underline underline-offset-4 u-focus">
                Shop all products
              </Link>
            }
          />
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {collections.map((c, i) => {
              const count = c._count.products;
              return (
                <li key={c.id}>
                  <Link
                    href={`/collections/${c.slug}`}
                    className="group block rounded-lg overflow-hidden bg-paper-2 u-focus"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-ink-2">
                      {c.heroImage ? (
                        <Image
                          src={c.heroImage}
                          alt={c.name}
                          fill
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover transition-transform duration-700 ease-lux group-hover:scale-[1.04]"
                          /* First row is above the fold on most viewports. */
                          priority={i < 3}
                        />
                      ) : (
                        <div
                          className="absolute inset-0"
                          style={{
                            background: `linear-gradient(135deg, ${c.accentHex ?? '#1a1b1e'} 0%, #0b0b0c 100%)`,
                          }}
                          aria-hidden="true"
                        />
                      )}
                      <div
                        className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/20 to-transparent"
                        aria-hidden="true"
                      />

                      <div className="absolute inset-x-0 bottom-0 p-6">
                        <p className="u-label text-paper/70 mb-2">
                          {KIND_LABEL[c.kind] ?? c.kind}
                          {count > 0 ? ` · ${count} piece${count === 1 ? '' : 's'}` : ''}
                        </p>
                        <h2 className="u-display text-2xl md:text-3xl font-light text-paper mb-1">
                          {c.name}
                        </h2>
                        {c.tagline ? (
                          <p className="text-paper/70 text-sm leading-relaxed">{c.tagline}</p>
                        ) : null}
                        <span className="mt-4 inline-flex items-center gap-1 u-label text-paper">
                          View collection
                          <ArrowRight
                            className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1"
                            aria-hidden="true"
                          />
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
