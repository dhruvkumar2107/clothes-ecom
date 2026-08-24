'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Field } from './Field';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, className, id, ...props }, ref) => {
    const textareaId = id || `textarea-${Math.random().toString(36).slice(2, 9)}`;
    const hintId = hint ? `${textareaId}-hint` : undefined;
    const errorId = error ? `${textareaId}-error` : undefined;

    return (
      <Field label={label} hint={hint} error={error} htmlFor={textareaId} required={props.required}>
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'w-full rounded-md border border-line bg-paper text-ink placeholder:text-muted-2',
            'px-3 py-2.5 transition-colors duration-150 resize-y min-h-[100px]',
            'hover:border-line-2 focus:border-accent focus:ring-1 focus:ring-accent',
            'disabled:bg-paper-3 disabled:cursor-not-allowed',
            'u-focus',
            error && 'border-danger focus:border-danger focus:ring-danger',
            className
          )}
          aria-describedby={cn(hintId, errorId)}
          aria-invalid={!!error}
          {...props}
        />
      </Field>
    );
  }
);

Textarea.displayName = 'Textarea';