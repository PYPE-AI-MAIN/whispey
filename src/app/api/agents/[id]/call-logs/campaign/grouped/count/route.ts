import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { createServiceRoleClient } from '@/lib/supabase-server'

const supabase = createServiceRoleClient()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { campaignId?: string; filters?: unknown[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { campaignId, filters = [] } = body
  if (!campaignId) return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })

  const { data: agentRow, error: agentErr } = await supabase
    .from('pype_voice_agents')
    .select('project_id')
    .eq('id', agentId)
    .maybeSingle()

  if (agentErr || !agentRow?.project_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const access = await getProjectRoleForApi(agentRow.project_id as string)
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const rpcParams: Record<string, unknown> = {
    p_agent_id: agentId,
    p_campaign_id: campaignId,
  }
  if (Array.isArray(filters) && filters.length > 0) {
    rpcParams.p_filters = filters
  }

  const { data, error } = await supabase.rpc('get_campaign_grouped_call_logs_count', rpcParams)

  if (error) {
    console.error('get_campaign_grouped_call_logs_count:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ count: Number(data ?? 0) })
}
