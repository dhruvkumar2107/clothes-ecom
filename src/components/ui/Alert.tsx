'use client';

import { cn } from '@/lib/utils';
import { Badge, BadgeProps } from './Badge';

export interface AlertProps {
  children: React.ReactNode;
  tone?: BadgeProps['tone'];
  title?: string;
  onDismiss?: () => void;
  className?: string;
}

const toneStyles: Record<NonNullable<BadgeProps['tone']>, string> = {
  default: 'border-ink/20 bg-ink/5 text-ink',
  success: 'border-success/20 bg-success/5 text-success',
  warning: 'border-warning/20 bg-warning/5 text-warning',
  danger: 'border-danger/20 bg-danger/5 text-danger',
  info: 'border-info/20 bg-info/5 text-info',
  muted: 'border-line bg-paper-3 text-muted',
  neutral: 'border-ink/20 bg-ink/5 text-ink',
  accent: 'border-accent/20 bg-accent/5 text-accent',
};

export const Alert = ({ children, tone = 'default', title, onDismiss, className }: AlertProps) => {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-md border p-4 flex gap-3 animate-rise',
        toneStyles[tone],
        className
      )}
    >
      <div className="flex-1 min-w-0">
        {title && <p className="font-medium mb-1">{title}</p>}
        <div className="text-sm leading-relaxed">{children}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-current/50 hover:text-current transition-colors p-0.5"
          aria-label="Dismiss"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
};

Alert.displayName = 'Alert';