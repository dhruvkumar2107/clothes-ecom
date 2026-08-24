'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Field } from './Field';

export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, hint, error, className, id, ...props }, ref) => {
    const switchId = id || `switch-${Math.random().toString(36).slice(2, 9)}`;
    const hintId = hint ? `${switchId}-hint` : undefined;
    const errorId = error ? `${switchId}-error` : undefined;

    return (
      <Field label={label} hint={hint} error={error} htmlFor={switchId} required={props.required}>
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            role="switch"
            aria-checked={props.checked}
            aria-describedby={cn(hintId, errorId)}
            aria-invalid={!!error}
            onClick={() => {
              if (props.onChange) props.onChange({ target: { checked: !props.checked } } as React.ChangeEvent<HTMLInputElement>);
            }}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full border-2 transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-paper',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              props.checked ? 'bg-accent border-accent' : 'bg-paper-3 border-line',
              className
            )}
            disabled={props.disabled}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-paper shadow',
                'transition-transform duration-200 ease-lux',
                props.checked ? 'translate-x-5' : 'translate-x-0'
              )}
              aria-hidden="true"
            />
          </button>
          {label && <span className="text-sm text-ink leading-relaxed">{label}</span>}
        </label>
        <input
          ref={ref}
          type="checkbox"
          id={switchId}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          checked={props.checked}
          onChange={props.onChange}
          disabled={props.disabled}
          {...props}
        />
      </Field>
    );
  }
);

Switch.displayName = 'Switch';