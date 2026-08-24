import Link from 'next/link';
import { PrismaClient } from '@prisma/client';
import { formatMoney } from '@/lib/money';
import {
  TrendingUp,
  ShoppingBag,
  Package,
  Users,
  RotateCcw,
  Plus,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const [
    productsCount,
    ordersCount,
    usersCount,
    pendingRefundsCount,
    recentOrders,
    completedOrders,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.user.count(),
    prisma.return.count({ where: { status: { in: ['requested', 'approved'] } } }),
    prisma.order.findMany({
      take: 6,
      orderBy: { placedAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        items: { select: { name: true, qty: true } },
      },
    }),
    prisma.order.findMany({
      select: { grandTotal: true },
    }),
  ]);

  const totalRevenue = completedOrders.reduce((acc, curr) => acc + curr.grandTotal, 0);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between pb-6 border-b border-zinc-800/80">
        <div>
          <h1 className="text-2xl font-serif font-bold text-zinc-100 tracking-wide">Executive Dashboard</h1>
          <p className="text-xs text-zinc-400 mt-1">Real-time metrics, order fulfillments, and revenue statistics.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/products/new"
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2 rounded-lg text-xs font-semibold shadow-lg shadow-amber-500/10 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add New Product
          </Link>
          <Link
            href="/admin/orders"
            className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 px-4 py-2 rounded-lg text-xs font-medium transition-all"
          >
            Process Orders
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 relative overflow-hidden group hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Total Revenue</span>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-zinc-100">{formatMoney(totalRevenue)}</div>
            <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1">
              <ArrowUpRight className="w-3 h-3" /> Live store sales
            </p>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 relative overflow-hidden group hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Total Orders</span>
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-zinc-100">{ordersCount}</div>
            <p className="text-[11px] text-zinc-400 mt-1">Across all payment channels</p>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 relative overflow-hidden group hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Active Catalogue</span>
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-zinc-100">{productsCount}</div>
            <p className="text-[11px] text-purple-400 mt-1">Published items</p>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 relative overflow-hidden group hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Pending Refunds</span>
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-zinc-100">{pendingRefundsCount}</div>
            <p className="text-[11px] text-amber-400 mt-1">Requires review</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Recent Customer Orders</h2>
              <p className="text-xs text-zinc-400">Latest orders placed on the platform</p>
            </div>
            <Link
              href="/admin/orders"
              className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
            >
              View All <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-xs">No orders placed yet.</div>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {recentOrders.map((order) => (
                <div key={order.id} className="py-3.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-[10px] font-mono text-amber-300 font-bold">
                      #{order.orderNumber.slice(-4)}
                    </div>
                    <div>
                      <span className="font-medium text-zinc-200 block">{order.user.name}</span>
                      <span className="text-[10px] text-zinc-400 font-mono">{order.user.email}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-mono font-bold text-zinc-100 block">{formatMoney(order.grandTotal)}</span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase font-semibold tracking-wider ${
                        order.status === 'delivered'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : order.status === 'pending'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-100">Control Actions</h2>
            <div className="space-y-2.5">
              <Link
                href="/admin/products/new"
                className="w-full flex items-center justify-between p-3 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 text-xs text-zinc-200 border border-zinc-700/50 transition-all"
              >
                <span className="flex items-center gap-2.5">
                  <Plus className="w-4 h-4 text-amber-400" />
                  Add New Product
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400" />
              </Link>
              <Link
                href="/admin/orders"
                className="w-full flex items-center justify-between p-3 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 text-xs text-zinc-200 border border-zinc-700/50 transition-all"
              >
                <span className="flex items-center gap-2.5">
                  <RotateCcw className="w-4 h-4 text-amber-400" />
                  Manage Order Refunds
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400" />
              </Link>
              <Link
                href="/admin/users"
                className="w-full flex items-center justify-between p-3 rounded-lg bg-zinc-800/60 hover:bg-zinc-800 text-xs text-zinc-200 border border-zinc-700/50 transition-all"
              >
                <span className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-amber-400" />
                  Customer Roster ({usersCount})
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400" />
              </Link>
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
              <ShieldAlert className="w-4 h-4" />
              Super Admin Mode Active
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              All financial operations, refunds, and product modifications are logged in audit tables.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
