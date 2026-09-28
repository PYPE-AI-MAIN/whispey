/**
 * Journeys tab — Confluence "Analytics Phase 3 and 4 — Build Spec" §3.5.3.
 * A campaign selector, its funnel, and the most recently updated journeys as
 * milestone chips. Only exists in the org view (§3.5.4) — a per-agent canvas
 * has nothing cross-agent to show.
 *
 * Campaigns and journeys are created implicitly by `ingest_journey_event`
 * (§3.3.2), so the only real state here is "no campaign has sent an event
 * yet" — not an error, just nothing to show.
 */
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RangePicker } from './OrgOverview'
import { useCampaigns, useFunnel, useRecentJourneys, type JourneyEvent, type JourneySummary } from '@/hooks/useJourneys'
import type { OverviewRange } from '@/hooks/useOrgOverview'

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No journeys yet</p>
      <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
        Journeys and their campaigns appear here automatically the first time an external workflow posts an event to{' '}
        <code className="rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-gray-800">POST /api/journeys/events</code>. Nothing to configure first.
      </p>
    </div>
  )
}

function Funnel({ projectId, campaignId, range }: Readonly<{ projectId: string; campaignId: string; range: OverviewRange }>) {
  const dateRange = 'from' in range ? range : rangeFromDays(range.days)
  const { data, isLoading } = useFunnel(projectId, campaignId, { from: dateRange.from, to: dateRange.to }, true)
  const steps = data?.steps ?? []
  const max = Math.max(1, ...steps.map((s) => s.reached_count))

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
  if (steps.length === 0) return <p className="text-sm text-gray-500 dark:text-gray-400">This campaign has no steps yet.</p>

  return (
    <div className="flex flex-wrap gap-3">
      {steps.map((s) => (
        <div
          key={s.step_key}
          className="flex min-w-[110px] flex-1 flex-col items-center rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">{s.reached_count.toLocaleString()}</div>
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{s.label}</div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${(s.reached_count / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function rangeFromDays(days: number): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to)
  from.setDate(to.getDate() - days)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { from: fmt(from), to: fmt(to) }
}

/** One milestone chip. Voice steps deep-link to the call behind them — the same URL LogsOverlay's own drill-through opens. */
function MilestoneChip({ event, projectId }: Readonly<{ event: JourneyEvent; projectId: string }>) {
  const label = event.step ?? event.action
  const canOpen = event.channel === 'voice' && event.agent_id && event.external_ref

  const chip = (
    <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
      {label}
    </span>
  )

  if (!canOpen) return chip
  return (
    <Link
      href={`/${projectId}/agents/${event.agent_id}/observability?session_id=${event.external_ref}`}
      target="_blank"
      className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40"
    >
      {label}
    </Link>
  )
}

function JourneyRow({ projectId, journey }: Readonly<{ projectId: string; journey: JourneySummary }>) {
  return (
    <div className="flex flex-col gap-2 border-b border-gray-100 px-4 py-3 last:border-0 dark:border-gray-800/70">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-900 dark:text-gray-100">{journey.identity_key}</span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {journey.status}
          {journey.outcome ? ` · ${journey.outcome}` : ''}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {journey.events.map((e, i) => (
          <MilestoneChip key={`${journey.id}-${i}`} event={e} projectId={projectId} />
        ))}
      </div>
    </div>
  )
}

export function JourneysTab({ projectId, isActive }: Readonly<{ projectId: string; isActive: boolean }>) {
  const { data: campaigns, isLoading: campaignsLoading } = useCampaigns(projectId, isActive)
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [range, setRange] = useState<OverviewRange>({ days: 30 })
  const { data: journeys, isLoading: journeysLoading } = useRecentJourneys(projectId, campaignId, isActive)

  useEffect(() => {
    if (!campaignId && campaigns && campaigns.length > 0) setCampaignId(campaigns[0].id)
  }, [campaigns, campaignId])

  if (campaignsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8 md:px-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Select value={campaignId ?? undefined} onValueChange={setCampaignId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a campaign" />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name ?? c.key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <RangePicker range={range} onChange={setRange} />
        </div>

        {campaignId && (
          <>
            <div className="mb-8">
              <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">Funnel</h2>
              <Funnel projectId={projectId} campaignId={campaignId} range={range} />
            </div>

            <div>
              <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">Recent journeys</h2>
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                {journeysLoading && (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                )}
                {!journeysLoading && (journeys?.length ?? 0) === 0 && (
                  <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">No journeys for this campaign yet.</p>
                )}
                {journeys?.map((j) => (
                  <JourneyRow key={j.id} projectId={projectId} journey={j} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
