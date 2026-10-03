'use client';

import React from 'react';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCartStore, useSearchOverlay, useMobileNav } from '@/app/providers';
import { Search, Menu, X, User, Heart, ShoppingBag, ChevronDown, ChevronRight } from 'lucide-react';

interface MegaMenuItem {
  label: string;
  href?: string;
  sublinks?: MegaMenuSublink[];
}

interface MegaMenuSublink {
  label: string;
  href?: string;
  sublinks?: MegaMenuSublink[];
}

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

  const megaMenus: Record<string, MegaMenuItem[]> = {
    women: [
      {
        label: 'Women',
        sublinks: [
          { label: 'Clothing', sublinks: [
            { label: 'Dresses', href: '/products?category=women-dresses' },
            { label: 'Tops', href: '/products?category=women-tops' },
            { label: 'Shirts', href: '/products?category=women-tops' },
            { label: 'Co-ords', href: '/products?category=women-tops' },
            { label: 'Bottoms', href: '/products?category=women-bottoms' },
            { label: 'Jackets', href: '/products?category=women-outerwear' },
            { label: 'Ethnic', href: '/products?category=women-outerwear' },
            { label: 'Accessories', href: '/products?category=unisex-accessories' },
          ]},
          { label: 'Shop by:', sublinks: [
            { label: 'New Arrivals', href: '/products?sort=newest' },
            { label: 'Best Sellers', href: '/products?featured=true' },
            { label: 'Trending', href: '/products?new=true' },
            { label: 'Under ₹1999', href: '/products?minPrice=0&maxPrice=199999' },
            { label: 'Limited Edition', href: '/collections?kind=drop' },
          ]},
        ],
      },
    ],
    men: [
      {
        label: 'Men',
        sublinks: [
          { label: 'Clothing', sublinks: [
            { label: 'Shirts', href: '/products?category=men-shirts' },
            { label: 'Trousers', href: '/products?category=men-trousers' },
            { label: 'Outerwear', href: '/products?category=men-outerwear' },
            { label: 'Knitwear', href: '/products?category=men-knitwear' },
          ]},
          { label: 'Shop by:', sublinks: [
            { label: 'New Arrivals', href: '/products?sort=newest' },
            { label: 'Best Sellers', href: '/products?featured=true' },
            { label: 'Under ₹1999', href: '/products?minPrice=0&maxPrice=199999' },
          ]},
        ],
      },
    ],
  };

  const navigate = (href: string) => {
    router.push(href);
  };

  return (
    <header
      className={`fixed left-0 right-0 z-50 transition-all duration-300 ${
        hidden ? '-translate-y-full' : 'translate-y-0'
      } ${scrolled ? 'bg-paper/95 backdrop-blur-md shadow-[0_1px_0_0_var(--color-line)]' : 'bg-paper'}`}
      style={{ top: 0 }}
      role="banner"
    >
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

          {/* Desktop Navigation with Mega Menus */}
          <nav className="hidden md:flex items-center gap-8 ml-8" role="navigation" aria-label="Main navigation">
            <MegaNav
              megaMenus={megaMenus}
              navigate={navigate}
              isMobile={false}
            />
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

function MegaNav({ megaMenus, navigate, isMobile }: { megaMenus: Record<string, MegaMenuItem[]>; navigate: (href: string) => void; isMobile: boolean }) {
  const [openGender, setOpenGender] = useState<string | null>(null);

  return (
    <div
      className="relative"
      onMouseLeave={() => setOpenGender(null)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpenGender(null);
      }}
    >
      <ul className="flex items-center gap-8 md:gap-0">
        {['women', 'men'].map((gender) => (
          <li
            key={gender}
            className="relative"
            onMouseEnter={() => setOpenGender(gender)}
          >
            <button
              type="button"
              aria-expanded={openGender === gender}
              aria-controls={`mega-menu-${gender}`}
              onFocus={() => setOpenGender(gender)}
              onClick={() => setOpenGender(gender)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${isMobile ? 'hidden' : ''} u-focus`}
              aria-label={gender === 'women' ? 'Women' : 'Men'}
            >
              {gender === 'women' ? 'Women' : 'Men'}
              <ChevronDown
                className={`w-3 h-3 ml-1 transition-transform ${openGender === gender ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {!isMobile && openGender === gender && (
              <DesktopMegaMenu
                gender={gender}
                menus={megaMenus[gender] ?? []}
                onClose={() => setOpenGender(null)}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DesktopMegaMenu({ gender, menus, onClose }: { gender: string; menus: MegaMenuItem[]; onClose: () => void }) {
  return (
    <div
      id={`mega-menu-${gender}`}
      role="region"
      aria-label={`${gender} shopping categories`}
      className="absolute left-1/2 top-full z-[60] w-[min(480px,calc(100vw-2rem))] -translate-x-1/2 pt-3"
    >
      <div className="grid max-h-[calc(100vh-5rem)] grid-cols-1 gap-8 overflow-y-auto rounded-sm border border-line bg-paper p-6 shadow-xl md:p-8">
        {menus.map((menu, mi) => (
          <section key={mi}>
            <h3 className="u-label mb-5 border-b border-line pb-3 text-xs uppercase tracking-wider text-accent">
              {menu.label}
            </h3>
            <div className="space-y-5">
              {menu.sublinks?.map((group, gi) => (
                <div key={gi}>
                  {group.href ? (
                    <Link
                      href={group.href}
                      onClick={onClose}
                      className="text-sm font-medium text-ink hover:text-accent"
                    >
                      {group.label}
                    </Link>
                  ) : (
                    <>
                      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink/50">
                        {group.label}
                      </h4>
                      <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {group.sublinks?.map((item, ii) => (
                          <li key={ii}>
                            {item.href ? (
                              <Link
                                href={item.href}
                                onClick={onClose}
                                className="text-sm text-ink/75 transition-colors hover:text-accent"
                              >
                                {item.label}
                              </Link>
                            ) : (
                              <span className="text-sm text-ink/75">{item.label}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              ))}
            </div>
            <Link
              href={`/products?gender=${menu.label.toLowerCase()}`}
              onClick={onClose}
              className="mt-6 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-ink hover:text-accent"
            >
              Shop all {menu.label.toLowerCase()}
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </section>
        ))}
      </div>
    </div>
  );
}

function MobileMegaMenu({ gender, menus, navigate }: { gender: string; menus: MegaMenuItem[]; navigate: (href: string) => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-ink/95 backdrop-blur-md left top w-full md:translate-x-full md:translate-x-0 transition-transform duration-300">
      <div className="flex flex-col h-full p-8 pt-16">
        <button
          onClick={() => useMobileNav.getState().closeNav()}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-paper/80 transition-colors"
          aria-label="Close menu"
        >
          <X className="w-6 h-6" aria-hidden="true" />
        </button>

        <h2 className="u-display text-2xl md:text-3xl font-light text-ink mb-8">
          {gender === 'women' ? 'Women' : 'Men'}
        </h2>

        {menus.map((menu, mi) => (
          <div key={mi} className="mb-10">
            <h3 className="u-label text-accent text-xs uppercase tracking-wider mb-4">{menu.label}</h3>
            <ul className="space-y-2">
              {menu.sublinks?.map((sublink, si) => (
                <li key={si}>
                  {sublink.href ? (
                    <Link
                      href={sublink.href}
                      className="block text-paper/60 hover:text-ink transition-colors text-sm py-1.5"
                      aria-label={sublink.label}
                    >
                      {sublink.label}
                    </Link>
                  ) : null}
                </li>
              ))}
              {!menu.sublinks && (
                <li>
                  <Link
                    href="/products?gender="
                      className="block text-paper/60 hover:text-ink transition-colors text-sm py-1.5"
                    >
                      Shop All
                    </Link>
                  </li>
                )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}