import Link from 'next/link';
import { db } from '@/lib/db';
import { Bell, Package, ShoppingBag, Star, AlertTriangle, Users, MessageSquare } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminNotificationsPage() {
  const [lowStockProducts, pendingOrders, pendingReviews, newCustomers, pendingReturns] = await Promise.all([
    db.productVariant.findMany({
      where: { stock: { lte: 5 }, product: { status: 'active' } },
      take: 20,
      select: {
        id: true, size: true, color: true, stock: true,
        product: { select: { name: true, slug: true } },
      },
      orderBy: { stock: 'asc' },
    }),
    db.order.findMany({
      where: { status: { in: ['pending', 'confirmed'] } },
      take: 10,
      orderBy: { placedAt: 'desc' },
      select: {
        id: true, orderNumber: true, grandTotal: true, status: true, placedAt: true,
        user: { select: { name: true } },
      },
    }),
    db.review.findMany({
      where: { status: 'pending' },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, rating: true, body: true, createdAt: true,
        product: { select: { name: true } },
        user: { select: { name: true } },
      },
    }),
    db.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    db.return.findMany({
      where: { status: { in: ['requested', 'approved'] } },
      take: 5,
      select: {
        id: true, returnNumber: true, reason: true, status: true, requestedAt: true,
        order: { select: { orderNumber: true } },
        user: { select: { name: true } },
      },
    }),
  ]);

  const notifications = [
    ...lowStockProducts.map(p => ({
      type: 'low_stock' as const,
      icon: AlertTriangle,
      color: '#EF4444',
      title: `${p.product.name} — ${p.size}/${p.color}`,
      detail: `${p.stock} units remaining`,
      href: '/admin/inventory',
      time: '',
    })),
    ...pendingOrders.map(o => ({
      type: 'order' as const,
      icon: ShoppingBag,
      color: '#F59E0B',
      title: `Order #${o.orderNumber} — ${o.user.name}`,
      detail: `Needs processing`,
      href: `/admin/orders/${o.id}`,
      time: new Date(o.placedAt).toLocaleDateString(),
    })),
    ...pendingReviews.map(r => ({
      type: 'review' as const,
      icon: Star,
      color: '#8B5CF6',
      title: `Review by ${r.user.name || 'Anonymous'}`,
      detail: `${r.product.name} — ${r.rating}/5`,
      href: '/admin/reviews',
      time: new Date(r.createdAt).toLocaleDateString(),
    })),
    ...pendingReturns.map(r => ({
      type: 'return' as const,
      icon: MessageSquare,
      color: '#F97316',
      title: `Return ${r.returnNumber} — ${r.user.name}`,
      detail: `Order #${r.order.orderNumber} · ${r.reason}`,
      href: '/admin/orders',
      time: new Date(r.requestedAt).toLocaleDateString(),
    })),
    ...newCustomers.map(c => ({
      type: 'customer' as const,
      icon: Users,
      color: '#3D6B4D',
      title: `New customer: ${c.name || c.email}`,
      detail: 'Just signed up',
      href: `/admin/users/${c.id}`,
      time: new Date(c.createdAt).toLocaleDateString(),
    })),
  ].sort((a, b) => {
    if (!a.time || !b.time) return 0;
    return new Date(b.time).getTime() - new Date(a.time).getTime();
  });

  const typeLabels: Record<string, string> = {
    low_stock: 'Low Stock',
    order: 'New Order',
    review: 'Review',
    return: 'Return',
    customer: 'Customer',
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold text-[#0A0A0A]" style={{ fontFamily: "'Playfair Display', serif" }}>Notifications</h1>
        <p className="text-[12px] text-[#7A7468] mt-0.5">Activity alerts and pending actions</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Low Stock', value: lowStockProducts.length, color: '#EF4444', href: '/admin/inventory' },
          { label: 'Pending Orders', value: pendingOrders.length, color: '#F59E0B', href: '/admin/orders' },
          { label: 'Reviews', value: pendingReviews.length, color: '#8B5CF6', href: '/admin/reviews' },
          { label: 'Returns', value: pendingReturns.length, color: '#F97316', href: '/admin/orders' },
          { label: 'New Customers', value: newCustomers.length, color: '#3D6B4D', href: '/admin/users' },
        ].map((s) => (
          <Link key={s.label} href={s.href} className="bg-white rounded-xl border border-[#E8E5DE] p-3 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-[10px] font-medium text-[#7A7468]">{s.label}</span>
            </div>
            <div className="text-lg font-bold text-[#0A0A0A]">{s.value}</div>
          </Link>
        ))}
      </div>

      {/* Notification List */}
      <div className="bg-white rounded-xl border border-[#E8E5DE] overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-12 text-center text-[#9E9789] text-[12px]">
            <Bell className="w-8 h-8 mx-auto mb-2 text-[#E8E5DE]" />
            All caught up! No pending notifications.
          </div>
        ) : (
          <div className="divide-y divide-[#F3F1ED]">
            {notifications.slice(0, 50).map((n, i) => (
              <Link key={i} href={n.href}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAF9F7] transition-colors">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${n.color}10` }}>
                  <n.icon className="w-3.5 h-3.5" style={{ color: n.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-[#0A0A0A] truncate">{n.title}</p>
                  <p className="text-[10px] text-[#9E9789]">{n.detail}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-[#7A7468] bg-[#F3F1ED] px-1.5 py-0.5 rounded">{typeLabels[n.type]}</span>
                  {n.time && <p className="text-[9px] text-[#9E9789] mt-0.5">{n.time}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
