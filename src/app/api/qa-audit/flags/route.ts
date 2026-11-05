import { NextRequest, NextResponse } from 'next/server'
import { isQaDenied, qaDb, resolveAgentAccess } from '@/server/qa/access'
import { withDataPlane } from '@/server/data-plane'

const PAGE_SIZE = 25
const STATUSES = ['pending', 'in_review', 'resolved'] as const

/** One page of flagged-call tickets for an agent, newest first, plus a count per status. */
export const GET = withDataPlane(async (dp, request: NextRequest) => {
  const params = request.nextUrl.searchParams
  const agentId = params.get('agentId') ?? ''
  const access = await resolveAgentAccess(agentId)
  if (isQaDenied(access)) return NextResponse.json({ error: access.error }, { status: access.status })

  const status = STATUSES.find((s) => s === params.get('status'))
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)

  // Tickets live in the project's data plane; comments and events stay in Pype.
  const plane = await dp.forProject(access.projectId)
  const [{ rows: data, total }, counts] = await Promise.all([
    plane.qa.listTickets(agentId, {
      status,
      from: (page - 1) * PAGE_SIZE,
      to: page * PAGE_SIZE - 1,
      columns: 'id, agent_id, call_log_id, reason, flagged_by_email, flagged_at, status, resolution_note, resolved_by, resolved_at, sheet_url, assignee_email',
    }),
    plane.qa.countByStatus(agentId, STATUSES),
  ])

  const ids = data.map((t) => t.id)
  const { data: comments } = ids.length
    ? await qaDb.from('qa_flag_comments').select('id, ticket_id, author_email, body, attachments, created_at').in('ticket_id', ids).order('created_at')
    : { data: [] }
  const { data: events } = ids.length
    ? await qaDb.from('qa_flag_events').select('id, ticket_id, kind, actor_email, detail, created_at').in('ticket_id', ids).order('created_at')
    : { data: [] }
  // The sheet and assignee are for Pype staff only; customers never get them.
  const tickets = data.map((t) => ({
    ...t,
    sheet_url: access.internal ? t.sheet_url : null,
    assignee_email: access.internal ? t.assignee_email : null,
    comments: (comments ?? []).filter((c) => c.ticket_id === t.id),
    events: (events ?? []).filter((e) => e.ticket_id === t.id),
  }))

  return NextResponse.json({
    tickets,
    total,
    page,
    pageSize: PAGE_SIZE,
    counts,
    canManage: access.canManage,
    internal: access.internal,
  })
})
