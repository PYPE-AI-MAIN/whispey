// src/app/admin/projects/loading.tsx
// src/app/admin/projects/loading.tsx
import { Loader2, Building2 } from 'lucide-react'

export default function AdminProjectsLoading() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header Skeleton */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center animate-pulse">
            <Building2 className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1">
            <div className="h-8 w-56 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
            <div className="h-4 w-72 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Search and Filter Skeleton */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <div className="w-full sm:w-48 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
      </div>

      {/* Loading State with Spinner */}
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-green-600 mb-3" />
        <p className="text-sm text-gray-600 dark:text-gray-400">Loading projects...</p>
      </div>

      {/* Project Cards Skeleton (optional, shows while loading) */}
      <div className="space-y-6">
        {/* Section Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>

        {/* Project Cards */}
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div 
              key={i}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse"
            >
              <div className="space-y-4">
                {/* Project Info */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                  <div className="flex-1">
                    <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                  <div className="flex-1 h-10 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="flex-1 h-10 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-10 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}