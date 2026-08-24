import Link from 'next/link';
import { PrismaClient } from '@prisma/client';
import { formatMoney } from '@/lib/money';
import { Wallet, Banknote, CheckCircle, XCircle, Clock, Loader2, Shield, AlertTriangle, ExternalLink } from 'lucide-react';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export default async function AdminPayoutsPage() {
  const [withdrawals, bankAccounts] = await Promise.all([
    prisma.withdrawalRequest.findMany({
      orderBy: { requestedAt: 'desc' },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        bankAccount: { select: { accountHolderName: true, accountNumberLast4: true, ifsc: true, bankName: true, verificationStatus: true } },
      },
    }),
    prisma.bankAccount.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  const pendingCount = withdrawals.filter(w => w.status === 'pending').length;
  const processingCount = withdrawals.filter(w => w.status === 'processing').length;
  const completedCount = withdrawals.filter(w => w.status === 'completed').length;
  const failedCount = withdrawals.filter(w => w.status === 'failed').length;
  const totalPending = withdrawals
    .filter(w => w.status === 'pending')
    .reduce((acc, w) => acc + w.amount, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <h1 className="text-2xl font-serif font-bold text-zinc-100 tracking-wide">Payouts & Withdrawals</h1>
          <p className="text-xs text-zinc-400 mt-1">Manage customer withdrawal requests and bank account verifications.</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Pending Review</span>
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-zinc-100">{pendingCount}</div>
            <p className="text-[11px] text-amber-400 mt-1">{formatMoney(totalPending)} awaiting approval</p>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Processing</span>
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-zinc-100">{processingCount}</div>
            <p className="text-[11px] text-blue-400 mt-1">Sent to payment provider</p>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Completed</span>
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-zinc-100">{completedCount}</div>
            <p className="text-[11px] text-emerald-400 mt-1">Successfully paid out</p>
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Failed</span>
            <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-zinc-100">{failedCount}</div>
            <p className="text-[11px] text-rose-400 mt-1">Requires attention</p>
          </div>
        </div>
      </div>

      {/* Withdrawal Queue */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-amber-400" /> Withdrawal Requests
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4">Request ID</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Bank Account</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Provider Ref</th>
                <th className="px-6 py-4">Requested</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-zinc-500">
                    No withdrawal requests yet.
                  </td>
                </tr>
              ) : (
                withdrawals.map((w) => (
                  <tr key={w.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-amber-300">
                      #{w.id.slice(-8).toUpperCase()}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <span className="font-medium text-zinc-100 block text-sm">{w.user.name}</span>
                        <span className="text-[10px] text-zinc-400 font-mono">{w.user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-zinc-100">
                      {formatMoney(w.amount)}
                    </td>
                    <td className="px-6 py-4 text-zinc-300 text-sm">
                      {w.bankAccount ? (
                        <>
                          {w.bankAccount.accountHolderName} • {w.bankAccount.bankName}
                          <span className="block text-[10px] text-zinc-500 font-mono">
                            **** {w.bankAccount.accountNumberLast4} / {w.bankAccount.ifsc}
                          </span>
                        </>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          w.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : w.status === 'processing'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : w.status === 'failed'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {w.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-zinc-400 text-[11px]">
                      {w.providerPayoutId || '—'}
                    </td>
                    <td className="px-6 py-4 text-zinc-400 font-mono text-[11px]">
                      {new Date(w.requestedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {w.status === 'pending' && (
                          <>
                            <button className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-medium rounded hover:bg-emerald-500/20 transition-colors flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Approve
                            </button>
                            <button className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-medium rounded hover:bg-rose-500/20 transition-colors flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Reject
                            </button>
                          </>
                        )}
                        {w.status === 'processing' && (
                          <button className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-medium rounded hover:bg-blue-500/20 transition-colors flex items-center gap-1" disabled>
                            <Loader2 className="w-3 h-3 animate-spin" /> Processing
                          </button>
                        )}
                        {w.status === 'completed' && w.providerPayoutId && (
                          <button className="p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded transition-colors" title="View on Provider">
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bank Account Verification Logs */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-400" /> Bank Account Verification Logs
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950/80 text-zinc-400 uppercase text-[10px] tracking-wider border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Account Details</th>
                <th className="px-6 py-4">Verification</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Verified At</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {bankAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                    No bank accounts on file.
                  </td>
                </tr>
              ) : (
                bankAccounts.map((ba) => (
                  <tr key={ba.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <span className="font-medium text-zinc-100 block text-sm">{ba.user.name}</span>
                        <span className="text-[10px] text-zinc-400 font-mono">{ba.user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-zinc-300 text-sm">
                      {ba.accountHolderName} • {ba.bankName}
                      <span className="block text-[10px] text-zinc-500 font-mono">
                        {ba.accountNumberLast4} / {ba.ifsc}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700/50 text-zinc-300 font-mono text-[10px]">
                        Verified
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30`}
                      >
                        Verified
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-400 font-mono text-[11px]">
                      {ba.verifiedAt ? new Date(ba.verifiedAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!true && (
                        <button className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-medium rounded hover:bg-blue-500/20 transition-colors">
                          Re-verify
                        </button>
                      )}
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