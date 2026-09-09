'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCartStore, useSearchOverlay, useMobileNav } from '@/app/providers';
import { Search, Menu, X, User, Heart, ShoppingBag } from 'lucide-react';

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const { count, refresh } = useCartStore();
  const { open: searchOpen } = useSearchOverlay();
  const { open: mobileOpen } = useMobileNav();
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 16);

      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setHidden(true);
      } else {
        setHidden(false);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSearchClick = useCallback(() => {
    useSearchOverlay.getState().openOverlay();
  }, []);

  return (
    <header
      className={`fixed left-0 right-0 z-50 transition-all duration-300 ${
        hidden ? '-translate-y-full' : 'translate-y-0'
      } ${scrolled ? 'bg-paper/95 backdrop-blur-md shadow-[0_1px_0_0_var(--color-line)]' : 'bg-paper'}`}
      style={{ top: 0 }}
      role="banner"
    >
      {/* Main Navigation */}
      <div className="u-container">
        <div className="flex items-center justify-between h-14 md:h-16 gap-4">
          {/* Mobile Menu */}
          <button
            onClick={() => useMobileNav.getState().openNav()}
            className="flex items-center justify-center w-10 h-10 md:hidden transition-colors u-focus"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </button>

          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 shrink-0 u-focus"
            aria-label="LUMEN&CO Home"
          >
            <span className="u-display text-xl md:text-2xl font-normal tracking-[-0.02em] text-ink">
              LUMEN&CO
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8 ml-8" role="navigation" aria-label="Main navigation">
            <Link href="/products" className="u-label hover:text-ink transition-colors u-focus">
              Women
            </Link>
            <Link href="/products?gender=men" className="u-label hover:text-ink transition-colors u-focus">
              Men
            </Link>
            <Link href="/products?new=true" className="u-label hover:text-ink transition-colors u-focus">
              New Arrivals
            </Link>
            <Link href="/collections" className="u-label hover:text-ink transition-colors u-focus">
              Collections
            </Link>
            <Link href="/products?featured=true" className="u-label hover:text-ink transition-colors u-focus">
              Best Sellers
            </Link>
            <Link href="/products?sale=true" className="u-label text-danger hover:text-danger/80 transition-colors u-focus">
              Sale
            </Link>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            {/* Search */}
            <button
              onClick={handleSearchClick}
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-paper-2 transition-colors u-focus"
              aria-label="Search"
            >
              <Search className="w-[18px] h-[18px] text-ink" aria-hidden="true" />
            </button>

            {/* Account */}
            <Link
              href="/account"
              className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full hover:bg-paper-2 transition-colors u-focus"
              aria-label="My Account"
            >
              <User className="w-[18px] h-[18px] text-ink" aria-hidden="true" />
            </Link>

            {/* Wishlist */}
            <Link
              href="/account/wishlist"
              className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full hover:bg-paper-2 transition-colors u-focus"
              aria-label="Wishlist"
            >
              <Heart className="w-[18px] h-[18px] text-ink" aria-hidden="true" />
            </Link>

            {/* Cart */}
            <button
              onClick={() => useCartStore.getState().openDrawer()}
              className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-paper-2 transition-colors u-focus"
              aria-label={`Shopping bag, ${count} items`}
            >
              <ShoppingBag className="w-[18px] h-[18px] text-ink" aria-hidden="true" />
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-ink text-paper text-[9px] font-medium rounded-full flex items-center justify-center animate-fade-in tabular-nums">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
