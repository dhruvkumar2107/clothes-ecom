import Link from 'next/link';
import { db } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { SmartImage } from '@/components/ui/SmartImage';
import { Search, AlertTriangle, Package, ArrowUpDown, Edit } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PER_PAGE = 30;

interface PageProps {
  searchParams: Promise<{ q?: string; filter?: string; page?: string }>;
}

export default async function AdminInventoryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = (params.q ?? '').trim().slice(0, 80);
  const filter = params.filter || '';
  const page = Math.max(1, Number(params.page) || 1);

  const where: Record<string, any> = { product: { status: 'active' } };

  if (filter === 'low') {
    where.stock = { lte: 5, gt: 0 };
  } else if (filter === 'out') {
    where.stock = 0;
  } else if (filter === 'in-stock') {
    where.stock = { gt: 5 };
  }

  if (q) {
    where.OR = [
      { sku: { contains: q, mode: 'insensitive' } },
      { color: { contains: q, mode: 'insensitive' } },
      { size: { contains: q, mode: 'insensitive' } },
      { product: { name: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const [variants, total, summary] = await Promise.all([
    db.productVariant.findMany({
      where,
      orderBy: { stock: 'asc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true, sku: true, size: true, color: true, colorHex: true, stock: true, reserved: true,
        lowStockThreshold: true, active: true,
        product: { select: { id: true, name: true, slug: true, basePrice: true, images: { take: 1, select: { url: true } } } },
      },
    }),
    db.productVariant.count({ where }),
    db.productVariant.aggregate({
      where: { product: { status: 'active' } },
      _sum: { stock: true, reserved: true },
      _count: true,
    }),
  ]);

  const lowStockCount = await db.productVariant.count({ where: { product: { status: 'active' }, stock: { lte: 5, gt: 0 } } });
  const outOfStockCount = await db.productVariant.count({ where: { product: { status: 'active' }, stock: 0 } });

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const totalStock = Number(summary._sum.stock ?? 0);
  const totalReserved = Number(summary._sum.reserved ?? 0);

  const href = (next: Partial<{ q: string; filter: string; page: number }>) => {
    const merged = { q, filter, page, ...next };
    const search = new URLSearchParams();
    if (merged.q) search.set('q', merged.q);
    if (merged.filter) search.set('filter', merged.filter);
    if (merged.page && merged.page > 1) search.set('page', String(merged.page));
    const query = search.toString();
    return query ? `/admin/inventory?${query}` : '/admin/inventory';
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold text-[#0A0A0A]" style={{ fontFamily: "'Playfair Display', serif" }}>Inventory</h1>
        <p className="text-[12px] text-[#7A7468] mt-0.5">Track and manage stock across all variants</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Variants', value: summary._count, icon: Package, color: '#9C7C4E' },
          { label: 'Total Stock', value: totalStock, icon: Package, color: '#3D6B4D' },
          { label: 'Low Stock', value: lowStockCount, icon: AlertTriangle, color: lowStockCount > 0 ? '#F59E0B' : '#3D6B4D' },
          { label: 'Out of Stock', value: outOfStockCount, icon: AlertTriangle, color: outOfStockCount > 0 ? '#EF4444' : '#3D6B4D' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[#E8E5DE] p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className="w-3.5 h-3.5" style={{ color: s.color }} />
              <span className="text-[10px] font-medium text-[#7A7468]">{s.label}</span>
            </div>
            <div className="text-lg font-bold text-[#0A0A0A]">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
        <form method="GET" action="/admin/inventory" className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9E9789]" />
            <input name="q" defaultValue={q} placeholder="Search by SKU, product, color, size..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#E8E5DE] rounded-lg text-[11px] text-[#0A0A0A] placeholder-[#9E9789] focus:outline-none focus:border-[#9C7C4E]/50 transition-colors" />
          </div>
          {filter ? <input type="hidden" name="filter" value={filter} /> : null}
          <button type="submit" className="px-3 py-1.5 bg-[#0A0A0A] hover:bg-[#1A1A1A] text-white rounded-lg text-[11px] font-medium transition-colors">Search</button>
        </form>
        <div className="flex bg-white border border-[#E8E5DE] rounded-lg overflow-hidden">
          {[
            { value: '', label: 'All' },
            { value: 'in-stock', label: 'In Stock' },
            { value: 'low', label: 'Low Stock' },
            { value: 'out', label: 'Out of Stock' },
          ].map((f) => (
            <Link key={f.value} href={href({ filter: f.value, page: 1 })}
              className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${filter === f.value ? 'bg-[#9C7C4E]/10 text-[#9C7C4E]' : 'text-[#7A7468] hover:bg-[#F3F1ED]'}`}>
              {f.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-[#E8E5DE] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-[#FAF9F7] text-[#7A7468] uppercase text-[9px] tracking-wider border-b border-[#E8E5DE]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Product</th>
                <th className="px-4 py-2.5 font-medium">SKU</th>
                <th className="px-4 py-2.5 font-medium">Color</th>
                <th className="px-4 py-2.5 font-medium">Size</th>
                <th className="px-4 py-2.5 font-medium text-center">Stock</th>
                <th className="px-4 py-2.5 font-medium text-center">Reserved</th>
                <th className="px-4 py-2.5 font-medium text-center">Available</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F1ED]">
              {variants.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-[#9E9789]">No variants found.</td></tr>
              ) : variants.map((v) => {
                const available = Math.max(0, v.stock - v.reserved);
                const isLow = available > 0 && available <= v.lowStockThreshold;
                const isOut = available === 0;
                return (
                  <tr key={v.id} className="hover:bg-[#FAF9F7] transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-9 rounded bg-[#F3F1ED] overflow-hidden shrink-0">
                          {v.product.images[0] && <SmartImage src={v.product.images[0].url} alt="" fill sizes="28px" className="object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <Link href={`/admin/products/${v.product.id}`} className="text-[11px] font-medium text-[#0A0A0A] hover:text-[#9C7C4E] truncate block max-w-[18ch]">{v.product.name}</Link>
                          <span className="text-[9px] text-[#9E9789]">{formatMoney(v.product.basePrice)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[10px] text-[#7A7468]">{v.sku}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full border border-[#E8E5DE]" style={{ backgroundColor: v.colorHex }} />
                        <span className="text-[11px] text-[#0A0A0A]">{v.color}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[#0A0A0A] font-medium">{v.size}</td>
                    <td className="px-4 py-2.5 text-center font-mono font-medium text-[#0A0A0A]">{v.stock}</td>
                    <td className="px-4 py-2.5 text-center font-mono text-[#7A7468]">{v.reserved}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`font-mono font-bold ${isOut ? 'text-red-600' : isLow ? 'text-[#9C7C4E]' : 'text-[#3D6B4D]'}`}>
                        {available}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${
                        isOut ? 'bg-red-50 text-red-600 border border-red-200' :
                        isLow ? 'bg-[#D4A853]/10 text-[#9C7C4E] border border-[#D4A853]/20' :
                        'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      }`}>
                        {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/admin/products/${v.product.id}`} className="p-1.5 text-[#7A7468] hover:text-[#9C7C4E] hover:bg-[#F3F1ED] rounded-md transition-colors inline-flex" title="Edit Product">
                        <Edit className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <nav className="flex items-center justify-between" aria-label="Pagination">
          <p className="text-[10px] text-[#9E9789]">Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total}</p>
          <div className="flex items-center gap-1">
            {page > 1 && <Link href={href({ page: page - 1 })} className="px-3 py-1.5 text-[10px] bg-white border border-[#E8E5DE] hover:bg-[#F3F1ED] rounded-lg transition-colors">Previous</Link>}
            {page < totalPages && <Link href={href({ page: page + 1 })} className="px-3 py-1.5 text-[10px] bg-white border border-[#E8E5DE] hover:bg-[#F3F1ED] rounded-lg transition-colors">Next</Link>}
          </div>
        </nav>
      )}
    </div>
  );
}
