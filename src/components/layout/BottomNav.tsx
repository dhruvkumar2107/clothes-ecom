'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Heart, ShoppingBag, User } from 'lucide-react';
import { useCartStore } from '@/app/providers';

const NAV_ITEMS = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/products', icon: Search, label: 'Shop' },
  { href: '/account/wishlist', icon: Heart, label: 'Wishlist' },
  { href: '/cart', icon: ShoppingBag, label: 'Bag' },
  { href: '/account', icon: User, label: 'Account' },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const { count } = useCartStore();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-[50] bg-paper/95 backdrop-blur-sm border-t border-line safe-area-pb"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-14">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 w-14 h-full transition-colors u-focus ${
                isActive ? 'text-ink' : 'text-muted hover:text-ink'
              }`}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative">
                <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.5} aria-hidden="true" />
                {item.label === 'Bag' && count > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[14px] h-3.5 px-1 bg-accent text-paper text-[8px] font-medium rounded-full flex items-center justify-center">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </div>
              <span className="text-[9px] tracking-wider uppercase">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
