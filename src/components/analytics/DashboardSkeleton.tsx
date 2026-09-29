/**
 * What the dashboard looks like before it has loaded.
 *
 * One component, used by both the route's loading screen and the canvas
 * itself. The route had its own copy shaped like the Overview page it was
 * written for — six metric tiles in a light-grey grid — and it kept that shape
 * long after the page changed, so a refresh flashed the old dashboard before
 * showing the new one. Two skeletons for one screen will always drift; this is
 * the one.
 */
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function DashboardSkeleton({ withHeader = false }: Readonly<{ withHeader?: boolean }>) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* only when nothing else has painted yet — inside the canvas the real toolbar is already there */}
      {withHeader && (
        <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-2 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-14 rounded-md" />
            <Skeleton className="h-6 w-16 rounded-md" />
            <Skeleton className="h-6 w-16 rounded-md" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-28 rounded-md" />
            <Skeleton className="h-7 w-24 rounded-md" />
          </div>
        </div>
      )}

      <div className="grid flex-1 grid-cols-12 content-start gap-3 p-3">
        {/* four numbers across, then charts two to a row — the seeded layout */}
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={`skeleton-kpi-${i}`} // NOSONAR: fixed-count placeholder loader, no data identity to key by
            className="col-span-12 h-[124px] rounded-xl sm:col-span-6 xl:col-span-3"
            style={{ animationDelay: `${i * 40}ms` }}
          />
        ))}
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={`skeleton-chart-${i}`} // NOSONAR: fixed-count placeholder loader, no data identity to key by
            className={cn('col-span-12 h-[292px] rounded-xl lg:col-span-6')}
            style={{ animationDelay: `${(i + 8) * 40}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
