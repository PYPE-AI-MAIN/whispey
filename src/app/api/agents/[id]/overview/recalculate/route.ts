import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { createServiceRoleClient } from '@/lib/supabase-server'

// Manual recovery path for call_summary_daily: rebuilds full history for this
// agent only. The cron (refresh_call_summary_daily) only reprocesses days with
// activity inside its configured window, so historical edits, deletes and
// reprocessing older than that need this to catch up.
// See migrations/incremental_call_summary_refresh.sql.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: agentId } = await params
  const supabase = createServiceRoleClient()
  const { data: agentRow, error: agentErr } = await supabase
    .from('pype_voice_agents')
    .select('project_id')
    .eq('id', agentId)
    .maybeSingle()

  if (agentErr || !agentRow?.project_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const access = await getProjectRoleForApi(agentRow.project_id as string)
  if (!access || access.role === 'viewer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase.rpc('recalculate_call_summary_daily', { p_agent_id: agentId })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
