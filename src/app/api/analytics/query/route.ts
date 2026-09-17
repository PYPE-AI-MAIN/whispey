/**
 * Every chart on a dashboard, in one request — Confluence "Analytics Phase 1
 * and 2 — Build Spec" §9.1.
 *
 * One request per dashboard rather than one per chart, for two reasons.
 * Serverless functions do not keep connections, so eight requests means eight
 * connections against a budget of 60; and a browser only runs about six
 * requests at a time per site, so they would queue before the database ever saw
 * them.
 *
 * But one slow chart must not block the other seven, so nothing here is
 * all-or-nothing: each chart carries its own timeout and its own status, and
 * the response says which ones came back.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Spec, FilterNode } from '@/server/analytics/spec'
import { buildQuery, SpecError } from '@/server/analytics/buildQuery'
import { runQuery, isTimeout } from '@/server/analytics/db'
import { resolveAnalyticsContext, isDenied, outcomeOrderFor } from '@/server/analytics/context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Vercel allows 60s. Stop starting new charts before then and say so, rather than returning a 504 with nothing. */
const BATCH_DEADLINE_MS = 45_000
const PER_CHART_TIMEOUT_MS = 10_000

const Body = z.object({
  agentId: z.string().uuid(),
  dashboardId: z.string().uuid().optional(),
  /** The filter chips above the canvas. They narrow every chart; a chart can never widen past them. */
  filters: z.array(FilterNode).max(50).default([]),
  /** The Period control in the header. Overrides whatever range each chart was saved with. */
  range: z.union([z.object({ days: z.number().int().min(1).max(730) }), z.object({ from: z.string(), to: z.string() })]).optional(),
  widgets: z.array(z.object({ id: z.string(), spec: z.unknown() })).min(1).max(20),
})

type WidgetResult = {
  widget_id: string
  status: 'ok' | 'error' | 'timeout' | 'skipped'
  data?: unknown[]
  meta?: unknown
  error?: string
}

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad request', detail: parsed.error.flatten() }, { status: 400 })
  }
  const body = parsed.data

  const resolved = await resolveAnalyticsContext(body.agentId)
  if (isDenied(resolved)) return resolved.errorResponse
  const { ctx, agent } = resolved

  const agentOutcomeOrder = outcomeOrderFor(agent.outcomeRanking)
  const startedAt = Date.now()

  const results = await Promise.all(
    body.widgets.map(async (widget): Promise<WidgetResult> => {
      try {
        const spec = Spec.parse({
          ...(widget.spec as object),
          // dashboard filters AND the chart's own: a chart may narrow further,
          // never override
          having: [...(((widget.spec as { having?: unknown[] }).having ?? []) as never[]), ...body.filters],
          ...(body.range ? { range: body.range } : {}),
        })

        // resolved per request, which is what makes reordering the agent's
        // outcome list update every chart at once
        if (spec.dedupe?.ranking_ref === 'agent' && !spec.dedupe.ranking?.length) {
          if (!agentOutcomeOrder?.length) {
            return { widget_id: widget.id, status: 'error', error: 'This agent has no outcome order set yet' }
          }
          spec.dedupe.ranking = agentOutcomeOrder
        }

        const { sql, params, meta } = buildQuery(spec, ctx, 'aggregate')

        if (Date.now() - startedAt > BATCH_DEADLINE_MS) {
          return { widget_id: widget.id, status: 'skipped', error: 'Ran out of time — reload to try this chart again' }
        }

        const data = await runQuery(sql, params, PER_CHART_TIMEOUT_MS)
        return { widget_id: widget.id, status: 'ok', data, meta }
      } catch (err) {
        if (isTimeout(err)) {
          return { widget_id: widget.id, status: 'timeout', error: 'This chart took too long. Try a shorter date range.' }
        }
        if (err instanceof SpecError || err instanceof z.ZodError) {
          return { widget_id: widget.id, status: 'error', error: err instanceof z.ZodError ? 'This chart is not valid' : err.message }
        }
        console.error('[analytics/query]', widget.id, err)
        return { widget_id: widget.id, status: 'error', error: 'Something went wrong drawing this chart' }
      }
    })
  )

  return NextResponse.json({ widgets: results, took_ms: Date.now() - startedAt })
}
