'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/* ────────────────────────────────────────────────────────────────────────── */
/* Toast — backed by a zustand store so it works anywhere (layout, RSC holes) */

export interface Toast {
  id: string;
  message: string;
  title?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  add: (toast: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
}

const useToastStore = create<ToastState>()(
  persist(
    (set) => ({
      toasts: [],
      add: (t) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
        return id;
      },
      dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    { name: 'lmn-toasts', storage: createJSONStorage(() => sessionStorage) }
  )
);

export function useToast() {
  const { add, dismiss } = useToastStore();
  return {
    toast: (t: Omit<Toast, 'id'>) => add(t),
    dismiss,
  };
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [mounted, setMounted] = useState(false);
  const toasts = useToastStore((s) => s.toasts);

  if (!mounted) {
    setMounted(true);
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none" aria-live="polite">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={useToastStore.getState().dismiss} />
        ))}
      </div>
    </>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const tone = toast.tone ?? 'default';
  const bg = {
    default: 'bg-ink',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    info: 'bg-info',
  }[tone];

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-md ${bg} text-paper shadow-lg min-w-[280px] max-w-md animate-in-right u-focus`}
      role="alert"
      style={{ animationDuration: `${(toast.duration ?? 4000) / 1000}s` }}
    >
      <div className="flex-1 min-w-0">
        {toast.title && <p className="font-medium text-sm">{toast.title}</p>}
        <p className="text-sm leading-relaxed">{toast.message}</p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-paper/70 hover:text-paper transition-colors p-0.5"
        aria-label="Dismiss"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Cart store — minimal state for the drawer badge and open/close */

interface CartState {
  count: number;
  drawerOpen: boolean;
  refresh: () => Promise<void>;
  openDrawer: () => void;
  closeDrawer: () => void;
  setCount: (n: number) => void;
}

export const useCartStore = create<CartState>((set) => ({
  count: 0,
  drawerOpen: false,
  refresh: async () => {
    try {
      const res = await fetch('/api/cart', { credentials: 'include' });
      if (res.ok) {
        const { data } = await res.json();
        set({ count: data?.itemCount ?? 0 });
      }
    } catch {
      /* ignore — badge is decorative */
    }
  },
  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
  setCount: (n) => set({ count: n }),
}));

/* ────────────────────────────────────────────────────────────────────────── */
/* Search overlay state */

interface SearchOverlayState {
  open: boolean;
  openOverlay: () => void;
  closeOverlay: () => void;
  toggleOverlay: () => void;
}

export const useSearchOverlay = create<SearchOverlayState>((set) => ({
  open: false,
  openOverlay: () => set({ open: true }),
  closeOverlay: () => set({ open: false }),
  toggleOverlay: () => set((s) => ({ open: !s.open })),
}));

/* ────────────────────────────────────────────────────────────────────────── */
/* Mobile nav drawer state */

interface MobileNavState {
  open: boolean;
  openNav: () => void;
  closeNav: () => void;
}

export const useMobileNav = create<MobileNavState>((set) => ({
  open: false,
  openNav: () => set({ open: true }),
  closeNav: () => set({ open: false }),
}));

/* ────────────────────────────────────────────────────────────────────────── */
/* Country/locale context — client mirror of server locale for components that
   need to render locale-aware UI (Price, date formatting, etc.) */

interface LocaleContextValue {
  locale: string;
  currency: string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children, locale, currency }: { children: ReactNode; locale: string; currency: string }) {
  return (
    <LocaleContext.Provider value={{ locale, currency }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) return { locale: 'en', currency: 'INR' };
  return ctx;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Providers barrel — mount once in root layout */

export function Providers({ children, locale, currency }: { children: ReactNode; locale: string; currency: string }) {
  return (
    <LocaleProvider locale={locale} currency={currency}>
      <ToastProvider>{children}</ToastProvider>
    </LocaleProvider>
  );
}