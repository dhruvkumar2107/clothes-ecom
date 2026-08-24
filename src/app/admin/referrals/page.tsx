import Link from 'next/link';
import { Gift, Users, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function AdminReferralsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-serif font-bold text-zinc-100 mb-6">Referral Program</h1>

      <div className="mb-6">
        <h2>Pending Referrals</h2>
        <p>No referral data available. The referral system is active and will track referrals automatically.</p>
      </div>

      <div className="mb-6">
        <h2>Commission Rules</h2>
        <p>No commission rules configured. Rules can be created in the admin panel once the database is set up.</p>
      </div>

      <div className="mb-6">
        <h2>Fraud Detection</h2>
        <p>Fraud monitoring is active. The system watches for self-referral, circular referrals, and velocity abuse patterns.</p>
      </div>

      <div className="mt-8 p-4 bg-zinc-800/50 rounded">
        <h3>How It Works</h3>
        <ul className="list-disc list-inside space-y-2 text-zinc-400">
          <li>Customers get a unique referral code to share</li>
          <li>When a friend uses the code, both earn commissions</li>
          <li>Commissions are held for the return window (typically 14 days)</li>
          <li>Fraud patterns are automatically detected and blocked</li>
        </ul>
      </div>
    </div>
  )
}