'use client';

import { cn } from '@/lib/utils';

export const Table = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <div className={cn('w-full', className)}>
      <table className="w-full border-collapse text-sm" role="table">
        {children}
      </table>
    </div>
  );
};

export const TableWrap = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <div className={cn('overflow-x-auto -mx-5 px-5', className)}>
      {children}
    </div>
  );
};

export const THead = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <thead className={cn('[&_th]:border-b_[&_th]:border-line [&_th]:bg-paper-2 [&_th]:text-left [&_th]:font-medium [&_th]:u-label [&_th]:py-3 [&_th]:px-4', className)}>{children}</thead>;
};

export const TBody = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <tbody className={cn('[&_tr]:border-b_[&_tr]:border-line [&_tr]:hover:bg-paper-2', className)}>{children}</tbody>;
};

export const TR = ({ children, className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => {
  return <tr className={cn(className)} {...props}>{children}</tr>;
};

export const TH = ({ children, className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => {
  return <th className={cn('px-4 py-3', className)} {...props}>{children}</th>;
};

export const TD = ({ children, className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => {
  return <td className={cn('px-4 py-3 text-ink', className)} {...props}>{children}</td>;
};

Table.displayName = 'Table';
TableWrap.displayName = 'TableWrap';
THead.displayName = 'THead';
TBody.displayName = 'TBody';
TR.displayName = 'TR';
TH.displayName = 'TH';
TD.displayName = 'TD';