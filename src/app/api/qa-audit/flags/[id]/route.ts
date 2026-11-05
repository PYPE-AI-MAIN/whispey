import { NextRequest, NextResponse } from 'next/server'
import { isQaDenied, qaDb, resolveAgentAccess, type QaAccess } from '@/server/qa/access'
import { sheetUrlError, ticketAttachments, ticketPatch } from '@/lib/qaAudit'
import { logQaEvent, notifyQaStatusChange } from '@/server/qa/notify'

type Ticket = { id: string; call_log_id: string; status: string; flagged_by_email: string | null; assignee_email: string | null; reason: string }

/** Everything people are told once a ticket has been updated. */
async function announce(
  access: QaAccess,
  ticket: Ticket,
  next: { status: string; said: string | null; sheet: string; assignee: string; engineer: { name: string; slack_id: string | null } | null },
) {
  const base = {
    kind: 'flag' as const,
    agentName: access.agent.display_name || access.agent.name,
    agentId: access.agent.id,
    projectId: access.projectId,
    byEmail: access.email,
    callLogId: ticket.call_log_id,
  }
  if (ticket.status !== next.status) {
    await logQaEvent(ticket.id, 'status', access.email, `${ticket.status} -> ${next.status}`)
    await notifyQaStatusChange({ ...base, clientEmail: ticket.flagged_by_email ?? '', detail: `Flagged call ${ticket.status} -> ${next.status}`, note: next.said })
  }
  // The prompt engineer is told when a ticket in review is theirs (new assignee, or it just moved to review).
  const handedOff = next.assignee && next.status === 'in_review' && (next.assignee !== ticket.assignee_email || ticket.status !== 'in_review')
  if (handedOff) {
    await logQaEvent(ticket.id, 'assigned', access.email, `Passed to ${next.engineer?.name ?? next.assignee}`)
    await notifyQaStatusChange({
      ...base,
      clientEmail: next.assignee,
      flaggedBy: ticket.flagged_by_email,
      detail: 'Flagged call assigned to you to fix',
      note: [`Flag: ${ticket.reason}`, next.said].filter(Boolean).join(' | '),
      sheetUrl: next.sheet || null,
      slack: true,
      slackId: next.engineer?.slack_id,
    })
  }
}

/** Validate the update form: status, sheet link, assignee (must be on the roster) and the optional comment. */
async function parseUpdate(body: Record<string, unknown>, ticketId: string) {
  const check = ticketPatch(body)
  if ('error' in check) return { error: check.error }

  const sheet = typeof body.sheet_url === 'string' ? body.sheet_url.trim() : ''
  const sheetError = sheet && sheetUrlError(sheet)
  if (sheetError) return { error: sheetError }

  const assignee = typeof body.assignee_email === 'string' ? body.assignee_email.trim().toLowerCase() : ''
  let engineer: { name: string; slack_id: string | null } | null = null
  if (assignee) {
    const { data } = await qaDb.from('qa_team_members').select('name, slack_id').eq('role', 'prompt_engineer').eq('email', assignee).maybeSingle()
    if (!data) return { error: 'Pick a prompt engineer from the list' }
    engineer = data
  }

  const comment = (body.comment ?? {}) as { body?: unknown; attachments?: unknown }
  const commentText = typeof comment.body === 'string' ? comment.body.trim().slice(0, 4000) : ''
  return { check, sheet, assignee, engineer, commentText, commentFiles: ticketAttachments(comment.attachments, ticketId) }
}

/** QA team only: move a ticket along, add a comment, and hand it to a prompt engineer. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: ticket } = await qaDb.from('qa_flag_tickets').select('id, agent_id, call_log_id, status, flagged_by_email, assignee_email, reason').eq('id', id).maybeSingle()
  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

  const access = await resolveAgentAccess(ticket.agent_id)
  if (isQaDenied(access)) return NextResponse.json({ error: access.error }, { status: access.status })
  if (!access.canManage) return NextResponse.json({ error: 'Only the QA team can update tickets' }, { status: 403 })

  const parsed = await parseUpdate((await request.json().catch(() => ({}))) as Record<string, unknown>, id)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const { check, sheet, assignee, engineer, commentText, commentFiles } = parsed

  const done = check.patch.status === 'resolved'
  const { data, error } = await qaDb
    .from('qa_flag_tickets')
    .update({
      ...check.patch,
      sheet_url: sheet || null,
      assignee_email: assignee || null,
      resolved_by: done ? access.email : null,
      resolved_at: done ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select('id, status, resolution_note, resolved_by, resolved_at, sheet_url, assignee_email')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (commentText || commentFiles.length) {
    await qaDb.from('qa_flag_comments').insert({ ticket_id: id, author_email: access.email, body: commentText, attachments: commentFiles })
  }
  await announce(access, ticket, { status: check.patch.status, said: commentText || check.patch.resolution_note, sheet, assignee, engineer })

  return NextResponse.json({ ticket: data })
}
