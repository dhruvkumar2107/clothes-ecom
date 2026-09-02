'use client';

import { forwardRef, useState, useCallback, createContext, useContext, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccordionContextValue {
  openItems: Set<string>;
  toggle: (value: string) => void;
  type: 'single' | 'multiple';
  collapsible: boolean;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

function useAccordion() {
  const ctx = useContext(AccordionContext);
  if (!ctx) throw new Error('Accordion components must be used within <Accordion>');
  return ctx;
}

interface AccordionItemContextValue {
  value: string;
}

const AccordionItemContext = createContext<AccordionItemContextValue | null>(null);

function useAccordionItem() {
  const ctx = useContext(AccordionItemContext);
  if (!ctx) throw new Error('AccordionTrigger/AccordionContent must be used within <AccordionItem>');
  return ctx;
}

interface AccordionProps {
  children: ReactNode;
  type?: 'single' | 'multiple';
  collapsible?: boolean;
  className?: string;
}

export const Accordion = forwardRef<HTMLDivElement, AccordionProps>(
  ({ children, type = 'single', collapsible = true, className, ...props }, ref) => {
    const [openItems, setOpenItems] = useState<Set<string>>(new Set());

    const toggle = useCallback((value: string) => {
      setOpenItems((prev) => {
        const next = new Set(prev);
        if (next.has(value)) {
          if (collapsible) {
            next.delete(value);
          }
        } else {
          if (type === 'single') {
            next.clear();
          }
          next.add(value);
        }
        return next;
      });
    }, [type, collapsible]);

    return (
      <AccordionContext.Provider value={{ openItems, toggle, type, collapsible }}>
        <div ref={ref} className={cn('space-y-2', className)} {...props}>
          {children}
        </div>
      </AccordionContext.Provider>
    );
  }
);

Accordion.displayName = 'Accordion';

interface AccordionItemProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export const AccordionItem = forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ value, children, className, ...props }, ref) => {
    const { openItems } = useAccordion();
    const isOpen = openItems.has(value);
    return (
      <AccordionItemContext.Provider value={{ value }}>
        <div
          ref={ref}
          data-state={isOpen ? 'open' : 'closed'}
          className={cn('border border-line rounded-lg overflow-hidden', className)}
          {...props}
        >
          {children}
        </div>
      </AccordionItemContext.Provider>
    );
  }
);

AccordionItem.displayName = 'AccordionItem';

interface AccordionTriggerProps {
  children: ReactNode;
  className?: string;
}

export const AccordionTrigger = forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  ({ children, className, ...props }, ref) => {
    const { openItems, toggle } = useAccordion();
    const { value } = useAccordionItem();
    const isOpen = openItems.has(value);

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => toggle(value)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-4 text-left font-medium text-ink hover:bg-ink-2 transition-colors',
          className
        )}
        aria-expanded={isOpen}
        {...props}
      >
        {children}
        <ChevronDown className={cn('w-5 h-5 text-muted transition-transform', isOpen && 'rotate-180')} aria-hidden="true" />
      </button>
    );
  }
);

AccordionTrigger.displayName = 'AccordionTrigger';

interface AccordionContentProps {
  children: ReactNode;
  className?: string;
}

export const AccordionContent = forwardRef<HTMLDivElement, AccordionContentProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('px-4 pb-4 text-muted', className)}
        role="region"
        {...props}
      >
        {children}
      </div>
    );
  }
);

AccordionContent.displayName = 'AccordionContent';

export type { AccordionProps, AccordionItemProps, AccordionTriggerProps, AccordionContentProps };
