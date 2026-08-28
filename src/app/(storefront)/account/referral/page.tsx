import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCustomerSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CopyButton } from '@/components/ui/CopyButton';
import { Share2, Users, Gift, TrendingUp, Send, Mail } from 'lucide-react';

export const revalidate = 0;

const REFERRAL_PITCH =
  'Check out LUMEN&CO — use my link and get ₹200 off your first order.';

export const metadata: Metadata = {
  title: 'Refer & Earn',
  description: 'Share LUMEN&CO with friends and earn rewards',
};

export default async function ReferralPage() {
  const session = await getCustomerSession();

  if (!session) {
    redirect('/login?redirect=/account/referral');
  }

  const referrals = await db.referral.findMany({
    where: { referrerId: session.userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      code: true,
      status: true,
      createdAt: true,
      referredUser: {
        select: { id: true, name: true, email: true, photoUrl: true, createdAt: true },
      },
      convertedAt: true,
      firstOrderId: true,
      commissions: {
        select: {
          id: true,
          commissionAmount: true,
          status: true,
          holdUntil: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const totalConversions = referrals.filter(r => r.status === 'converted').length;
  const totalEarned = await db.referralCommission.aggregate({
    where: { referrerId: session.userId, status: { in: ['available', 'paid'] } },
    _sum: { commissionAmount: true },
  });
  const pendingEarnings = await db.referralCommission.aggregate({
    where: { referrerId: session.userId, status: 'held' },
    _sum: { commissionAmount: true },
  });

  // A missing NEXT_PUBLIC_APP_URL would otherwise ship a link that literally
  // starts with "undefined/".
  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://clothes-ecom.onrender.com').replace(/\/$/, '');
  const referralLink = `${origin}/signup?ref=${session.referralCode}`;
  const shareText = `${REFERRAL_PITCH} ${referralLink}`;

  const tierThresholds = [0, 5, 15, 50];
  const currentTier = tierThresholds.findLast(t => totalConversions >= t) || 0;
  const nextTier = tierThresholds.find(t => t > currentTier) || null;

  return (
    <div className="py-8 md:py-12">
      <div className="u-container">
        <div className="mb-8">
          <h1 className="u-display text-3xl mb-2">Refer & Earn</h1>
          <p className="text-muted">Share LUMEN&CO with friends. They get ₹200 off, you earn ₹200 wallet credit.</p>
        </div>

        {/* Share Card */}
        <div className="bg-gradient-to-br from-accent/10 to-accent/5 rounded-2xl border border-accent/20 p-8 mb-10">
          <div className="max-w-2xl">
            <h2 className="u-display text-2xl mb-4">Your Referral Link</h2>
            <div className="flex gap-2 mb-4">
              <Input
                value={referralLink}
                readOnly
                className="flex-1 bg-paper border-line"
              />
              <CopyButton value={referralLink} label="Copy" />
            </div>
            {/*
              Share targets are links, not click handlers — this is a server
              component, and every one of these is a plain URL anyway.
            */}
            <div className="flex flex-wrap gap-3">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-ink text-paper rounded-md text-sm font-medium hover:bg-ink-2 transition-colors flex items-center gap-2 u-focus"
              >
                <Share2 className="w-4 h-4" aria-hidden="true" />
                Share via WhatsApp
              </a>
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(REFERRAL_PITCH)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 border border-line rounded-md text-sm font-medium hover:bg-paper-3 transition-colors flex items-center gap-2 u-focus"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
                Telegram
              </a>
              <a
                href={`mailto:?subject=${encodeURIComponent('₹200 off at LUMEN&CO')}&body=${encodeURIComponent(shareText)}`}
                className="px-4 py-2 border border-line rounded-md text-sm font-medium hover:bg-paper-3 transition-colors flex items-center gap-2 u-focus"
              >
                <Mail className="w-4 h-4" aria-hidden="true" />
                Email
              </a>
            </div>
            <p className="text-sm text-muted mt-4">Your code: <strong className="text-ink">{session.referralCode}</strong> — Friends get ₹200 off their first order.</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard icon={Users} label="Total Referrals" value={referrals.length} />
          <StatCard icon={Gift} label="Conversions" value={totalConversions} />
          <StatCard icon={TrendingUp} label="Total Earned" value={formatCurrency(totalEarned._sum.commissionAmount || 0)} />
          <StatCard icon={TrendingUp} label="Pending" value={formatCurrency(pendingEarnings._sum.commissionAmount || 0)} className="text-warning" />
        </div>

        {/* Tier Progress */}
        <div className="bg-paper rounded-lg border border-line p-6 mb-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="u-display text-xl">Your Tier Progress</h3>
            <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${currentTier >= 50 ? 'bg-amber/10 text-amber' : currentTier >= 15 ? 'bg-gray/10 text-gray' : currentTier >= 5 ? 'bg-orange/10 text-orange' : 'bg-bronze/10 text-bronze'}`}>
              {currentTier >= 50 ? 'Gold' : currentTier >= 15 ? 'Silver' : currentTier >= 5 ? 'Bronze' : 'Starter'}
            </span>
          </div>
          <div className="h-3 bg-ink/10 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${Math.min(100, (totalConversions / (nextTier || 50)) * 100)}%` }} />
          </div>
          <p className="text-sm text-muted">
            {nextTier ? `${totalConversions}/${nextTier} referrals to reach next tier` : 'You\'ve reached the highest tier!'}
          </p>
        </div>

        {/* Referrals List */}
        <div className="bg-paper rounded-lg border border-line overflow-hidden">
          <div className="p-4 border-b border-line">
            <h2 className="u-display text-xl">Your Referrals</h2>
          </div>
          {referrals.length === 0 ? (
            <div className="p-8 text-center text-muted">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg mb-2">No referrals yet</p>
              <p>Share your link to start earning</p>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {referrals.map((ref) => (
                <div key={ref.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-ink/5 flex items-center justify-center flex-shrink-0">
                      {ref.referredUser.photoUrl ? (
                        <img src={ref.referredUser.photoUrl} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-ink font-medium">{ref.referredUser.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-ink truncate max-w-xs">{ref.referredUser.name}</p>
                      <p className="text-xs text-muted">{ref.referredUser.email}</p>
                      <p className="text-xs text-muted">{new Date(ref.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${ref.status === 'converted' ? 'bg-success/10 text-success' : ref.status === 'rejected' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}`}>
                      {ref.status.charAt(0).toUpperCase() + ref.status.slice(1)}
                    </span>
                    {ref.commissions.length > 0 && (
                      <div className="text-right">
                        <p className="font-medium text-sm text-accent">{formatCurrency(ref.commissions.reduce((sum, c) => sum + c.commissionAmount, 0))}</p>
                        <p className="text-xs text-muted">{ref.commissions.filter(c => c.status === 'held').length} pending</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="mt-10 grid md:grid-cols-3 gap-6">
          <HowItWorksStep number={1} title="Share Your Link" desc="Copy your unique referral link or code and share it with friends via WhatsApp, email, or social media." icon={<Share2 className="w-6 h-6" />} />
          <HowItWorksStep number={2} title="Friend Shops" desc="Your friend signs up and places their first order using your link. They get ₹200 off instantly." icon={<Gift className="w-6 h-6" />} />
          <HowItWorksStep number={3} title="You Earn" desc="Once their order is delivered and the return window passes, ₹200 is credited to your wallet." icon={<TrendingUp className="w-6 h-6" />} />
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, className = '' }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; className?: string }) {
  return (
    <div className="p-5 bg-paper rounded-lg border border-line text-center">
      <Icon className="w-6 h-6 text-accent mx-auto mb-2" />
      <p className="u-label mb-1">{label}</p>
      <p className={`font-bold text-2xl ${className}`}>{value}</p>
    </div>
  );
}

function HowItWorksStep({ number, title, desc, icon }: { number: number; title: string; desc: string; icon: React.ReactNode }) {
  return (
    <div className="relative p-6 bg-paper rounded-lg border border-line">
      <span className="absolute -top-3 left-6 w-8 h-8 rounded-full bg-accent text-paper font-bold text-sm flex items-center justify-center">{number}</span>
      <div className="pt-4">
        <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-3 text-accent">{icon}</div>
        <h3 className="u-display text-lg mb-2">{title}</h3>
        <p className="text-sm text-muted">{desc}</p>
      </div>
    </div>
  );
}