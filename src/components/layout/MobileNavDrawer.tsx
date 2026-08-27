'use client';

import Link from 'next/link';
import { useMobileNav, useSearchOverlay } from '@/app/providers';
import { X, ChevronRight, ShoppingBag, Heart, User, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const MOBILE_NAV = [
  { label: 'Shop All', href: '/products', icon: ShoppingBag },
  { label: 'New Arrivals', href: '/products?new=true', icon: null },
  { label: 'Bestsellers', href: '/products?featured=true', icon: null },
  { label: 'Collections', href: '/collections', icon: null },
  { label: 'Creator Storefronts', href: '/creators', icon: null },
  { label: 'Virtual Try-On', href: '/virtual-try-on', icon: null },
  { label: 'Virtual Wardrobe', href: '/wardrobe', icon: null },
  { label: 'Style Quiz', href: '/style-quiz', icon: null },
  { label: 'Sale', href: '/products?sale=true', icon: null },
];

export function MobileNavDrawer() {
  const { open, closeNav } = useMobileNav();

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-ink/50 z-[90] animate-in"
        onClick={closeNav}
        aria-hidden="true"
      />
      <aside
        className="fixed left-0 top-0 h-full w-full max-w-sm bg-paper z-[100] flex flex-col shadow-xl animate-in-left"
        role="dialog"
        aria-label="Mobile navigation"
        aria-modal="true"
      >
        <div className="flex items-center justify-between p-4 border-b border-line">
          <h2 className="u-display text-xl font-medium">Menu</h2>
          <button
            onClick={closeNav}
            className="w-10 h-10 rounded-md hover:bg-ink-2 flex items-center justify-center transition-colors u-focus"
            aria-label="Close menu"
          >
            <X className="w-5 h-5 text-ink" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1" role="navigation">
          {MOBILE_NAV.map((item, i) => (
            <Link
              key={i}
              href={item.href}
              onClick={closeNav}
              className="flex items-center gap-3 px-4 py-3 rounded-md text-ink hover:bg-ink-2 transition-colors u-focus"
            >
              {item.icon && <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />}
              <span className="font-medium">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-muted ml-auto" aria-hidden="true" />
            </Link>
          ))}

          <div className="pt-4 border-t border-line">
            <Link
              href="/account/wishlist"
              onClick={closeNav}
              className="flex items-center gap-3 px-4 py-3 rounded-md text-ink hover:bg-ink-2 transition-colors u-focus"
            >
              <Heart className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <span className="font-medium">Wishlist</span>
            </Link>
            <Link
              href="/account"
              onClick={closeNav}
              className="flex items-center gap-3 px-4 py-3 rounded-md text-ink hover:bg-ink-2 transition-colors u-focus"
            >
              <User className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <span className="font-medium">My Account</span>
            </Link>
          </div>
        </nav>

        <div className="p-4 border-t border-line space-y-3">
          <Button variant="outline" className="w-full justify-center gap-2" onClick={() => { useMobileNav.getState().closeNav(); useSearchOverlay.getState().openOverlay(); }}>
            <Search className="w-4 h-4" aria-hidden="true" />
            Search
          </Button>
          <Link href="/cart" onClick={closeNav} className="block">
            <Button className="w-full justify-center gap-2">
              <ShoppingBag className="w-4 h-4" aria-hidden="true" />
              Shopping Bag
            </Button>
          </Link>
        </div>
      </aside>
    </>
  );
}