/**
 * Charts built on the Journeys tab, shared by everyone on the project and kept
 * per campaign. One row per chart (pype_journey_charts) so two people adding
 * charts at once can't overwrite each other; viewers can read but not change.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { guarded } from '@/server/analytics/guard'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { resolveProjectAnalyticsContext, isDenied } from '@/server/analytics/context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabase = createServiceRoleClient()
const MAX_CHARTS_PER_CAMPAIGN = 30
const COLUMNS = 'id, dimension, metric, kind, position, created_at'

const ChartInput = z.object({
  dimension: z.string().min(1).max(120),
  metric: z.enum(['events', 'journeys']),
  kind: z.enum(['bar', 'line', 'pie']),
})

const Scope = z.object({ projectId: z.string().uuid(), campaignId: z.string().uuid() })

async function campaignInProject(projectId: string, campaignId: string) {
  const { data } = await supabase.from('pype_campaigns').select('id').eq('id', campaignId).eq('project_id', projectId).maybeSingle()
  return !!data
}

async function listCharts(projectId: string, campaignId: string) {
  const { data } = await supabase
    .from('pype_journey_charts')
    .select(COLUMNS)
    .eq('project_id', projectId)
    .eq('campaign_id', campaignId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
  return data ?? []
}

export const GET = guarded('journeys/charts', async (req: NextRequest) => {
  const parsed = Scope.safeParse({ projectId: req.nextUrl.searchParams.get('projectId'), campaignId: req.nextUrl.searchParams.get('campaignId') })
  if (!parsed.success) return NextResponse.json({ error: 'projectId and campaignId are required' }, { status: 400 })
  const { projectId, campaignId } = parsed.data

  const resolved = await resolveProjectAnalyticsContext(projectId)
  if (isDenied(resolved)) return resolved.errorResponse
  if (!(await campaignInProject(projectId, campaignId))) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  return NextResponse.json({ charts: await listCharts(projectId, campaignId), canEdit: resolved.role !== 'viewer' })
})

const CreateBody = Scope.extend({ charts: z.array(ChartInput).min(1).max(MAX_CHARTS_PER_CAMPAIGN) })

/** Adds one or more charts. A list is how a browser's old local charts are imported the first time. */
export const POST = guarded('journeys/charts', async (req: NextRequest) => {
  const parsed = CreateBody.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Bad request', detail: parsed.error.flatten() }, { status: 400 })
  const { projectId, campaignId, charts } = parsed.data

  const resolved = await resolveProjectAnalyticsContext(projectId)
  if (isDenied(resolved)) return resolved.errorResponse
  if (resolved.role === 'viewer') return NextResponse.json({ error: 'You can view these charts but not change them' }, { status: 403 })
  if (!(await campaignInProject(projectId, campaignId))) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const existing = await listCharts(projectId, campaignId)
  if (existing.length + charts.length > MAX_CHARTS_PER_CAMPAIGN) {
    return NextResponse.json({ error: `A campaign can have up to ${MAX_CHARTS_PER_CAMPAIGN} charts. Remove one first.` }, { status: 400 })
  }

  const { userId } = await auth()
  const start = existing.reduce((m, c) => Math.max(m, c.position), -1) + 1
  const { error } = await supabase.from('pype_journey_charts').insert(
    charts.map((c, i) => ({ project_id: projectId, campaign_id: campaignId, ...c, position: start + i, created_by: userId }))
  )
  if (error) {
    console.error('[journeys/charts] insert failed', error)
    return NextResponse.json({ error: 'Could not save the chart' }, { status: 500 })
  }
  return NextResponse.json({ charts: await listCharts(projectId, campaignId) }, { status: 201 })
})

const PatchBody = z.object({ projectId: z.string().uuid(), id: z.string().uuid(), kind: z.enum(['bar', 'line', 'pie']) })

export const PATCH = guarded('journeys/charts', async (req: NextRequest) => {
  const parsed = PatchBody.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  const { projectId, id, kind } = parsed.data

  const resolved = await resolveProjectAnalyticsContext(projectId)
  if (isDenied(resolved)) return resolved.errorResponse
  if (resolved.role === 'viewer') return NextResponse.json({ error: 'You can view these charts but not change them' }, { status: 403 })

  const { data, error } = await supabase.from('pype_journey_charts').update({ kind }).eq('id', id).eq('project_id', projectId).select(COLUMNS).maybeSingle()
  if (error) {
    console.error('[journeys/charts] update failed', error)
    return NextResponse.json({ error: 'Could not update the chart' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Chart not found' }, { status: 404 })
  return NextResponse.json({ chart: data })
})

export const DELETE = guarded('journeys/charts', async (req: NextRequest) => {
  const parsed = z.object({ projectId: z.string().uuid(), id: z.string().uuid() }).safeParse({
    projectId: req.nextUrl.searchParams.get('projectId'),
    id: req.nextUrl.searchParams.get('id'),
  })
  if (!parsed.success) return NextResponse.json({ error: 'projectId and id are required' }, { status: 400 })
  const { projectId, id } = parsed.data

  const resolved = await resolveProjectAnalyticsContext(projectId)
  if (isDenied(resolved)) return resolved.errorResponse
  if (resolved.role === 'viewer') return NextResponse.json({ error: 'You can view these charts but not change them' }, { status: 403 })

  const { error } = await supabase.from('pype_journey_charts').delete().eq('id', id).eq('project_id', projectId)
  if (error) {
    console.error('[journeys/charts] delete failed', error)
    return NextResponse.json({ error: 'Could not remove the chart' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
})
