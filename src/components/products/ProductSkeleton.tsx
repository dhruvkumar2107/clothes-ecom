interface ProductSkeletonProps {
  count?: number;
}

export function ProductSkeleton({ count = 1 }: ProductSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <article key={i} className="group relative bg-paper rounded-lg border border-line overflow-hidden">
          <div className="aspect-[3/4] bg-paper-2 relative overflow-hidden">
            <div className="absolute inset-0 shimmer" />
          </div>
          <div className="p-4 space-y-2">
            <div className="h-3 w-16 bg-paper-3 rounded" />
            <div className="h-4 w-3/4 bg-paper-3 rounded" />
            <div className="flex gap-1.5">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="w-6 h-6 rounded-full bg-paper-3" />
              ))}
            </div>
            <div className="flex items-baseline gap-2">
              <div className="h-4 w-20 bg-paper-3 rounded" />
              <div className="h-3 w-14 bg-paper-3 rounded" />
            </div>
            <div className="h-3 w-16 bg-paper-3 rounded" />
          </div>
        </article>
      ))}
    </>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <ProductSkeleton count={count} />
    </div>
  );
}
