import Link from 'next/link';
import { PrismaClient } from '@prisma/client';
import { formatMoney } from '@/lib/money';
import { Gift, Users, AlertTriangle, CheckCircle, XCircle, Clock, Filter, Search, ChevronRight, Edit } from 'lucide-react';

const prisma = new PrismaClient();

export const revalidate = 0;

export default async function AdminReferralsPage() {
  const [referrals, rules, fraudFlags] = await Promise.all([
    prisma.referral.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        referrer: { select: { name: true, email: true, referralCode: { select: { code: true } } } },
        invitee: { select: { name: true, email: true, createdAt: true } },
        commission: { select: { amount: true, status: true, createdAt: true } },
      },
    }),
    prisma.referralRule.findMany({
      orderBy: { priority: 'desc' },
    }),
    prisma.referralFraudFlag.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        referral: {
          include: {
            referrer: { select: { name: true, email: true } },
            invitee: { select: { name: true, email: true } },
          },
        },
      },
    }),
  ]);

  const pendingReferrals = referrals.filter(r => r.status === 'pending').length;
  const completedReferrals = referrals.filter(r => r.status === 'completed').length;
  const totalCommission = referrals.reduce((acc, r) => acc + (r.commission?.amount || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <h1 className="text-2xl font-serif font-bold text-zinc-100 tracking-wide">Referral Program</h1>
          <p className="text-xs text-zinc-400 mt-1">Track referrals, manage commission rules, and monitor fraud detection.</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-5">
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Pending Referrals</span>
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-zinc-100">{pendingReferrals}</div>
            <p className="text-[11px] text-zinc-400 mt-1">Awaiting qualification</p>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Completed Referrals</span>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-zinc-100">{completedReferrals}</div>
            <p className="text-[11px] text-emerald-400 mt-1">Successfully converted</p>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Total Commission</span>
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Gift className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-zinc-100">{formatMoney(totalCommission)}</div>
            <p className="text-[11px] text-purple-400 mt-1">Across all referrals</p>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Fraud Flags</span>
            <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-zinc-100">{fraudFlags.length}</div>
            <p className="text-[11px] text-rose-400 mt-1">Requires review</p>
          </div>
        </div>
      </div>

      {/* Commission Rules */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <Gift className="w-4 h-4 text-amber-400" /> Commission Rules
          </h2>
          <Link
            href="/admin/referrals/rules/new"
            className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1"
          >
            Add Rule <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {rules.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-xs">
            No commission rules configured. Create rules to define commission tiers.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Min Order</th>
                  <th className="px-4 py-3">Max Uses</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-zinc-100">{rule.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700/50 text-zinc-300 font-mono text-[10px]">
                        {rule.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-200">
                      {rule.type === 'percent' ? `${rule.value}%` : formatMoney(rule.value)}
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-400">
                      {rule.minOrderValue ? formatMoney(rule.minOrderValue) : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-400">
                      {rule.maxUsesPerUser || 'Unlimited'}
                    </td>
                    <td className="px-4 py-3 font-mono text-amber-400">{rule.priority}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          rule.isActive
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        }`}
                      >
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded transition-colors" title="Edit Rule">
                        <Edit className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Referral List */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-400" /> Recent Referrals
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4">Referrer</th>
                <th className="px-6 py-4">Invitee</th>
                <th className="px-6 py-4">Code Used</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Commission</th>
                <th className="px-6 py-4">Qualified At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {referrals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">No referrals yet.</td>
                </tr>
              ) : (
                referrals.map((ref) => (
                  <tr key={ref.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <span className="font-medium text-zinc-100 block text-sm">{ref.referrer.name || 'Unknown'}</span>
                        <span className="text-[10px] text-zinc-400 font-mono">{ref.referrer.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <span className="font-medium text-zinc-100 block text-sm">{ref.invitee.name || 'Unknown'}</span>
                        <span className="text-[10px] text-zinc-400 font-mono">{ref.invitee.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-amber-400">
                      {ref.referrer.referralCode?.code || '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          ref.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : ref.status === 'pending'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        }`}
                      >
                        {ref.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-purple-400">
                      {ref.commission ? formatMoney(ref.commission.amount) : '—'}
                    </td>
                    <td className="px-6 py-4 text-zinc-400 font-mono text-[11px]">
                      {ref.qualifiedAt ? new Date(ref.qualifiedAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fraud Flags */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" /> Fraud Detection Flags
        </h2>

        {fraudFlags.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-xs">
            No fraud flags detected. The system monitors for self-referral, circular referrals, and velocity abuse.
          </div>
        ) : (
          <div className="space-y-3">
            {fraudFlags.map((flag) => (
              <div key={flag.id} className="p-4 bg-zinc-950/60 border border-zinc-800 rounded-lg flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 text-sm">
                    <span className={`px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider ${
                      flag.severity === 'high'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : flag.severity === 'medium'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    }`}>
                      {flag.severity}
                    </span>
                    <span className="text-zinc-300">{flag.reason}</span>
                    <span className="text-zinc-500 font-mono text-[10px]">/{flag.referral.id.slice(0, 8)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-[11px] text-zinc-400">
                    <span>Referrer: {flag.referral.referrer.name} ({flag.referral.referrer.email})</span>
                    <span>Invitee: {flag.referral.invitee.name} ({flag.referral.invitee.email})</span>
                    <span className="font-mono">{new Date(flag.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-medium rounded hover:bg-emerald-500/20 transition-colors">
                    Dismiss
                  </button>
                  <button className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-medium rounded hover:bg-rose-500/20 transition-colors">
                    Block Referrer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}