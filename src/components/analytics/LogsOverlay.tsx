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
import { Download, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Widget } from '@/types/analytics'
import { useCsvExport } from '@/hooks/useAnalyticsDashboard'

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
  agentId, widget, dimensionValue, open, onClose, downloadDisabled, chartTotal,
}: {
  agentId: string
  widget: Widget | null
  /** undefined = every row behind the chart; null = the rows with no value. */
  dimensionValue: string | null | undefined
  open: boolean
  onClose: () => void
  downloadDisabled: boolean
  chartTotal?: number
}) {
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
          body: JSON.stringify({ agentId, spec: widget.spec, dimensionValue, cursor: next }),
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
    [agentId, widget, dimensionValue]
  )

  useEffect(() => {
    if (open) {
      setRows([])
      setCursor(null)
      void load(null)
    }
  }, [open, load])

  const grain = widget?.spec.grain ?? 'interaction'

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-hidden p-0">
        <DialogHeader className="border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <DialogTitle className="text-base">
            {widget?.title}
            {dimensionValue !== undefined && (
              <span className="ml-2 font-normal text-gray-500">
                · {dimensionValue === null ? 'no value' : dimensionValue}
              </span>
            )}
          </DialogTitle>

          {/* stops somebody asking why they expected 1,847 */}
          {grain === 'entity' && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              One per appointment, best outcome
              {chartTotal ? ` — ${chartTotal.toLocaleString()} calls became ${rows.length.toLocaleString()} rows` : ''}
            </p>
          )}

          {!downloadDisabled && (
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                disabled={csv.busy || !widget}
                onClick={() => widget && csv.run(widget.spec, dimensionValue, widget.title)}
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
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="pb-2 font-medium">When</th>
                  <th className="pb-2 font-medium">Number</th>
                  <th className="pb-2 font-medium">Length</th>
                  <th className="pb-2 font-medium">Ended</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="py-1.5 whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {r.started_at ? new Date(r.started_at).toLocaleString() : '—'}
                    </td>
                    <td className="py-1.5 tabular-nums text-gray-700 dark:text-gray-300">{r.customer_number ?? '—'}</td>
                    <td className="py-1.5 tabular-nums text-gray-500">
                      {r.duration_seconds ? `${Math.round(r.duration_seconds)}s` : '—'}
                    </td>
                    <td className="py-1.5 text-gray-500">{r.call_ended_reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {cursor && (
            <div className="pt-3 text-center">
              <Button variant="outline" size="sm" disabled={loading} onClick={() => void load(cursor)}>
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
