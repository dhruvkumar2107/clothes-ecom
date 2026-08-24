'use client';

import { cn } from '@/lib/utils';
import Link from 'next/link';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  href?: string;
}

export interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  variant?: 'line' | 'pills';
}

export const Tabs = ({ tabs, value, onChange, className, variant = 'line' }: TabsProps) => {
  return (
    <div role="tablist" aria-label="Tabs" className={cn('flex gap-1', variant === 'pills' ? '' : 'border-b border-line', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={value === tab.id}
          aria-controls={`${tab.id}-panel`}
          id={`${tab.id}-trigger`}
          onClick={() => onChange(tab.id)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium transition-colors u-focus relative',
            variant === 'line'
              ? value === tab.id
                ? 'text-ink border-b-2 border-ink -mb-px'
                : 'text-muted hover:text-ink'
              : value === tab.id
              ? 'bg-ink text-paper rounded-md'
              : 'text-ink hover:bg-paper-2 rounded-md'
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn('ml-1.5 text-xs', variant === 'line' ? 'text-muted' : value === tab.id ? 'text-paper/70' : 'text-muted')}>
              ({tab.count})
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

export interface TabLinksProps {
  tabs: (TabItem & { href: string })[];
  active: string;
  className?: string;
}

export const TabLinks = ({ tabs, active, className }: TabLinksProps) => {
  return (
    <nav aria-label="Tabs" className={cn('flex gap-1 border-b border-line', className)}>
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={cn(
            'px-4 py-2.5 text-sm font-medium transition-colors u-focus relative',
            tab.id === active
              ? 'text-ink border-b-2 border-ink -mb-px'
              : 'text-muted hover:text-ink'
          )}
          aria-current={tab.id === active ? 'page' : undefined}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 text-xs text-muted">({tab.count})</span>
          )}
        </Link>
      ))}
    </nav>
  );
};

Tabs.displayName = 'Tabs';
TabLinks.displayName = 'TabLinks';