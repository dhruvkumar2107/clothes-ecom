'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCartStore, useSearchOverlay, useMobileNav } from '@/app/providers';
import { Button } from '@/components/ui/Button';
import { Search, Menu, X, User, Heart, ShoppingBag, ChevronRight } from 'lucide-react';

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { count, refresh } = useCartStore();
  const { open: searchOpen, closeOverlay } = useSearchOverlay();
  const { open: mobileOpen, closeNav } = useMobileNav();
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[50] transition-all duration-300 ${
        scrolled ? 'bg-paper/95 backdrop-blur-sm border-b border-line shadow-sm' : 'bg-transparent'
      }`}
      style={{ top: scrolled ? 0 : '32px' }}
      role="banner"
    >
      <div className="u-container">
        <div className="flex items-center justify-between h-16 md:h-20 gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 shrink-0 u-focus"
            aria-label="LUMEN&CO Home"
          >
            <span className="u-display text-2xl md:text-3xl font-light tracking-tight text-ink">
              LUMEN&CO
            </span>
            <span className="u-label text-xs md:text-sm ml-1 hidden lg:inline">Light as couture</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8" role="navigation" aria-label="Main navigation">
            <Link href="/products" className="u-label hover:text-ink transition-colors u-focus">
              Shop
            </Link>
            <Link href="/collections" className="u-label hover:text-ink transition-colors u-focus">
              Collections
            </Link>
            <Link href="/products?new=true" className="u-label hover:text-ink transition-colors u-focus">
              New
            </Link>
            <Link href="/products?featured=true" className="u-label hover:text-ink transition-colors u-focus">
              Bestsellers
            </Link>
          </nav>

          {/* Desktop Search Bar */}
          <form
            onSubmit={handleSearch}
            className="hidden md:flex items-center flex-1 max-w-xs lg:max-w-sm mx-4"
            role="search"
          >
            <div className="relative w-full group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-2 group-focus-within:text-ink transition-colors" aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-paper-2 border border-line rounded-full focus:bg-paper focus:border-ink/20 focus:outline-none transition-all placeholder:text-muted-2"
                aria-label="Search products"
              />
            </div>
          </form>

          {/* Actions */}
          <div className="flex items-center gap-1 md:gap-3 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => useSearchOverlay.getState().openOverlay()}
              aria-label="Search"
              className="md:hidden u-focus"
            >
              <Search className="w-5 h-5" aria-hidden="true" />
            </Button>

            <Link
              href="/account/wishlist"
              className="hidden sm:flex items-center justify-center w-10 h-10 rounded-md hover:bg-ink-2 transition-colors u-focus"
              aria-label="Wishlist"
            >
              <Heart className="w-5 h-5 text-ink" aria-hidden="true" />
            </Link>

            <Link
              href="/account"
              className="hidden sm:flex items-center justify-center w-10 h-10 rounded-md hover:bg-ink-2 transition-colors u-focus"
              aria-label="My Account"
            >
              <User className="w-5 h-5 text-ink" aria-hidden="true" />
            </Link>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => useCartStore.getState().openDrawer()}
              aria-label={`Shopping bag, ${count} items`}
              className="relative u-focus"
            >
              <ShoppingBag className="w-5 h-5 text-ink" aria-hidden="true" />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-5 px-1.5 bg-accent text-paper text-[10px] font-medium rounded-full flex items-center justify-center animate-fade-in">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => useMobileNav.getState().openNav()}
              aria-label="Menu"
              className="md:hidden u-focus"
            >
              <Menu className="w-6 h-6 text-ink" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
