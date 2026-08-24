'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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

export const useToastStore = create<ToastState>()(
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

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const toasts = useToastStore((s) => s.toasts);

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