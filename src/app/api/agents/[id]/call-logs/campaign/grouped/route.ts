import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { createServiceRoleClient } from '@/lib/supabase-server'
import type { CallLog } from '@/types/logs'
import { withDataPlane, rethrowDataPlane } from '@/server/data-plane'

const supabase = createServiceRoleClient()

export const POST = withDataPlane(async (
  dp,
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
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

  const plane = await dp.forProject(agentRow.project_id as string)

  let groupedRows: CallLog[]
  try {
    groupedRows = (await plane.callData.campaignGroupedCallLogs(rpcParams)) as CallLog[]
  } catch (e) {
    rethrowDataPlane(e)
    console.error('get_campaign_grouped_call_logs:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }

  // Batch-fetch all calls for the 50 contacts so sub_rows are available instantly on expand
  if (groupedRows.length > 0) {
    const customerNumbers = groupedRows.map(r => r.customer_number)

    const allCalls = await plane.callData.listCampaignCalls(agentId, campaignId, customerNumbers).catch((e) => {
      rethrowDataPlane(e) // a failed sub-row lookup still returns the grouped rows, as before
      return null
    })

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
})
