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
import { planDashboardQueries, SpecError, InternalSpecError } from '@/server/analytics/buildQuery'
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
  /** The time-of-day window above the canvas. Same rule as the filters: it narrows every chart. */
  time_of_day: z.object({ from: z.string(), to: z.string() }).nullable().optional(),
  /** Which days count, 1 = Monday to 7 = Sunday. */
  days_of_week: z.array(z.number().int().min(1).max(7)).max(7).nullable().optional(),
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

  // validate first, so an invalid chart is reported against itself rather than
  // taking down the batch it happened to share a scan with
  const results = new Map<string, WidgetResult>()
  const runnable: { id: string; spec: Spec }[] = []

  for (const widget of body.widgets) {
    try {
      const spec = Spec.parse({
        ...(widget.spec as object),
        // dashboard filters AND the chart's own: a chart may narrow further,
        // never override
        having: [...(((widget.spec as { having?: unknown[] }).having ?? []) as never[]), ...body.filters],
        ...(body.range ? { range: body.range } : {}),
        ...(body.time_of_day ? { time_of_day: body.time_of_day } : {}),
        ...(body.days_of_week?.length ? { days_of_week: body.days_of_week } : {}),
      })

      // resolved per request, which is what makes reordering the agent's
      // outcome list update every chart at once
      if (spec.dedupe?.ranking_ref === 'agent' && !spec.dedupe.ranking?.length) {
        if (!agentOutcomeOrder?.length) {
          results.set(widget.id, { widget_id: widget.id, status: 'error', error: 'This agent has no outcome order set yet' })
          continue
        }
        spec.dedupe.ranking = agentOutcomeOrder
      }
      runnable.push({ id: widget.id, spec })
    } catch (err) {
      results.set(widget.id, { widget_id: widget.id, status: 'error', error: explain(err, widget.id) })
    }
  }

  // charts that read the same rows under the same rules answer in one statement
  const plans = runnable.length ? planDashboardQueries(runnable, ctx) : []

  await Promise.all(
    plans.map(async (plan) => {
      const fail = (status: WidgetResult['status'], error: string) => {
        for (const id of plan.members) results.set(id, { widget_id: id, status, error })
      }
      if (Date.now() - startedAt > BATCH_DEADLINE_MS) {
        fail('skipped', 'Ran out of time — reload to try this chart again')
        return
      }
      try {
        const rows = await runQuery(plan.sql, plan.params, PER_CHART_TIMEOUT_MS)
        plan.members.forEach((id, index) => {
          results.set(id, {
            widget_id: id,
            status: 'ok',
            data: unpack(rows, plan.members.length > 1 ? index : null),
            meta: plan.meta,
          })
        })
      } catch (err) {
        if (isTimeout(err)) {
          fail('timeout', 'This chart took too long. Try a shorter date range.')
          return
        }
        console.error('[analytics/query]', plan.members, err)
        fail('error', err instanceof SpecError ? err.message : 'Something went wrong drawing this chart')
      }
    })
  )

  const ordered = body.widgets.map(
    (w) => results.get(w.id) ?? { widget_id: w.id, status: 'error' as const, error: 'This chart did not run' }
  )

  return NextResponse.json({ widgets: ordered, took_ms: Date.now() - startedAt, statements: plans.length })
}


/**
 * One chart's columns out of a shared scan. `index` is null when the statement
 * answered a single chart and the columns kept their plain names.
 */
function unpack(rows: Record<string, unknown>[], index: number | null): Record<string, unknown>[] {
  if (index === null) return rows
  const suffix = `_${index}`
  return rows.map((row) => ({
    ...(row.bucket !== undefined ? { bucket: row.bucket } : {}),
    ...(row.series !== undefined ? { series: row.series } : {}),
    value: row[`value${suffix}`],
    n_rows: row[`n_rows${suffix}`],
    n_nonnull: row[`n_nonnull${suffix}`],
  }))
}

/** What to show a person, versus what to put in the log. */
function explain(err: unknown, widgetId: string): string {
  if (err instanceof SpecError) return err.message
  if (err instanceof z.ZodError) {
    console.error('[analytics/query] invalid spec', widgetId, err.flatten())
    return 'This chart needs fixing in its settings'
  }
  if (err instanceof InternalSpecError) {
    console.error('[analytics/query] compiler bug', widgetId, err.message)
    return 'Could not draw this chart. The problem has been logged.'
  }
  console.error('[analytics/query]', widgetId, err)
  return 'Something went wrong drawing this chart'
}
