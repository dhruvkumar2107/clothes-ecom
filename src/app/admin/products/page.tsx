import Link from 'next/link';
import { SmartImage } from '@/components/ui/SmartImage';
import { db } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { DeleteRowButton } from '@/components/admin/DeleteRowButton';
import {
  Plus, Edit, ExternalLink, Search, AlertTriangle, Grid, List,
  Star, Sparkles, Tag, Eye, MoreHorizontal, Copy,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const PER_PAGE = 24;

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

const LOW_STOCK = 5;

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; page?: string; gender?: string; collection?: string; view?: string }>;
}

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = (params.q ?? '').trim().slice(0, 80);
  const status = STATUSES.some((s) => s.value === params.status) ? params.status! : '';
  const page = Math.max(1, Number(params.page) || 1);
  const gender = params.gender || '';
  const view = params.view || 'list';

  const where: Record<string, any> = {};
  if (status) where.status = status;
  if (gender) where.gender = gender;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { slug: { contains: q, mode: 'insensitive' } },
      { variants: { some: { sku: { contains: q, mode: 'insensitive' } } } },
      { category: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const [products, total, collections] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true, slug: true, name: true, basePrice: true, compareAtPrice: true, status: true,
        featured: true, gender: true, soldCount: true, ratingAvg: true, createdAt: true,
        category: { select: { name: true, slug: true } },
        images: { take: 1, orderBy: { sortOrder: 'asc' }, select: { url: true, colorKey: true } },
        variants: { select: { sku: true, stock: true, reserved: true, color: true, colorHex: true, size: true } },
        collections: { select: { collection: { select: { name: true, slug: true } } } },
        _count: { select: { images: true, variants: true } },
      },
    }),
    db.product.count({ where }),
    db.collection.findMany({ where: { active: true }, select: { id: true, name: true, slug: true }, orderBy: { sortOrder: 'asc' } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const href = (next: Partial<{ q: string; status: string; page: number; gender: string; view: string }>) => {
    const merged = { q, status, page, gender, view, ...next };
    const search = new URLSearchParams();
    if (merged.q) search.set('q', merged.q);
    if (merged.status) search.set('status', merged.status);
    if (merged.gender) search.set('gender', merged.gender);
    if (merged.page && merged.page > 1) search.set('page', String(merged.page));
    if (merged.view) search.set('view', merged.view);
    const query = search.toString();
    return query ? `/admin/products?${query}` : '/admin/products';
  };

  const getUniqueColors = (variants: { color: string; colorHex: string }[]) => {
    const seen = new Set<string>();
    return variants.filter(v => { if (seen.has(v.color)) return false; seen.add(v.color); return true; });
  };

  const getStatusBadge = (product: any) => {
    const available = product.variants.reduce((acc: number, v: any) => acc + Math.max(0, v.stock - v.reserved), 0);
    const badges: string[] = [];
    if (product.featured) badges.push('FEATURED');
    if (product.soldCount > 20) badges.push('BEST SELLER');
    if (product.compareAtPrice) badges.push('SALE');
    const daysSinceCreation = Math.floor((Date.now() - new Date(product.createdAt).getTime()) / 86400000);
    if (daysSinceCreation <= 14) badges.push('NEW');
    if (available === 0) badges.push('OUT OF STOCK');
    else if (available <= LOW_STOCK) badges.push('LOW STOCK');
    return badges;
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-[#0A0A0A]" style={{ fontFamily: "'Playfair Display', serif" }}>Products</h1>
          <p className="text-[12px] text-[#7A7468] mt-0.5">{total} products in catalogue</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={href({ view: view === 'grid' ? 'list' : 'grid' })} className="flex items-center gap-1.5 bg-white border border-[#E8E5DE] text-[#0A0A0A] px-3 py-1.5 rounded-lg text-[11px] font-medium hover:bg-[#F3F1ED] transition-colors">
            {view === 'grid' ? <List className="w-3.5 h-3.5" /> : <Grid className="w-3.5 h-3.5" />}
            {view === 'grid' ? 'List' : 'Grid'}
          </Link>
          <Link href="/admin/products/new" className="flex items-center gap-1.5 bg-[#0A0A0A] hover:bg-[#1A1A1A] text-white px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors">
            <Plus className="w-3 h-3" /> Add Product
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
        <form method="GET" action="/admin/products" className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9E9789]" />
            <input name="q" defaultValue={q} placeholder="Search name, SKU, category..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#E8E5DE] rounded-lg text-[11px] text-[#0A0A0A] placeholder-[#9E9789] focus:outline-none focus:border-[#9C7C4E]/50 transition-colors" />
          </div>
          {status ? <input type="hidden" name="status" value={status} /> : null}
          {gender ? <input type="hidden" name="gender" value={gender} /> : null}
          <button type="submit" className="px-3 py-1.5 bg-[#0A0A0A] hover:bg-[#1A1A1A] text-white rounded-lg text-[11px] font-medium transition-colors">Search</button>
        </form>

        <div className="flex items-center gap-1.5">
          <div className="flex bg-white border border-[#E8E5DE] rounded-lg overflow-hidden">
            {STATUSES.map((s) => (
              <Link key={s.value || 'all'} href={href({ status: s.value, page: 1 })}
                className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${status === s.value ? 'bg-[#9C7C4E]/10 text-[#9C7C4E]' : 'text-[#7A7468] hover:bg-[#F3F1ED]'}`}>
                {s.label}
              </Link>
            ))}
          </div>
          <div className="flex bg-white border border-[#E8E5DE] rounded-lg overflow-hidden">
            {['', 'men', 'women', 'unisex'].map((g) => (
              <Link key={g || 'all'} href={href({ gender: g, page: 1 })}
                className={`px-2.5 py-1 text-[10px] font-medium capitalize transition-colors ${gender === g ? 'bg-[#9C7C4E]/10 text-[#9C7C4E]' : 'text-[#7A7468] hover:bg-[#F3F1ED]'}`}>
                {g || 'All'}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Grid View */}
      {view === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {products.map((product) => {
            const mainImage = product.images[0]?.url ?? null;
            const available = product.variants.reduce((acc, v) => acc + Math.max(0, v.stock - v.reserved), 0);
            const badges = getStatusBadge(product);
            const colors = getUniqueColors(product.variants);
            return (
              <div key={product.id} className="bg-white rounded-xl border border-[#E8E5DE] overflow-hidden group hover:shadow-md transition-all">
                <div className="relative aspect-[3/4] bg-[#F3F1ED] overflow-hidden">
                  {mainImage ? <SmartImage src={mainImage} alt="" fill className="object-cover group-hover:scale-105 transition-transform duration-500" /> : null}
                  <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                    {badges.slice(0, 2).map((b) => (
                      <span key={b} className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        b === 'FEATURED' ? 'bg-[#9C7C4E] text-white' :
                        b === 'BEST SELLER' ? 'bg-[#0A0A0A] text-white' :
                        b === 'SALE' ? 'bg-red-500 text-white' :
                        b === 'NEW' ? 'bg-blue-500 text-white' :
                        b === 'OUT OF STOCK' ? 'bg-red-600 text-white' :
                        'bg-[#D4A853] text-white'
                      }`}>{b}</span>
                    ))}
                  </div>
                  <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <Link href={`/admin/products/${product.id}`} className="p-1.5 bg-white/90 backdrop-blur rounded-lg text-[#0A0A0A] hover:bg-white"><Edit className="w-3 h-3" /></Link>
                    <Link href={`/products/${product.slug}`} target="_blank" className="p-1.5 bg-white/90 backdrop-blur rounded-lg text-[#0A0A0A] hover:bg-white"><ExternalLink className="w-3 h-3" /></Link>
                  </div>
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-1 mb-1">
                    {colors.slice(0, 4).map((c) => (
                      <span key={c.color} className="w-3 h-3 rounded-full border border-[#E8E5DE]" style={{ backgroundColor: c.colorHex }} title={c.color} />
                    ))}
                    {colors.length > 4 && <span className="text-[8px] text-[#9E9789]">+{colors.length - 4}</span>}
                  </div>
                  <Link href={`/admin/products/${product.id}`} className="text-[11px] font-medium text-[#0A0A0A] hover:text-[#9C7C4E] line-clamp-1 block transition-colors">{product.name}</Link>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-semibold text-[#0A0A0A]">{formatMoney(product.basePrice)}</span>
                    {product.compareAtPrice && <span className="text-[9px] text-[#9E9789] line-through">{formatMoney(product.compareAtPrice)}</span>}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[9px] text-[#7A7468]">{product.category?.name || '—'}</span>
                    <span className={`text-[9px] font-bold ${available === 0 ? 'text-red-500' : available <= LOW_STOCK ? 'text-[#9C7C4E]' : 'text-[#3D6B4D]'}`}>
                      {available} in stock
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-xl border border-[#E8E5DE] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-[#FAF9F7] text-[#7A7468] uppercase text-[9px] tracking-wider border-b border-[#E8E5DE]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Product</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Colors</th>
                  <th className="px-4 py-2.5 font-medium">Price</th>
                  <th className="px-4 py-2.5 font-medium">Stock</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Badges</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F1ED]">
                {products.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-[#9E9789]">
                    {q || status ? 'No products match this filter.' : 'No products yet. Click "Add Product" to create your first listing.'}
                  </td></tr>
                ) : products.map((product) => {
                  const mainImage = product.images[0]?.url ?? null;
                  const available = product.variants.reduce((acc, v) => acc + Math.max(0, v.stock - v.reserved), 0);
                  const low = available <= LOW_STOCK;
                  const badges = getStatusBadge(product);
                  const colors = getUniqueColors(product.variants);
                  return (
                    <tr key={product.id} className="hover:bg-[#FAF9F7] transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="relative w-9 h-11 rounded-md overflow-hidden bg-[#F3F1ED] shrink-0">
                            {mainImage ? <SmartImage src={mainImage} alt="" fill sizes="36px" className="object-cover" /> : null}
                          </div>
                          <div className="min-w-0">
                            <Link href={`/admin/products/${product.id}`} className="font-medium text-[#0A0A0A] hover:text-[#9C7C4E] transition-colors block truncate max-w-[20ch] text-[11px]">{product.name}</Link>
                            <p className="text-[9px] text-[#9E9789] mt-0.5">{product.variants[0]?.sku ?? product.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-[#7A7468]">{product.category?.name ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-0.5">
                          {colors.slice(0, 3).map((c) => (
                            <span key={c.color} className="w-3.5 h-3.5 rounded-full border border-[#E8E5DE]" style={{ backgroundColor: c.colorHex }} title={c.color} />
                          ))}
                          {colors.length > 3 && <span className="text-[8px] text-[#9E9789] ml-0.5">+{colors.length - 3}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-medium text-[#0A0A0A]">{formatMoney(product.basePrice)}</span>
                        {product.compareAtPrice && <span className="block text-[9px] text-[#9E9789] line-through">{formatMoney(product.compareAtPrice)}</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-0.5 tabular-nums font-medium ${available === 0 ? 'text-red-600' : low ? 'text-[#9C7C4E]' : 'text-[#0A0A0A]'}`}>
                          {low && available > 0 && <AlertTriangle className="w-2.5 h-2.5" />}
                          {available}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${
                          product.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                          product.status === 'draft' ? 'bg-yellow-50 text-yellow-600 border border-yellow-200' :
                          'bg-[#F3F1ED] text-[#7A7468] border border-[#E8E5DE]'
                        }`}>{product.status}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-0.5">
                          {badges.slice(0, 3).map((b) => (
                            <span key={b} className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded ${
                              b === 'FEATURED' ? 'bg-[#9C7C4E]/10 text-[#9C7C4E]' :
                              b === 'BEST SELLER' ? 'bg-[#0A0A0A]/10 text-[#0A0A0A]' :
                              b === 'SALE' ? 'bg-red-50 text-red-600' :
                              b === 'NEW' ? 'bg-blue-50 text-blue-600' :
                              b === 'OUT OF STOCK' ? 'bg-red-50 text-red-600' :
                              'bg-[#D4A853]/10 text-[#9C7C4E]'
                            }`}>{b}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/admin/products/${product.id}`} className="p-1.5 text-[#7A7468] hover:text-[#9C7C4E] hover:bg-[#F3F1ED] rounded-md transition-colors" title="Edit"><Edit className="w-3 h-3" /></Link>
                          <Link href={`/products/${product.slug}`} target="_blank" className="p-1.5 text-[#7A7468] hover:text-[#9C7C4E] hover:bg-[#F3F1ED] rounded-md transition-colors" title="View on store"><ExternalLink className="w-3 h-3" /></Link>
                          <DeleteRowButton endpoint={`/api/admin/products/${product.id}`} name={product.name} kind="product" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 ? (
        <nav className="flex items-center justify-between" aria-label="Pagination">
          <p className="text-[10px] text-[#9E9789]">
            Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            {page > 1 && (
              <Link href={href({ page: page - 1 })} className="px-3 py-1.5 text-[10px] bg-white border border-[#E8E5DE] hover:bg-[#F3F1ED] text-[#0A0A0A] rounded-lg transition-colors">Previous</Link>
            )}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = page <= 3 ? i + 1 : page + i - 2;
              if (p < 1 || p > totalPages) return null;
              return (
                <Link key={p} href={href({ page: p })}
                  className={`px-2.5 py-1.5 text-[10px] rounded-lg transition-colors ${p === page ? 'bg-[#9C7C4E] text-white font-semibold' : 'bg-white border border-[#E8E5DE] hover:bg-[#F3F1ED] text-[#0A0A0A]'}`}>
                  {p}
                </Link>
              );
            })}
            {page < totalPages && (
              <Link href={href({ page: page + 1 })} className="px-3 py-1.5 text-[10px] bg-white border border-[#E8E5DE] hover:bg-[#F3F1ED] text-[#0A0A0A] rounded-lg transition-colors">Next</Link>
            )}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
