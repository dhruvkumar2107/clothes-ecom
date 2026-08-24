'use client';

import { forwardRef, useId } from 'react';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import type { RadioGroupProps as RadixRadioGroupProps } from '@radix-ui/react-radio-group';
import { cn } from '@/lib/utils';

const RadioGroup = forwardRef<HTMLDivElement, RadixRadioGroupProps>(
  ({ className, ...props }, ref) => {
    return (
      <RadioGroupPrimitive.Root
        ref={ref}
        className={cn('grid gap-2', className)}
        {...props}
      />
    );
  }
);
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

interface RadioGroupItemProps extends RadioGroupPrimitive.RadioGroupItemProps {
  label?: string;
  className?: string;
}

const RadioGroupItem = forwardRef<HTMLLabelElement, RadioGroupItemProps>(
  ({ label, className, ...props }, ref) => {
    const id = useId();
    return (
      <label
        ref={ref}
        className={cn(
          'flex items-center gap-2 cursor-pointer',
          className
        )}
      >
        <RadioGroupPrimitive.Item
          id={id}
          className={cn(
            'aspect-square h-4 w-4 rounded-full border border-line text-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
          )}
          {...props}
        >
          <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-accent" />
          </RadioGroupPrimitive.Indicator>
        </RadioGroupPrimitive.Item>
        {label && <span className="text-sm text-ink">{label}</span>}
      </label>
    );
  }
);
RadioGroupItem.displayName = 'RadioGroupItem';

export { RadioGroup, RadioGroupItem };
export type { RadioGroupProps as RadioGroupProps } from '@radix-ui/react-radio-group';
export type { RadioGroupItemProps as RadioGroupItemProps } from '@radix-ui/react-radio-group';