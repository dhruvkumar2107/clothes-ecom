import Link from 'next/link';
import { PrismaClient } from '@prisma/client';
import { formatMoney } from '@/lib/money';
import { Users, Search, Filter, ChevronLeft, ChevronRight, ExternalLink, Flag, Activity } from 'lucide-react';

const prisma = new PrismaClient();

export const revalidate = 0;

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { orders: true, referralsMade: true } },
      wallet: { select: { balance: true } },
    },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <h1 className="text-2xl font-serif font-bold text-zinc-100 tracking-wide">Customer Roster</h1>
          <p className="text-xs text-zinc-400 mt-1">Manage customer accounts, view order history, and monitor referral activity.</p>
        </div>
      </div>

      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Orders</th>
                <th className="px-6 py-4">Lifetime Spend</th>
                <th className="px-6 py-4">Wallet Balance</th>
                <th className="px-6 py-4">Referral Code</th>
                <th className="px-6 py-4">Referrals</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-zinc-500">
                    No customers registered yet.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-semibold text-xs">
                          {user.name?.charAt(0) || (user.email ? user.email.charAt(0).toUpperCase() : 'U')}
                        </div>
                        <div>
                          <span className="font-medium text-zinc-100 block text-sm">{user.name || 'Unnamed'}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">/{user.id.slice(0, 8)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-0.5">
                        <span className="text-[11px] text-zinc-300 font-mono">{user.email}</span>
                        {user.phone && (
                          <span className="text-[10px] text-zinc-500 font-mono">{user.phone}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-medium text-zinc-200">
                      {user._count.orders}
                    </td>
                    <td className="px-6 py-4 font-mono font-semibold text-zinc-100">
                      {formatMoney(user._count.orders > 0 ? 0 : 0)}
                    </td>
                    <td className="px-6 py-4 font-mono text-emerald-400">
                      {formatMoney(user.wallet?.balance || 0)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700/50 text-zinc-300 font-mono text-xs">
                        {user.referralCode || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-amber-400">
                      {user._count.referralsMade}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          user.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : user.status === 'banned'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/orders?userId=${user.id}`}
                          className="p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded transition-colors"
                          title="View Orders"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                        <button className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded transition-colors" title="Flag User">
                          <Flag className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}