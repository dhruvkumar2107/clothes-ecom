import Link from 'next/link';
import { db } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { Plus, Calendar, Edit } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PER_PAGE = 25;

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function AdminCouponsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const [coupons, total] = await Promise.all([
    db.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    db.coupon.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const href = (next: Partial<{ page: number }>) => {
    const merged = { page, ...next };
    const search = new URLSearchParams();
    if (merged.page > 1) search.set('page', String(merged.page));
    const query = search.toString();
    return query ? `/admin/coupons?${query}` : '/admin/coupons';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#0A0A0A]" style={{ fontFamily: "'Playfair Display', serif" }}>Coupons</h1>
          <p className="text-[13px] text-[#7A7468] mt-0.5">Manage promotional codes and discounts</p>
        </div>
        <Link
          href="/admin/coupons/new"
          className="flex items-center justify-center gap-1.5 bg-[#0A0A0A] hover:bg-[#1A1A1A] text-white px-4 py-2 rounded-lg text-[12px] font-medium transition-colors self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Coupon
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-[#E8E5DE] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-[#FAF9F7] text-[#7A7468] uppercase text-[10px] tracking-wider border-b border-[#E8E5DE]">
              <tr>
                <th className="px-5 py-3 font-medium">Code</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Value</th>
                <th className="px-5 py-3 font-medium">Min Cart</th>
                <th className="px-5 py-3 font-medium">Usage</th>
                <th className="px-5 py-3 font-medium">Validity</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F1ED]">
              {coupons.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-[#9E9789]">
                    No coupons yet. Click "Create Coupon" to start.
                  </td>
                </tr>
              ) : (
                coupons.map((coupon) => {
                  const isExpired = coupon.endsAt && new Date(coupon.endsAt) < new Date();
                  const isActive = coupon.active && !isExpired;

                  return (
                    <tr key={coupon.id} className="hover:bg-[#FAF9F7] transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#0A0A0A] bg-[#F3F1ED] border border-[#E8E5DE] px-2 py-0.5 rounded text-[12px]">
                            {coupon.code}
                          </span>
                          {coupon.name && <span className="text-[#7A7468] text-[12px]">{coupon.name}</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded bg-[#F3F1ED] border border-[#E8E5DE] text-[#7A7468] font-medium text-[10px] uppercase">
                          {coupon.kind}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-semibold text-[#0A0A0A]">
                        {coupon.kind === 'percent'
                          ? `${coupon.value}%`
                          : coupon.kind === 'free_shipping'
                          ? 'Free Shipping'
                          : formatMoney(coupon.value)}
                      </td>
                      <td className="px-5 py-3 text-[#7A7468]">
                        {coupon.minCartValue ? formatMoney(coupon.minCartValue) : 'None'}
                      </td>
                      <td className="px-5 py-3 font-mono text-[#0A0A0A]">
                        {coupon.usedCount}
                      </td>
                      <td className="px-5 py-3 text-[#7A7468] text-[11px]">
                        {coupon.startsAt ? new Date(coupon.startsAt).toLocaleDateString() : 'Now'}
                        {' - '}
                        {coupon.endsAt ? new Date(coupon.endsAt).toLocaleDateString() : 'No end'}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            : isExpired
                            ? 'bg-red-50 text-red-600 border border-red-200'
                            : 'bg-[#F3F1ED] text-[#7A7468] border border-[#E8E5DE]'
                        }`}>
                          {isActive ? 'Active' : isExpired ? 'Expired' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/admin/coupons/${coupon.id}/edit`}
                          className="p-1.5 text-[#7A7468] hover:text-[#9C7C4E] hover:bg-[#F3F1ED] rounded-md transition-colors inline-flex"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
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
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-[#9E9789]">
            Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            {page > 1 && (
              <Link href={href({ page: page - 1 })} className="px-3 py-1.5 text-[11px] bg-white border border-[#E8E5DE] hover:bg-[#F3F1ED] text-[#0A0A0A] rounded-lg transition-colors">
                Previous
              </Link>
            )}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = page <= 3 ? i + 1 : page + i - 2;
              if (p < 1 || p > totalPages) return null;
              return (
                <Link
                  key={p}
                  href={href({ page: p })}
                  className={`px-3 py-1.5 text-[11px] rounded-lg transition-colors ${
                    p === page
                      ? 'bg-[#9C7C4E] text-white font-semibold'
                      : 'bg-white border border-[#E8E5DE] hover:bg-[#F3F1ED] text-[#0A0A0A]'
                  }`}
                >
                  {p}
                </Link>
              );
            })}
            {page < totalPages && (
              <Link href={href({ page: page + 1 })} className="px-3 py-1.5 text-[11px] bg-white border border-[#E8E5DE] hover:bg-[#F3F1ED] text-[#0A0A0A] rounded-lg transition-colors">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
