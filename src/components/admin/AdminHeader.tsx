'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Search, Bell, Plus, ChevronDown, LogOut, Settings, ExternalLink, Command } from 'lucide-react';

export function AdminHeader() {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ type: string; label: string; href: string }[]>([]);
  const [searchError, setSearchError] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [staff, setStaff] = useState<{ name: string; email: string; roleName: string } | null>(null);
  const [profileError, setProfileError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setProfileOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadStaff() {
      try {
        const response = await fetch('/api/auth/staff-me', { cache: 'no-store' });
        const body = await response.json();
        if (cancelled) return;
        if (response.status === 401) {
          router.replace('/admin/login');
          return;
        }
        if (!response.ok || !body.ok) {
          throw new Error(body.error?.message ?? 'Unable to load staff profile.');
        }
        setStaff(body.data.staff);
      } catch (error) {
        if (!cancelled) {
          console.error('Admin profile request failed:', error);
          setProfileError(error instanceof Error ? error.message : 'Unable to load staff profile.');
        }
      }
    }

    void loadStaff();
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchError('');
      return;
    }

    let cancelled = false;
    setSearchError('');
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(searchQuery.trim())}`);
        const body = await res.json();
        if (!res.ok || !body.ok) {
          throw new Error(body.error?.message ?? 'Search is unavailable.');
        }
        if (!cancelled) setSearchResults(body.data?.results ?? []);
      } catch (error) {
        if (!cancelled) {
          setSearchResults([]);
          setSearchError(error instanceof Error ? error.message : 'Search is unavailable.');
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [searchQuery]);

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError('');
    try {
      const response = await fetch('/api/auth/staff-logout', { method: 'POST' });
      const body = await response.json();
      if (!response.ok || !body.ok) {
        throw new Error(body.error?.message ?? 'Unable to sign out.');
      }
      router.replace('/admin/login');
      router.refresh();
    } catch (error) {
      console.error('Admin sign out failed:', error);
      setSignOutError(error instanceof Error ? error.message : 'Unable to sign out. Please try again.');
      setSigningOut(false);
    }
  }

  return (
    <>
      <header className="h-14 border-b border-[#E8E5DE] bg-white/80 backdrop-blur-md sticky top-0 z-30 px-6 flex items-center justify-between">
        {/* Left: Search */}
        <div ref={searchRef} className="relative flex-1 max-w-lg">
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-1.5 bg-[#FAF9F7] border border-[#E8E5DE] rounded-lg text-[12px] text-[#9E9789] hover:border-[#D4D0C8] transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Search products, orders, customers...</span>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-white border border-[#E8E5DE] rounded text-[10px] font-mono text-[#9E9789]">
              <Command className="w-2.5 h-2.5" />K
            </kbd>
          </button>

          {searchOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#E8E5DE] rounded-xl shadow-lg shadow-black/5 overflow-hidden z-50">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[#F3F1ED]">
                <Search className="w-4 h-4 text-[#9E9789]" />
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search everything..."
                  className="flex-1 bg-transparent text-[13px] text-[#0A0A0A] placeholder-[#9E9789] focus:outline-none"
                />
                <kbd className="px-1.5 py-0.5 bg-[#F3F1ED] border border-[#E8E5DE] rounded text-[10px] font-mono text-[#9E9789]">ESC</kbd>
              </div>
              {searchResults.length > 0 && (
                <div className="max-h-72 overflow-y-auto p-2">
                  {searchResults.map((r, i) => (
                    <Link
                      key={i}
                      href={r.href}
                      onClick={() => { setSearchOpen(false); setSearchQuery(''); }}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#FAF9F7] transition-colors"
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9C7C4E] w-16 shrink-0">{r.type}</span>
                      <span className="text-[12px] text-[#0A0A0A] truncate">{r.label}</span>
                    </Link>
                  ))}
                </div>
              )}
              {searchError && (
                <div className="p-4 text-center text-[12px] text-red-600" role="alert">{searchError}</div>
              )}
              {searchQuery && !searchError && searchResults.length === 0 && (
                <div className="p-6 text-center text-[12px] text-[#9E9789]">No results found</div>
              )}
              {!searchQuery && (
                <div className="p-4 space-y-1">
                  <p className="text-[10px] font-medium text-[#9E9789] uppercase tracking-wider mb-2">Quick Links</p>
                  {[
                    { label: 'New Product', href: '/admin/products/new' },
                    { label: 'All Orders', href: '/admin/orders' },
                    { label: 'Inventory', href: '/admin/inventory' },
                    { label: 'Reviews', href: '/admin/reviews' },
                  ].map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setSearchOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#FAF9F7] text-[12px] text-[#0A0A0A] transition-colors"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 ml-4">
          <Link
            href="/admin/products/new"
            className="hidden sm:flex items-center gap-1.5 bg-[#0A0A0A] hover:bg-[#1A1A1A] text-white px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
          >
            <Plus className="w-3 h-3" />
            New Product
          </Link>

          <Link
            href="/admin/notifications"
            aria-label="View admin notifications"
            className="p-2 text-[#7A7468] hover:text-[#0A0A0A] hover:bg-[#F3F1ED] rounded-lg transition-colors"
          >
            <Bell className="w-4 h-4" />
          </Link>

          {/* Profile */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              aria-label="Open staff profile menu"
              aria-expanded={profileOpen}
              className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg hover:bg-[#F3F1ED] transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-[#9C7C4E]/10 flex items-center justify-center text-[#9C7C4E] text-[10px] font-bold font-mono">
                {(staff?.name || staff?.email || 'Admin').slice(0, 2).toUpperCase()}
              </div>
              <ChevronDown className="w-3 h-3 text-[#9E9789]" />
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-[#E8E5DE] rounded-xl shadow-lg shadow-black/5 overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-[#F3F1ED]">
                  <p className="text-[12px] font-medium text-[#0A0A0A]">{staff?.name || staff?.email || 'Staff account'}</p>
                  {staff?.name && <p className="text-[10px] text-[#7A7468]">{staff.email}</p>}
                  <p className="text-[10px] text-[#9C7C4E]">{staff?.roleName || 'Staff'}</p>
                  {profileError && <p role="alert" className="mt-1 text-[10px] text-red-600">{profileError}</p>}
                  {signOutError && <p role="alert" className="mt-1 text-[10px] text-red-600">{signOutError}</p>}
                </div>
                <div className="p-1.5">
                  {[
                    { label: 'Settings', href: '/admin/settings', icon: Settings },
                    { label: 'View Store', href: '/', icon: ExternalLink },
                  ].map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#FAF9F7] text-[12px] text-[#0A0A0A] transition-colors"
                    >
                      <item.icon className="w-3.5 h-3.5 text-[#9E9789]" />
                      {item.label}
                    </Link>
                  ))}
                </div>
                <div className="p-1.5 border-t border-[#F3F1ED]">
                  <button
                    onClick={() => { setProfileOpen(false); void handleSignOut(); }}
                    disabled={signingOut}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-red-50 text-[12px] text-red-600 transition-colors disabled:opacity-60"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    {signingOut ? 'Signing out…' : 'Sign Out'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
