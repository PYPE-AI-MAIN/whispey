export default function ObservabilityLoading() {
  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm flex-shrink-0">
        <div className="px-4 py-2">
          <div className="flex items-center gap-2">
            {/* Back button skeleton */}
            <div className="w-7 h-7 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
            {/* Title skeleton */}
            <div className="w-28 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
        <div className="animate-pulse space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-32" />
            <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-20" />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-200 dark:bg-gray-600 rounded" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-14" />
                </div>
              ))}
            </div>
            <div className="flex gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="text-center">
                  <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-10 mb-1" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-6 mx-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Traces table */}
      <div className="flex-1 overflow-hidden">
        {/* Table header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
          <div className="flex items-center gap-4">
            {[120, 80, 100, 80, 60].map((w, i) => (
              <div
                key={i}
                className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                style={{ width: w }}
              />
            ))}
          </div>
        </div>

        {/* Table rows */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-gray-900 animate-pulse"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {/* Role badge */}
              <div className="w-16 h-5 bg-gray-200 dark:bg-gray-700 rounded-full" />
              {/* Message content */}
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded" style={{ width: `${60 + (i % 3) * 15}%` }} />
                {i % 2 === 0 && (
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/3" />
                )}
              </div>
              {/* Timestamp */}
              <div className="w-20 h-3 bg-gray-200 dark:bg-gray-700 rounded shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
