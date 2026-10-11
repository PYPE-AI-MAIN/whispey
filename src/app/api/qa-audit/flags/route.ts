import { NextRequest, NextResponse } from 'next/server'
import { isQaDenied, qaDb, resolveAgentAccess } from '@/server/qa/access'

/** Flagged-call tickets for one agent, newest first. */
export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get('agentId') ?? ''
  const access = await resolveAgentAccess(agentId)
  if (isQaDenied(access)) return NextResponse.json({ error: access.error }, { status: access.status })

  const { data, error } = await qaDb
    .from('qa_flag_tickets')
    .select('id, call_log_id, reason, flagged_by_email, flagged_at, status, resolution_note, resolved_by, resolved_at')
    .eq('agent_id', agentId)
    .order('flagged_at', { ascending: false })
    .limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ tickets: data ?? [], canManage: access.canManage })
}
