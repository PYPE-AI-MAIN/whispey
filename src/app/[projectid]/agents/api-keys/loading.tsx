import { Key, Shield, Calendar, Activity, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export default function ApiKeysLoading() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 p-6">
      {/* Header Skeleton */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="w-48 h-8 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
        </div>
        <div className="w-full max-w-2xl h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
      </div>

      {/* Security Info Skeleton */}
      <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start gap-3">
          <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="w-32 h-3 bg-blue-200 dark:bg-blue-800 rounded animate-pulse" />
            <div className="w-full max-w-md h-3 bg-blue-200 dark:bg-blue-800 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Keys List Skeleton */}
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Card key={i} className="border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  {/* Icon skeleton */}
                  <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Key className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-pulse" />
                  </div>
                  
                  <div className="flex-1 space-y-3">
                    {/* Title and badges */}
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                      <div className="w-16 h-5 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                    </div>
                    
                    {/* Masked key */}
                    <div className="w-48 h-3 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                    
                    {/* Metadata */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-400 dark:text-gray-600" />
                        <div className="w-24 h-3 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                      </div>
                      <div className="flex items-center gap-1">
                        <Activity className="w-3 h-3 text-gray-400 dark:text-gray-600" />
                        <div className="w-20 h-3 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Action buttons skeleton */}
                <div className="flex items-center gap-1">
                  <div className="w-7 h-7 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                  <div className="w-7 h-7 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Optional: Loading indicator */}
      <div className="flex items-center justify-center py-8 mt-4">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Loading API keys...</span>
      </div>
    </div>
  )
}