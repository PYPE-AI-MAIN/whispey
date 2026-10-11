import { NextRequest, NextResponse } from 'next/server'
import { isQaDenied, qaDb, resolveAgentAccess } from '@/server/qa/access'
import { ticketPatch } from '@/lib/qaAudit'

/** QA team only: move a ticket along and record how it was resolved. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: ticket } = await qaDb.from('qa_flag_tickets').select('id, agent_id').eq('id', id).maybeSingle()
  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

  const access = await resolveAgentAccess(ticket.agent_id)
  if (isQaDenied(access)) return NextResponse.json({ error: access.error }, { status: access.status })
  if (!access.canManage) return NextResponse.json({ error: 'Only the QA team can update tickets' }, { status: 403 })

  const check = ticketPatch((await request.json().catch(() => ({}))) as Record<string, unknown>)
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: 400 })

  const done = check.patch.status === 'resolved'
  const { data, error } = await qaDb
    .from('qa_flag_tickets')
    .update({
      ...check.patch,
      resolved_by: done ? access.email : null,
      resolved_at: done ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select('id, status, resolution_note, resolved_by, resolved_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ticket: data })
}
