export default function SettingsLoading() {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          {/* Header Skeleton */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
            <div className="space-y-2">
              <div className="w-48 h-6 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
              <div className="w-32 h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
            </div>
          </div>
  
          {/* Team Management Card Skeleton */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 space-y-6">
            <div className="space-y-2">
              <div className="w-40 h-5 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
              <div className="w-64 h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
            </div>
            
            {/* Members skeleton */}
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="w-48 h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                    <div className="w-32 h-3 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }