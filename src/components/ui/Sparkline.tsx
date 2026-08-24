'use client';

import { cn } from '@/lib/utils';

export interface SparklineProps {
  data: number[];
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  height?: number;
  className?: string;
  showArea?: boolean;
}

const toneColors = {
  default: 'var(--color-accent)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',
};

export const Sparkline = ({ data, tone = 'default', height = 40, className, showArea = true }: SparklineProps) => {
  if (!data.length) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 100;
    return `${x}% ${y}%`;
  }).join(',');

  const areaPoints = [
    `0% 100%`,
    ...points.split(', '),
    `100% 100%`,
  ].join(',');

  const color = toneColors[tone];

  return (
    <svg
      className={cn('w-full overflow-visible', className)}
      width="100%"
      height={height}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      role="img"
      aria-label={`Sparkline chart with ${data.length} data points`}
    >
      {showArea && (
        <polygon
          points={areaPoints}
          fill={color}
          fillOpacity="0.1"
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

Sparkline.displayName = 'Sparkline';