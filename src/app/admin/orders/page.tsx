import Link from 'next/link';
import { db } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { Eye } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PER_PAGE = 25;

interface PageProps {
  searchParams: Promise<{ page?: string; status?: string }>;
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const status = params.status || '';

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { placedAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        orderNumber: true,
        placedAt: true,
        grandTotal: true,
        status: true,
        paymentStatus: true,
        user: { select: { name: true, email: true } },
        items: { select: { qty: true } },
      },
    }),
    db.order.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const href = (next: Partial<{ page: number; status: string }>) => {
    const merged = { page, status, ...next };
    const search = new URLSearchParams();
    if (merged.page > 1) search.set('page', String(merged.page));
    if (merged.status) search.set('status', merged.status);
    const query = search.toString();
    return query ? `/admin/orders?${query}` : '/admin/orders';
  };

  const statuses = ['', 'pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between pb-6 border-b border-zinc-800/80">
        <div>
          <h1 className="text-2xl font-serif font-bold text-zinc-100 tracking-wide">Orders & Refunds Control</h1>
          <p className="text-xs text-zinc-400 mt-1">{total} total orders — review purchases, issue refunds, manage fulfillment.</p>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {statuses.map((s) => (
          <Link
            key={s || 'all'}
            href={href({ status: s, page: 1 })}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider border transition-colors ${
              status === s
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'text-zinc-400 border-zinc-800 hover:bg-zinc-800'
            }`}
          >
            {s || 'All'}
          </Link>
        ))}
      </div>

      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4">Order #</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Items</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4">Fulfillment</th>
                <th className="px-6 py-4">Payment</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                    No orders found.
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const totalItems = order.items.reduce((acc, item) => acc + item.qty, 0);
                  return (
                    <tr key={order.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-amber-300">
                        #{order.orderNumber}
                        <span className="block text-[10px] text-zinc-500 font-sans font-normal mt-0.5">
                          {new Date(order.placedAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-zinc-100 block">{order.user.name}</span>
                        <span className="text-[10px] text-zinc-400 font-mono">{order.user.email}</span>
                      </td>
                      <td className="px-6 py-4 font-mono text-zinc-200">{totalItems} items</td>
                      <td className="px-6 py-4 font-mono font-semibold text-zinc-100">{formatMoney(order.grandTotal)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          order.status === 'delivered' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : order.status === 'shipped' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : order.status === 'cancelled' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          order.paymentStatus === 'paid' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : order.paymentStatus === 'refunded' || order.paymentStatus === 'partially_refunded' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="inline-flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded text-xs font-medium transition-colors border border-zinc-700/60"
                        >
                          <Eye className="w-3.5 h-3.5 text-amber-400" /> Details
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <nav className="flex items-center justify-between" aria-label="Pagination">
          {page > 1 ? (
            <Link href={href({ page: page - 1 })} className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors">
              Previous
            </Link>
          ) : <span />}
          <span className="text-xs text-zinc-500">Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link href={href({ page: page + 1 })} className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors">
              Next
            </Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
