'use client'

/**
 * The org-view screen — Confluence "Analytics Phase 3 and 4 — Build Spec"
 * §3.5. Replaces the public, login-free Metabase iframe that used to live at
 * this route entirely — not extended, not embedded alongside it.
 *
 * Three tabs, one query engine (§3.5): Overview's fixed tiles and Explore's
 * chart canvas both read `buildQuery.ts` through `Ctx.agentIds`, never two
 * pipelines for the same number. Tab switching follows this codebase's own
 * page-navigation convention (`Dashboard.tsx`) — a `?tab=` query param and
 * plain button pills with every panel kept mounted and toggled via
 * `hidden`/`block`, not the shadcn `Tabs` primitive, which this codebase
 * reserves for small in-place toggles.
 */
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import Header from '@/components/shared/Header'
import { useSupabaseQuery } from '@/hooks/useSupabase'
import { OrgOverview } from '@/components/analytics/OrgOverview'

type Tab = 'overview' | 'explore' | 'journeys'
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'explore', label: 'Explore' },
  { id: 'journeys', label: 'Journeys' },
]

function ComingSoon({ label }: Readonly<{ label: string }>) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">
      {label} is on its way.
    </div>
  )
}

export default function OrgAnalyticsPage() {
  return (
    <Suspense fallback={null}>
      <OrgAnalyticsPageContent />
    </Suspense>
  )
}

function OrgAnalyticsPageContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = params.projectid as string
  const activeTab = (searchParams.get('tab') as Tab | null) || 'overview'

  const { data: projects, isLoading: projectLoading } = useSupabaseQuery('pype_voice_projects', {
    select: 'id, name',
    filters: [{ column: 'id', operator: 'eq', value: projectId }],
  })
  const project = projects?.[0]

  const [breadcrumb, setBreadcrumb] = useState<{ project?: string; item?: string }>({})
  useEffect(() => {
    if (project) setBreadcrumb({ project: project.name, item: 'Analytics' })
  }, [project])

  const handleTabChange = (tab: Tab) => {
    router.push(`/${projectId}/analytics?tab=${tab}`)
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-900">
      <Header breadcrumb={breadcrumb} isLoading={projectLoading} />

      <div className="flex-none border-b border-gray-200 bg-white px-6 dark:border-gray-800 dark:bg-gray-900 md:px-8">
        <div className="flex items-center gap-1 py-3">
          <BarChart3 className="mr-2 h-4 w-4 text-gray-400" />
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`rounded-md px-3 py-1.5 text-sm ${
                activeTab === tab.id
                  ? 'bg-gray-100 font-medium text-gray-900 dark:bg-gray-800 dark:text-gray-50'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {/* every panel stays mounted; hidden ones just don't fetch, matching
            AnalyticsCanvas's own isActive convention on the agent page */}
        <div className={activeTab === 'overview' ? 'block h-full' : 'hidden'}>
          <OrgOverview projectId={projectId} isActive={activeTab === 'overview'} />
        </div>
        <div className={activeTab === 'explore' ? 'block h-full' : 'hidden'}>
          <ComingSoon label="Explore" />
        </div>
        <div className={activeTab === 'journeys' ? 'block h-full' : 'hidden'}>
          <ComingSoon label="Journeys" />
        </div>
      </div>
    </div>
  )
}
