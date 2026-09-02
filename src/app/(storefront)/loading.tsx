export default function StorefrontLoading() {
  return (
    <div className="flex-1">
      {/* Hero skeleton */}
      <div className="relative min-h-[100vh] bg-ink flex items-end md:items-center">
        <div className="absolute inset-0 bg-gradient-to-br from-ink-2 to-ink animate-pulse" />
        <div className="u-container relative z-10 pb-20 md:py-0 w-full">
          <div className="max-w-3xl space-y-6">
            <div className="h-4 w-24 bg-paper/10 rounded" />
            <div className="space-y-3">
              <div className="h-16 md:h-24 lg:h-32 w-3/4 bg-paper/10 rounded" />
              <div className="h-16 md:h-24 lg:h-32 w-1/2 bg-paper/10 rounded" />
            </div>
            <div className="h-6 w-2/3 bg-paper/10 rounded" />
            <div className="flex gap-4 pt-4">
              <div className="h-12 w-40 bg-paper/10 rounded-md" />
              <div className="h-12 w-40 bg-paper/10 rounded-md" />
            </div>
          </div>
        </div>
      </div>

      {/* Editorial grid skeleton */}
      <section className="py-16 md:py-24">
        <div className="u-container">
          <div className="flex items-end justify-between gap-6 mb-12">
            <div className="space-y-3">
              <div className="h-3 w-16 bg-ink/10 rounded" />
              <div className="h-8 w-48 bg-ink/10 rounded" />
            </div>
            <div className="h-4 w-20 bg-ink/10 rounded" />
          </div>
          <div className="grid md:grid-cols-2 gap-4 md:gap-6">
            <div className="md:row-span-2 aspect-[3/4] bg-paper-2 rounded-lg animate-pulse" />
            <div className="aspect-[3/4] bg-paper-2 rounded-lg animate-pulse" />
            <div className="aspect-[3/4] bg-paper-2 rounded-lg animate-pulse" />
          </div>
        </div>
      </section>

      {/* Product grid skeleton */}
      <section className="py-16 md:py-24 bg-paper-2">
        <div className="u-container">
          <div className="flex items-end justify-between gap-6 mb-12">
            <div className="space-y-3">
              <div className="h-3 w-20 bg-ink/10 rounded" />
              <div className="h-8 w-40 bg-ink/10 rounded" />
            </div>
            <div className="h-4 w-24 bg-ink/10 rounded" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10 md:gap-x-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="aspect-[3/4] bg-paper-3 rounded-lg animate-pulse" />
                <div className="h-3 w-16 bg-ink/10 rounded" />
                <div className="h-4 w-3/4 bg-ink/10 rounded" />
                <div className="h-4 w-1/2 bg-ink/10 rounded" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust strip skeleton */}
      <section className="py-12 md:py-16 border-y border-line">
        <div className="u-container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="text-center space-y-3">
                <div className="w-14 h-14 mx-auto rounded-lg bg-ink/5 animate-pulse" />
                <div className="h-4 w-20 mx-auto bg-ink/10 rounded" />
                <div className="h-3 w-28 mx-auto bg-ink/10 rounded" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
