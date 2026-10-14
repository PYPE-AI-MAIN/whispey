/**
 * What the org Overview tab looks like before it has loaded — same role as
 * DashboardSkeleton (§10), shaped for this screen instead: a title, four KPI
 * tiles, and a breakdown table, not the per-agent canvas's chart grid.
 */
import { Skeleton } from '@/components/ui/skeleton'

export function OverviewSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8 md:px-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Skeleton className="h-7 w-32" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-64 rounded-lg" />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`skeleton-kpi-${i}`} // NOSONAR: fixed-count placeholder loader, no data identity to key by
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-lg" style={{ animationDelay: `${i * 40}ms` }} />
              <Skeleton className="h-3 w-20" style={{ animationDelay: `${i * 40}ms` }} />
            </div>
            <Skeleton className="mt-3 h-8 w-24" style={{ animationDelay: `${i * 40}ms` }} />
          </div>
        ))}
      </div>

      <div>
        <Skeleton className="mb-3 h-5 w-36" />
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`skeleton-row-${i}`} // NOSONAR: fixed-count placeholder loader, no data identity to key by
              className="flex items-center gap-6 border-b border-gray-100 px-6 py-4 last:border-0 dark:border-gray-800/70"
            >
              <Skeleton className="h-4 w-28" style={{ animationDelay: `${(i + 4) * 40}ms` }} />
              <Skeleton className="h-4 w-12" style={{ animationDelay: `${(i + 4) * 40}ms` }} />
              <Skeleton className="h-4 w-12" style={{ animationDelay: `${(i + 4) * 40}ms` }} />
              <Skeleton className="h-4 w-12" style={{ animationDelay: `${(i + 4) * 40}ms` }} />
              <Skeleton className="ml-auto h-5 w-14 rounded-full" style={{ animationDelay: `${(i + 4) * 40}ms` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
