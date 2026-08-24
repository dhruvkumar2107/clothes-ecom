'use client';

import { cn } from '@/lib/utils';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padded?: boolean;
}

export const Card = ({ children, className, hover = false, padded = true }: CardProps) => {
  return (
    <div
      className={cn(
        'rounded-md border border-line bg-paper transition-shadow duration-200',
        padded && 'p-5',
        hover && 'hover:shadow-md',
        className
      )}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <div className={cn('mb-4', className)}>{children}</div>;
};

export const CardBody = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <div className={cn(className)}>{children}</div>;
};

export const CardFooter = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <div
      className={cn(
        'mt-4 pt-4 border-t border-line flex items-center gap-3',
        className
      )}
    >
      {children}
    </div>
  );
};

Card.displayName = 'Card';
CardHeader.displayName = 'CardHeader';
CardBody.displayName = 'CardBody';
CardFooter.displayName = 'CardFooter';