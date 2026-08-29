import Link from 'next/link';
import { db } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { Search } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PER_PAGE = 25;

interface PageProps {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const q = (params.q ?? '').trim().slice(0, 80);
  const status = params.status || '';

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
      { referralCode: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        referralCode: true,
        lifetimeSpend: true,
        loyaltyTier: true,
        createdAt: true,
        wallet: { select: { balance: true } },
        _count: { select: { orders: true, referralsMade: true } },
      },
    }),
    db.user.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const href = (next: Partial<{ page: number; q: string; status: string }>) => {
    const merged = { page, q, status, ...next };
    const search = new URLSearchParams();
    if (merged.page > 1) search.set('page', String(merged.page));
    if (merged.q) search.set('q', merged.q);
    if (merged.status) search.set('status', merged.status);
    const query = search.toString();
    return query ? `/admin/users?${query}` : '/admin/users';
  };

  const statuses = ['', 'active', 'flagged', 'banned'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <h1 className="text-2xl font-serif font-bold text-zinc-100 tracking-wide">Customer Roster</h1>
          <p className="text-xs text-zinc-400 mt-1">{total} customers — manage accounts, view history, monitor referrals.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <form method="GET" action="/admin/users" className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Name, email, phone, referral code"
              className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500/60"
            />
          </div>
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <button type="submit" className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs font-semibold text-zinc-200 transition-colors">
            Search
          </button>
        </form>
        <div className="flex gap-1.5">
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
                <th className="px-6 py-4">Wallet</th>
                <th className="px-6 py-4">Referral Code</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-zinc-500">No customers found.</td>
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
                          <span className="text-[10px] text-zinc-400 font-mono">Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[11px] text-zinc-300 font-mono block">{user.email}</span>
                      {user.phone && <span className="text-[10px] text-zinc-500 font-mono">{user.phone}</span>}
                    </td>
                    <td className="px-6 py-4 font-mono font-medium text-zinc-200">{user._count.orders}</td>
                    <td className="px-6 py-4 font-mono font-semibold text-zinc-100">{formatMoney(user.lifetimeSpend)}</td>
                    <td className="px-6 py-4 font-mono text-emerald-400">{formatMoney(user.wallet?.balance || 0)}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700/50 text-zinc-300 font-mono text-xs">
                        {user.referralCode || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                        user.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : user.status === 'banned' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="inline-flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded text-xs font-medium transition-colors border border-zinc-700/60"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
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
