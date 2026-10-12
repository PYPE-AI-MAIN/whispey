import { NextRequest, NextResponse } from 'next/server'
import { isQaDenied, qaDb, resolveAgentAccess } from '@/server/qa/access'
import { sheetUrlError, ticketPatch } from '@/lib/qaAudit'
import { notifyQaStatusChange } from '@/server/qa/notify'

/** QA team only: move a ticket along and record how it was resolved. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: ticket } = await qaDb.from('qa_flag_tickets').select('id, agent_id, call_log_id, status, flagged_by_email, assignee_email, sheet_url, reason').eq('id', id).maybeSingle()
  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

  const access = await resolveAgentAccess(ticket.agent_id)
  if (isQaDenied(access)) return NextResponse.json({ error: access.error }, { status: access.status })
  if (!access.canManage) return NextResponse.json({ error: 'Only the QA team can update tickets' }, { status: 403 })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const check = ticketPatch(body)
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: 400 })

  const sheet = typeof body.sheet_url === 'string' ? body.sheet_url.trim() : ''
  const assignee = typeof body.assignee_email === 'string' ? body.assignee_email.trim().toLowerCase() : ''
  const extraError = sheet && sheetUrlError(sheet)
  if (extraError) return NextResponse.json({ error: extraError }, { status: 400 })
  const { data: engineer } = assignee
    ? await qaDb.from('qa_team_members').select('name, slack_id').eq('role', 'prompt_engineer').eq('email', assignee).maybeSingle()
    : { data: null }
  if (assignee && !engineer) return NextResponse.json({ error: 'Pick a prompt engineer from the list' }, { status: 400 })

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

  if (ticket.status !== check.patch.status) {
    await notifyQaStatusChange({
      kind: 'flag',
      agentName: access.agent.display_name || access.agent.name,
      agentId: access.agent.id,
      projectId: access.projectId,
      clientEmail: ticket.flagged_by_email ?? '',
      byEmail: access.email,
      callLogId: ticket.call_log_id,
      detail: `Flagged call ${ticket.status} -> ${check.patch.status}`,
      note: check.patch.resolution_note,
    })
  }

  // The prompt engineer is told when a ticket in review is theirs (new assignee, or it just moved to review).
  if (assignee && check.patch.status === 'in_review' && (assignee !== ticket.assignee_email || ticket.status !== 'in_review')) {
    await notifyQaStatusChange({
      kind: 'flag',
      agentName: access.agent.display_name || access.agent.name,
      agentId: access.agent.id,
      projectId: access.projectId,
      clientEmail: assignee,
      byEmail: access.email,
      callLogId: ticket.call_log_id,
      detail: 'Flagged call assigned to you to fix',
      note: [`Flag: ${ticket.reason}`, check.patch.resolution_note].filter(Boolean).join(' | '),
      sheetUrl: sheet || null,
      slackId: engineer?.slack_id,
    })
  }

  return NextResponse.json({ ticket: data })
}
