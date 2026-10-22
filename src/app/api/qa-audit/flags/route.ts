import { NextRequest, NextResponse } from 'next/server'
import { isQaDenied, qaDb, resolveAgentAccess } from '@/server/qa/access'

const PAGE_SIZE = 25
const STATUSES = ['pending', 'in_review', 'resolved'] as const

/** One page of flagged-call tickets for an agent, newest first, plus a count per status. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const agentId = params.get('agentId') ?? ''
  const access = await resolveAgentAccess(agentId)
  if (isQaDenied(access)) return NextResponse.json({ error: access.error }, { status: access.status })

  const status = STATUSES.find((s) => s === params.get('status'))
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)

  let query = qaDb
    .from('qa_flag_tickets')
    .select('id, call_log_id, reason, flagged_by_email, flagged_at, status, resolution_note, resolved_by, resolved_at, sheet_url, assignee_email', { count: 'exact' })
    .eq('agent_id', agentId)
  if (status) query = query.eq('status', status)
  const [{ data, error, count }, ...counts] = await Promise.all([
    query.order('flagged_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    ...STATUSES.map((s) => qaDb.from('qa_flag_tickets').select('id', { count: 'exact', head: true }).eq('agent_id', agentId).eq('status', s)),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (data ?? []).map((t) => t.id)
  const { data: comments } = ids.length
    ? await qaDb.from('qa_flag_comments').select('id, ticket_id, author_email, body, attachments, created_at').in('ticket_id', ids).order('created_at')
    : { data: [] }
  const { data: events } = ids.length
    ? await qaDb.from('qa_flag_events').select('id, ticket_id, kind, actor_email, detail, created_at').in('ticket_id', ids).order('created_at')
    : { data: [] }
  // The sheet and assignee are for Pype staff only; customers never get them.
  const tickets = (data ?? []).map((t) => ({
    ...t,
    sheet_url: access.internal ? t.sheet_url : null,
    assignee_email: access.internal ? t.assignee_email : null,
    comments: (comments ?? []).filter((c) => c.ticket_id === t.id),
    events: (events ?? []).filter((e) => e.ticket_id === t.id),
  }))

  return NextResponse.json({
    tickets,
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    counts: Object.fromEntries(STATUSES.map((s, i) => [s, counts[i].count ?? 0])),
    canManage: access.canManage,
    internal: access.internal,
  })
}
