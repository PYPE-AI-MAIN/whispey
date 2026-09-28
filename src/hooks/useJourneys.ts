/**
 * Data for the Journeys tab — Confluence "Analytics Phase 3 and 4 — Build
 * Spec" §3.5.3. Three independent reads (campaigns, funnel, recent journeys)
 * rather than one combined endpoint, since picking a different campaign only
 * needs to re-fetch the last two.
 */
import { useQuery } from '@tanstack/react-query'
import type { OverviewRange } from './useOrgOverview'

export type Campaign = {
  id: string
  key: string
  name: string | null
  steps: { step: string; label: string; channel: string }[]
  created_at: string
}

export type FunnelStep = { ordinality: number; step_key: string; label: string; reached_count: number }
export type Funnel = { steps: FunnelStep[]; journeyCount: number }

export type JourneyEvent = {
  channel: string
  step: string | null
  action: string
  agent_id: string | null
  external_ref: string | null
  occurred_at: string
}

export type JourneySummary = {
  id: string
  identity_key: string
  status: string
  current_step: string | null
  outcome: string | null
  created_at: string
  updated_at: string
  events: JourneyEvent[]
}

function toDateRange(range: OverviewRange): { from: string; to: string } {
  if ('from' in range) return range
  const to = new Date()
  const from = new Date(to)
  from.setDate(to.getDate() - range.days)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { from: fmt(from), to: fmt(to) }
}

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `Request failed (${res.status})`)
  }
  return res.json()
}

export function useCampaigns(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['journeys', 'campaigns', projectId],
    queryFn: () => getJSON<{ campaigns: Campaign[] }>(`/api/journeys/campaigns?projectId=${projectId}`).then((r) => r.campaigns),
    enabled: enabled && !!projectId,
  })
}

export function useFunnel(projectId: string, campaignId: string | null, range: OverviewRange, enabled: boolean) {
  const { from, to } = toDateRange(range)
  return useQuery({
    queryKey: ['journeys', 'funnel', projectId, campaignId, from, to],
    queryFn: () => getJSON<Funnel>(`/api/journeys/funnel?projectId=${projectId}&campaignId=${campaignId}&from=${from}&to=${to}`),
    enabled: enabled && !!projectId && !!campaignId,
  })
}

export function useRecentJourneys(projectId: string, campaignId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['journeys', 'recent', projectId, campaignId],
    queryFn: () =>
      getJSON<{ journeys: JourneySummary[] }>(`/api/journeys/recent?projectId=${projectId}&campaignId=${campaignId}&limit=20`).then(
        (r) => r.journeys
      ),
    enabled: enabled && !!projectId && !!campaignId,
  })
}
