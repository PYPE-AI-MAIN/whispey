import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { createServiceRoleClient } from '@/lib/supabase-server'
import type { CallLog } from '@/types/logs'

const supabase = createServiceRoleClient()

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { campaignId?: string; limit?: number; offset?: number; filters?: unknown[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { campaignId, limit = 50, offset = 0, filters = [] } = body
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

  // Only pass p_filters when non-empty — the SQL function must be updated first (see docs)
  const rpcParams: Record<string, unknown> = {
    p_agent_id: agentId,
    p_campaign_id: campaignId,
    p_limit: limit,
    p_offset: offset,
  }
  if (Array.isArray(filters) && filters.length > 0) {
    rpcParams.p_filters = filters
  }

  const { data, error } = await supabase.rpc('get_campaign_grouped_call_logs', rpcParams)

  if (error) {
    console.error('get_campaign_grouped_call_logs:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const groupedRows = (data ?? []) as CallLog[]

  // Batch-fetch all calls for the 50 contacts so sub_rows are available instantly on expand
  if (groupedRows.length > 0) {
    const customerNumbers = groupedRows.map(r => r.customer_number)

    const { data: allCalls } = await supabase
      .from('pype_voice_call_logs')
      .select('*')
      .eq('agent_id', agentId)
      .filter('metadata->>campaignId', 'eq', campaignId)
      .in('customer_number', customerNumbers)
      .order('call_started_at', { ascending: false })

    if (allCalls && allCalls.length > 0) {
      const callsByContact = new Map<string, CallLog[]>()
      for (const call of allCalls) {
        const bucket = callsByContact.get(call.customer_number) ?? []
        bucket.push(call as CallLog)
        callsByContact.set(call.customer_number, bucket)
      }

      const enriched: CallLog[] = groupedRows.map(row => ({
        ...row,
        sub_rows: (callsByContact.get(row.customer_number) ?? []).filter(c => c.id !== row.id),
      }))

      return NextResponse.json({ data: enriched })
    }
  }

  return NextResponse.json({ data: groupedRows })
}
