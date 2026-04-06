import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export default function ApiKeysLoading() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="mb-8 space-y-3">
        <Skeleton className="w-48 h-8" />
        <Skeleton className="w-full max-w-2xl h-4" />
      </div>

      {/* Security info banner */}
      <div className="mb-6 p-3 border border-gray-200 dark:border-gray-800 rounded-lg">
        <div className="flex items-start gap-3">
          <Skeleton className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="w-32 h-3" />
            <Skeleton className="w-full max-w-md h-3" />
          </div>
        </div>
      </div>

      {/* Keys list */}
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Card key={i} className="border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="w-32 h-4" />
                      <Skeleton className="w-16 h-5 rounded-full" />
                    </div>
                    <Skeleton className="w-48 h-3" />
                    <div className="flex items-center gap-4">
                      <Skeleton className="w-24 h-3" />
                      <Skeleton className="w-20 h-3" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Skeleton className="w-7 h-7" />
                  <Skeleton className="w-7 h-7" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
