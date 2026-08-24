'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { Field } from './Field';

export interface MoneyInputProps {
  label?: string;
  hint?: string;
  error?: string;
  value: number; // paise
  onChange: (paise: number) => void;
  disabled?: boolean;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ label, hint, error, value, onChange, disabled, required, min, max, step = 100, className }, ref) => {
    const inputId = `money-${Math.random().toString(36).slice(2, 9)}`;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    const rupees = (value / 100).toFixed(2);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value.replace(/[^\d.]/g, '');
      const parts = inputValue.split('.');
      let paise: number;
      if (parts.length === 1) {
        paise = parseInt(parts[0] || '0', 10) * 100;
      } else {
        const rupeePart = parseInt(parts[0] || '0', 10) * 100;
        const paisePart = parseInt((parts[1] + '00').slice(0, 2), 10);
        paise = rupeePart + paisePart;
      }
      if (!Number.isNaN(paise)) {
        if (min !== undefined && paise < min) paise = min;
        if (max !== undefined && paise > max) paise = max;
        onChange(paise);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const inputValue = e.target.value.replace(/[^\d.]/g, '');
      const num = parseFloat(inputValue || '0');
      let paise = Math.round(num * 100);
      if (min !== undefined && paise < min) paise = min;
      if (max !== undefined && paise > max) paise = max;
      onChange(paise);
    };

    return (
      <Field label={label} hint={hint} error={error} htmlFor={inputId} required={required}>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true">₹</span>
          <input
            ref={ref}
            type="text"
            id={inputId}
            value={rupees}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={disabled}
            required={required}
            min={min !== undefined ? (min / 100).toFixed(2) : undefined}
            max={max !== undefined ? (max / 100).toFixed(2) : undefined}
            step={(step / 100).toFixed(2)}
            className={cn(
              'w-full rounded-md border border-line bg-paper text-ink placeholder:text-muted-2',
              'pl-7 pr-3 py-2.5 transition-colors duration-150',
              'hover:border-line-2 focus:border-accent focus:ring-1 focus:ring-accent',
              'disabled:bg-paper-3 disabled:cursor-not-allowed',
              'u-focus',
              error && 'border-danger focus:border-danger focus:ring-danger',
              className
            )}
            aria-describedby={cn(hintId, errorId)}
            aria-invalid={!!error}
            inputMode="decimal"
            pattern="[0-9]*\.?[0-9]{0,2}"
          />
        </div>
      </Field>
    );
  }
);

MoneyInput.displayName = 'MoneyInput';