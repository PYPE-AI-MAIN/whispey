import { Skeleton } from '@/components/ui/skeleton'

export default function SettingsLoading() {
  return (
    <div className="min-h-screen bg-muted/50">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="w-48 h-6" />
            <Skeleton className="w-32 h-4" />
          </div>
        </div>

        {/* Team Management Card */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-6">
          <div className="space-y-2">
            <Skeleton className="w-40 h-5" />
            <Skeleton className="w-64 h-4" />
          </div>

          {/* Members */}
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="w-48 h-4" />
                  <Skeleton className="w-32 h-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
