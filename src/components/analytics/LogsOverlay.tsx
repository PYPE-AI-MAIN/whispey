/**
 * The calls behind a bar — Confluence "Analytics Phase 1 and 2 — Build Spec"
 * §10.7, and the thing people actually use on a phone.
 *
 * The line under the title is the point of it: somebody who expected 1,847 and
 * sees 340 needs to be told why on the screen that shows the 340, not in a
 * document.
 */
'use client'
import React, { useEffect, useState } from 'react'
import { ArrowUpRight, Download, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Widget } from '@/types/analytics'
import { useCsvExport, type DashboardContext } from '@/hooks/useAnalyticsDashboard'

type Row = {
  id: string
  call_id: string
  customer_number: string | null
  started_at: string | null
  call_ended_at: string | null
  duration_seconds: number | null
  call_ended_reason: string | null
  series?: string | null
}

export function LogsOverlay({
  agentId, projectId, widget, dimensionValue, open, onClose, downloadDisabled, chartTotal, grainLabel, seriesLabel, dashboard,
}: Readonly<{
  agentId: string
  /** Needed to link a row to its call. */
  projectId: string
  /** "Every call", or "One per patient" — whatever this chart is counting one of. */
  grainLabel: string
  /** What the chart splits by, for the column heading. */
  seriesLabel?: string | null
  widget: Widget | null
  /** undefined = every row behind the chart; null = the rows with no value. */
  dimensionValue: string | null | undefined
  open: boolean
  onClose: () => void
  downloadDisabled: boolean
  chartTotal?: number
  /**
   * The Period control, filter chips and When above the canvas — without
   * these the rows here were the chart's own saved defaults (a starter chart
   * says 7 days) instead of what the card on screen is actually showing, and
   * "the row count under a bar always equals the bar" stopped being true the
   * moment anyone touched the Period control.
   */
  dashboard: DashboardContext
}>) {
  const [rows, setRows] = useState<Row[]>([])
  const [cursor, setCursor] = useState<{ startedAt: string; id: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const csv = useCsvExport(agentId)

  const load = React.useCallback(
    async (next: { startedAt: string; id: string } | null) => {
      if (!widget) return
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/analytics/drill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId,
            spec: widget.spec,
            dimensionValue,
            cursor: next,
            filters: dashboard.filters,
            range: dashboard.range,
            time_of_day: dashboard.time_of_day,
            days_of_week: dashboard.days_of_week,
          }),
        }).catch(() => {
          throw new Error('Could not reach the server. Check your connection and try again.')
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body?.error ?? 'Could not load these calls')
        setRows((prev) => (next ? [...prev, ...body.rows] : body.rows))
        setCursor(body.nextCursor)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [agentId, widget, dimensionValue, dashboard]
  )

  useEffect(() => {
    if (open) {
      setRows([])
      setCursor(null)
      load(null)
    }
  }, [open, load])

  const grain = widget?.spec.grain ?? 'interaction'
  const winnerLabel = widget?.spec.dedupe?.winner === 'most_recent' ? 'most recent attempt' : 'best outcome'
  // the breakdown column earns its space only when the rows differ in it
  const showSeries = Boolean(widget?.spec.dimension) && dimensionValue === undefined

  /**
   * The call itself, in a new tab — the dashboard you were reading is still
   * there when you come back, filters, scroll position and all.
   */
  const openCall = (id: string) =>
    window.open(`/${projectId}/agents/${agentId}/observability?session_id=${id}`, '_blank', 'noopener')

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      {/* both max-w-6xl AND sm:max-w-6xl: the base DialogContent sets
          sm:max-w-lg, and tailwind-merge only dedupes within the same
          variant bucket — a bare max-w-6xl doesn't touch an sm: one, so
          without this the dialog stayed capped at 32rem on every real
          screen no matter what unprefixed max-w- class was added here */}
      <DialogContent className="max-h-[85vh] max-w-6xl sm:max-w-6xl overflow-hidden p-0">
        <DialogHeader className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <DialogTitle className="text-base">
            {widget?.title}
            {dimensionValue !== undefined && (
              <span className="ml-2 font-normal text-gray-500">
                · {dimensionValue ?? 'no value'}
              </span>
            )}
          </DialogTitle>

          {/* stops somebody asking why they expected 1,847 */}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {grain === 'entity' ? `${grainLabel}, ${winnerLabel}` : grainLabel}
            {/* only when it actually collapsed something: "54 calls became 54
                rows" reads like a bug, because it is telling you nothing */}
            {grain === 'entity' && chartTotal && chartTotal !== rows.length
              ? ` — ${chartTotal.toLocaleString()} calls became ${rows.length.toLocaleString()} rows`
              : ''}
            {rows.length > 0 && grain !== 'entity' ? ` · ${rows.length.toLocaleString()} shown` : ''}
          </p>

          {!downloadDisabled && (
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                disabled={csv.busy || !widget}
                onClick={() => widget && csv.run(widget.spec, dimensionValue, widget.title, dashboard)}
              >
                {csv.busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-2 h-3.5 w-3.5" />}
                Export CSV
              </Button>
              {csv.error && <span className="ml-2 text-xs text-red-600">{csv.error}</span>}
            </div>
          )}
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto px-5 py-3">
          {error && <p className="py-6 text-center text-sm text-red-600">{error}</p>}
          {!error && loading && rows.length === 0 && <Skeleton className="h-40 w-full" />}
          {!error && !loading && rows.length === 0 && (
            <p className="py-10 text-center text-sm text-gray-500">No calls here.</p>
          )}

          {rows.length > 0 && (
            // border-collapse: the browser default is border-collapse: separate
            // with a couple px of border-spacing between rows — the sticky
            // thead's box doesn't cover that gap, so a sliver of the row above
            // kept peeking through above the header as you scrolled.
            <table className="w-full border-collapse text-sm">
              {/* z-10: a sticky element with no z-index still paints in DOM
                  order, so the rows scrolling underneath it — later in the
                  document — were painting on TOP of it instead of behind it */}
              {/* bg-background, not bg-white/dark:bg-gray-950: the dialog's own
                  surface is the theme's `--background` token (DialogContent
                  uses `bg-background`), and gray-950 is a close but NOT
                  identical shade — a fixed hue vs. the theme's own hue. That
                  seam is subtle but is exactly what reads as the header being
                  a separate floating panel instead of part of the table. */}
              <thead className="sticky top-0 z-10 bg-background text-left text-xs uppercase tracking-wide text-gray-400">
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="py-2 font-medium">When</th>
                  <th className="py-2 font-medium">Number</th>
                  <th className="py-2 font-medium">Length</th>
                  <th className="py-2 font-medium">Ended</th>
                  {/* the value this row landed in — pointless when every row on
                      screen has the same one, because the title already says it */}
                  {showSeries && <th className="py-2 font-medium">{seriesLabel ?? 'Value'}</th>}
                  <th className="w-8 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => openCall(r.id)}
                    className="group cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800/70 dark:hover:bg-gray-800/40"
                  >
                    <td className="whitespace-nowrap py-2 pr-4 text-gray-700 dark:text-gray-300">
                      {r.started_at ? new Date(r.started_at).toLocaleString() : '—'}
                    </td>
                    {/* about 250 of this agent's rows hold a 40-character web
                        session id here instead of a number, and unbounded it
                        pushed every other column off the dialog */}
                    <td
                      className="max-w-[10rem] truncate py-2 pr-4 tabular-nums text-gray-700 dark:text-gray-300"
                      title={r.customer_number ?? undefined}
                    >
                      {r.customer_number || '—'}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4 tabular-nums text-gray-500">{length(r.duration_seconds)}</td>
                    <td className="max-w-[9rem] truncate py-2 pr-4 text-gray-500" title={r.call_ended_reason ?? undefined}>
                      {r.call_ended_reason ?? '—'}
                    </td>
                    {showSeries && (
                      <td className="max-w-[10rem] truncate py-2 pr-4 text-gray-500" title={r.series ?? undefined}>
                        {r.series ?? '—'}
                      </td>
                    )}
                    <td className="py-2 text-right">
                      <ArrowUpRight className="h-3.5 w-3.5 text-gray-300 opacity-0 transition group-hover:opacity-100 dark:text-gray-600" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {cursor && (
            <div className="pt-3 text-center">
              <Button variant="outline" size="sm" disabled={loading} onClick={() => load(cursor)}>
                {loading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                Load more
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** A call length nobody has to convert in their head. */
function length(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—'
  const whole = Math.round(seconds)
  if (whole < 60) return `${whole}s`
  return `${Math.floor(whole / 60)}m ${String(whole % 60).padStart(2, '0')}s`
}
