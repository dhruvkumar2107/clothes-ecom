'use client';

import Link from 'next/link';
import { useMobileNav, useSearchOverlay } from '@/app/providers';
import { X, Search } from 'lucide-react';

const MOBILE_NAV = [
  { label: 'Women', href: '/products' },
  { label: 'Men', href: '/products?gender=men' },
  { label: 'New Arrivals', href: '/products?new=true' },
  { label: 'Collections', href: '/collections' },
  { label: 'Best Sellers', href: '/products?featured=true' },
  { label: 'Sale', href: '/products?sale=true' },
];

const HELP_LINKS = [
  { label: 'Track Order', href: '/track' },
  { label: 'Size Guide', href: '/size-guide' },
  { label: 'Contact Us', href: '/contact' },
  { label: 'FAQs', href: '/faq' },
];

const ACCOUNT_LINKS = [
  { label: 'My Account', href: '/account' },
  { label: 'Orders', href: '/account/orders' },
  { label: 'Wishlist', href: '/account/wishlist' },
  { label: 'Addresses', href: '/account/addresses' },
];

export function MobileNavDrawer() {
  const { open, closeNav } = useMobileNav();

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/40 z-[90] animate-fade-in backdrop-blur-sm"
        onClick={closeNav}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className="fixed left-0 top-0 h-full w-full max-w-sm bg-paper z-[100] flex flex-col shadow-2xl animate-slide-in-left"
        role="dialog"
        aria-label="Mobile navigation"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <span className="u-display text-lg">Menu</span>
          <button
            onClick={closeNav}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-paper-2 transition-colors u-focus"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <nav className="flex-1 overflow-y-auto" role="navigation">
          {/* Main Navigation */}
          <div className="px-6 py-6">
            <ul className="space-y-1">
              {MOBILE_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={closeNav}
                    className="block py-3 text-base text-ink hover:text-accent transition-colors u-focus"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account Links */}
          <div className="px-6 py-6 border-t border-line">
            <h3 className="u-label mb-4">Account</h3>
            <ul className="space-y-1">
              {ACCOUNT_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={closeNav}
                    className="block py-2 text-sm text-muted hover:text-ink transition-colors u-focus"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Help Links */}
          <div className="px-6 py-6 border-t border-line">
            <h3 className="u-label mb-4">Help</h3>
            <ul className="space-y-1">
              {HELP_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={closeNav}
                    className="block py-2 text-sm text-muted hover:text-ink transition-colors u-focus"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Footer Actions */}
        <div className="border-t border-line p-6 space-y-3">
          <button
            onClick={() => {
              closeNav();
              useSearchOverlay.getState().openOverlay();
            }}
            className="btn-secondary w-full text-xs"
          >
            <Search className="w-4 h-4" aria-hidden="true" />
            Search
          </button>
        </div>
      </aside>
    </>
  );
}
