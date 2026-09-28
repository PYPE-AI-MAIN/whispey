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

export type OrgAgentRow = {
  id: string
  name: string
  is_active: boolean
  calls: number | null
  successPct: number | null
  latency: number | null
}

export type OrgOverviewData = {
  totalCalls: number | null
  successPct: number | null
  avgLatency: number | null
  totalCost: number | null
  agents: OrgAgentRow[]
}

const WIDGET_IDS = {
  totalCalls: 'total_calls',
  completedCalls: 'completed_calls',
  avgLatency: 'avg_latency',
  totalCost: 'total_cost',
  callsByAgent: 'calls_by_agent',
  completedByAgent: 'completed_by_agent',
  latencyByAgent: 'latency_by_agent',
} as const

function specsFor(days: number): { id: string; spec: SpecInput }[] {
  const range = { days }
  return [
    { id: WIDGET_IDS.totalCalls, spec: { spec_version: 1, agg: { fn: 'count' }, range } },
    {
      id: WIDGET_IDS.completedCalls,
      spec: { spec_version: 1, agg: { fn: 'count' }, having: [{ field: { col: 'call_ended_reason' }, op: 'eq', value: 'completed' }], range },
    },
    { id: WIDGET_IDS.avgLatency, spec: { spec_version: 1, agg: { fn: 'avg', field: { col: 'avg_latency' } }, range } },
    { id: WIDGET_IDS.totalCost, spec: { spec_version: 1, agg: { fn: 'sum', field: { col: 'total_cost' } }, range } },
    {
      id: WIDGET_IDS.callsByAgent,
      spec: { spec_version: 1, agg: { fn: 'count' }, dimension: { field: { col: 'agent_id' } }, range },
    },
    {
      id: WIDGET_IDS.completedByAgent,
      spec: {
        spec_version: 1,
        agg: { fn: 'count' },
        dimension: { field: { col: 'agent_id' } },
        having: [{ field: { col: 'call_ended_reason' }, op: 'eq', value: 'completed' }],
        range,
      },
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

export function useOrgOverview(projectId: string | undefined, days: number, enabled: boolean) {
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
          body: JSON.stringify({ projectId, widgets: specsFor(days) }),
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
  }, [projectId, days, enabled])

  const totalCalls = firstValue(results.get(WIDGET_IDS.totalCalls)?.data)
  const completedCalls = firstValue(results.get(WIDGET_IDS.completedCalls)?.data)
  const successPct = totalCalls ? ((completedCalls ?? 0) / totalCalls) * 100 : null

  const callsByAgent = byAgent(results.get(WIDGET_IDS.callsByAgent)?.data)
  const completedByAgent = byAgent(results.get(WIDGET_IDS.completedByAgent)?.data)
  const latencyByAgent = byAgent(results.get(WIDGET_IDS.latencyByAgent)?.data)

  const agents: OrgAgentRow[] = (agentsQuery.data ?? []).map((a) => {
    const calls = callsByAgent.get(a.id) ?? null
    const completed = completedByAgent.get(a.id) ?? null
    return {
      id: a.id,
      name: a.display_name || a.name,
      is_active: a.is_active,
      calls,
      successPct: calls ? ((completed ?? 0) / calls) * 100 : null,
      latency: latencyByAgent.get(a.id) ?? null,
    }
  })

  const data: OrgOverviewData = {
    totalCalls,
    successPct,
    avgLatency: firstValue(results.get(WIDGET_IDS.avgLatency)?.data),
    totalCost: firstValue(results.get(WIDGET_IDS.totalCost)?.data),
    agents,
  }

  return { data, isLoading: isLoading || agentsQuery.isLoading, error: error ?? (agentsQuery.error as Error | null) }
}
