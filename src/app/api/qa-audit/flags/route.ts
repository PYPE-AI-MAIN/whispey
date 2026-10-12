import { NextRequest, NextResponse } from 'next/server'
import { isQaDenied, qaDb, resolveAgentAccess } from '@/server/qa/access'

/** Flagged-call tickets for one agent, newest first. */
export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get('agentId') ?? ''
  const access = await resolveAgentAccess(agentId)
  if (isQaDenied(access)) return NextResponse.json({ error: access.error }, { status: access.status })

  const { data, error } = await qaDb
    .from('qa_flag_tickets')
    .select('id, call_log_id, reason, flagged_by_email, flagged_at, status, resolution_note, resolved_by, resolved_at, sheet_url, assignee_email')
    .eq('agent_id', agentId)
    .order('flagged_at', { ascending: false })
    .limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (data ?? []).map((t) => t.id)
  const { data: comments } = ids.length
    ? await qaDb.from('qa_flag_comments').select('id, ticket_id, author_email, body, attachments, created_at').in('ticket_id', ids).order('created_at')
    : { data: [] }
  // The sheet and assignee are for Pype staff only; customers never get them.
  const tickets = (data ?? []).map((t) => ({
    ...t,
    sheet_url: access.internal ? t.sheet_url : null,
    assignee_email: access.internal ? t.assignee_email : null,
    comments: (comments ?? []).filter((c) => c.ticket_id === t.id),
  }))

  return NextResponse.json({ tickets, canManage: access.canManage, internal: access.internal })
}
