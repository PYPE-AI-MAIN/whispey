// src/app/admin/users/loading.tsx
import { Loader2, Users } from 'lucide-react'

export default function AdminUsersLoading() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header Skeleton */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center animate-pulse">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
            <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
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
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="text-sm text-gray-600 dark:text-gray-400">Loading users...</p>
      </div>

      {/* User Cards Skeleton (optional, shows while loading) */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div 
            key={i}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div className="flex-1">
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
              <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}