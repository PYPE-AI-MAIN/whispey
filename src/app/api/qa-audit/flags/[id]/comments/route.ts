import { NextRequest, NextResponse } from 'next/server'
import { qaDb } from '@/server/qa/access'
import { loadTicket } from '@/server/qa/ticketAccess'
import { withDataPlane } from '@/server/data-plane'
import { ticketAttachments } from '@/lib/qaAudit'
import { notifyQaStatusChange } from '@/server/qa/notify'

/** QA team only: add a comment (text and/or images) at any status; the customer sees it and is notified. */
export const POST = withDataPlane(async (dp, request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const b = (await request.json().catch(() => ({}))) as { body?: unknown; attachments?: unknown; agentId?: unknown }
  const loaded = await loadTicket(dp, typeof b.agentId === 'string' ? b.agentId : null, id, 'id, agent_id, call_log_id, flagged_by_email')
  if ('error' in loaded) return loaded.error
  const { access, ticket } = loaded
  if (!access.canManage) return NextResponse.json({ error: 'Only the QA team can comment' }, { status: 403 })

  const text = typeof b.body === 'string' ? b.body.trim().slice(0, 4000) : ''
  const attachments = ticketAttachments(b.attachments, id)
  if (!text && attachments.length === 0) return NextResponse.json({ error: 'Write a comment or attach an image' }, { status: 400 })

  const { data, error } = await qaDb
    .from('qa_flag_comments')
    .insert({ ticket_id: id, author_email: access.email, body: text, attachments })
    .select('id, ticket_id, author_email, body, attachments, created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await notifyQaStatusChange({
    kind: 'flag',
    agentName: access.agent.display_name || access.agent.name,
    agentId: access.agent.id,
    projectId: access.projectId,
    clientEmail: ticket.flagged_by_email ?? '',
    byEmail: access.email,
    callLogId: ticket.call_log_id,
    detail: 'New comment from the QA team on your flagged call',
    note: text || `${attachments.length} image(s) attached`,
  })

  return NextResponse.json({ comment: data }, { status: 201 })
})
