/**
 * The dashboard behind an agent's Overview page — Confluence "Analytics Phase 1
 * and 2 — Build Spec" §6.1, §10.10.
 *
 * There is exactly one shared dashboard per agent, and it is created the first
 * time somebody opens the page, seeded with the starter charts. That is the
 * answer to "where does a new dashboard come from": nobody creates one, and
 * nobody ever lands on a blank page.
 */
import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/server/analytics/guard'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { Spec } from '@/server/analytics/spec'
import { STARTER_CHARTS } from '@/server/analytics/starterCharts'
import { resolveAnalyticsContext, isDenied } from '@/server/analytics/context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabase = createServiceRoleClient()

export const GET = guarded('analytics/dashboard', async (req: NextRequest) => {
  const agentId = req.nextUrl.searchParams.get('agentId')
  if (!agentId) return NextResponse.json({ error: 'agentId is required' }, { status: 400 })

  const resolved = await resolveAnalyticsContext(agentId)
  if (isDenied(resolved)) return resolved.errorResponse
  const { agent, role, downloadDisabled } = resolved

  let { data: dashboard } = await supabase
    .from('pype_analytics_dashboards')
    .select('*')
    .eq('agent_id', agentId)
    .eq('scope', 'agent')
    .eq('visibility', 'shared')
    .maybeSingle()

  if (!dashboard) {
    const created = await supabase
      .from('pype_analytics_dashboards')
      .insert({ project_id: agent.projectId, agent_id: agentId, scope: 'agent', visibility: 'shared', name: 'Overview' })
      .select('*')
      .single()
    // two people opening the page at once: the unique index means one insert
    // loses, and the loser reads what the winner made
    if (created.error) {
      const retry = await supabase
        .from('pype_analytics_dashboards')
        .select('*')
        .eq('agent_id', agentId)
        .eq('scope', 'agent')
        .eq('visibility', 'shared')
        .maybeSingle()
      if (!retry.data) {
        console.error('[analytics/dashboard] create failed', created.error)
        return NextResponse.json({ error: 'Could not open this dashboard' }, { status: 500 })
      }
      dashboard = retry.data
    } else {
      dashboard = created.data
      await supabase.from('pype_analytics_widgets').insert(
        STARTER_CHARTS.map((c, i) => ({
          dashboard_id: dashboard!.id,
          title: c.title,
          kind: c.kind,
          spec: c.spec,
          layout: c.layout,
          position: i,
          is_seeded: true,
        }))
      )
    }
  }

  const { data: widgets } = await supabase
    .from('pype_analytics_widgets')
    .select('*')
    .eq('dashboard_id', dashboard.id)
    .order('position', { ascending: true })

  return NextResponse.json({
    dashboard,
    widgets: widgets ?? [],
    agent: { id: agent.id, name: agent.name },
    can_edit: role !== 'viewer',
    // the export route refuses anyway; this stops the button appearing at all
    download_disabled: downloadDisabled,
  })
})

const SaveBody = z.object({
  agentId: z.string().uuid(),
  dashboardId: z.string().uuid(),
  /** What the browser last read. A save against an older number is refused rather than overwriting. */
  version: z.number().int().min(1),
  defaults: z.record(z.unknown()).optional(),
  widgets: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        title: z.string().min(1).max(120),
        kind: z.enum(['kpi', 'bar', 'line', 'table', 'pie', 'text']),
        spec: z.unknown(),
        // a rectangle on the twelve-column grid. `width` is the pre-grid shape,
        // still accepted so an older client cannot fail to save.
        layout: z.union([
          z.object({
            x: z.number().int().min(0).max(11),
            y: z.number().int().min(0).max(500),
            w: z.number().int().min(1).max(12),
            h: z.number().int().min(1).max(40),
          }),
          z.object({ width: z.enum(['quarter', 'half', 'full']) }),
        ]),
        position: z.number().int().min(0),
        is_seeded: z.boolean().optional(),
      })
    )
    .max(40),
})

export const PUT = guarded('analytics/dashboard', async (req: NextRequest) => {
  const parsed = SaveBody.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Bad request', detail: parsed.error.flatten() }, { status: 400 })
  const body = parsed.data

  const resolved = await resolveAnalyticsContext(body.agentId)
  if (isDenied(resolved)) return resolved.errorResponse
  if (resolved.role === 'viewer') return NextResponse.json({ error: 'You can view this dashboard but not change it' }, { status: 403 })

  // every chart is validated before it is stored, so a saved dashboard can
  // never contain something the query builder will refuse later. A text block
  // is not a chart at all — it never reaches buildQuery — so it gets its own,
  // much smaller check instead of the full query Spec.
  const TextSpec = z.object({ text: z.string().max(4000) })
  for (const w of body.widgets) {
    const check = w.kind === 'text' ? TextSpec.safeParse(w.spec) : Spec.safeParse(w.spec)
    if (!check.success) {
      return NextResponse.json({ error: `"${w.title}" is not a valid chart`, detail: check.error.flatten() }, { status: 400 })
    }
  }

  const bumped = await supabase
    .from('pype_analytics_dashboards')
    .update({ version: body.version + 1, ...(body.defaults ? { defaults: body.defaults } : {}) })
    .eq('id', body.dashboardId)
    .eq('agent_id', body.agentId)
    .eq('version', body.version)
    .select('id, version')
    .maybeSingle()

  if (!bumped.data) {
    return NextResponse.json(
      { error: 'Somebody else saved this dashboard while you were editing. Reload to see their changes.' },
      { status: 409 }
    )
  }

  // Every row must carry the same keys: PostgREST refuses a batch where some
  // objects have `id` and some do not, which is what a dashboard with one new
  // chart on it looks like. Minting the id here keeps one uniform upsert.
  const rows = body.widgets.map((w) => ({
    id: w.id ?? randomUUID(),
    dashboard_id: body.dashboardId,
    title: w.title,
    kind: w.kind,
    spec: w.spec,
    layout: w.layout,
    position: w.position,
    is_seeded: w.is_seeded ?? false,
  }))

  // Write first, then remove what is no longer on the dashboard. PostgREST has
  // no transaction across two calls, so the order decides what a half-failure
  // leaves behind: delete-then-insert can empty a dashboard and then fail to
  // refill it. This way the worst case is a few stale rows, not a blank page.
  const { error: upError } = await supabase.from('pype_analytics_widgets').upsert(rows)

  const removal = supabase.from('pype_analytics_widgets').delete().eq('dashboard_id', body.dashboardId)
  let delError: typeof upError = null
  if (!upError) {
    const result = rows.length ? await removal.not('id', 'in', `(${rows.map((r) => r.id).join(',')})`) : await removal
    delError = result.error
  }

  if (delError || upError) {
    const failure = delError ?? upError
    console.error('[analytics/dashboard] save failed', failure)
    return NextResponse.json(
      // the version was already bumped, so the browser has to reload rather
      // than press Save again against a number the database has moved past
      { error: 'Could not save this dashboard. Reload the page and try again.', detail: failure?.message },
      { status: 500 }
    )
  }

  const { data: widgets } = await supabase
    .from('pype_analytics_widgets')
    .select('*')
    .eq('dashboard_id', body.dashboardId)
    .order('position', { ascending: true })

  return NextResponse.json({ version: bumped.data.version, widgets: widgets ?? [] })
})
