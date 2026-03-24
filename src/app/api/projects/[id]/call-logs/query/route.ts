import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { redactTagsFromCallLogsForViewer } from '@/lib/redactCallLogsTagsForViewer'
import type { CallLog } from '@/types/logs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const { userId } = await auth()
  const user = await currentUser()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const access = await getProjectRoleForApi(projectId)
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const p_agent_id = body.p_agent_id as string | undefined
  if (!p_agent_id) {
    return NextResponse.json({ error: 'p_agent_id required' }, { status: 400 })
  }

  const { data: agentRow, error: agentErr } = await supabase
    .from('pype_voice_agents')
    .select('project_id')
    .eq('id', p_agent_id)
    .maybeSingle()

  if (agentErr || !agentRow || agentRow.project_id !== projectId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const userEmail = user?.emailAddresses?.[0]?.emailAddress ?? null

  const rpcParamsWithUser = {
    p_agent_id,
    p_pre_distinct_filters: body.p_pre_distinct_filters ?? [],
    p_post_distinct_filters: body.p_post_distinct_filters ?? [],
    p_select: body.p_select ?? '*',
    p_order_by_column: body.p_order_by_column ?? 'created_at',
    p_order_ascending: body.p_order_ascending ?? false,
    p_limit: body.p_limit ?? 50,
    p_offset: body.p_offset ?? 0,
    p_distinct_column: body.p_distinct_column ?? null,
    p_distinct_json_field: body.p_distinct_json_field ?? null,
    p_distinct_order: body.p_distinct_order ?? 'asc',
    p_date_from: body.p_date_from ?? null,
    p_date_to: body.p_date_to ?? null,
    p_user_clerk_id: userId,
    p_user_email: userEmail,
  }

  let { data, error } = await supabase.rpc('get_call_logs_with_distinct', rpcParamsWithUser)

  if (error?.code === 'PGRST202') {
    const params13 = {
      p_agent_id: rpcParamsWithUser.p_agent_id,
      p_pre_distinct_filters: rpcParamsWithUser.p_pre_distinct_filters,
      p_post_distinct_filters: rpcParamsWithUser.p_post_distinct_filters,
      p_select: rpcParamsWithUser.p_select,
      p_order_by_column: rpcParamsWithUser.p_order_by_column,
      p_order_ascending: rpcParamsWithUser.p_order_ascending,
      p_limit: rpcParamsWithUser.p_limit,
      p_offset: rpcParamsWithUser.p_offset,
      p_distinct_column: rpcParamsWithUser.p_distinct_column,
      p_distinct_json_field: rpcParamsWithUser.p_distinct_json_field,
      p_distinct_order: rpcParamsWithUser.p_distinct_order,
      p_date_from: rpcParamsWithUser.p_date_from,
      p_date_to: rpcParamsWithUser.p_date_to,
    }
    const fallback = await supabase.rpc('get_call_logs_with_distinct', params13)
    if (fallback.error) {
      console.error('rpc fallback error:', fallback.error)
      return NextResponse.json({ error: fallback.error.message }, { status: 500 })
    }
    data = fallback.data
    error = null
  }

  if (error) {
    console.error('get_call_logs_with_distinct:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let rows = (data || []) as CallLog[]
  if (access.role === 'viewer') {
    rows = redactTagsFromCallLogsForViewer(rows)
  }

  return NextResponse.json({ data: rows })
}
