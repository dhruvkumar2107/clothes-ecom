'use client';

import { cn } from '@/lib/utils';
import Link from 'next/link';

export interface BreadcrumbsProps {
  items: { label: string; href?: string }[];
  className?: string;
}

export const Breadcrumbs = ({ items, className }: BreadcrumbsProps) => {
  return (
    <nav aria-label="Breadcrumb" className={cn(className)}>
      <ol className="flex items-center gap-1.5 text-sm u-label">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-1.5">
            {index > 0 && (
              <svg className="w-4 h-4 text-muted-2 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M9 18l6-6-6-6" />
              </svg>
            )}
            {item.href ? (
              <Link href={item.href} className="text-muted hover:text-ink transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className="text-ink" aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

Breadcrumbs.displayName = 'Breadcrumbs';