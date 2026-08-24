'use client';

import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  id?: string;
  children: ReactNode;
  className?: string;
}

export const Field = forwardRef<HTMLDivElement, FieldProps>(
  ({ label, hint, error, children, className, ...props }, ref) => {
    const id = props.id || `field-${Math.random().toString(36).slice(2, 9)}`;
    const errorId = error ? `${id}-error` : undefined;
    const hintId = hint ? `${id}-hint` : undefined;

    return (
      <div ref={ref} className={cn('space-y-1.5', className)} {...props}>
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-ink">
            {label}
            {props.required && <span className="text-danger ml-0.5" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="relative">
          {children}
        </div>
        {hint && !error && (
          <p id={hintId} className="text-xs text-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-xs text-danger flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </p>
        )}
      </div>
    );
  }
);

Field.displayName = 'Field';

interface FieldLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const FieldLabel = forwardRef<HTMLLabelElement, FieldLabelProps>(
  ({ required, children, className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('block text-sm font-medium text-ink', className)}
      {...props}
    >
      {children}
      {required && <span className="text-danger ml-0.5" aria-hidden="true">*</span>}
    </label>
  )
);

FieldLabel.displayName = 'FieldLabel';

export const FieldDescription = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cn('text-xs text-muted', className)}>{children}</p>
);

export const FieldError = ({ children, className }: { children: ReactNode; className?: string }) => (
  <p className={cn('text-xs text-danger flex items-center gap-1', className)}>
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
    {children}
  </p>
);