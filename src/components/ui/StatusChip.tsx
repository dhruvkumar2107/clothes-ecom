'use client';

import { cn } from '@/lib/utils';
import { toneFor, humanize } from '@/lib/enums';
import { Badge } from './Badge';

export interface StatusChipProps {
  status: string | null | undefined;
  label?: string;
  className?: string;
  showDot?: boolean;
}

export const StatusChip = ({ status, label, className, showDot = true }: StatusChipProps) => {
  if (!status) return null;

  const tone = toneFor(status);
  const displayLabel = label ?? humanize(status);

  return (
    <Badge tone={tone} size="sm" className={className} dot={showDot}>
      {displayLabel}
    </Badge>
  );
};

StatusChip.displayName = 'StatusChip';