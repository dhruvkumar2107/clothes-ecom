'use client';

import { forwardRef, useId } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import type { SliderProps as RadixSliderProps } from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

const Slider = forwardRef<HTMLDivElement, RadixSliderProps>(
  ({ className, ...props }, ref) => {
    return (
      <SliderPrimitive.Root
        ref={ref}
        className={cn('relative flex w-full touch-none select-none py-2', className)}
        {...props}
      >
        <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-ink/10">
          <SliderPrimitive.Range className="absolute h-full bg-accent" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full bg-paper border-2 border-accent shadow-lg focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2" />
      </SliderPrimitive.Root>
    );
  }
);
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
export type { SliderProps as SliderProps } from '@radix-ui/react-slider';