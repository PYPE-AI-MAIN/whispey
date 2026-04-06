import { Skeleton } from '@/components/ui/skeleton'

export default function ObservabilityLoading() {
  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm shrink-0">
        <div className="px-4 py-2">
          <div className="flex items-center gap-2">
            <Skeleton className="w-7 h-7 rounded-lg" />
            <Skeleton className="w-28 h-5" />
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="w-4 h-4" />
                  <Skeleton className="h-4 w-14" />
                </div>
              ))}
            </div>
            <div className="flex gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="text-center space-y-1">
                  <Skeleton className="h-3 w-10" />
                  <Skeleton className="h-3 w-6 mx-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Traces table */}
      <div className="flex-1 overflow-hidden">
        {/* Table header */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-2">
          <div className="flex items-center gap-4">
            {[120, 80, 100, 80, 60].map((w, i) => (
              <Skeleton key={i} className="h-3" style={{ width: w }} />
            ))}
          </div>
        </div>

        {/* Table rows */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-gray-900"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <Skeleton className="w-16 h-5 rounded-full shrink-0" />
              <div className="flex-1 flex flex-col gap-1.5">
                <Skeleton className="h-3" style={{ width: `${60 + (i % 3) * 15}%` }} />
                {i % 2 === 0 && <Skeleton className="h-3 w-1/3" />}
              </div>
              <Skeleton className="w-20 h-3 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
