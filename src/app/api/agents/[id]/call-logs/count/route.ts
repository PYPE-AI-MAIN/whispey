import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { createServiceRoleClient } from '@/lib/supabase-server'
import type { Filter } from '@/lib/supabase-query-types'

const supabase = createServiceRoleClient()

// Mirrors the filter application used by /api/data/supabase-select — the RPC
// (get_call_logs_with_distinct) has no count-mode variant, so an accurate
// pre-download estimate is built by replaying the same pre/post-distinct
// filters directly against the table with a HEAD count query. This ignores
// p_distinct_column: a DISTINCT ON in the real query can only ever reduce the
// row count further, so this is an upper-bound estimate, not an exact match.
function applyFilters(query: any, filters: Filter[]) {
  let q = query
  for (const filter of filters) {
    switch (filter.operator) {
      case 'eq': q = q.eq(filter.column, filter.value); break
      case 'neq':
      case '<>': q = q.neq(filter.column, filter.value); break
      case 'gt': q = q.gt(filter.column, filter.value); break
      case 'gte': q = q.gte(filter.column, filter.value); break
      case 'lt': q = q.lt(filter.column, filter.value); break
      case 'lte': q = q.lte(filter.column, filter.value); break
      case 'like': q = q.like(filter.column, filter.value as string); break
      case 'ilike': q = q.ilike(filter.column, filter.value as string); break
      case 'in': q = q.in(filter.column, filter.value as unknown[]); break
      case 'not.is': q = q.not(filter.column, 'is', filter.value); break
      default: break
    }
  }
  return q
}

/**
 * GET /api/agents/[id]/call-logs/count
 * Returns the total number of call logs for the given agent + optional date range.
 * Uses a HEAD-only query (no rows transferred) — very fast.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  // Build count query — no rows fetched, just the count header
  let query = supabase
    .from('pype_voice_call_logs')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId)

  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo)   query = query.lte('created_at', dateTo)

  const { count, error } = await query

  if (error) {
    console.error('call-logs count error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ count: count ?? 0 })
}

/**
 * POST /api/agents/[id]/call-logs/count
 * Accurate pre-download count estimate — mirrors the query route's rich
 * filter shape (pre/post-distinct filters + date range) so the download
 * dialog can show a real row count for the selected export scope.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  let query = supabase
    .from('pype_voice_call_logs')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId)

  if (dateFrom) query = query.gte('call_started_at', `${dateFrom} 00:00:00`)
  if (dateTo) query = query.lte('call_started_at', `${dateTo} 23:59:59.999`)

  query = applyFilters(query, preFilters)
  query = applyFilters(query, postFilters)

  const { count, error } = await query

  if (error) {
    console.error('call-logs count (POST) error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ count: count ?? 0 })
}
