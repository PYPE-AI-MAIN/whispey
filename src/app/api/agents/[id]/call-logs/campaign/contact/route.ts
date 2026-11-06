import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { withDataPlane, rethrowDataPlane } from '@/server/data-plane'
import type { CallLog } from '@/types/logs'

const supabase = createServiceRoleClient()

export const GET = withDataPlane(async (
  dp,
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
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

  const plane = await dp.forProject(agentRow.project_id as string)
  let data: unknown[]
  try {
    data = await plane.callData.campaignContactCalls(agentId, campaignId, customerNumber)
  } catch (e) {
    rethrowDataPlane(e)
    console.error('get_campaign_contact_call_logs:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }

  return NextResponse.json({ data: data as CallLog[] })
})
