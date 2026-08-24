'use client';

import { formatMoney, INR, type CurrencyInfo } from '@/lib/money';
import { Badge } from './Badge';
import { cn } from '@/lib/utils';

export interface PriceProps {
  amount: number; // paise
  compareAt?: number | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSavings?: boolean;
  className?: string;
  currency?: CurrencyInfo;
}

const sizeStyles = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

export const Price = ({ amount, compareAt, size = 'md', showSavings = false, className, currency = INR }: PriceProps) => {
  const formatted = formatMoney(amount, { currency });
  const compareFormatted = compareAt ? formatMoney(compareAt, { currency }) : null;
  const hasDiscount = compareAt && compareAt > amount;

  return (
    <div className={cn('flex items-baseline gap-2 flex-wrap', className)}>
      <span className={cn('font-medium text-ink', sizeStyles[size])}>{formatted}</span>
      {compareFormatted && (
        <span className={cn('text-muted line-through', sizeStyles[size])}>
          {compareFormatted}
        </span>
      )}
      {hasDiscount && showSavings && (
        <Badge tone="success" size="sm">
          Save {formatMoney(compareAt! - amount, { currency })}
        </Badge>
      )}
    </div>
  );
};

Price.displayName = 'Price';