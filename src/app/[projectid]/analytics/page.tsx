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
import { Suspense, useMemo, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { useSupabaseQuery } from '@/hooks/useSupabase'
import { OrgOverview, RangePicker } from '@/components/analytics/OrgOverview'
import AnalyticsCanvas from '@/components/analytics/AnalyticsCanvas'
import { JourneysTab } from '@/components/analytics/JourneysTab'
import { AgentMultiSelect } from '@/components/analytics/AgentMultiSelect'
import type { OverviewRange } from '@/hooks/useOrgOverview'

type Tab = 'overview' | 'explore' | 'journeys'
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'explore', label: 'Explore' },
  { id: 'journeys', label: 'Workflows' },
]

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
function ExploreTab({
  projectId,
  isActive,
  selectedAgentIds,
}: Readonly<{ projectId: string; isActive: boolean; selectedAgentIds: string[] | null }>) {
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
      <div className="flex items-center justify-end border-b border-border bg-card px-4 py-2">
        <RangePicker range={range} onChange={setRange} />
      </div>
      <div className="min-h-0 flex-1">
        <AnalyticsCanvas
          project={{ id: projectId }}
          agent={null}
          dateRange={dateRange}
          isActive={isActive}
          selectedAgentIds={selectedAgentIds}
        />
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
  const requestedTab = searchParams.get('tab')
  const activeTab = TABS.find((t) => t.id === requestedTab)?.id ?? 'overview'

  // shared across all three tabs (§3.5's "Agents: All ▾") — null means every
  // agent, which is also what keeps a newly added agent included by default
  const { data: agents } = useSupabaseQuery<{ id: string; name: string; display_name: string | null }>('pype_voice_agents', {
    select: 'id, name, display_name',
    filters: [{ column: 'project_id', operator: 'eq', value: projectId }],
    orderBy: { column: 'created_at', ascending: true },
  })
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[] | null>(null)

  const handleTabChange = (tab: Tab) => {
    router.push(`/${projectId}/analytics?tab=${tab}`)
  }

  return (
    <div className="flex h-full flex-col bg-muted/50">
      <div className="flex-none border-b border-border bg-card px-6 md:px-8">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-1">
            <BarChart3 className="mr-2 h-4 w-4 text-muted-foreground" />
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  activeTab === tab.id
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* shared across all three tabs, per §3.5's wireframe — not per-tab state */}
          <AgentMultiSelect
            agents={(agents ?? []).map((a) => ({ id: a.id, name: a.display_name || a.name }))}
            selected={selectedAgentIds}
            onChange={setSelectedAgentIds}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {/* every panel stays mounted; hidden ones just don't fetch, matching
            AnalyticsCanvas's own isActive convention on the agent page */}
        <div className={activeTab === 'overview' ? 'block h-full' : 'hidden'}>
          <OrgOverview projectId={projectId} isActive={activeTab === 'overview'} selectedAgentIds={selectedAgentIds} />
        </div>
        <div className={activeTab === 'explore' ? 'block h-full' : 'hidden'}>
          <ExploreTab projectId={projectId} isActive={activeTab === 'explore'} selectedAgentIds={selectedAgentIds} />
        </div>
        <div className={activeTab === 'journeys' ? 'block h-full' : 'hidden'}>
          <JourneysTab projectId={projectId} isActive={activeTab === 'journeys'} />
        </div>
      </div>
    </div>
  )
}
