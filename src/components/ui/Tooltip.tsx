'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface TooltipProps {
  content: string;
  children: React.ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

const sideStyles = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

const arrowStyles = {
  top: 'border-ink border-t-0 border-l-0 rotate-45',
  bottom: 'border-ink border-b-0 border-r-0 rotate-45',
  left: 'border-ink border-l-0 border-t-0 rotate-45',
  right: 'border-ink border-r-0 border-b-0 rotate-45',
};

export const Tooltip = ({ content, children, side = 'top', delay = 200, className }: TooltipProps) => {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const childRef = useRef<HTMLDivElement>(null);

  const show = () => {
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  };

  const hide = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!children || Array.isArray(children)) {
    return <>{children}</>;
  }

  return (
    <div className="relative inline-block" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} ref={childRef}>
      {React.cloneElement(children as React.ReactElement<any>, {
        'aria-describedby': visible ? 'tooltip' : undefined,
      } as any)}
      {visible && (
        <div
          id="tooltip"
          role="tooltip"
          className={cn(
            'absolute z-[60] px-2.5 py-1.5 text-xs font-medium text-paper bg-ink rounded-sm whitespace-nowrap animate-fade-in',
            sideStyles[side],
            className
          )}
        >
          {content}
          <div
            className={cn(
              'absolute w-2 h-2 bg-ink transform',
              side === 'top' && 'bottom-[-4px] left-1/2 -translate-x-1/2',
              side === 'bottom' && 'top-[-4px] left-1/2 -translate-x-1/2',
              side === 'left' && 'right-[-4px] top-1/2 -translate-y-1/2',
              side === 'right' && 'left-[-4px] top-1/2 -translate-y-1/2',
            )}
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
};

Tooltip.displayName = 'Tooltip';