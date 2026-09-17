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
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { Spec } from '@/server/analytics/spec'
import { STARTER_CHARTS } from '@/server/analytics/starterCharts'
import { resolveAnalyticsContext, isDenied } from '@/server/analytics/context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabase = createServiceRoleClient()

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agentId')
  if (!agentId) return NextResponse.json({ error: 'agentId is required' }, { status: 400 })

  const resolved = await resolveAnalyticsContext(agentId)
  if (isDenied(resolved)) return resolved.errorResponse
  const { agent, role } = resolved

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
  })
}

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
        kind: z.enum(['kpi', 'bar', 'line', 'table', 'pie']),
        spec: z.unknown(),
        layout: z.object({ width: z.enum(['quarter', 'half', 'full']) }),
        position: z.number().int().min(0),
        is_seeded: z.boolean().optional(),
      })
    )
    .max(40),
})

export async function PUT(req: NextRequest) {
  const parsed = SaveBody.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Bad request', detail: parsed.error.flatten() }, { status: 400 })
  const body = parsed.data

  const resolved = await resolveAnalyticsContext(body.agentId)
  if (isDenied(resolved)) return resolved.errorResponse
  if (resolved.role === 'viewer') return NextResponse.json({ error: 'You can view this dashboard but not change it' }, { status: 403 })

  // every chart is validated before it is stored, so a saved dashboard can
  // never contain something the query builder will refuse later
  for (const w of body.widgets) {
    const check = Spec.safeParse(w.spec)
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

  const keep = body.widgets.filter((w) => w.id).map((w) => w.id as string)
  const removal = supabase.from('pype_analytics_widgets').delete().eq('dashboard_id', body.dashboardId)
  const { error: delError } = keep.length
    ? await removal.not('id', 'in', `(${keep.join(',')})`)
    : await removal

  const { error: upError } = await supabase.from('pype_analytics_widgets').upsert(
    body.widgets.map((w) => ({
      ...(w.id ? { id: w.id } : {}),
      dashboard_id: body.dashboardId,
      title: w.title,
      kind: w.kind,
      spec: w.spec,
      layout: w.layout,
      position: w.position,
      is_seeded: w.is_seeded ?? false,
    }))
  )

  if (delError || upError) {
    console.error('[analytics/dashboard] save failed', delError ?? upError)
    return NextResponse.json({ error: 'Could not save this dashboard' }, { status: 500 })
  }

  const { data: widgets } = await supabase
    .from('pype_analytics_widgets')
    .select('*')
    .eq('dashboard_id', body.dashboardId)
    .order('position', { ascending: true })

  return NextResponse.json({ version: bumped.data.version, widgets: widgets ?? [] })
}
