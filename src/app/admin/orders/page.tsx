import Link from 'next/link';
import { db } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { Eye, Search, Filter, ArrowUpDown } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PER_PAGE = 25;

interface PageProps {
  searchParams: Promise<{ page?: string; status?: string; q?: string }>;
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const status = params.status || '';
  const q = (params.q ?? '').trim().slice(0, 80);

  const where: Record<string, any> = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { orderNumber: { contains: q, mode: 'insensitive' } },
      { user: { name: { contains: q, mode: 'insensitive' } } },
      { user: { email: { contains: q, mode: 'insensitive' } } },
    ];
  }

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { placedAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true, orderNumber: true, placedAt: true, grandTotal: true, status: true,
        paymentStatus: true, paymentMethod: true, shippingTotal: true, discountTotal: true,
        items: { select: { qty: true, name: true, size: true, color: true } },
        user: { select: { name: true, email: true } },
      },
    }),
    db.order.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const href = (next: Partial<{ page: number; status: string; q: string }>) => {
    const merged = { page, status, q, ...next };
    const search = new URLSearchParams();
    if (merged.page && merged.page > 1) search.set('page', String(merged.page));
    if (merged.status) search.set('status', merged.status);
    if (merged.q) search.set('q', merged.q);
    const query = search.toString();
    return query ? `/admin/orders?${query}` : '/admin/orders';
  };

  const statuses = ['', 'pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'];

  const statusColors: Record<string, string> = {
    pending: 'bg-[#D4A853]/10 text-[#9C7C4E] border border-[#D4A853]/20',
    confirmed: 'bg-blue-50 text-blue-600 border border-blue-200',
    processing: 'bg-purple-50 text-purple-600 border border-purple-200',
    packed: 'bg-indigo-50 text-indigo-600 border border-indigo-200',
    shipped: 'bg-indigo-50 text-indigo-600 border border-indigo-200',
    delivered: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
    cancelled: 'bg-red-50 text-red-600 border border-red-200',
    returned: 'bg-orange-50 text-orange-600 border border-orange-200',
  };

  const paymentColors: Record<string, string> = {
    paid: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
    unpaid: 'bg-[#D4A853]/10 text-[#9C7C4E] border border-[#D4A853]/20',
    refunded: 'bg-purple-50 text-purple-600 border border-purple-200',
    partially_refunded: 'bg-purple-50 text-purple-600 border border-purple-200',
    failed: 'bg-red-50 text-red-600 border border-red-200',
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#0A0A0A]" style={{ fontFamily: "'Playfair Display', serif" }}>Orders</h1>
          <p className="text-[12px] text-[#7A7468] mt-0.5">{total} total orders</p>
        </div>
      </div>

      {/* Search */}
      <form method="GET" action="/admin/orders" className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9E9789]" />
          <input name="q" defaultValue={q} placeholder="Search by order number, customer..."
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#E8E5DE] rounded-lg text-[11px] text-[#0A0A0A] placeholder-[#9E9789] focus:outline-none focus:border-[#9C7C4E]/50 transition-colors" />
        </div>
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <button type="submit" className="px-3 py-1.5 bg-[#0A0A0A] hover:bg-[#1A1A1A] text-white rounded-lg text-[11px] font-medium transition-colors">Search</button>
      </form>

      {/* Status Filters */}
      <div className="flex gap-1 flex-wrap">
        {statuses.map((s) => (
          <Link key={s || 'all'} href={href({ status: s, page: 1 })}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              status === s
                ? 'bg-[#9C7C4E]/10 text-[#9C7C4E] border border-[#9C7C4E]/20'
                : 'text-[#7A7468] border border-[#E8E5DE] hover:bg-[#F3F1ED]'
            }`}>
            {s || 'All'}
          </Link>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-[#E8E5DE] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-[#FAF9F7] text-[#7A7468] uppercase text-[9px] tracking-wider border-b border-[#E8E5DE]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Order</th>
                <th className="px-4 py-2.5 font-medium">Customer</th>
                <th className="px-4 py-2.5 font-medium">Items</th>
                <th className="px-4 py-2.5 font-medium">Total</th>
                <th className="px-4 py-2.5 font-medium">Payment</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F1ED]">
              {orders.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-[#9E9789]">No orders found.</td></tr>
              ) : orders.map((order) => {
                const totalItems = order.items.reduce((acc, item) => acc + item.qty, 0);
                const itemSummary = order.items.slice(0, 2).map(i => i.name).join(', ') + (order.items.length > 2 ? ` +${order.items.length - 2} more` : '');
                return (
                  <tr key={order.id} className="hover:bg-[#FAF9F7] transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/orders/${order.id}`} className="font-mono font-semibold text-[#9C7C4E] hover:underline text-[11px]">#{order.orderNumber}</Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-[#0A0A0A] block text-[11px]">{order.user.name}</span>
                      <span className="text-[9px] text-[#9E9789]">{order.user.email}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[#0A0A0A]">{totalItems} items</span>
                      <span className="block text-[9px] text-[#9E9789] truncate max-w-[16ch]">{itemSummary}</span>
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-[#0A0A0A]">{formatMoney(order.grandTotal)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${paymentColors[order.paymentStatus] || 'bg-gray-50 text-gray-600'}`}>
                        {order.paymentStatus}
                      </span>
                      <span className="block text-[9px] text-[#9E9789] mt-0.5 capitalize">{order.paymentMethod || '—'}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${statusColors[order.status] || 'bg-gray-50 text-gray-600'}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[10px] text-[#7A7468]">{new Date(order.placedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/admin/orders/${order.id}`}
                        className="inline-flex items-center gap-1 bg-[#F3F1ED] hover:bg-[#E8E5DE] text-[#0A0A0A] px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors">
                        <Eye className="w-3 h-3" /> View
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
