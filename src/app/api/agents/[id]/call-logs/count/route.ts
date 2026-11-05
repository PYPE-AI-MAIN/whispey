import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { createServiceRoleClient } from '@/lib/supabase-server'
import type { Filter } from '@/lib/supabase-query-types'
import { withDataPlane, rethrowDataPlane } from '@/server/data-plane'

const supabase = createServiceRoleClient()

// The RPC (get_call_logs_with_distinct) has no count-mode variant, so the POST
// estimate replays the same pre/post-distinct filters as a HEAD count query. It
// ignores p_distinct_column: a DISTINCT ON can only reduce the count further, so
// this is an upper bound, not an exact match.

/**
 * GET /api/agents/[id]/call-logs/count
 * Returns the total number of call logs for the given agent + optional date range.
 * Uses a HEAD-only query (no rows transferred) — very fast.
 */
export const GET = withDataPlane(async (
  dp,
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: agentId } = await params

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Resolve project and check access
  const { data: agentRow, error: agentErr } = await supabase
    .from('pype_voice_agents')
    .select('project_id')
    .eq('id', agentId)
    .maybeSingle()

  if (agentErr || !agentRow?.project_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const access = await getProjectRoleForApi(agentRow.project_id as string)
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const dateFrom = searchParams.get('dateFrom')
  const dateTo   = searchParams.get('dateTo')

  const plane = await dp.forProject(agentRow.project_id as string)
  try {
    const count = await plane.callData.countCallLogs({
      agentIds: [agentId],
      from: dateFrom ?? undefined,
      to: dateTo ?? undefined,
    })
    return NextResponse.json({ count })
  } catch (e) {
    rethrowDataPlane(e)
    console.error('call-logs count error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
})

/**
 * POST /api/agents/[id]/call-logs/count
 * Accurate pre-download count estimate — mirrors the query route's rich
 * filter shape (pre/post-distinct filters + date range) so the download
 * dialog can show a real row count for the selected export scope.
 */
export const POST = withDataPlane(async (
  dp,
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id: agentId } = await params

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { data: agentRow, error: agentErr } = await supabase
    .from('pype_voice_agents')
    .select('project_id')
    .eq('id', agentId)
    .maybeSingle()

  if (agentErr || !agentRow?.project_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const access = await getProjectRoleForApi(agentRow.project_id as string)
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const preFilters = (body.p_pre_distinct_filters ?? []) as Filter[]
  const postFilters = (body.p_post_distinct_filters ?? []) as Filter[]
  const dateFrom = body.p_date_from as string | null | undefined
  const dateTo = body.p_date_to as string | null | undefined

  const plane = await dp.forProject(agentRow.project_id as string)
  try {
    const count = await plane.callData.countCallLogs({
      agentIds: [agentId],
      dateColumn: 'call_started_at',
      from: dateFrom ? `${dateFrom} 00:00:00` : undefined,
      to: dateTo ? `${dateTo} 23:59:59.999` : undefined,
      filters: [...preFilters, ...postFilters],
    })
    return NextResponse.json({ count })
  } catch (e) {
    rethrowDataPlane(e)
    console.error('call-logs count (POST) error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }
})
