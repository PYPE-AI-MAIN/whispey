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
import Link from 'next/link'
import { Suspense, useMemo, useState } from 'react'
import { BarChart3, ChevronRight } from 'lucide-react'
import { useSupabaseQuery } from '@/hooks/useSupabase'
import { OrgOverview, RangePicker } from '@/components/analytics/OrgOverview'
import AnalyticsCanvas from '@/components/analytics/AnalyticsCanvas'
import type { OverviewRange } from '@/hooks/useOrgOverview'

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

/**
 * Explore — Confluence "Analytics Phase 3 and 4 — Build Spec" §3.5.2. The
 * identical canvas the per-agent page uses, just with no single `agent` — the
 * canvas itself already generalizes to an org-wide `Ctx.agentIds` from that.
 *
 * `AnalyticsCanvas` takes an already-resolved `{ from, to }` as a prop rather
 * than owning its own Period control (Dashboard.tsx's own convention: the
 * canvas reads it, the page around it owns it) — so this reuses the exact
 * same RangePicker the Overview tab already has, instead of a second one.
 */
function ExploreTab({ projectId, isActive }: Readonly<{ projectId: string; isActive: boolean }>) {
  const [range, setRange] = useState<OverviewRange>({ days: 30 })
  const dateRange = useMemo(() => {
    if ('from' in range) return range
    const to = new Date()
    const from = new Date(to)
    from.setDate(to.getDate() - range.days)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    return { from: fmt(from), to: fmt(to) }
  }, [range])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end border-b border-gray-200 bg-white px-4 py-2 dark:border-gray-800 dark:bg-gray-900">
        <RangePicker range={range} onChange={setRange} />
      </div>
      <div className="min-h-0 flex-1">
        <AnalyticsCanvas project={{ id: projectId }} agent={null} dateRange={dateRange} isActive={isActive} />
      </div>
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

  const handleTabChange = (tab: Tab) => {
    router.push(`/${projectId}/analytics?tab=${tab}`)
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-900">
      {/* Just the breadcrumb — the app's own sidebar already carries the logo,
          Docs/Help links and the signed-in user, so repeating all of that in a
          second header bar (the shared Header component's usual job on pages
          with no sidebar of their own) was pure duplication here. */}
      <div className="flex-none border-b border-gray-200 bg-white px-6 py-3 dark:border-gray-800 dark:bg-gray-900 md:px-8">
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
            Home
          </Link>
          <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600" />
          <span className="text-gray-900 dark:text-gray-100">{projectLoading ? 'Loading…' : project?.name ?? 'Project'}</span>
          <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600" />
          <span className="text-gray-900 dark:text-gray-100">Analytics</span>
        </nav>
      </div>

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
          <ExploreTab projectId={projectId} isActive={activeTab === 'explore'} />
        </div>
        <div className={activeTab === 'journeys' ? 'block h-full' : 'hidden'}>
          <ComingSoon label="Journeys" />
        </div>
      </div>
    </div>
  )
}
