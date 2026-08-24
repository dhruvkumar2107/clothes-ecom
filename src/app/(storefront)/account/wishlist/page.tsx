import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCustomerSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { formatCurrency } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My Wishlist',
  description: 'Your saved items',
};

export default async function WishlistPage() {
  const session = await getCustomerSession();

  if (!session) {
    redirect('/login?redirect=/account/wishlist');
  }

  const wishlist = await db.wishlistItem.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      variantId: true,
      createdAt: true,
      product: {
        select: {
          id: true,
          slug: true,
          name: true,
          basePrice: true,
          compareAtPrice: true,
          images: {
            where: { kind: 'gallery' },
            orderBy: { sortOrder: 'asc' },
            take: 1,
            select: { url: true, alt: true },
          },
          status: true,
          variants: {
            where: { active: true },
            select: { id: true, size: true, color: true, colorHex: true, priceDelta: true, stock: true, reserved: true },
          },
        },
      },
      variant: {
        select: {
          id: true,
          size: true,
          color: true,
          colorHex: true,
          priceDelta: true,
          stock: true,
          reserved: true,
        },
      },
    },
  });

  return (
    <div className="py-8 md:py-12">
      <div className="u-container">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="u-display text-3xl mb-1">My Wishlist</h1>
            <p className="text-muted">{wishlist.length} saved item{wishlist.length !== 1 ? 's' : ''}</p>
          </div>
          <Link href="/products">
            <button className="px-4 py-2 text-sm text-accent hover:underline flex items-center gap-1">Continue Shopping</button>
          </Link>
        </div>

        {wishlist.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-ink/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h2 className="u-display text-xl mb-2">Your wishlist is empty</h2>
            <p className="text-muted mb-6">Save items you love for later</p>
            <Link href="/products">
              <button className="px-6 py-3 bg-ink text-paper rounded-md font-medium hover:bg-ink-2 transition-colors">Start Shopping</button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {wishlist.map((item) => {
              const product = item.product;
              const variant = item.variant;
              const inStock = variant && variant.stock - variant.reserved > 0;
              const price = variant ? product.basePrice + variant.priceDelta : product.basePrice;
              const hasDiscount = product.compareAtPrice && product.compareAtPrice > price;

              return (
                <article key={item.id} className="group relative bg-paper rounded-lg border border-line overflow-hidden transition-all duration-300 hover:shadow-lg">
                  <Link href={`/products/${product.slug}`} className="block relative aspect-[3/4] overflow-hidden bg-paper-2">
                    {product.images[0]?.url ? (
                      <img src={product.images[0].url} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                    )}
                    {!inStock && (
                      <div className="absolute inset-0 bg-ink/60 flex items-center justify-center">
                        <span className="text-paper text-sm font-medium">Out of Stock</span>
                      </div>
                    )}
                  </Link>

                  <div className="p-4">
                    <h3 className="font-medium text-sm text-ink line-clamp-2 mb-2">
                      <Link href={`/products/${product.slug}`} className="hover:text-accent transition-colors">{product.name}</Link>
                    </h3>

                    {variant && (
                      <div className="flex items-center gap-2 text-xs text-muted mb-2">
                        <span>Size: {variant.size}</span>
                        <span>•</span>
                        <span style={{ color: variant.colorHex }}>●</span>
                        <span>{variant.color}</span>
                      </div>
                    )}

                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="font-semibold text-sm text-ink">{formatCurrency(price)}</span>
                      {hasDiscount && <span className="text-sm text-muted line-through">{formatCurrency(product.compareAtPrice!)}</span>}
                    </div>

                    <div className="flex gap-2">
                      <button
                        className="flex-1 px-3 py-2 bg-ink text-paper rounded-md text-sm font-medium hover:bg-ink-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!inStock}
                      >
                        Add to Bag
                      </button>
                      <button className="px-3 py-2 border border-line rounded-md text-sm text-muted hover:text-danger hover:border-danger transition-colors" aria-label="Remove from wishlist">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}