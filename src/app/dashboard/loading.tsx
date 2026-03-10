export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-deep-iris/30" />
        <div className="h-4 w-72 animate-pulse rounded bg-deep-iris/20" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-soft-violet/10 bg-midnight-plum p-6"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 animate-pulse rounded bg-deep-iris/30" />
              <div className="size-8 animate-pulse rounded-lg bg-deep-iris/20" />
            </div>
            <div className="mt-4 h-8 w-32 animate-pulse rounded bg-deep-iris/30" />
            <div className="mt-2 h-3 w-20 animate-pulse rounded bg-deep-iris/20" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-soft-violet/10 bg-midnight-plum p-6"
          >
            <div className="mb-4 h-4 w-32 animate-pulse rounded bg-deep-iris/30" />
            <div className="h-48 animate-pulse rounded-lg bg-deep-iris/15" />
          </div>
        ))}
      </div>
    </div>
  );
}
