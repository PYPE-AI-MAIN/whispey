import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { createServiceRoleClient } from '@/lib/supabase-server'
import type { CallLog } from '@/types/logs'

const supabase = createServiceRoleClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const campaignId = searchParams.get('campaignId')
  const customerNumber = searchParams.get('customerNumber')

  if (!campaignId || !customerNumber) {
    return NextResponse.json(
      { error: 'campaignId and customerNumber are required' },
      { status: 400 }
    )
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
  if (!access) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase.rpc('get_campaign_contact_call_logs', {
    p_agent_id: agentId,
    p_campaign_id: campaignId,
    p_customer_number: customerNumber,
  })

  if (error) {
    console.error('get_campaign_contact_call_logs:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: (data ?? []) as CallLog[] })
}
