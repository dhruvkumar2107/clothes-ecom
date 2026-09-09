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
      <div>
        <h1 className="text-xl font-semibold text-[#0A0A0A]" style={{ fontFamily: "'Playfair Display', serif" }}>Customers</h1>
        <p className="text-[13px] text-[#7A7468] mt-0.5">{total} customers</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <form method="GET" action="/admin/users" className="flex gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9E9789]" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search by name, email, phone..."
              className="w-full pl-9 pr-3 py-2 bg-[#F3F1ED] border border-transparent rounded-lg text-[12px] text-[#0A0A0A] placeholder-[#9E9789] focus:outline-none focus:border-[#9C7C4E]/50 focus:bg-white transition-all"
            />
          </div>
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <button type="submit" className="px-4 py-2 bg-[#0A0A0A] hover:bg-[#1A1A1A] text-white rounded-lg text-[12px] font-medium transition-colors">
            Search
          </button>
        </form>
        <div className="flex gap-1.5">
          {statuses.map((s) => (
            <Link
              key={s || 'all'}
              href={href({ status: s, page: 1 })}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                status === s
                  ? 'bg-[#9C7C4E]/10 text-[#9C7C4E] border border-[#9C7C4E]/20'
                  : 'text-[#7A7468] border border-[#E8E5DE] hover:bg-[#F3F1ED]'
              }`}
            >
              {s || 'All'}
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E8E5DE] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-[#FAF9F7] text-[#7A7468] uppercase text-[10px] tracking-wider border-b border-[#E8E5DE]">
              <tr>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Contact</th>
                <th className="px-5 py-3 font-medium">Orders</th>
                <th className="px-5 py-3 font-medium">Spend</th>
                <th className="px-5 py-3 font-medium">Wallet</th>
                <th className="px-5 py-3 font-medium">Referral</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F1ED]">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-[#9E9789]">No customers found.</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-[#FAF9F7] transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#9C7C4E]/10 flex items-center justify-center text-[#9C7C4E] font-semibold text-[10px]">
                          {user.name?.charAt(0) || (user.email ? user.email.charAt(0).toUpperCase() : 'U')}
                        </div>
                        <div>
                          <span className="font-medium text-[#0A0A0A] block text-[12px]">{user.name || 'Unnamed'}</span>
                          <span className="text-[10px] text-[#9E9789]">Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[11px] text-[#7A7468] block">{user.email}</span>
                      {user.phone && <span className="text-[10px] text-[#9E9789]">{user.phone}</span>}
                    </td>
                    <td className="px-5 py-3 font-medium text-[#0A0A0A]">{user._count.orders}</td>
                    <td className="px-5 py-3 font-semibold text-[#0A0A0A]">{formatMoney(user.lifetimeSpend)}</td>
                    <td className="px-5 py-3 text-[#3D6B4D]">{formatMoney(user.wallet?.balance || 0)}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded bg-[#F3F1ED] border border-[#E8E5DE] text-[#7A7468] font-mono text-[10px]">
                        {user.referralCode || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                        user.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : user.status === 'banned' ? 'bg-red-50 text-red-600 border border-red-200'
                        : 'bg-[#F3F1ED] text-[#7A7468] border border-[#E8E5DE]'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="inline-flex items-center gap-1 bg-[#F3F1ED] hover:bg-[#E8E5DE] text-[#0A0A0A] px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
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
            <Link href={href({ page: page - 1 })} className="px-4 py-2 bg-white border border-[#E8E5DE] rounded-lg text-[12px] font-medium text-[#0A0A0A] hover:bg-[#F3F1ED] transition-colors">
              Previous
            </Link>
          ) : <span />}
          <span className="text-[12px] text-[#7A7468]">Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link href={href({ page: page + 1 })} className="px-4 py-2 bg-white border border-[#E8E5DE] rounded-lg text-[12px] font-medium text-[#0A0A0A] hover:bg-[#F3F1ED] transition-colors">
              Next
            </Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
