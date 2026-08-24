'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Field } from './Field';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, icon, suffix, className, id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    return (
      <Field label={label} hint={hint} error={error} htmlFor={inputId} required={props.required}>
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-2" aria-hidden="true">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-md border border-line bg-paper text-ink placeholder:text-muted-2',
              'px-3 py-2.5 transition-colors duration-150',
              'hover:border-line-2 focus:border-accent focus:ring-1 focus:ring-accent',
              'disabled:bg-paper-3 disabled:cursor-not-allowed',
              'u-focus',
              icon && 'pl-10',
              suffix && 'pr-10',
              error && 'border-danger focus:border-danger focus:ring-danger',
              className
            )}
            aria-describedby={cn(hintId, errorId)}
            aria-invalid={!!error}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-2 flex items-center">
              {suffix}
            </span>
          )}
        </div>
      </Field>
    );
  }
);

Input.displayName = 'Input';