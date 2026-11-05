import { NextResponse } from 'next/server'
import { isQaDenied, resolveAgentAccess, type QaAccess } from '@/server/qa/access'
import type { DataPlane, PlaneSource, Row } from '@/server/data-plane'

/**
 * A ticket lives in its project's data plane, so a ticket id alone cannot be
 * looked up: the caller sends the agent id as the hint, the project comes from
 * the agent, and the ticket must belong to that agent.
 */
export async function loadTicket(
  dp: PlaneSource,
  agentId: string | null | undefined,
  ticketId: string,
  columns: string
): Promise<{ access: QaAccess; plane: DataPlane; ticket: Row } | { error: NextResponse }> {
  if (!agentId) return { error: NextResponse.json({ error: 'agentId is required' }, { status: 400 }) }
  const access = await resolveAgentAccess(agentId)
  if (isQaDenied(access)) return { error: NextResponse.json({ error: access.error }, { status: access.status }) }
  const plane = await dp.forProject(access.projectId)
  const ticket = await plane.qa.getTicket(ticketId, columns)
  if (!ticket || ticket.agent_id !== agentId) return { error: NextResponse.json({ error: 'Ticket not found' }, { status: 404 }) }
  return { access, plane, ticket }
}
