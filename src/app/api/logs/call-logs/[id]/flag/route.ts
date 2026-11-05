import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { normalizeFlags, type FlagEntry } from '@/utils/callLogsUtils'
import { logQaEvent, notifyQaTeam } from '@/server/qa/notify'
import { withDataPlane, rethrowDataPlane, type DataPlane } from '@/server/data-plane'

const supabase = createServiceRoleClient()

type FlagAction =
  | { action: 'add'; text: string }
  | { action: 'update'; flagId: string; text: string }
  | { action: 'delete'; flagId: string }

// agent_id is the routing hint: the call row lives in the project's data plane.
type FlagRequest = FlagAction & { agent_id?: string }

type FlagActionResult = { nextFlags: FlagEntry[] } | { error: string; status: number }

function addFlag(existingFlags: FlagEntry[], text: string | undefined, userId: string, userEmail: string): FlagActionResult {
  const trimmed = text?.trim()
  if (!trimmed) return { error: 'Flag text is required', status: 400 }
  return {
    nextFlags: [
      ...existingFlags,
      { id: randomUUID(), text: trimmed, flagged_at: new Date().toISOString(), flagged_by: { userId, email: userEmail } },
    ],
  }
}

function updateFlag(existingFlags: FlagEntry[], flagId: string, text: string | undefined, userId: string): FlagActionResult {
  const target = existingFlags.find(f => f.id === flagId)
  if (!target) return { error: 'Flag not found', status: 404 }
  // Only the author can edit their own flag — admins may delete but not rewrite someone else's.
  if (target.flagged_by?.userId !== userId) {
    return { error: 'You can only edit your own flag', status: 403 }
  }
  const trimmed = text?.trim()
  if (!trimmed) return { error: 'Flag text is required', status: 400 }
  return {
    nextFlags: existingFlags.map(f =>
      f.id === flagId ? { ...f, text: trimmed, flagged_at: new Date().toISOString() } : f
    ),
  }
}

function deleteFlag(existingFlags: FlagEntry[], flagId: string, userId: string, canDeleteAnyFlag: boolean): FlagActionResult {
  const target = existingFlags.find(f => f.id === flagId)
  if (!target) return { error: 'Flag not found', status: 404 }
  const isAuthor = target.flagged_by?.userId === userId
  if (!isAuthor && !canDeleteAnyFlag) {
    return { error: 'You can only remove your own flag', status: 403 }
  }
  return { nextFlags: existingFlags.filter(f => f.id !== flagId) }
}

function applyFlagAction(
  body: FlagAction,
  existingFlags: FlagEntry[],
  userId: string,
  userEmail: string,
  canDeleteAnyFlag: boolean
): FlagActionResult {
  if (body.action === 'add') return addFlag(existingFlags, body.text, userId, userEmail)
  if (body.action === 'update') return updateFlag(existingFlags, body.flagId, body.text, userId)
  if (body.action === 'delete') return deleteFlag(existingFlags, body.flagId, userId, canDeleteAnyFlag)
  return { error: 'Invalid action', status: 400 }
}

/**
 * Mirror a customer flag into the QA Audit queue. Best effort: the flag itself
 * is already saved, and a ticket hiccup must not make the customer's flag fail.
 */
async function syncQaTicket(
  plane: DataPlane,
  body: FlagAction,
  nextFlags: FlagEntry[],
  ids: { callLogId: string; agentId: string; projectId: string; agentName: string },
) {
  try {
    if (body.action === 'add') {
      const flag = nextFlags.at(-1)
      if (!flag) return
      await plane.qa.upsertFlagTicket({
        call_log_id: ids.callLogId,
        agent_id: ids.agentId,
        project_id: ids.projectId,
        flag_id: flag.id,
        reason: flag.text,
        flagged_by_user_id: flag.flagged_by?.userId ?? null,
        flagged_by_email: flag.flagged_by?.email ?? null,
        flagged_at: flag.flagged_at,
      })
      const ticketId = await plane.qa.findTicketId(ids.callLogId, flag.id)
      if (ticketId) await logQaEvent(ticketId, 'flagged', flag.flagged_by?.email ?? '', flag.text)
      await notifyQaTeam({
        kind: 'flag',
        agentName: ids.agentName,
        agentId: ids.agentId,
        projectId: ids.projectId,
        byEmail: flag.flagged_by?.email ?? '',
        callLogId: ids.callLogId,
        detail: flag.text,
      })
    } else if (body.action === 'update') {
      await plane.qa.updatePendingReason(ids.callLogId, body.flagId, body.text.trim())
    } else {
      // Only a ticket nobody has started on goes away with the flag.
      await plane.qa.deletePending(ids.callLogId, body.flagId)
    }
  } catch (e) {
    rethrowDataPlane(e)
    console.error('QA ticket sync failed:', e instanceof Error ? e.message : e)
  }
}

export const PATCH = withDataPlane(async (
  dp,
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { userId } = await auth()
    const user = await currentUser()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json() as FlagRequest
    if (typeof body.agent_id !== 'string' || !body.agent_id) {
      return NextResponse.json({ error: 'agent_id required' }, { status: 400 })
    }

    // Resolve the project from the hinted agent (control plane) before touching call data.
    const { data: agent } = await supabase
      .from('pype_voice_agents')
      .select('project_id, name, display_name')
      .eq('id', body.agent_id)
      .maybeSingle()

    const projectRole = agent?.project_id ? await getProjectRoleForApi(agent.project_id) : null
    if (!projectRole) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const plane = await dp.forProject(agent!.project_id)
    const current = await plane.callData.getCallLog(id, 'transcription_metrics, agent_id')
    if (!current || current.agent_id !== body.agent_id) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }
    const canDeleteAnyFlag = projectRole.role === 'admin' || projectRole.role === 'owner'

    const existingFlags = normalizeFlags(current?.transcription_metrics?.flag)
    const result = applyFlagAction(
      body,
      existingFlags,
      userId,
      user?.emailAddresses?.[0]?.emailAddress ?? '',
      canDeleteAnyFlag
    )
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    const { nextFlags } = result

    const updatedMetrics: Record<string, unknown> = { ...current?.transcription_metrics }
    if (nextFlags.length > 0) {
      updatedMetrics.flag = nextFlags
    } else {
      delete updatedMetrics.flag
    }

    await plane.callLogs.setTranscriptionMetrics(id, updatedMetrics)

    if (current?.agent_id && agent?.project_id) {
      await syncQaTicket(plane, body, nextFlags, { callLogId: id, agentId: current.agent_id, projectId: agent.project_id, agentName: agent.display_name || agent.name })
    }

    const qaPath = current?.agent_id && agent?.project_id ? `/${agent.project_id}/agents/${current.agent_id}/qa` : null
    return NextResponse.json({ success: true, flags: nextFlags, qaPath })
  } catch (error: unknown) {
    rethrowDataPlane(error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error updating call log flag:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
