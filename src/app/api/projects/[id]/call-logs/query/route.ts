import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { redactTagsFromCallLogsForViewer } from '@/lib/redactCallLogsTagsForViewer'
import type { CallLog } from '@/types/logs'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { queryCallLogs } from '@/lib/queryCallLogs'

const supabase = createServiceRoleClient()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const { userId } = await auth()
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

  const { data, error } = await queryCallLogs(supabase, {
    p_agent_id,
    p_pre_distinct_filters: (body.p_pre_distinct_filters as any[]) ?? [],
    p_post_distinct_filters: (body.p_post_distinct_filters as any[]) ?? [],
    p_select: (body.p_select as string) ?? '*',
    p_order_by_column: (body.p_order_by_column as string) ?? 'created_at',
    p_order_ascending: (body.p_order_ascending as boolean) ?? false,
    p_limit: (body.p_limit as number) ?? 50,
    p_offset: (body.p_offset as number) ?? 0,
    p_distinct_column: (body.p_distinct_column as string) ?? null,
    p_distinct_json_field: (body.p_distinct_json_field as string) ?? null,
    p_distinct_order: (body.p_distinct_order as string) ?? 'asc',
    p_date_from: (body.p_date_from as string) ?? null,
    p_date_to: (body.p_date_to as string) ?? null,
  })

  if (error) {
    console.error('queryCallLogs:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let rows = (data || []) as CallLog[]
  if (access.role === 'viewer') {
    rows = redactTagsFromCallLogsForViewer(rows)
  }

  return NextResponse.json({ data: rows })
}
