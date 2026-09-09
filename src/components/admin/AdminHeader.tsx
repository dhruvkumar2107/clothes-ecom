'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Search, Bell, Plus, ChevronDown, LogOut, User, Settings, ExternalLink, Command } from 'lucide-react';

export function AdminHeader() {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ type: string; label: string; href: string }[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotificationsOpen(false);
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
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch {}
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const notifications = [
    { id: '1', text: '3 products low in stock', time: '5m ago', read: false },
    { id: '2', text: '2 new orders received', time: '12m ago', read: false },
    { id: '3', text: 'Review awaiting approval', time: '1h ago', read: true },
  ];

  const unreadCount = notifications.filter(n => !n.read).length;

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
              {searchQuery && searchResults.length === 0 && (
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

          {/* Notifications */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false); }}
              className="relative p-2 text-[#7A7468] hover:text-[#0A0A0A] hover:bg-[#F3F1ED] rounded-lg transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#9C7C4E] ring-2 ring-white" />
              )}
            </button>
            {notificationsOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-[#E8E5DE] rounded-xl shadow-lg shadow-black/5 overflow-hidden z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#F3F1ED]">
                  <span className="text-[12px] font-semibold text-[#0A0A0A]">Notifications</span>
                  <span className="text-[10px] text-[#9C7C4E] font-medium cursor-pointer hover:underline">Mark all read</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications.map((n) => (
                    <div key={n.id} className={`px-4 py-3 border-b border-[#F3F1ED] last:border-0 hover:bg-[#FAF9F7] transition-colors ${!n.read ? 'bg-[#FAF9F7]' : ''}`}>
                      <p className="text-[12px] text-[#0A0A0A]">{n.text}</p>
                      <p className="text-[10px] text-[#9E9789] mt-0.5">{n.time}</p>
                    </div>
                  ))}
                </div>
                <Link
                  href="/admin/notifications"
                  onClick={() => setNotificationsOpen(false)}
                  className="block text-center py-2.5 text-[11px] font-medium text-[#9C7C4E] hover:bg-[#FAF9F7] border-t border-[#F3F1ED] transition-colors"
                >
                  View All Notifications
                </Link>
              </div>
            )}
          </div>

          {/* Profile */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false); }}
              className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg hover:bg-[#F3F1ED] transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-[#9C7C4E]/10 flex items-center justify-center text-[#9C7C4E] text-[10px] font-bold font-mono">
                AD
              </div>
              <ChevronDown className="w-3 h-3 text-[#9E9789]" />
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-[#E8E5DE] rounded-xl shadow-lg shadow-black/5 overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-[#F3F1ED]">
                  <p className="text-[12px] font-medium text-[#0A0A0A]">Admin User</p>
                  <p className="text-[10px] text-[#9C7C4E]">Administrator</p>
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
                    onClick={() => { setProfileOpen(false); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-red-50 text-[12px] text-red-600 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
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
