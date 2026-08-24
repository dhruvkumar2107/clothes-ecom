'use client';

import { cn } from '@/lib/utils';

export interface ProgressProps {
  value: number;
  max?: number;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  label?: string;
  showValue?: boolean;
  className?: string;
}

const toneStyles = {
  default: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
};

export const Progress = ({ value, max = 100, tone = 'default', label, showValue = false, className }: ProgressProps) => {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="flex justify-between text-sm mb-1.5">
          {label && <span className="text-ink">{label}</span>}
          {showValue && <span className="text-muted">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div className="relative h-2 bg-paper-3 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-300 ease-lux', toneStyles[tone])}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={Math.round(percentage)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        />
      </div>
    </div>
  );
};

Progress.displayName = 'Progress';