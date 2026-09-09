'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, Package, ShoppingBag, Layers, Users,
  Settings, Sparkles, ArrowLeft, Gift, TicketPercent, Shield,
  ChevronDown, BarChart3, Palette, Clock, Star, Menu, X,
  Inbox, Tag, Image, FileText, Bell, Boxes, Store,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  children?: { name: string; href: string; icon: React.ElementType }[];
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  {
    name: 'Products', href: '/admin/products', icon: Package,
    children: [
      { name: 'All Products', href: '/admin/products', icon: Package },
      { name: 'Add Product', href: '/admin/products/new', icon: Sparkles },
      { name: 'Categories', href: '/admin/categories', icon: Tag },
      { name: 'Collections', href: '/admin/collections', icon: Layers },
    ],
  },
  {
    name: 'Orders', href: '/admin/orders', icon: ShoppingBag,
    children: [
      { name: 'All Orders', href: '/admin/orders', icon: ShoppingBag },
      { name: 'Returns', href: '/admin/orders?status=returned', icon: Clock },
    ],
  },
  { name: 'Customers', href: '/admin/users', icon: Users },
  { name: 'Inventory', href: '/admin/inventory', icon: Boxes },
  { name: 'Reviews', href: '/admin/reviews', icon: Star },
  {
    name: 'Marketing', href: '/admin/coupons', icon: TicketPercent,
    children: [
      { name: 'Coupons', href: '/admin/coupons', icon: TicketPercent },
      { name: 'Referrals', href: '/admin/referrals', icon: Gift },
    ],
  },
  { name: 'Content', href: '/admin/content', icon: Image },
  {
    name: 'Analytics', href: '/admin/analytics/trends', icon: BarChart3,
    children: [
      { name: 'Trends', href: '/admin/analytics/trends', icon: BarChart3 },
      { name: 'Returns', href: '/admin/analytics/returns', icon: BarChart3 },
      { name: 'Size & Fit', href: '/admin/analytics/size-fit', icon: Palette },
      { name: 'Style Quiz', href: '/admin/analytics/quiz', icon: Star },
    ],
  },
  { name: 'Payouts', href: '/admin/payouts', icon: Gift },
  { name: 'Notifications', href: '/admin/notifications', icon: Bell },
  { name: 'Audit Log', href: '/admin/audit', icon: Shield },
  { name: 'Settings', href: '/admin/settings', icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState<string | null>(() => {
    for (const item of navigation) {
      if (item.children?.some(c => pathname === c.href || pathname.startsWith(c.href))) {
        return item.name;
      }
    }
    return null;
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => pathname === href || (href !== '/admin/dashboard' && pathname.startsWith(href));

  const toggleExpand = (name: string) => {
    setExpanded(expanded === name ? null : name);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 py-4 border-b border-[#E8E5DE]">
        <Link href="/admin/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-[#0A0A0A] flex items-center justify-center">
            <Store className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-[13px] tracking-[0.15em] uppercase text-[#0A0A0A] font-semibold block leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>LUMEN</span>
            <span className="text-[9px] uppercase tracking-[0.2em] text-[#9C7C4E] font-medium">Admin</span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
        {navigation.map((item) => {
          const active = isActive(item.href);
          const hasChildren = item.children && item.children.length > 0;
          const isExpanded = expanded === item.name;
          const Icon = item.icon;

          if (hasChildren) {
            return (
              <div key={item.name}>
                <button
                  onClick={() => toggleExpand(item.name)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all group ${
                    active
                      ? 'bg-[#9C7C4E]/8 text-[#0A0A0A]'
                      : 'text-[#7A7468] hover:text-[#0A0A0A] hover:bg-[#F3F1ED]'
                  }`}
                >
                  <Icon className={`w-[16px] h-[16px] ${active ? 'text-[#9C7C4E]' : 'text-[#9E9789] group-hover:text-[#7A7468]'}`} />
                  <span className="flex-1 text-left">{item.name}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                {isExpanded && (
                  <div className="ml-3 mt-0.5 space-y-0.5 border-l border-[#E8E5DE] pl-3">
                    {item.children!.map((child) => {
                      const childActive = pathname === child.href;
                      const ChildIcon = child.icon;
                      return (
                        <Link
                          key={child.name}
                          href={child.href}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                            childActive
                              ? 'bg-[#9C7C4E]/8 text-[#0A0A0A]'
                              : 'text-[#9E9789] hover:text-[#0A0A0A] hover:bg-[#F3F1ED]'
                          }`}
                        >
                          <ChildIcon className={`w-3 h-3 ${childActive ? 'text-[#9C7C4E]' : ''}`} />
                          {child.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all group ${
                active
                  ? 'bg-[#9C7C4E]/8 text-[#0A0A0A]'
                  : 'text-[#7A7468] hover:text-[#0A0A0A] hover:bg-[#F3F1ED]'
              }`}
            >
              <Icon className={`w-[16px] h-[16px] ${active ? 'text-[#9C7C4E]' : 'text-[#9E9789] group-hover:text-[#7A7468]'}`} />
              {item.name}
              {item.badge && (
                <span className="ml-auto text-[9px] font-semibold bg-[#9C7C4E] text-white px-1.5 py-0.5 rounded-full">{item.badge}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2.5 border-t border-[#E8E5DE]">
        <Link
          href="/"
          className="flex items-center justify-between px-3 py-2 rounded-lg text-[11px] font-medium text-[#9E9789] hover:text-[#0A0A0A] hover:bg-[#F3F1ED] transition-all"
        >
          <span className="flex items-center gap-2">
            <ArrowLeft className="w-3 h-3" />
            View Store
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#3D6B4D] animate-pulse" />
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 bg-white rounded-lg shadow-sm border border-[#E8E5DE]"
      >
        {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/20 z-40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        w-[220px] bg-white border-r border-[#E8E5DE] flex flex-col h-screen sticky top-0 z-40
        max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-50 max-lg:transition-transform max-lg:duration-300
        ${mobileOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'}
      `}>
        {sidebarContent}
      </aside>
    </>
  );
}
