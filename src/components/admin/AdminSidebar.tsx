'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  ShoppingBag,
  Layers,
  Users,
  Wallet,
  Settings,
  Sparkles,
  ArrowLeft,
  Gift,
  TicketPercent,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Products', href: '/admin/products', icon: Package },
  { name: 'Add Product', href: '/admin/products/new', icon: PlusCircle },
  { name: 'Orders & Refunds', href: '/admin/orders', icon: ShoppingBag },
  { name: 'Collections', href: '/admin/collections', icon: Layers },
  { name: 'Customers', href: '/admin/users', icon: Users },
  { name: 'Referrals', href: '/admin/referrals', icon: Gift },
  { name: 'Coupons', href: '/admin/coupons', icon: TicketPercent },
  { name: 'Payouts', href: '/admin/payouts', icon: Wallet },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-800/80 flex flex-col justify-between h-screen sticky top-0 text-zinc-100 z-40">
      <div>
        {/* Brand Header */}
        <div className="p-6 border-b border-zinc-800/60 flex items-center justify-between">
          <Link href="/admin/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-serif text-lg tracking-widest uppercase text-amber-200 font-bold">LUMEN</span>
              <span className="text-xs block text-zinc-400 font-sans tracking-normal">Admin Control</span>
            </div>
          </Link>
        </div>

        {/* Navigation Menu */}
        <nav className="p-4 space-y-1.5">
          {navigation.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/80'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-zinc-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / Storefront link */}
      <div className="p-4 border-t border-zinc-800/60">
        <Link
          href="/"
          className="flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-amber-300 hover:bg-zinc-900/60 transition-all border border-transparent hover:border-zinc-800"
        >
          <span className="flex items-center gap-2">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Storefront
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </Link>
      </div>
    </aside>
  );
}
