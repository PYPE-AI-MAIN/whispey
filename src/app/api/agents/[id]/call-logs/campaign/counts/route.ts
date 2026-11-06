import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { withDataPlane, rethrowDataPlane } from '@/server/data-plane'

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

  // the calls live where the project's route says (Pype or the customer), never a fallback
  const plane = await dp.forProject(agentRow.project_id as string)
  let data: { customer_number: string; call_count: number }[]
  try {
    data = (await plane.callData.campaignCallCounts(agentId, campaignId)) as typeof data
  } catch (e) {
    rethrowDataPlane(e)
    console.error('get_campaign_call_counts:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 })
  }

  // Convert array to map: { [customerNumber]: callCount }
  const countsMap: Record<string, number> = {}
  for (const row of data) {
    countsMap[row.customer_number] = Number(row.call_count)
  }

  return NextResponse.json({ counts: countsMap })
})
