'use client';

import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useSearchParams, usePathname } from 'next/navigation';

export interface PaginationProps {
  page: number;
  perPage: number;
  total: number;
  baseHref: string;
  className?: string;
  showFirstLast?: boolean;
  showPageSize?: boolean;
}

export const Pagination = ({ page, perPage, total, baseHref, className, showFirstLast = true, showPageSize = false }: PaginationProps) => {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return null;

  const createHref = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    return `${baseHref}?${params.toString()}`;
  };

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  const visiblePages = pages.filter((p) => {
    if (p === 1 || p === totalPages) return true;
    if (p >= page - 1 && p <= page + 1) return true;
    return false;
  });

  return (
    <nav aria-label="Pagination" className={cn('flex items-center justify-center gap-1', className)}>
      {showFirstLast && page > 1 && (
        <Link href={createHref(1)} className="px-3 py-1.5 text-sm border border-line rounded-md hover:bg-paper-2 transition-colors u-focus" aria-label="First page">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M11 19H6l7-7 7 7H13v4" />
            <path d="M18 19h5l-7-7-7 7h5v4" />
          </svg>
        </Link>
      )}

      <Link
        href={page > 1 ? createHref(page - 1) : '#'}
        className={cn(
          'px-3 py-1.5 text-sm border border-line rounded-md transition-colors u-focus',
          page > 1 ? 'hover:bg-paper-2' : 'opacity-50 pointer-events-none cursor-not-allowed'
        )}
        aria-label="Previous page"
        aria-disabled={page === 1}
        tabIndex={page === 1 ? -1 : undefined}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>

      {visiblePages.map((p, i) => {
        const prev = visiblePages[i - 1];
        const showEllipsis = prev && p - prev > 1;

        return (
          <React.Fragment key={p}>
            {showEllipsis && (
              <span className="px-2 text-sm text-muted-2" aria-hidden="true">…</span>
            )}
            {p === page ? (
              <span className="px-3 py-1.5 text-sm font-medium bg-ink text-paper rounded-md" aria-current="page">{p}</span>
            ) : (
              <Link href={createHref(p)} className="px-3 py-1.5 text-sm border border-line rounded-md hover:bg-paper-2 transition-colors u-focus">
                {p}
              </Link>
            )}
          </React.Fragment>
        );
      })}

      <Link
        href={page < totalPages ? createHref(page + 1) : '#'}
        className={cn(
          'px-3 py-1.5 text-sm border border-line rounded-md transition-colors u-focus',
          page < totalPages ? 'hover:bg-paper-2' : 'opacity-50 pointer-events-none cursor-not-allowed'
        )}
        aria-label="Next page"
        aria-disabled={page === totalPages}
        tabIndex={page === totalPages ? -1 : undefined}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>

      {showFirstLast && page < totalPages && (
        <Link href={createHref(totalPages)} className="px-3 py-1.5 text-sm border border-line rounded-md hover:bg-paper-2 transition-colors u-focus" aria-label="Last page">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M13 5h7l-7 7-7-7h7V1" />
            <path d="M6 5h5l7 7-7 7h5V1" />
          </svg>
        </Link>
      )}
    </nav>
  );
};

import React from 'react';
Pagination.displayName = 'Pagination';