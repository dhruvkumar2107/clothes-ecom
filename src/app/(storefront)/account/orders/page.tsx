import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCustomerSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { formatCurrency } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My Orders',
  description: 'View and track your orders',
};

interface OrdersPageProps {
  searchParams: Promise<{ page?: string; status?: string }>;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const session = await getCustomerSession();

  if (!session) {
    redirect('/login?redirect=/account/orders');
  }

  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const status = params.status;
  const limit = 10;

  const where: any = { userId: session.userId };
  if (status) where.status = status;

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { placedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        fulfillmentStatus: true,
        grandTotal: true,
        amountPaid: true,
        amountDue: true,
        paymentMethod: true,
        placedAt: true,
        confirmedAt: true,
        deliveredAt: true,
        items: {
          select: {
            id: true,
            name: true,
            sku: true,
            size: true,
            color: true,
            imageUrl: true,
            qty: true,
            lineTotal: true,
            fulfillmentStatus: true,
          },
        },
        _count: { select: { shipments: true } },
      },
    }),
    db.order.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="py-8 md:py-12">
      <div className="u-container">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="u-display text-3xl mb-1">My Orders</h1>
            <p className="text-muted">Track and manage your orders</p>
          </div>
          <Link href="/products">
            <button className="px-4 py-2 text-sm text-accent hover:underline flex items-center gap-1">Continue Shopping</button>
          </Link>
        </div>

        {/* Status Filter */}
        <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Order status filter">
          {['all', 'pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'].map((s) => (
            <button
              key={s}
              onClick={() => window.location.href = s === 'all' ? '/account/orders' : `/account/orders?status=${s}`}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                status === s || (!status && s === 'all')
                  ? 'bg-ink text-paper'
                  : 'bg-paper border border-line text-ink hover:bg-ink-2'
              }`}
              role="tab"
              aria-selected={status === s || (!status && s === 'all')}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-ink/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <h2 className="u-display text-xl mb-2">No orders found</h2>
            <p className="text-muted mb-6">{status ? `No ${status} orders` : 'You haven\'t placed any orders yet.'}</p>
            <Link href="/products">
              <button className="px-6 py-3 bg-ink text-paper rounded-md font-medium hover:bg-ink-2 transition-colors">Start Shopping</button>
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {orders.map((order) => (
                <Link key={order.id} href={`/account/orders/${order.id}`} className="block">
                  <div className="bg-paper rounded-lg border border-line overflow-hidden hover:border-accent/50 transition-colors">
                    <div className="p-4 md:p-6">
                      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <span className="u-label">Order</span>
                          <span className="font-mono font-medium text-ink">{order.orderNumber}</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted">
                          <span>{new Date(order.placedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                          <span>•</span>
                          <span>{order.items.length} item{order.items.length > 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex items-center gap-3 ml-auto">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            order.status === 'delivered' ? 'bg-success/10 text-success' :
                            order.status === 'cancelled' ? 'bg-danger/10 text-danger' :
                            order.status === 'returned' ? 'bg-info/10 text-info' :
                            'bg-warning/10 text-warning'
                          }`}>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </span>
                          {order.paymentStatus !== 'paid' && (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-danger/10 text-danger">
                              {order.amountDue > 0 ? `Due: ${formatCurrency(order.amountDue)}` : order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        {order.items.slice(0, 3).map((item) => (
                          <div key={item.id} className="flex items-center gap-3 w-full sm:w-auto">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt="" className="w-12 h-16 rounded object-cover" />
                            ) : (
                              <div className="w-12 h-16 rounded bg-paper-2 flex items-center justify-center text-muted">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-ink truncate">{item.name}</p>
                              <p className="text-xs text-muted">{item.size} • {item.color} • Qty: {item.qty}</p>
                            </div>
                            <span className="text-sm font-medium text-ink">{formatCurrency(item.lineTotal)}</span>
                          </div>
                        ))}
                        {order.items.length > 3 && (
                          <span className="text-sm text-muted self-center">+{order.items.length - 3} more</span>
                        )}
                      </div>

                      <div className="mt-4 flex items-center justify-between pt-4 border-t border-line">
                        <span className="font-semibold text-ink">{formatCurrency(order.grandTotal)}</span>
                        <span className="text-sm text-accent hover:underline flex items-center gap-1">View Details</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
                <button
                  onClick={() => window.location.href = `/account/orders?page=${page - 1}${status ? `&status=${status}` : ''}`}
                  disabled={page <= 1}
                  className="w-10 h-10 rounded-md border border-line flex items-center justify-center hover:bg-ink-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (page <= 3) pageNum = i + 1;
                  else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = page - 2 + i;

                  return (
                    <button
                      key={pageNum}
                      onClick={() => window.location.href = `/account/orders?page=${pageNum}${status ? `&status=${status}` : ''}`}
                      className={`w-10 h-10 rounded-md flex items-center justify-center font-medium transition-colors ${
                        page === pageNum ? 'bg-ink text-paper' : 'text-ink hover:bg-ink-2'
                      }`}
                      aria-label={`Page ${pageNum}`}
                      aria-current={page === pageNum ? 'page' : undefined}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => window.location.href = `/account/orders?page=${page + 1}${status ? `&status=${status}` : ''}`}
                  disabled={page >= totalPages}
                  className="w-10 h-10 rounded-md border border-line flex items-center justify-center hover:bg-ink-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}