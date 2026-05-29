import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { createServiceRoleClient } from '@/lib/supabase-server'

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

  const { data, error } = await supabase.rpc('get_campaign_call_counts', {
    p_agent_id: agentId,
    p_campaign_id: campaignId,
  })

  if (error) {
    console.error('get_campaign_call_counts:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Convert array to map: { [customerNumber]: callCount }
  const countsMap: Record<string, number> = {}
  for (const row of (data ?? []) as { customer_number: string; call_count: number }[]) {
    countsMap[row.customer_number] = Number(row.call_count)
  }

  return NextResponse.json({ counts: countsMap })
}
