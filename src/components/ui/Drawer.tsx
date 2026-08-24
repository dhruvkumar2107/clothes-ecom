'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  side?: 'right' | 'left' | 'bottom';
  size?: 'sm' | 'md' | 'lg' | 'full';
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

const sideStyles = {
  right: 'right-0',
  left: 'left-0',
  bottom: 'bottom-0 left-0 right-0',
};

const sizeStyles = {
  sm: 'w-[320px] max-w-full',
  md: 'w-[400px] max-w-full',
  lg: 'w-[560px] max-w-full',
  full: 'w-full max-w-full',
};

const bottomSizeStyles = {
  sm: 'h-[320px] max-h-[80vh]',
  md: 'h-[480px] max-h-[80vh]',
  lg: 'h-[600px] max-h-[80vh]',
  full: 'h-[90vh] max-h-[90vh]',
};

export const Drawer = ({
  open,
  onClose,
  title,
  description,
  side = 'right',
  size = 'md',
  children,
  footer,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}: DrawerProps) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const isBottom = side === 'bottom';

  useEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      drawerRef.current?.focus();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && closeOnEscape) onClose();
        if (e.key === 'Tab') trapFocus(e);
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
        previousActiveElement.current?.focus();
      };
    }
  }, [open, closeOnEscape, onClose]);

  const trapFocus = (e: KeyboardEvent) => {
    const focusableElements = drawerRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusableElements?.length) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex animate-fade-in" role="dialog" aria-modal="true" aria-labelledby={title ? 'drawer-title' : undefined}>
      <div
        className="absolute inset-0 bg-ink/50 backdrop-blur-sm animate-fade-in"
        onClick={closeOnOverlayClick ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={drawerRef}
        tabIndex={-1}
        className={cn(
          'relative flex flex-col bg-paper shadow-xl animate-in-right',
          sideStyles[side],
          isBottom ? bottomSizeStyles[size] : sizeStyles[size],
          isBottom ? 'flex-col-reverse' : 'flex-col'
        )}
      >
        {(title || footer) && (
          <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-line flex-shrink-0">
            <div>
              {title && <h2 id="drawer-title" className="u-display text-lg font-normal text-ink">{title}</h2>}
              {description && <p className="text-sm text-muted mt-1">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1 text-muted hover:text-ink transition-colors rounded-sm hover:bg-paper-2 u-focus"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="px-5 py-4 border-t border-line flex items-center justify-end gap-3 bg-paper-2 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

Drawer.displayName = 'Drawer';