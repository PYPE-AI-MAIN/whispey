// src/app/admin/loading.tsx
import { Loader2 } from 'lucide-react'

export default function AdminLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        <p className="text-sm text-gray-600 dark:text-gray-400">Loading admin panel...</p>
      </div>
    </div>
  )
}