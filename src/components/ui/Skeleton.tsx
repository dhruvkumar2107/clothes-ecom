'use client';

import { cn } from '@/lib/utils';

export interface SkeletonProps {
  className?: string;
  lines?: number;
}

export const Skeleton = ({ className, lines = 1 }: SkeletonProps) => {
  if (lines > 1) {
    return (
      <div className={cn('space-y-2', className)} aria-hidden="true">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'u-skeleton rounded-sm',
              i === lines - 1 ? 'w-3/4' : 'w-full',
              'h-4'
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('u-skeleton rounded-sm', className)} aria-hidden="true" />
  );
};

export const SkeletonCard = ({ className }: { className?: string }) => {
  return (
    <div className={cn('p-5 space-y-4', className)} aria-hidden="true">
      <div className="u-skeleton rounded-sm h-4 w-1/4" />
      <div className="u-skeleton rounded-sm h-4 w-1/2" />
      <div className="space-y-2">
        <div className="u-skeleton rounded-sm h-4 w-full" />
        <div className="u-skeleton rounded-sm h-4 w-3/4" />
        <div className="u-skeleton rounded-sm h-4 w-1/2" />
      </div>
    </div>
  );
};

Skeleton.displayName = 'Skeleton';
SkeletonCard.displayName = 'SkeletonCard';