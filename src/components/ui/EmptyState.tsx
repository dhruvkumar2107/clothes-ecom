'use client';

import { cn } from '@/lib/utils';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState = ({ icon, title, description, action, className }: EmptyStateProps) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center py-12 px-4 animate-rise',
        className
      )}
    >
      {icon && (
        <div className="mb-4 text-muted-2" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3 className="u-display text-xl font-normal text-ink mb-2">{title}</h3>
      {description && (
        <p className="text-muted max-w-sm mb-6">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};

EmptyState.displayName = 'EmptyState';