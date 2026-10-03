export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-zinc-200/10 rounded ${className}`}
      {...props}
    />
  );
}

export function SkeletonCard({ className = '', ...props }: SkeletonProps) {
  return (
    <div className={`space-y-3 ${className}`} {...props}>
      <Skeleton className="aspect-[3/4] rounded-lg" />
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="aspect-[3/4] rounded-lg" />
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div className="relative w-full aspect-[16/7] md:aspect-[21/9] bg-zinc-900 rounded-2xl overflow-hidden">
      <Skeleton className="absolute inset-0" />
      <div className="absolute inset-0 flex flex-col items-start justify-end p-8 md:p-16 space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-12 w-96 max-w-full" />
        <Skeleton className="h-6 w-64 max-w-full" />
        <Skeleton className="h-12 w-40 rounded-full" />
      </div>
    </div>
  );
}

export function CategoryGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="aspect-square rounded-xl" />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex gap-4">
          {Array.from({ length: cols }).map((_, col) => (
            <Skeleton key={col} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
