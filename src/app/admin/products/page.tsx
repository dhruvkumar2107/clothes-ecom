import Link from 'next/link';
import Image from 'next/image';
import { db } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { DeleteRowButton } from '@/components/admin/DeleteRowButton';
import { Plus, Edit, ExternalLink, Search, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PER_PAGE = 25;

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

/** Below this, the row is flagged so the operator can reorder. */
const LOW_STOCK = 5;

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = (params.q ?? '').trim().slice(0, 80);
  const status = STATUSES.some((s) => s.value === params.status) ? params.status! : '';
  const page = Math.max(1, Number(params.page) || 1);

  const where = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { slug: { contains: q, mode: 'insensitive' as const } },
            // SKUs live on the variants, so a SKU search matches through them.
            { variants: { some: { sku: { contains: q, mode: 'insensitive' as const } } } },
          ],
        }
      : {}),
  };

  // Paginated — the catalogue only grows, and an unbounded findMany here would
  // eventually time out the admin.
  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        slug: true,
        name: true,
        basePrice: true,
        status: true,
        category: { select: { name: true } },
        images: { take: 1, orderBy: { sortOrder: 'asc' }, select: { url: true } },
        variants: { select: { sku: true, stock: true, reserved: true } },
      },
    }),
    db.product.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const href = (next: Partial<{ q: string; status: string; page: number }>) => {
    const merged = { q, status, page, ...next };
    const search = new URLSearchParams();
    if (merged.q) search.set('q', merged.q);
    if (merged.status) search.set('status', merged.status);
    if (merged.page > 1) search.set('page', String(merged.page));
    const query = search.toString();
    return query ? `/admin/products?${query}` : '/admin/products';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <h1 className="text-2xl font-serif font-bold text-zinc-100 tracking-wide">
            Product Catalogue
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            {total} {total === 1 ? 'product' : 'products'} — manage listings, inventory, prices and
            imagery.
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2 rounded-lg text-xs font-semibold shadow-md shadow-amber-500/10 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add Product
        </Link>
      </div>

      {/* Filters. A GET form and links, so every view has a shareable URL. */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <form method="GET" action="/admin/products" className="flex gap-2 flex-1 max-w-md">
          <label htmlFor="admin-product-q" className="sr-only">
            Search products
          </label>
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500"
              aria-hidden="true"
            />
            <input
              id="admin-product-q"
              name="q"
              defaultValue={q}
              placeholder="Name, slug or SKU"
              className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/60"
            />
          </div>
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <button
            type="submit"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs font-semibold text-zinc-200 transition-colors"
          >
            Search
          </button>
        </form>

        <div className="flex gap-1.5">
          {STATUSES.map((s) => (
            <Link
              key={s.value || 'all'}
              href={href({ status: s.value, page: 1 })}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider border transition-colors ${
                status === s.value
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'text-zinc-400 border-zinc-800 hover:bg-zinc-800'
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Base Price</th>
                <th className="px-6 py-4">Available</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                    {q || status
                      ? 'No products match this filter.'
                      : 'No products added yet. Click “Add Product” to create your first listing.'}
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const mainImage = product.images[0]?.url ?? null;
                  // Reserved units are already promised to open carts and orders.
                  const available = product.variants.reduce(
                    (acc, v) => acc + Math.max(0, v.stock - v.reserved),
                    0,
                  );
                  const low = available <= LOW_STOCK;

                  return (
                    <tr key={product.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3.5">
                          <div className="relative w-12 h-14 rounded-md overflow-hidden bg-zinc-800 border border-zinc-700/60 shrink-0">
                            {mainImage ? (
                              <Image
                                src={mainImage}
                                alt=""
                                fill
                                sizes="48px"
                                className="object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/admin/products/${product.id}`}
                              className="font-medium text-zinc-100 hover:text-amber-400 transition-colors block truncate max-w-[22ch]"
                            >
                              {product.name}
                            </Link>
                            <p className="text-[10px] text-zinc-500 mt-0.5">
                              {product.variants[0]?.sku ?? product.slug}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-zinc-400">
                        {product.category?.name ?? '—'}
                      </td>
                      <td className="px-6 py-4 text-zinc-200 tabular-nums">
                        {formatMoney(product.basePrice)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 tabular-nums ${
                            available === 0
                              ? 'text-rose-400'
                              : low
                                ? 'text-amber-400'
                                : 'text-zinc-200'
                          }`}
                        >
                          {low ? (
                            <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                          ) : null}
                          {available} units
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            product.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                          }`}
                        >
                          {product.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded transition-colors"
                            title="Edit product"
                          >
                            <Edit className="w-4 h-4" aria-hidden="true" />
                          </Link>
                          <Link
                            href={`/products/${product.slug}`}
                            target="_blank"
                            className="p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded transition-colors"
                            title="View on storefront"
                          >
                            <ExternalLink className="w-4 h-4" aria-hidden="true" />
                          </Link>
                          <DeleteRowButton
                            endpoint={`/api/admin/products/${product.id}`}
                            name={product.name}
                            kind="product"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between" aria-label="Pagination">
          {page > 1 ? (
            <Link
              href={href({ page: page - 1 })}
              className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-zinc-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={href({ page: page + 1 })}
              className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              Next
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
