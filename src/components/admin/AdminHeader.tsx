'use client';

import Link from 'next/link';
import { Search, Bell, ShieldCheck, Plus } from 'lucide-react';

export function AdminHeader() {
  return (
    <header className="h-16 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30 px-8 flex items-center justify-between">
      {/* Search Input */}
      <div className="relative w-96">
        <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search products, orders, customers..."
          className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-900/90 border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all"
        />
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Quick Add Product Button */}
        <Link
          href="/admin/products/new"
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-md shadow-amber-500/10 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          New Product
        </Link>

        {/* Notifications */}
        <button
          type="button"
          className="relative p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-lg transition-colors border border-transparent hover:border-zinc-800"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400" />
        </button>

        {/* Admin Badge */}
        <div className="flex items-center gap-3 pl-3 border-l border-zinc-800">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 text-xs font-bold font-mono">
            AD
          </div>
          <div className="text-left hidden md:block">
            <span className="text-xs font-medium text-zinc-200 block">Admin User</span>
            <span className="text-[10px] text-amber-400/90 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Full System Access
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
