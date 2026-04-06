import { Skeleton } from '@/components/ui/skeleton'

export default function AgentDashboardLoading() {
  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm shrink-0">
        <div className="px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Skeleton className="w-9 h-9 rounded-xl" />
              <div className="flex items-center gap-4">
                <Skeleton className="h-8 w-36" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 ml-8">
                {[96, 80, 120].map((w, i) => (
                  <Skeleton key={i} className="h-9 rounded-lg" style={{ width: w, animationDelay: `${i * 60}ms` }} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-12" />
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                  {[36, 36, 44].map((w, i) => (
                    <Skeleton key={i} className="h-8 rounded-md" style={{ width: w, animationDelay: `${i * 50}ms` }} />
                  ))}
                </div>
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Content — matches Overview's MetricsGridSkeleton + ChartGridSkeleton layout */}
      <div className="flex-1 overflow-auto">
        <div className="p-8 space-y-8">
          {/* 6-column metrics grid */}
          <div className="grid grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-5">
                <div className="flex items-start justify-between mb-4">
                  <Skeleton className="w-9 h-9 rounded-lg" />
                  <Skeleton className="w-12 h-5" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>

          {/* 2-column charts grid */}
          <div className="grid grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
                <div className="px-7 py-6 border-b border-gray-200 dark:border-gray-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-9 h-9 rounded-lg" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                    </div>
                    <div className="text-right space-y-1.5">
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-5 w-8" />
                    </div>
                  </div>
                </div>
                <div className="p-7">
                  <Skeleton className="h-80 w-full rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
