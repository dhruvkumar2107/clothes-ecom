'use client';

import { cn } from '@/lib/utils';
import { initials } from '@/lib/utils';

export interface AvatarProps {
  name?: string | null;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeStyles = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
};

export const Avatar = ({ name, src, size = 'md', className }: AvatarProps) => {
  const hasImage = !!src;

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-paper-3 overflow-hidden',
        'ring-1 ring-line',
        sizeStyles[size],
        className
      )}
      aria-label={name ? `Avatar for ${name}` : 'User avatar'}
    >
      {hasImage ? (
        <img
          src={src!}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className="font-medium text-ink" aria-hidden="true">
          {initials(name || 'User')}
        </span>
      )}
    </div>
  );
};

Avatar.displayName = 'Avatar';