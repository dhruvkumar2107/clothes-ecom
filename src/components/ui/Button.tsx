'use client';

import { forwardRef, ButtonHTMLAttributes, AnchorHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

type ButtonPropsBase = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  href?: string;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  asChild?: boolean;
};

export type ButtonProps = ButtonPropsBase & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'href'> & Partial<AnchorHTMLAttributes<HTMLAnchorElement>>;

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-paper hover:bg-ink-2 active:bg-ink-3',
  secondary: 'bg-paper-3 text-ink hover:bg-paper-2 active:bg-line border border-line',
  outline: 'border border-ink text-ink hover:bg-ink/5 active:bg-ink/10',
  ghost: 'text-ink hover:bg-paper-3 active:bg-paper-2',
  danger: 'bg-danger text-paper hover:bg-danger/90 active:bg-danger',
  link: 'text-ink underline-offset-2 hover:underline',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-base gap-2',
  lg: 'px-6 py-3 text-lg gap-2.5',
  icon: 'p-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      href,
      icon,
      iconRight,
      disabled,
      className,
      asChild = false,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    const baseStyles = `
      inline-flex items-center justify-center font-medium rounded-md
      transition-colors duration-200 ease-lux
      disabled:opacity-50 disabled:cursor-not-allowed
      u-focus
      ${fullWidth ? 'w-full' : ''}
    `;

    const content = (
      <>
        {loading ? (
          <Spinner size="sm" className="text-current" aria-hidden="true" />
        ) : (
          <>
            {icon && <span className="flex-shrink-0" aria-hidden="true">{icon}</span>}
            {children}
            {iconRight && <span className="flex-shrink-0" aria-hidden="true">{iconRight}</span>}
          </>
        )}
      </>
    );

    if (href && !asChild) {
      return (
        <a
          href={href}
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
          aria-disabled={isDisabled}
          tabIndex={isDisabled ? -1 : undefined}
          {...props as AnchorHTMLAttributes<HTMLAnchorElement>}
        >
          {content}
        </a>
      );
    }

    return (
      <button
        ref={ref}
        type="button"
        disabled={isDisabled}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {content}
      </button>
    );
  }
);

Button.displayName = 'Button';

import { Spinner } from './Spinner';