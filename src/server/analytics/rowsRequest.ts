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
import { Spec } from './spec'
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
  const spec = Spec.parse(body.spec)
  if (spec.dedupe?.ranking_ref === 'agent' && !spec.dedupe.ranking?.length) {
    const order = outcomeOrderFor(outcomeRanking)
    if (!order?.length) throw new Error('This agent has no outcome order set yet')
    spec.dedupe.ranking = order
  }

  const limit = body.limit ?? (target === 'export' ? 2000 : 100)
  const { sql, params } = buildQuery(spec, ctx, target, {
    // only narrow by the clicked bar when the caller actually clicked one —
    // `undefined` means "all rows", `null` means "the empty bucket"
    ...(body.dimensionValue !== undefined ? { dimensionValue: body.dimensionValue } : {}),
    ...(body.cursor ? { cursor: body.cursor } : {}),
    limit,
  })

  const rows = (await runQuery(sql, params, target === 'export' ? 30_000 : 10_000)) as Record<string, unknown>[]
  const last = rows.length === limit ? rows[rows.length - 1] : null
  const nextCursor = last
    ? { startedAt: new Date(last.started_at as string).toISOString(), id: String(last.id) }
    : null
  return { rows, nextCursor }
}
