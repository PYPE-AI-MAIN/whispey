// src/app/[projectid]/settings/page.tsx
'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import OrganizationSettings from "@/components/projects/OrganizationSettings"
import QaSubscriptions from "@/components/qa/QaSubscriptions"
import { useSupabaseQuery } from "@/hooks/useSupabase"
import { Loader2 } from 'lucide-react'

export default function SettingsPage() {
  const { projectid: projectId } = useParams()

  // for the "which agent" picker on a QA subscription
  const { data: agents } = useSupabaseQuery<{ id: string; name: string; display_name: string | null }>(
    'pype_voice_agents',
    {
      select: 'id, name, display_name',
      filters: [{ column: 'project_id', operator: 'eq', value: projectId as string }],
      orderBy: { column: 'created_at', ascending: true },
    },
  )

  // Fetch all projects using React Query
  const { data: projects, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await fetch('/api/projects')
      if (!response.ok) throw new Error('Failed to fetch projects')
      return response.json()
    },
    staleTime: 30000, // Cache for 30 seconds
  })

  // Find the current organization
  const organization = projects?.find((org: any) => org.id === projectId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-2">Failed to load organization</p>
          <button 
            onClick={() => window.location.reload()} 
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (!organization) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-2">Organization not found</p>
          <Link
            href="/projects"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Back to organizations
          </Link>
        </div>
      </div>
    )
  }

  // Plain block flow, no h-full/flex-1 chain: the shared SidebarWrapper shell
  // already gives every page one scroll container (<main class="overflow-auto">),
  // and a multi-level flex-1/min-h-0 chain trying to make only the member
  // table scroll turned out to fail silently on at least one real mobile
  // browser — the table resolved to zero height and was invisible, with no
  // error, because a child's min-height can't force a zero-height flex
  // ancestor to expand once overflow-hidden clips it. A plain page that just
  // grows, with the table given its own fixed vh-based height (immune to any
  // ancestor's height math) is far less clever but cannot fail this way.
  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6">
      <OrganizationSettings
        organizationName={organization.name}
        organizationId={organization.id}
      />

      <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <QaSubscriptions
          projectId={organization.id}
          agents={(agents ?? []).map((a) => ({ id: a.id, name: a.display_name || a.name }))}
        />
      </div>
    </div>
  )
}