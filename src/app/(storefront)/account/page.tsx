import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCustomerSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { formatCurrency } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'My Account',
  description: 'Manage your account, orders, and preferences',
};

const ACCOUNT_SECTIONS = [
  { href: '/account/orders', label: 'Orders', description: 'View and track your orders', icon: 'Package' },
  { href: '/account/wishlist', label: 'Wishlist', description: 'Your saved items', icon: 'Heart' },
  { href: '/account/addresses', label: 'Addresses', description: 'Manage delivery addresses', icon: 'MapPin' },
  { href: '/account/wallet', label: 'Wallet', description: 'View balance and transactions', icon: 'Wallet' },
  { href: '/account/referral', label: 'Refer & Earn', description: 'Share and earn rewards', icon: 'Gift' },
  { href: '/account/profile', label: 'Profile', description: 'Update your personal info', icon: 'User' },
];

export default async function AccountPage() {
  const session = await getCustomerSession();

  if (!session) {
    redirect('/login?redirect=/account');
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      name: true,
      email: true,
      phone: true,
      photoUrl: true,
      loyaltyTier: true,
      loyaltyPoints: true,
      referralCode: true,
      createdAt: true,
      _count: { select: { orders: true, addresses: true, wishlist: true } },
    },
  });

  if (!user) {
    redirect('/login?redirect=/account');
  }

  const wallet = await db.wallet.findUnique({
    where: { userId: session.userId },
    select: { balance: true, lockedBalance: true },
  });

  const recentOrders = await db.order.findMany({
    where: { userId: session.userId },
    orderBy: { placedAt: 'desc' },
    take: 3,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      grandTotal: true,
      placedAt: true,
      items: { select: { name: true, qty: true, imageUrl: true }, take: 1 },
    },
  });

  return (
    <div className="py-8 md:py-12">
      <div className="u-container">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="u-display text-3xl md:text-4xl">My Account</h1>
            <p className="text-muted">Manage your orders, preferences, and more</p>
          </div>
          <div className="flex items-center gap-4">
            {user.photoUrl ? (
              <img src={user.photoUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-ink flex items-center justify-center text-paper font-medium text-xl">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Profile Summary */}
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <div className="md:col-span-2 bg-paper rounded-lg border border-line p-6">
            <h2 className="u-display text-xl mb-4">Profile Overview</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="u-label mb-1">Name</p>
                <p className="font-medium">{user.name}</p>
              </div>
              <div>
                <p className="u-label mb-1">Email</p>
                <p className="font-medium">{user.email || 'Not set'}</p>
              </div>
              <div>
                <p className="u-label mb-1">Phone</p>
                <p className="font-medium">{user.phone || 'Not set'}</p>
              </div>
              <div>
                <p className="u-label mb-1">Member Since</p>
                <p className="font-medium">{new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-line flex flex-wrap gap-4">
              <Link href="/account/profile" className="text-sm text-accent hover:underline flex items-center gap-1">Edit Profile</Link>
              <Link href="/account/addresses" className="text-sm text-accent hover:underline flex items-center gap-1">Manage Addresses</Link>
            </div>
          </div>

          <div className="bg-paper rounded-lg border border-line p-6">
            <h2 className="u-display text-xl mb-4">Loyalty & Rewards</h2>
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${['bronze', 'silver', 'gold'].includes(user.loyaltyTier) ? `bg-${user.loyaltyTier}/10 border border-${user.loyaltyTier}/20` : 'bg-ink/5 border border-line'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="u-label capitalize">{user.loyaltyTier}</span>
                  <span className="font-bold text-lg">{user.loyaltyPoints} pts</span>
                </div>
                <div className="h-2 bg-ink/10 rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full transition-all" style={{ width: '45%' }} />
                </div>
                <p className="text-xs text-muted mt-2">500 pts to next tier</p>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Wallet Balance</span>
                <span className="font-semibold text-accent">{formatCurrency(wallet?.balance || 0)}</span>
              </div>
              <Link href="/account/wallet" className="text-sm text-accent hover:underline flex items-center gap-1">View Wallet</Link>
              <Link href="/account/referral" className="text-sm text-accent hover:underline flex items-center gap-1">Refer & Earn</Link>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard label="Total Orders" value={user._count.orders} />
          <StatCard label="Saved Addresses" value={user._count.addresses} />
          <StatCard label="Wishlist Items" value={user._count.wishlist} />
          <StatCard label="Referral Code" value={user.referralCode} />
        </div>

        {/* Recent Orders */}
        {(recentOrders.length > 0) && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="u-display text-2xl">Recent Orders</h2>
              <Link href="/account/orders" className="text-sm text-accent hover:underline flex items-center gap-1">View All</Link>
            </div>
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <Link key={order.id} href={`/account/orders/${order.id}`} className="flex items-center gap-4 p-4 bg-paper rounded-lg border border-line hover:border-accent/50 transition-colors">
                  {order.items[0]?.imageUrl ? (
                    <img src={order.items[0].imageUrl} alt="" className="w-16 h-20 rounded object-cover" />
                  ) : (
                    <div className="w-16 h-20 rounded bg-paper-2 flex items-center justify-center text-muted">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-ink truncate">{order.items[0]?.name || 'Order'}</p>
                    <p className="text-xs text-muted">{order.orderNumber} • {new Date(order.placedAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      order.status === 'delivered' ? 'bg-success/10 text-success' :
                      order.status === 'cancelled' ? 'bg-danger/10 text-danger' :
                      'bg-warning/10 text-warning'
                    }`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                    <p className="font-medium text-sm text-ink mt-1">{formatCurrency(order.grandTotal)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Account Sections */}
        <h2 className="u-display text-2xl mb-6">Account Sections</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ACCOUNT_SECTIONS.map((section, i) => (
            <Link key={i} href={section.href} className="p-5 bg-paper rounded-lg border border-line hover:border-accent/50 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-ink/5 flex items-center justify-center mb-3 group-hover:bg-ink/10 transition-colors">
                <svg className="w-5 h-5 text-ink group-hover:text-accent transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={getIconPath(section.icon)} />
                </svg>
              </div>
              <h3 className="font-medium text-ink group-hover:text-accent transition-colors">{section.label}</h3>
              <p className="text-sm text-muted mt-1">{section.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-4 bg-paper rounded-lg border border-line text-center">
      <p className="u-label mb-1">{label}</p>
      <p className="font-bold text-2xl text-ink">{value}</p>
    </div>
  );
}

function getIconPath(icon: string): string {
  const paths: Record<string, string> = {
    Package: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
    Heart: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
    MapPin: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z",
    Wallet: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2h2",
    Gift: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    User: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  };
  return paths[icon] || paths.Package;
}