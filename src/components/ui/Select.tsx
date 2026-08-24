'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Field } from './Field';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options?: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, options, placeholder, className, id, children, ...props }, ref) => {
    const selectId = id || `select-${Math.random().toString(36).slice(2, 9)}`;
    const hintId = hint ? `${selectId}-hint` : undefined;
    const errorId = error ? `${selectId}-error` : undefined;

    return (
      <Field label={label} hint={hint} error={error} htmlFor={selectId} required={props.required}>
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'w-full rounded-md border border-line bg-paper text-ink',
            'px-3 py-2.5 transition-colors duration-150 appearance-none',
            'hover:border-line-2 focus:border-accent focus:ring-1 focus:ring-accent',
            'disabled:bg-paper-3 disabled:cursor-not-allowed',
            'u-focus',
            error && 'border-danger focus:border-danger focus:ring-danger',
            className
          )}
          aria-describedby={cn(hintId, errorId)}
          aria-invalid={!!error}
          {...props}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
          {children}
        </select>
      </Field>
    );
  }
);

Select.displayName = 'Select';