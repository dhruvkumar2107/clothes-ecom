'use client';

import { forwardRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccordionProps {
  children: ReactNode;
  type?: 'single' | 'multiple';
  collapsible?: boolean;
  className?: string;
}

export const Accordion = forwardRef<HTMLDivElement, AccordionProps>(
  ({ children, type = 'single', collapsible = true, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('space-y-2', className)} {...props}>
        {children}
      </div>
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
    return (
      <div ref={ref} className={cn('border border-line rounded-lg overflow-hidden', className)} {...props}>
        {children}
      </div>
    );
  }
);

AccordionItem.displayName = 'AccordionItem';

interface AccordionTriggerProps {
  children: ReactNode;
  className?: string;
  asChild?: boolean;
}

export const AccordionTrigger = forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  ({ children, className, asChild, ...props }, ref) => {
    const [open, setOpen] = useState(false);

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-4 text-left font-medium text-ink hover:bg-ink-2 transition-colors',
          className
        )}
        aria-expanded={open}
        {...props}
      >
        {children}
        <ChevronDown className={cn('w-5 h-5 text-muted transition-transform', open && 'rotate-180')} aria-hidden="true" />
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
        {...props}
      >
        {children}
      </div>
    );
  }
);

AccordionContent.displayName = 'AccordionContent';

export type { AccordionProps, AccordionItemProps, AccordionTriggerProps, AccordionContentProps };