/**
 * Loading and saving one agent's dashboard — Confluence "Analytics Phase 1 and
 * 2 — Build Spec" §9.1.
 *
 * All the charts go out in one request. Eight charts as eight requests would be
 * eight database connections out of sixty, and a browser only runs about six at
 * a time per site, so they would queue twice before Postgres ever saw them.
 */
'use client'
import { useCallback, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Dashboard, Widget, WidgetResult, CatalogField } from '@/types/analytics'
import type { FilterNodeInput } from '@/server/analytics/spec'

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.error ?? 'Something went wrong')
  return body as T
}

type DashboardPayload = { dashboard: Dashboard; widgets: Widget[]; agent: { id: string; name: string }; can_edit: boolean }

export function useAnalyticsDashboard(agentId: string | undefined, enabled: boolean) {
  const queryClient = useQueryClient()

  const dashboard = useQuery({
    queryKey: ['analytics', 'dashboard', agentId],
    queryFn: () => json<DashboardPayload>(`/api/analytics/dashboard?agentId=${agentId}`),
    enabled: Boolean(agentId) && enabled,
    staleTime: 60_000,
  })

  const fields = useQuery({
    queryKey: ['analytics', 'fields', agentId],
    queryFn: () => json<{ fields: CatalogField[]; outcome_ranking: unknown }>(`/api/analytics/fields?agentId=${agentId}`),
    enabled: Boolean(agentId) && enabled,
    // the catalog changes when an agent's extractor changes, which is rare
    staleTime: 10 * 60_000,
  })

  const save = useMutation({
    mutationFn: (payload: { widgets: Omit<Widget, 'id' | 'dashboard_id' | 'live'>[] & { id?: string }[] }) =>
      json<{ version: number; widgets: Widget[] }>(`/api/analytics/dashboard`, {
        method: 'PUT',
        body: JSON.stringify({
          agentId,
          dashboardId: dashboard.data?.dashboard.id,
          version: dashboard.data?.dashboard.version,
          widgets: payload.widgets,
        }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['analytics', 'dashboard', agentId] }),
  })

  return { dashboard, fields, save }
}

/**
 * Runs every chart on the dashboard. The date range and the filter chips above
 * the canvas are applied here rather than saved into each chart, so one Period
 * change redraws everything without rewriting twelve saved objects.
 */
export function useChartData(
  agentId: string | undefined,
  widgets: Widget[],
  range: { from: string; to: string } | { days: number } | undefined,
  filters: FilterNodeInput[],
  enabled: boolean
) {
  const key = useMemo(
    () => widgets.map((w) => `${w.id}:${JSON.stringify(w.spec)}`).join('|'),
    [widgets]
  )

  const query = useQuery({
    queryKey: ['analytics', 'query', agentId, key, range, filters],
    queryFn: () =>
      json<{ widgets: WidgetResult[] }>(`/api/analytics/query`, {
        method: 'POST',
        body: JSON.stringify({
          agentId,
          range,
          filters,
          widgets: widgets.map((w) => ({ id: w.id, spec: w.spec })),
        }),
      }),
    enabled: Boolean(agentId) && widgets.length > 0 && enabled,
    staleTime: 30_000,
  })

  const byWidget = useMemo(() => {
    const map = new Map<string, WidgetResult>()
    for (const r of query.data?.widgets ?? []) map.set(r.widget_id, r)
    return map
  }, [query.data])

  return { ...query, byWidget }
}

/** Walks the export a page at a time, following the cursor, and hands back one file. */
export function useCsvExport(agentId: string | undefined) {
  const [state, setState] = useState<{ busy: boolean; rows: number; error?: string }>({ busy: false, rows: 0 })

  const run = useCallback(
    async (spec: unknown, dimensionValue: string | null | undefined, filename: string) => {
      if (!agentId) return
      setState({ busy: true, rows: 0 })
      const parts: string[] = []
      let cursor: unknown = null
      try {
        // a stream would hold a serverless function and a database connection
        // for the whole download, and die halfway on a slow connection
        for (let page = 0; page < 200; page++) {
          const res = await fetch('/api/analytics/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId, spec, dimensionValue, cursor }),
          })
          if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? 'Export failed')
          parts.push(await res.text())
          const next = res.headers.get('X-Next-Cursor')
          if (!next) break
          cursor = JSON.parse(atob(next))
          setState((s) => ({ ...s, rows: s.rows + 1 }))
        }
        const blob = new Blob(parts, { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
        a.click()
        URL.revokeObjectURL(url)
        setState({ busy: false, rows: 0 })
      } catch (err) {
        setState({ busy: false, rows: 0, error: (err as Error).message })
      }
    },
    [agentId]
  )

  return { ...state, run }
}
