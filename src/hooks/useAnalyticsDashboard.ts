/**
 * Loading and saving one agent's dashboard — Confluence "Analytics Phase 1 and
 * 2 — Build Spec" §9.1.
 *
 * All the charts go out in one request. Eight charts as eight requests would be
 * eight database connections out of sixty, and a browser only runs about six at
 * a time per site, so they would queue twice before Postgres ever saw them.
 */
'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Dashboard, Widget, WidgetResult, CatalogField } from '@/types/analytics'
import type { FilterNodeInput } from '@/server/analytics/spec'

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
  } catch {
    // fetch only rejects when the request never got an answer — offline, the
    // server restarting, a dropped connection. "Failed to fetch" is the
    // browser's words for that and it tells nobody anything.
    throw new Error('Could not reach the server. Check your connection and try again — nothing was lost.')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.error ?? `Something went wrong (${res.status})`)
  return body as T
}

type DashboardPayload = {
  dashboard: Dashboard
  widgets: Widget[]
  agent: { id: string; name: string }
  can_edit: boolean
  download_disabled: boolean
}

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
 * Runs the charts on the dashboard — Confluence §9.1.
 *
 * Two constraints pull against each other here.
 *
 * One request per chart is what a cache wants: change one chart, refetch one
 * chart. But eight charts is eight database connections out of sixty, and a
 * browser runs about six requests at a time per origin, so they queue twice
 * before Postgres sees them. §9.1 rules it out.
 *
 * One request for the whole dashboard fixes that and creates the opposite
 * problem: editing a single chart re-runs all twelve, which on this data was
 * 3.3 seconds of disk-bound queries to redraw one card.
 *
 * So: one request, carrying only the charts whose answer actually changed.
 * Results are kept per chart and merged, so editing one card re-queries one
 * card while the other eleven keep the numbers they already had. Changing the
 * date range, the filters or the hours invalidates everything, because it
 * genuinely does.
 */
export function useChartData(
  agentId: string | undefined,
  widgets: Widget[],
  range: { from: string; to: string } | { days: number } | undefined,
  filters: FilterNodeInput[],
  when: { timeOfDay: { from: string; to: string } | null; days: number[] },
  enabled: boolean
) {
  const [byWidget, setByWidget] = useState<Map<string, WidgetResult>>(new Map())
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  /** widget id → the spec we last have an answer for. */
  const answered = useRef(new Map<string, string>())
  const lastContext = useRef<string | null>(null)

  const context = JSON.stringify({ agentId, range, filters, when })
  const signature = useMemo(() => widgets.map((w) => `${w.id}:${JSON.stringify(w.spec)}`).join('|'), [widgets])

  const run = useCallback(
    async (force: boolean) => {
      if (!enabled || !agentId || widgets.length === 0) return

      const contextChanged = lastContext.current !== context
      const specOf = (w: Widget) => JSON.stringify(w.spec)
      const stale = widgets.filter((w) => force || contextChanged || answered.current.get(w.id) !== specOf(w))

      // a card that has not been touched keeps the number it already had
      if (stale.length === 0) {
        setByWidget((prev) => prune(prev, widgets))
        return
      }

      setIsFetching(true)
      setError(null)
      try {
        const body = await json<{ widgets: WidgetResult[] }>(`/api/analytics/query`, {
          method: 'POST',
          body: JSON.stringify({
            agentId,
            range,
            filters,
            time_of_day: when.timeOfDay,
            days_of_week: when.days,
            widgets: stale.map((w) => ({ id: w.id, spec: w.spec })),
          }),
        })
        lastContext.current = context
        for (const w of stale) answered.current.set(w.id, specOf(w))
        setByWidget((prev) => {
          const next = contextChanged ? new Map<string, WidgetResult>() : new Map(prev)
          for (const r of body.widgets) next.set(r.widget_id, r)
          return prune(next, widgets)
        })
      } catch (err) {
        setError(err as Error)
      } finally {
        setIsFetching(false)
      }
    },
    [agentId, context, enabled, filters, range, when, widgets]
  )

  useEffect(() => {
    if (!enabled) return
    // settings change on every keystroke and every dropdown; wait for the
    // person to stop before asking the database anything
    const timer = setTimeout(() => { run(false) }, 250)
    return () => clearTimeout(timer)
    // `signature` and `context` are the real inputs; `run` closes over both
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, context, enabled])

  const isLoading = isFetching && byWidget.size === 0

  return { byWidget, isFetching, isLoading, error, refetch: () => run(true) }
}

/** Drop answers for charts that are no longer on the dashboard. */
function prune(results: Map<string, WidgetResult>, widgets: Widget[]): Map<string, WidgetResult> {
  const live = new Set(widgets.map((w) => w.id))
  if ([...results.keys()].every((id) => live.has(id))) return results
  return new Map([...results].filter(([id]) => live.has(id)))
}

/** Walks the export a page at a time, following the cursor, and hands back one file. */
/** The dashboard's own controls — Period, filter chips, When — narrowed into whatever a chart or a drill/export request reads. */
export type DashboardContext = {
  range: { from: string; to: string } | { days: number }
  filters: FilterNodeInput[]
  time_of_day: { from: string; to: string } | null
  days_of_week: number[] | null
}

export function useCsvExport(agentId: string | undefined) {
  const [state, setState] = useState<{ busy: boolean; rows: number; error?: string }>({ busy: false, rows: 0 })

  const run = useCallback(
    async (spec: unknown, dimensionValue: string | null | undefined, filename: string, dashboard?: DashboardContext) => {
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
            body: JSON.stringify({
              agentId,
              spec,
              dimensionValue,
              cursor,
              filters: dashboard?.filters,
              range: dashboard?.range,
              time_of_day: dashboard?.time_of_day,
              days_of_week: dashboard?.days_of_week,
            }),
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
