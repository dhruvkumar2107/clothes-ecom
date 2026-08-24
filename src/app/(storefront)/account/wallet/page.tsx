import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCustomerSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { formatCurrency } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Wallet',
  description: 'View your wallet balance and transactions',
};

export default async function WalletPage() {
  const session = await getCustomerSession();

  if (!session) {
    redirect('/login?redirect=/account/wallet');
  }

  const wallet = await db.wallet.findUnique({
    where: { userId: session.userId },
  });

  const transactions = await db.walletTransaction.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const balance = wallet?.balance || 0;
  const lockedBalance = wallet?.lockedBalance || 0;
  const available = balance - lockedBalance;

  const typeLabels: Record<string, string> = {
    referral_commission: 'Referral Commission',
    cashback: 'Cashback',
    refund: 'Refund',
    order_payment: 'Order Payment',
    withdrawal: 'Withdrawal',
    withdrawal_reversal: 'Withdrawal Reversed',
    adjustment: 'Adjustment',
    signup_bonus: 'Signup Bonus',
  };

  const directionLabels: Record<string, string> = {
    credit: 'Credited',
    debit: 'Debited',
  };

  return (
    <div className="py-8 md:py-12">
      <div className="u-container">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="u-display text-3xl mb-1">Wallet</h1>
            <p className="text-muted">Manage your wallet balance and transactions</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Balance Card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-paper rounded-lg border border-line p-6">
              <div className="grid sm:grid-cols-3 gap-6">
                <div className="sm:col-span-2">
                  <p className="u-label mb-1">Available Balance</p>
                  <p className="text-4xl font-bold text-accent">{formatCurrency(available)}</p>
                  <p className="text-sm text-muted mt-1">Total: {formatCurrency(balance)} • Locked: {formatCurrency(lockedBalance)}</p>
                </div>
                <div className="text-right sm:text-left">
                  <p className="u-label mb-1">Total Earned</p>
                  <p className="font-semibold text-lg text-ink">{formatCurrency(wallet?.totalEarned || 0)}</p>
                </div>
                <div className="text-right sm:text-left">
                  <p className="u-label mb-1">Total Withdrawn</p>
                  <p className="font-semibold text-lg text-ink">{formatCurrency(wallet?.totalWithdrawn || 0)}</p>
                </div>
              </div>
            </div>

            {/* Transactions */}
            <div className="bg-paper rounded-lg border border-line overflow-hidden">
              <div className="p-4 border-b border-line">
                <h2 className="u-display text-xl">Recent Transactions</h2>
              </div>
              {transactions.length === 0 ? (
                <div className="p-8 text-center text-muted">
                  No transactions yet. Earn wallet balance through referrals, cashback, or refunds.
                </div>
              ) : (
                <div className="divide-y divide-line">
                  {transactions.map((txn) => (
                    <div key={txn.id} className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${txn.direction === 'credit' ? 'bg-success/10' : 'bg-danger/10'}`}>
                          <svg className={`w-5 h-5 ${txn.direction === 'credit' ? 'text-success' : 'text-danger'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={txn.direction === 'credit' ? "M12 6v6m0 0v6m0-6h6m-6 0H6" : "M20 12H4"} />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-sm text-ink truncate max-w-xs">{typeLabels[txn.type] || txn.type}</p>
                          <p className="text-xs text-muted">{new Date(txn.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                          {txn.description && <p className="text-xs text-muted truncate max-w-xs">{txn.description}</p>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-semibold text-sm ${txn.direction === 'credit' ? 'text-success' : 'text-danger'}`}>
                          {txn.direction === 'credit' ? '+' : '−'}{formatCurrency(txn.amount)}
                        </p>
                        <p className="text-xs text-muted">{txn.status === 'held' ? 'Held' : txn.direction === 'credit' ? 'Available' : 'Spent'}</p>
                        {txn.availableAt && <p className="text-xs text-warning">Available from {new Date(txn.availableAt).toLocaleDateString()}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-paper rounded-lg border border-line p-6">
              <h3 className="u-display text-lg mb-4">How to Earn</h3>
              <ul className="space-y-3 text-sm text-muted">
                <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center"><svg className="w-3 h-3 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></span> Refer friends — earn ₹200 per referral</li>
                <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center"><svg className="w-3 h-3 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></span> Cashback on orders — up to 5%</li>
                <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center"><svg className="w-3 h-3 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></span> Refunds credited instantly</li>
              </ul>
            </div>

            <div className="bg-paper rounded-lg border border-line p-6">
              <h3 className="u-display text-lg mb-4">Wallet Rules</h3>
              <ul className="space-y-2 text-sm text-muted">
                <li>• Wallet balance can be used for up to 50% of order total</li>
                <li>• Referral commissions are held for 14 days after delivery</li>
                <li>• Withdrawals take 1-3 business days to process</li>
                <li>• Minimum withdrawal: ₹500</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}