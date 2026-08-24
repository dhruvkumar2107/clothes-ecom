'use client';

import { cn } from '@/lib/utils';

export interface QtyStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeStyles = {
  sm: 'h-8 text-xs',
  md: 'h-10 text-sm',
  lg: 'h-12 text-base',
};

const btnStyles = {
  sm: 'p-1.5',
  md: 'p-2',
  lg: 'p-2.5',
};

export const QtyStepper = ({ value, onChange, min = 1, max = 99, disabled, size = 'md', className }: QtyStepperProps) => {
  const handleDecrement = () => {
    if (value > min) onChange(value - 1);
  };

  const handleIncrement = () => {
    if (value < max) onChange(value + 1);
  };

  return (
    <div
      className={cn(
        'inline-flex items-center border border-line rounded-md overflow-hidden',
        'bg-paper',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      role="group"
      aria-label="Quantity"
    >
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        className={cn(
          'flex items-center justify-center text-ink hover:bg-paper-2 active:bg-paper-3 transition-colors',
          'disabled:opacity-30 disabled:cursor-not-allowed',
          btnStyles[size]
        )}
        aria-label="Decrease quantity"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <input
        type="text"
        value={value}
        readOnly
        className={cn(
          'w-12 text-center border-x border-line bg-transparent',
          'focus:outline-none focus:ring-0',
          sizeStyles[size]
        )}
        aria-label="Quantity"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
      />

      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || value >= max}
        className={cn(
          'flex items-center justify-center text-ink hover:bg-paper-2 active:bg-paper-3 transition-colors',
          'disabled:opacity-30 disabled:cursor-not-allowed',
          btnStyles[size]
        )}
        aria-label="Increase quantity"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
};

QtyStepper.displayName = 'QtyStepper';