import Link from 'next/link';
import { db } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import {
  TrendingUp, ShoppingBag, Package, Users, RotateCcw,
  ArrowUpRight, ArrowDownRight, AlertCircle, Eye,
  ShoppingCart, DollarSign, BarChart3, Star, Clock,
  Boxes, TrendingDown, Minus, Layers, TicketPercent,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 7 * 86400000);
  const lastWeekStart = new Date(todayStart.getTime() - 14 * 86400000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(monthStart.getTime() - 86400000);

  const [
    todayRevenue,
    yesterdayRevenue,
    weekRevenue,
    lastWeekRevenue,
    monthRevenue,
    lastMonthRevenue,
    totalRevenue,
    todayOrders,
    yesterdayOrders,
    weekOrders,
    lastWeekOrders,
    monthOrders,
    lastMonthOrders,
    totalOrders,
    totalProducts,
    activeProducts,
    totalCustomers,
    newCustomersToday,
    newCustomersWeek,
    pendingOrders,
    pendingReturns,
    lowStockCount,
    outOfStockCount,
    recentOrders,
    lowStockProducts,
    topCategories,
    ordersByStatus,
    pendingReviews,
  ] = await Promise.all([
    db.order.aggregate({ where: { placedAt: { gte: todayStart }, paymentStatus: 'paid' }, _sum: { grandTotal: true } }),
    db.order.aggregate({ where: { placedAt: { gte: yesterdayStart, lt: todayStart }, paymentStatus: 'paid' }, _sum: { grandTotal: true } }),
    db.order.aggregate({ where: { placedAt: { gte: weekStart }, paymentStatus: 'paid' }, _sum: { grandTotal: true } }),
    db.order.aggregate({ where: { placedAt: { gte: lastWeekStart, lt: weekStart }, paymentStatus: 'paid' }, _sum: { grandTotal: true } }),
    db.order.aggregate({ where: { placedAt: { gte: monthStart }, paymentStatus: 'paid' }, _sum: { grandTotal: true } }),
    db.order.aggregate({ where: { placedAt: { gte: lastMonthStart, lt: lastMonthEnd }, paymentStatus: 'paid' }, _sum: { grandTotal: true } }),
    db.order.aggregate({ where: { paymentStatus: 'paid' }, _sum: { grandTotal: true } }),
    db.order.count({ where: { placedAt: { gte: todayStart } } }),
    db.order.count({ where: { placedAt: { gte: yesterdayStart, lt: todayStart } } }),
    db.order.count({ where: { placedAt: { gte: weekStart } } }),
    db.order.count({ where: { placedAt: { gte: lastWeekStart, lt: weekStart } } }),
    db.order.count({ where: { placedAt: { gte: monthStart } } }),
    db.order.count({ where: { placedAt: { gte: lastMonthStart, lt: lastMonthEnd } } }),
    db.order.count(),
    db.product.count(),
    db.product.count({ where: { status: 'active' } }),
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: todayStart } } }),
    db.user.count({ where: { createdAt: { gte: weekStart } } }),
    db.order.count({ where: { status: { in: ['pending', 'confirmed'] } } }),
    db.return.count({ where: { status: { in: ['requested', 'approved'] } } }),
    db.productVariant.count({ where: { stock: { lte: 5, gt: 0 }, product: { status: 'active' } } }),
    db.productVariant.count({ where: { stock: 0, product: { status: 'active' } } }),
    db.order.findMany({
      take: 6,
      orderBy: { placedAt: 'desc' },
      select: {
        id: true, orderNumber: true, grandTotal: true, status: true, placedAt: true,
        items: { select: { qty: true, name: true, imageUrl: true } },
        user: { select: { name: true } },
      },
    }),
    db.productVariant.findMany({
      where: { stock: { lte: 5 }, product: { status: 'active' } },
      take: 8,
      select: {
        id: true, size: true, color: true, colorHex: true, stock: true, lowStockThreshold: true,
        product: { select: { name: true, slug: true, images: { take: 1, select: { url: true } } } },
      },
      orderBy: { stock: 'asc' },
    }),
    db.$queryRaw`
      SELECT c.name, c.slug, COUNT(DISTINCT p.id)::int as "productCount"
      FROM "Category" c
      LEFT JOIN "Product" p ON p."categoryId" = c.id AND p.status = 'active'
      WHERE c."parentId" IS NULL
      GROUP BY c.id, c.name, c.slug
      ORDER BY "productCount" DESC
      LIMIT 6
    `,
    db.order.groupBy({ by: ['status'], _count: true }),
    db.review.count({ where: { status: 'pending' } }),
  ]);

  const tRev = Number(todayRevenue._sum.grandTotal ?? 0);
  const yRev = Number(yesterdayRevenue._sum.grandTotal ?? 0);
  const wRev = Number(weekRevenue._sum.grandTotal ?? 0);
  const lwRev = Number(lastWeekRevenue._sum.grandTotal ?? 0);
  const mRev = Number(monthRevenue._sum.grandTotal ?? 0);
  const lmRev = Number(lastMonthRevenue._sum.grandTotal ?? 0);
  const totalRev = Number(totalRevenue._sum.grandTotal ?? 0);

  const revChange = yRev > 0 ? ((tRev - yRev) / yRev) * 100 : tRev > 0 ? 100 : 0;
  const weekChange = lwRev > 0 ? ((wRev - lwRev) / lwRev) * 100 : wRev > 0 ? 100 : 0;
  const monthChange = lmRev > 0 ? ((mRev - lmRev) / lmRev) * 100 : mRev > 0 ? 100 : 0;

  const orderChange = yesterdayOrders > 0 ? ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100 : todayOrders > 0 ? 100 : 0;

  const avgOrderValue = totalOrders > 0 ? totalRev / totalOrders : 0;

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

  const ChangeIndicator = ({ value, label }: { value: number; label: string }) => {
    if (value > 0) return <span className="text-[10px] text-[#3D6B4D] flex items-center gap-0.5"><ArrowUpRight className="w-2.5 h-2.5" />{Math.abs(value).toFixed(0)}% {label}</span>;
    if (value < 0) return <span className="text-[10px] text-red-500 flex items-center gap-0.5"><ArrowDownRight className="w-2.5 h-2.5" />{Math.abs(value).toFixed(0)}% {label}</span>;
    return <span className="text-[10px] text-[#9E9789] flex items-center gap-0.5"><Minus className="w-2.5 h-2.5" />No change</span>;
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#0A0A0A]" style={{ fontFamily: "'Playfair Display', serif" }}>Dashboard</h1>
          <p className="text-[12px] text-[#7A7468] mt-0.5">Store overview and key metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/orders" className="flex items-center gap-1.5 bg-white border border-[#E8E5DE] text-[#0A0A0A] px-3 py-1.5 rounded-lg text-[11px] font-medium hover:bg-[#F3F1ED] transition-colors">
            <ShoppingBag className="w-3 h-3" /> Orders
          </Link>
          <Link href="/admin/products/new" className="flex items-center gap-1.5 bg-[#0A0A0A] hover:bg-[#1A1A1A] text-white px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors">
            <Package className="w-3 h-3" /> New Product
          </Link>
        </div>
      </div>

      {/* Revenue KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-[#E8E5DE] p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-[#7A7468]">Today&apos;s Revenue</span>
            <div className="w-7 h-7 rounded-lg bg-[#3D6B4D]/8 flex items-center justify-center"><DollarSign className="w-3.5 h-3.5 text-[#3D6B4D]" /></div>
          </div>
          <div className="text-xl font-bold text-[#0A0A0A]" style={{ fontFamily: "'Playfair Display', serif" }}>{formatMoney(tRev)}</div>
          <div className="mt-1"><ChangeIndicator value={revChange} label="vs yesterday" /></div>
        </div>
        <div className="bg-white rounded-xl border border-[#E8E5DE] p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-[#7A7468]">Week Revenue</span>
            <div className="w-7 h-7 rounded-lg bg-[#9C7C4E]/8 flex items-center justify-center"><BarChart3 className="w-3.5 h-3.5 text-[#9C7C4E]" /></div>
          </div>
          <div className="text-xl font-bold text-[#0A0A0A]" style={{ fontFamily: "'Playfair Display', serif" }}>{formatMoney(wRev)}</div>
          <div className="mt-1"><ChangeIndicator value={weekChange} label="vs last week" /></div>
        </div>
        <div className="bg-white rounded-xl border border-[#E8E5DE] p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-[#7A7468]">Month Revenue</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center"><TrendingUp className="w-3.5 h-3.5 text-purple-500" /></div>
          </div>
          <div className="text-xl font-bold text-[#0A0A0A]" style={{ fontFamily: "'Playfair Display', serif" }}>{formatMoney(mRev)}</div>
          <div className="mt-1"><ChangeIndicator value={monthChange} label="vs last month" /></div>
        </div>
        <div className="bg-white rounded-xl border border-[#E8E5DE] p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-[#7A7468]">Total Revenue</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center"><TrendingUp className="w-3.5 h-3.5 text-emerald-500" /></div>
          </div>
          <div className="text-xl font-bold text-[#0A0A0A]" style={{ fontFamily: "'Playfair Display', serif" }}>{formatMoney(totalRev)}</div>
          <p className="text-[10px] text-[#9E9789] mt-1">{totalOrders} total orders</p>
        </div>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Orders Today', value: todayOrders, change: orderChange, icon: ShoppingBag, color: '#9C7C4E' },
          { label: 'Avg Order Value', value: formatMoney(avgOrderValue), icon: DollarSign, color: '#3D6B4D' },
          { label: 'Products', value: activeProducts, sub: `${totalProducts} total`, icon: Package, color: '#6366F1' },
          { label: 'Customers', value: totalCustomers, sub: `+${newCustomersWeek} this week`, icon: Users, color: '#8B5CF6' },
          { label: 'Low Stock', value: lowStockCount + outOfStockCount, icon: AlertCircle, color: lowStockCount + outOfStockCount > 0 ? '#EF4444' : '#3D6B4D', alert: lowStockCount + outOfStockCount > 0 },
          { label: 'Pending', value: pendingOrders + pendingReturns, sub: `${pendingOrders} orders, ${pendingReturns} returns`, icon: Clock, color: pendingOrders > 0 ? '#F59E0B' : '#3D6B4D' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-[#E8E5DE] p-3.5 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: `${kpi.color}10` }}>
                <kpi.icon className="w-3 h-3" style={{ color: kpi.color }} />
              </div>
              <span className="text-[10px] font-medium text-[#7A7468]">{kpi.label}</span>
            </div>
            <div className="text-lg font-bold text-[#0A0A0A]">{kpi.value}</div>
            {kpi.change !== undefined && <ChangeIndicator value={kpi.change} label="vs yesterday" />}
            {kpi.sub && <p className="text-[10px] text-[#9E9789] mt-0.5">{kpi.sub}</p>}
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E8E5DE] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[13px] font-semibold text-[#0A0A0A]">Recent Orders</h2>
              <p className="text-[10px] text-[#9E9789]">Latest customer orders</p>
            </div>
            <Link href="/admin/orders" className="text-[11px] text-[#9C7C4E] hover:text-[#876839] font-medium flex items-center gap-1">
              View All <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="text-center py-12 text-[#9E9789] text-[12px]">No orders yet</div>
          ) : (
            <div className="divide-y divide-[#F3F1ED]">
              {recentOrders.map((order) => (
                <Link key={order.id} href={`/admin/orders/${order.id}`} className="py-2.5 flex items-center justify-between hover:bg-[#FAF9F7] -mx-2 px-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#F3F1ED] flex items-center justify-center text-[9px] font-mono text-[#9C7C4E] font-bold">
                      #{order.orderNumber.slice(-4)}
                    </div>
                    <div>
                      <span className="text-[11px] font-medium text-[#0A0A0A] block leading-tight">{order.user.name}</span>
                      <span className="text-[9px] text-[#9E9789]">{order.items.length} items · {new Date(order.placedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-semibold text-[#0A0A0A] block">{formatMoney(order.grandTotal)}</span>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] uppercase font-semibold tracking-wider ${statusColors[order.status] || 'bg-gray-50 text-gray-600'}`}>
                      {order.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-5">
          {/* Low Stock Alerts */}
          <div className="bg-white rounded-xl border border-[#E8E5DE] p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[13px] font-semibold text-[#0A0A0A]">Low Stock</h2>
              {lowStockProducts.length > 0 && (
                <span className="text-[9px] font-semibold bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-200">{lowStockProducts.length}</span>
              )}
            </div>
            <div className="space-y-2">
              {lowStockProducts.length === 0 ? (
                <p className="text-[11px] text-[#9E9789] text-center py-4">All products well-stocked</p>
              ) : (
                lowStockProducts.map((variant) => (
                  <Link key={variant.id} href={`/admin/inventory`} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-[#FAF9F7] transition-colors">
                    <div className="w-8 h-8 rounded-md bg-[#F3F1ED] overflow-hidden shrink-0">
                      {variant.product.images[0] && (
                        <img src={variant.product.images[0].url} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium text-[#0A0A0A] truncate">{variant.product.name}</p>
                      <p className="text-[9px] text-[#9E9789]">{variant.size} / {variant.color}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${variant.stock === 0 ? 'bg-red-50 text-red-600' : 'bg-[#D4A853]/10 text-[#9C7C4E]'}`}>
                      {variant.stock === 0 ? 'OOS' : `${variant.stock} left`}
                    </span>
                  </Link>
                ))
              )}
            </div>
            {lowStockProducts.length > 0 && (
              <Link href="/admin/inventory" className="block text-center text-[10px] text-[#9C7C4E] font-medium mt-2 hover:underline">View All Inventory →</Link>
            )}
          </div>

          {/* Orders by Status */}
          <div className="bg-white rounded-xl border border-[#E8E5DE] p-5">
            <h2 className="text-[13px] font-semibold text-[#0A0A0A] mb-3">Order Pipeline</h2>
            <div className="space-y-2">
              {(ordersByStatus as any[]).map((s) => {
                const total = (ordersByStatus as any[]).reduce((acc: number, x: any) => acc + x._count, 0);
                const pct = total > 0 ? (s._count / total) * 100 : 0;
                return (
                  <div key={s.status}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-medium text-[#7A7468] capitalize">{s.status}</span>
                      <span className="text-[10px] font-semibold text-[#0A0A0A]">{s._count}</span>
                    </div>
                    <div className="w-full h-1 bg-[#F3F1ED] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: statusColors[s.status]?.includes('emerald') ? '#10B981' : statusColors[s.status]?.includes('red') ? '#EF4444' : '#9C7C4E' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-[#E8E5DE] p-5">
            <h2 className="text-[13px] font-semibold text-[#0A0A0A] mb-3">Quick Actions</h2>
            <div className="space-y-1.5">
              {[
                { label: 'Add Product', href: '/admin/products/new', icon: Package },
                { label: 'Manage Inventory', href: '/admin/inventory', icon: Boxes },
                { label: 'Process Orders', href: '/admin/orders', icon: ShoppingBag },
                { label: 'Manage Collections', href: '/admin/collections', icon: Layers },
                { label: 'View Reviews', href: '/admin/reviews', icon: Star },
                { label: 'Manage Coupons', href: '/admin/coupons', icon: TicketPercent },
              ].map((action) => (
                <Link key={action.href} href={action.href} className="flex items-center justify-between p-2 rounded-lg hover:bg-[#FAF9F7] text-[11px] text-[#0A0A0A] font-medium transition-colors">
                  <span className="flex items-center gap-2"><action.icon className="w-3.5 h-3.5 text-[#9C7C4E]" />{action.label}</span>
                  <ArrowUpRight className="w-3 h-3 text-[#9E9789]" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
