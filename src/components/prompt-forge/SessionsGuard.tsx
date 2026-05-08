'use client'

import { useParams, useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useMemberVisibility } from '@/hooks/useMemberVisibility'
import { SessionsList } from './SessionsList'

export function SessionsGuard() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectid as string
  const agentId = params.agentid as string
  const { canAccessPromptForge, isLoading } = useMemberVisibility(projectId)

  if (isLoading) return <GuardSkeleton />

  if (!canAccessPromptForge) {
    return (
      <div className="h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-10 max-w-sm w-full text-center mx-4">
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          </div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Access Restricted
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
            Prompt Forge requires{' '}
            <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono text-gray-700 dark:text-gray-300">
              promptforge: true
            </code>{' '}
            in your project permissions.
          </p>
          <Button
            variant="outline" size="sm" className="w-full h-8 text-xs"
            onClick={() => router.replace(`/${projectId}/agents/${agentId}`)}
          >
            Go back
          </Button>
        </div>
      </div>
    )
  }

  return <SessionsList projectId={projectId} agentId={agentId} />
}

function GuardSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto px-8 h-14 flex items-center gap-3">
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="max-w-4xl mx-auto px-8 h-9" />
      </div>
      <div className="max-w-4xl mx-auto px-8 py-8 flex flex-col gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
            <Skeleton className="w-9 h-9 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-3.5 w-48 mb-2" />
              <Skeleton className="h-2.5 w-64" />
            </div>
            <Skeleton className="h-6 w-14 rounded-full" />
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}