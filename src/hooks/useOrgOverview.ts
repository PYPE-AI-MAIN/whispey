/**
 * The org Overview tab — Confluence "Analytics Phase 3 and 4 — Build Spec"
 * §3.5.1. Fixed tiles, not a saved dashboard: there is nothing here for anyone
 * to edit, so this skips the whole dashboard/widgets mechanism §3.5.2's
 * Explore tab needs, and just runs a handful of ad-hoc specs through the same
 * `/api/analytics/query` engine every other chart uses.
 */
'use client'
import { useEffect, useState } from 'react'
import { useSupabaseQuery } from '@/hooks/useSupabase'
import type { ResultRow, WidgetResult } from '@/types/analytics'
import type { SpecInput } from '@/server/analytics/spec'

export type OverviewRange = { days: number } | { from: string; to: string }

export type OrgAgentRow = {
  id: string
  name: string
  is_active: boolean
  calls: number | null
  pickupPct: number | null
  latency: number | null
}

export type OrgOverviewData = {
  totalCalls: number | null
  pickupPct: number | null
  avgLatency: number | null
  billingMinutes: number | null
  agents: OrgAgentRow[]
}

const WIDGET_IDS = {
  totalCalls: 'total_calls',
  pickupRate: 'pickup_rate',
  avgLatency: 'avg_latency',
  billingMinutes: 'billing_minutes',
  callsByAgent: 'calls_by_agent',
  pickupByAgent: 'pickup_by_agent',
  latencyByAgent: 'latency_by_agent',
} as const

/**
 * "Success" is not `call_ended_reason = 'completed'` — the dialler reports
 * that even for calls where nobody actually spoke, which reads ~3x too high
 * (Confluence "NHIC - Metric Definitions and Source of Truth"). Pickup is
 * whether a person was actually on the call, `transcription_metrics
 * ->> 'is_user_in_call'`, stored as the text '1'/'0'.
 */
const PICKUP_FIELD: { col: string; path: string[]; boolean_encoding: 'one_zero' } = {
  col: 'transcription_metrics',
  path: ['is_user_in_call'],
  boolean_encoding: 'one_zero',
}

function specsFor(range: OverviewRange): { id: string; spec: SpecInput }[] {
  return [
    { id: WIDGET_IDS.totalCalls, spec: { spec_version: 1, agg: { fn: 'count' }, range } },
    { id: WIDGET_IDS.pickupRate, spec: { spec_version: 1, agg: { fn: 'rate', field: PICKUP_FIELD }, range } },
    { id: WIDGET_IDS.avgLatency, spec: { spec_version: 1, agg: { fn: 'avg', field: { col: 'avg_latency' } }, range } },
    {
      id: WIDGET_IDS.billingMinutes,
      spec: { spec_version: 1, agg: { fn: 'sum_ceil_minutes', field: { col: 'billing_duration_seconds' } }, range },
    },
    {
      id: WIDGET_IDS.callsByAgent,
      spec: { spec_version: 1, agg: { fn: 'count' }, dimension: { field: { col: 'agent_id' } }, range },
    },
    {
      id: WIDGET_IDS.pickupByAgent,
      spec: { spec_version: 1, agg: { fn: 'rate', field: PICKUP_FIELD }, dimension: { field: { col: 'agent_id' } }, range },
    },
    {
      id: WIDGET_IDS.latencyByAgent,
      spec: { spec_version: 1, agg: { fn: 'avg', field: { col: 'avg_latency' } }, dimension: { field: { col: 'agent_id' } }, range },
    },
  ]
}

function firstValue(rows: ResultRow[] | undefined): number | null {
  const v = rows?.[0]?.value
  return v === null || v === undefined ? null : Number(v)
}

/** `series` on a dimensioned result is the group's own value — here, an agent id. */
function byAgent(rows: ResultRow[] | undefined): Map<string, number> {
  const out = new Map<string, number>()
  for (const r of rows ?? []) {
    if (r.series && r.value !== null) out.set(r.series, Number(r.value))
  }
  return out
}

export function useOrgOverview(projectId: string | undefined, range: OverviewRange, enabled: boolean) {
  const [results, setResults] = useState<Map<string, WidgetResult>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const agentsQuery = useSupabaseQuery<{ id: string; name: string; display_name: string | null; is_active: boolean }>(
    'pype_voice_agents',
    projectId
      ? {
          select: 'id, name, display_name, is_active',
          filters: [{ column: 'project_id', operator: 'eq', value: projectId }],
          orderBy: { column: 'created_at', ascending: true },
        }
      : null
  )

  const rangeKey = 'days' in range ? `d:${range.days}` : `r:${range.from}:${range.to}`

  useEffect(() => {
    if (!enabled || !projectId) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    ;(async () => {
      try {
        const res = await fetch('/api/analytics/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, widgets: specsFor(range) }),
        })
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `Something went wrong (${res.status})`)
        const reader = res.body?.getReader()
        if (!reader) throw new Error('Could not read the response')
        const decoder = new TextDecoder()
        let buffer = ''
        const next = new Map<string, WidgetResult>()
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          let newline: number
          while ((newline = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, newline)
            buffer = buffer.slice(newline + 1)
            if (!line.trim()) continue
            const result = JSON.parse(line) as WidgetResult
            next.set(result.widget_id, result)
            if (!cancelled) setResults(new Map(next))
          }
        }
      } catch (err) {
        if (!cancelled) setError(err as Error)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // `range` is a fresh object per render; `rangeKey` is the real dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, rangeKey, enabled])

  const callsByAgent = byAgent(results.get(WIDGET_IDS.callsByAgent)?.data)
  const pickupByAgent = byAgent(results.get(WIDGET_IDS.pickupByAgent)?.data)
  const latencyByAgent = byAgent(results.get(WIDGET_IDS.latencyByAgent)?.data)

  const agents: OrgAgentRow[] = (agentsQuery.data ?? []).map((a) => {
    const pickup = pickupByAgent.get(a.id)
    return {
      id: a.id,
      name: a.display_name || a.name,
      is_active: a.is_active,
      calls: callsByAgent.get(a.id) ?? null,
      pickupPct: pickup === undefined ? null : pickup * 100,
      latency: latencyByAgent.get(a.id) ?? null,
    }
  })

  const pickupRate = firstValue(results.get(WIDGET_IDS.pickupRate)?.data)
  const data: OrgOverviewData = {
    totalCalls: firstValue(results.get(WIDGET_IDS.totalCalls)?.data),
    pickupPct: pickupRate === null ? null : pickupRate * 100,
    avgLatency: firstValue(results.get(WIDGET_IDS.avgLatency)?.data),
    billingMinutes: firstValue(results.get(WIDGET_IDS.billingMinutes)?.data),
    agents,
  }

  return { data, isLoading: isLoading || agentsQuery.isLoading, error: error ?? (agentsQuery.error as Error | null) }
}
