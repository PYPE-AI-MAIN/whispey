export default function AgentDashboardLoading() {
  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm flex-shrink-0">
        <div className="px-8 py-3">
          <div className="flex items-center justify-between">
            {/* Left: nav + identity + tabs */}
            <div className="flex items-center gap-6">
              {/* Back button */}
              <div className="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />

              {/* Agent identity */}
              <div className="flex items-center gap-4">
                <div className="h-8 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
              </div>

              {/* Tab nav */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700/50 rounded-xl p-1 ml-8">
                {[96, 80, 120].map((w, i) => (
                  <div
                    key={i}
                    className="h-9 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
                    style={{ width: w, animationDelay: `${i * 60}ms` }}
                  />
                ))}
              </div>
            </div>

            {/* Right: filters + actions */}
            <div className="flex items-center gap-6">
              {/* Period label + buttons */}
              <div className="flex items-center gap-4">
                <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700/50 rounded-lg p-1">
                  {[36, 36, 44].map((w, i) => (
                    <div
                      key={i}
                      className="h-8 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse"
                      style={{ width: w, animationDelay: `${i * 50}ms` }}
                    />
                  ))}
                </div>
                <div className="h-8 w-22 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
              </div>
              {/* Action button */}
              <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 p-6 overflow-hidden">
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
              <div className="h-7 w-16 bg-gray-300 dark:bg-gray-600 rounded mb-1" />
              <div className="h-3 w-24 bg-gray-100 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 animate-pulse">
          {/* Table header */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            {[140, 100, 80, 80, 60].map((w, i) => (
              <div key={i} className="h-3 bg-gray-200 dark:bg-gray-700 rounded" style={{ width: w }} />
            ))}
          </div>
          {/* Table rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3 border-b border-gray-50 dark:border-gray-700/50"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="w-32 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-800 rounded" />
              <div className="w-20 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="w-16 h-3 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="w-12 h-5 bg-gray-100 dark:bg-gray-700 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
