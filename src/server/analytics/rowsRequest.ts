/**
 * Shared by drill-down and export — Confluence "Analytics Phase 1 and 2 — Build
 * Spec" §9.4. Both walk exactly the same rows the chart counted, which is what
 * makes "340 appointments" and the list underneath it agree.
 *
 * Paged by key, never by OFFSET: a deep OFFSET re-reads and discards everything
 * before it, and rows arriving mid-export shift the window so pages silently
 * repeat or skip. Ordering by (call_started_at, id) and continuing from the last
 * row read has neither problem.
 */
import { z } from 'zod'
import { Spec, FilterNode } from './spec'
import { buildQuery, type Ctx, type Target } from './buildQuery'
import { runQuery } from './db'
import { outcomeOrderFor } from './context'

export const RowsBody = z.object({
  agentId: z.string().uuid(),
  spec: z.unknown(),
  /** Which bar was clicked. null means the empty bucket, which is a real answer. */
  dimensionValue: z.string().nullable().optional(),
  cursor: z.object({ startedAt: z.string(), id: z.string().uuid() }).nullable().optional(),
  limit: z.number().int().min(1).max(5000).optional(),
  // The dashboard's own controls — Period, filter chips, When — the same ones
  // /api/analytics/query merges into every chart. A saved widget carries its
  // own default range (a starter chart says 7 days); without these the row
  // list under a bar stopped matching the bar the moment anyone changed the
  // Period control above the canvas, because the drill request never heard
  // about it.
  filters: z.array(FilterNode).max(50).optional(),
  range: z.union([z.object({ days: z.number().int().min(1).max(730) }), z.object({ from: z.string(), to: z.string() })]).optional(),
  time_of_day: z.object({ from: z.string(), to: z.string() }).nullable().optional(),
  days_of_week: z.array(z.number().int().min(1).max(7)).max(7).nullable().optional(),
})

export const ROW_COLUMNS = [
  'id', 'call_id', 'customer_number', 'started_at', 'call_ended_at',
  'duration_seconds', 'call_ended_reason',
] as const

export async function fetchRowPage(
  body: z.infer<typeof RowsBody>,
  ctx: Ctx,
  outcomeRanking: unknown,
  target: Target
): Promise<{ rows: Record<string, unknown>[]; nextCursor: { startedAt: string; id: string } | null }> {
  const spec = Spec.parse({
    ...(body.spec as object),
    // same merge /api/analytics/query does: the dashboard narrows, the chart
    // can narrow further, and the dashboard's Period overrides the chart's own
    having: [...(((body.spec as { having?: unknown[] }).having ?? []) as never[]), ...(body.filters ?? [])],
    ...(body.range ? { range: body.range } : {}),
    ...(body.time_of_day ? { time_of_day: body.time_of_day } : {}),
    ...(body.days_of_week?.length ? { days_of_week: body.days_of_week } : {}),
  })
  if (spec.dedupe?.ranking_ref === 'agent' && !spec.dedupe.ranking?.length) {
    const order = outcomeOrderFor(outcomeRanking)
    if (!order?.length) throw new Error('This agent has no outcome order set yet')
    spec.dedupe.ranking = order
  }

  const limit = body.limit ?? (target === 'export' ? 2000 : 100)
  const { sql, params } = buildQuery(spec, ctx, target, {
    // only narrow by the clicked bar when the caller actually clicked one —
    // `undefined` means "all rows", `null` means "the empty bucket"
    ...(body.dimensionValue === undefined ? {} : { dimensionValue: body.dimensionValue }),
    ...(body.cursor ? { cursor: body.cursor } : {}),
    limit,
  })

  const rows = await runQuery(sql, params, target === 'export' ? 30_000 : 10_000)
  const last = rows.length === limit ? rows.at(-1) : null
  const nextCursor = last
    ? { startedAt: new Date(last.started_at as string).toISOString(), id: String(last.id) }
    : null
  return { rows, nextCursor }
}
