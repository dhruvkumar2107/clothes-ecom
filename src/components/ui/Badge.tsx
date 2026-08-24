'use client';

import { cn } from '@/lib/utils';

export type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'neutral' | 'accent';

const toneStyles: Record<Tone, string> = {
  default: 'bg-ink/10 text-ink',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  danger: 'bg-danger/10 text-danger border-danger/20',
  info: 'bg-info/10 text-info border-info/20',
  muted: 'bg-paper-3 text-muted',
  neutral: 'bg-ink/10 text-ink',
  accent: 'bg-accent/10 text-accent border-accent/20',
};

export interface BadgeProps {
  children: React.ReactNode;
  tone?: Tone;
  size?: 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

export const Badge = ({ children, tone = 'default', size = 'md', className, dot = false }: BadgeProps) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-sm border',
        'whitespace-nowrap',
        toneStyles[tone],
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        className
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', tone === 'default' && 'bg-ink')} />}
      {children}
    </span>
  );
};

Badge.displayName = 'Badge';