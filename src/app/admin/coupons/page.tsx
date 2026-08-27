import Link from 'next/link';
import { db } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { Plus, TicketPercent, Edit, Trash2, Eye, Calendar, Package, Truck } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminCouponsPage() {
  const coupons = await db.coupon.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <h1 className="text-2xl font-serif font-bold text-zinc-100 tracking-wide">Coupons & Discounts</h1>
          <p className="text-xs text-zinc-400 mt-1">Create and manage promotional codes for marketing campaigns.</p>
        </div>
        <Link
          href="/admin/coupons/new"
          className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2 rounded-lg text-xs font-semibold shadow-md shadow-amber-500/10 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create Coupon
        </Link>
      </div>

      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Value</th>
                <th className="px-6 py-4">Min Cart Value</th>
                <th className="px-6 py-4">Usage</th>
                <th className="px-6 py-4">Validity</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {coupons.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-zinc-500">
                    No coupons created yet. Click "Create Coupon" to start a campaign.
                  </td>
                </tr>
              ) : (
                coupons.map((coupon) => {
                  const isExpired = coupon.endsAt && new Date(coupon.endsAt) < new Date();
                  const isActive = coupon.active && !isExpired;
                  const usagePercent = coupon.usedCount > 0 ? 50 : 0;

                  return (
                    <tr key={coupon.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-zinc-100 bg-zinc-800 border border-zinc-700 px-2.5 py-1 rounded text-sm">
                            {coupon.code}
                          </span>
                          {coupon.name && <span className="text-zinc-300 text-sm">{coupon.name}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700/50 text-zinc-300 font-medium text-[10px] uppercase">
                          {coupon.kind}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-semibold text-zinc-100">
                        {coupon.kind === 'percent'
                          ? `${coupon.value}%`
                          : coupon.kind === 'free_shipping'
                          ? 'Free Shipping'
                          : formatMoney(coupon.value)}
                      </td>
                      <td className="px-6 py-4 font-mono text-zinc-400">
                        {coupon.minCartValue ? formatMoney(coupon.minCartValue) : 'No minimum'}
                      </td>
<td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-zinc-200">
                              {coupon.usedCount}/∞
                            </span>
                          </div>
                        </td>
                      <td className="px-6 py-4 text-zinc-400 font-mono text-[11px]">
                        {coupon.startsAt ? new Date(coupon.startsAt).toLocaleDateString() : 'Now'}
                        {' '}<Calendar className="w-3 h-3 inline mx-1" />{' '}
                        {coupon.endsAt ? new Date(coupon.endsAt).toLocaleDateString() : 'No expiry'}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                            isActive
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : isExpired
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                          }`}
                        >
                          {isActive ? 'Active' : isExpired ? 'Expired' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/coupons/${coupon.id}/edit`}
                            className="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 rounded transition-colors"
                            title="Edit Coupon"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded transition-colors" title="Delete Coupon">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}