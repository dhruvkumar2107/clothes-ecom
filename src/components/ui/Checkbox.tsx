'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Field } from './Field';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, hint, error, className, id, ...props }, ref) => {
    const checkboxId = id || `checkbox-${Math.random().toString(36).slice(2, 9)}`;
    const hintId = hint ? `${checkboxId}-hint` : undefined;
    const errorId = error ? `${checkboxId}-error` : undefined;

    return (
      <Field label={label} hint={hint} error={error} htmlFor={checkboxId} required={props.required}>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            className={cn(
              'mt-0.5 h-4 w-4 rounded-sm border-line bg-paper text-accent',
              'hover:border-accent/50 focus:border-accent focus:ring-1 focus:ring-accent',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'u-focus',
              error && 'border-danger focus:border-danger focus:ring-danger',
              className
            )}
            aria-describedby={cn(hintId, errorId)}
            aria-invalid={!!error}
            {...props}
          />
          {label && <span className="text-sm text-ink leading-relaxed">{label}</span>}
        </label>
      </Field>
    );
  }
);

Checkbox.displayName = 'Checkbox';