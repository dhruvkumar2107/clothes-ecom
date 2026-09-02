import Link from 'next/link';
import { db } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { Gift, ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PER_PAGE = 25;

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function AdminReferralsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const [referrals, total] = await Promise.all([
    db.referral.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        code: true,
        status: true,
        createdAt: true,
        referrer: { select: { id: true, name: true, email: true } },
        referredUser: { select: { id: true, name: true, email: true, createdAt: true } },
        commissions: { select: { commissionAmount: true, status: true } },
      },
    }),
    db.referral.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <h1 className="text-2xl font-serif font-bold text-zinc-100 tracking-wide">Referral Program</h1>
          <p className="text-xs text-zinc-400 mt-1">{total} referrals — track invite links, signups, and commission payouts.</p>
        </div>
      </div>

      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Referrer</th>
                <th className="px-6 py-4">Referred User</th>
                <th className="px-6 py-4">Commission</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {referrals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                    No referrals tracked yet. Referrals are recorded when customers share their referral codes.
                  </td>
                </tr>
              ) : (
                referrals.map((ref) => {
                  const totalCommission = ref.commissions.reduce((sum, c) => sum + (c.commissionAmount || 0), 0);
                  const paidCommission = ref.commissions
                    .filter((c) => c.status === 'paid' || c.status === 'released')
                    .reduce((sum, c) => sum + (c.commissionAmount || 0), 0);

                  return (
                    <tr key={ref.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-amber-300 bg-zinc-800 border border-zinc-700 px-2.5 py-1 rounded">
                          {ref.code}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-zinc-100 block">{ref.referrer.name || 'Unnamed'}</span>
                        <span className="text-[10px] text-zinc-400 font-mono">{ref.referrer.email}</span>
                      </td>
                      <td className="px-6 py-4">
                        {ref.referredUser ? (
                          <>
                            <span className="font-medium text-zinc-100 block">{ref.referredUser.name || 'Unnamed'}</span>
                            <span className="text-[10px] text-zinc-400 font-mono">{ref.referredUser.email}</span>
                          </>
                        ) : (
                          <span className="text-zinc-500">Pending signup</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-zinc-200">
                        {totalCommission > 0 ? formatMoney(totalCommission) : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          ref.status === 'converted' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : ref.status === 'signed_up' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : ref.status === 'rejected' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {ref.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-zinc-400 font-mono text-[11px]">
                        {new Date(ref.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/admin/users/${ref.referrer.id}`}
                          className="inline-flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded text-xs font-medium transition-colors border border-zinc-700/60"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-amber-400" /> Referrer
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
            <Link href={`/admin/referrals?page=${page - 1}`} className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors">
              Previous
            </Link>
          ) : <span />}
          <span className="text-xs text-zinc-500">Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link href={`/admin/referrals?page=${page + 1}`} className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors">
              Next
            </Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
