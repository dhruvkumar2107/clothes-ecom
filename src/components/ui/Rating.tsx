'use client';

import { cn } from '@/lib/utils';

export interface RatingProps {
  value: number;
  count?: number;
  size?: 'sm' | 'md';
  showCount?: boolean;
  className?: string;
  interactive?: boolean;
  onChange?: (value: number) => void;
}

const starSize = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
};

export const Rating = ({
  value,
  count,
  size = 'md',
  showCount = true,
  className,
  interactive = false,
  onChange,
}: RatingProps) => {
  const roundedValue = Math.round(value * 2) / 2;

  const stars = Array.from({ length: 5 }, (_, i) => {
    const starValue = i + 1;
    let fill: 'full' | 'half' | 'empty' = 'empty';

    if (starValue <= roundedValue) fill = 'full';
    else if (starValue - 0.5 === roundedValue) fill = 'half';

    const handleClick = () => interactive && onChange?.(starValue);
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (interactive && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onChange?.(starValue);
      }
    };

    return (
      <button
        key={i}
        type="button"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        disabled={!interactive}
        tabIndex={interactive ? 0 : -1}
        className={cn('p-0.5', interactive && 'hover:scale-110 transition-transform', !interactive && 'cursor-default')}
        aria-label={`${starValue} star${starValue !== 1 ? 's' : ''}`}
      >
        <svg className={cn(starSize[size], 'text-warning')} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          {fill === 'full' && (
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          )}
          {fill === 'half' && (
            <>
              <defs>
                <linearGradient id={`half-star-${size}-${i}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="50%" stopColor="currentColor" />
                  <stop offset="50%" stopColor="transparent" />
                </linearGradient>
              </defs>
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                fill="url(#half-star-${size}-${i})"
              />
            </>
          )}
          {fill === 'empty' && (
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          )}
        </svg>
      </button>
    );
  });

  return (
    <div className={cn('flex items-center gap-2', className)} role="img" aria-label={`${value} out of 5 stars${count ? `, ${count} reviews` : ''}`}>
      <div className="flex items-center gap-0.5" aria-hidden="true">{stars}</div>
      {showCount && count !== undefined && (
        <span className="text-sm text-muted">({count})</span>
      )}
      {showCount && !count && (
        <span className="text-sm text-muted">({value.toFixed(1)})</span>
      )}
    </div>
  );
};

Rating.displayName = 'Rating';