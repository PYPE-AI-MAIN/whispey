import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { withDataPlane, rethrowDataPlane, projectIdForAgent } from '@/server/data-plane'

export const PATCH = withDataPlane(async (
  dp,
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params
    const body = await request.json()
    const { tags, tagComments, agent_id: agentId } = body as {
      tags?: unknown
      tagComments?: unknown
      agent_id?: unknown
    }

    // The call row lives in the project's data plane, so the agent id is required to find it.
    if (typeof agentId !== 'string' || !agentId) {
      return NextResponse.json({ error: 'agent_id required' }, { status: 400 })
    }
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const projectId = await projectIdForAgent(agentId)
    if (!projectId || !(await getProjectRoleForApi(projectId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const plane = await dp.forProject(projectId)

    // At least one of tags or tagComments must be present
    if (tags === undefined && tagComments === undefined) {
      return NextResponse.json({ error: 'tags or tagComments required' }, { status: 400 })
    }

    if (tags !== undefined && !Array.isArray(tags)) {
      return NextResponse.json({ error: 'tags must be an array' }, { status: 400 })
    }

    if (tagComments !== undefined && (typeof tagComments !== 'object' || Array.isArray(tagComments) || tagComments === null)) {
      return NextResponse.json({ error: 'tagComments must be an object' }, { status: 400 })
    }

    // Fetch current transcription_metrics so we can merge without clobbering other keys
    const current = await plane.callData.getCallLog(id, 'transcription_metrics, agent_id')
    if (!current || current.agent_id !== agentId) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    }

    const updatedMetrics: Record<string, unknown> = { ...(current?.transcription_metrics || {}) }

    if (tags !== undefined) {
      const cleanTags = (tags as unknown[])
        .map((t: unknown) => (typeof t === 'string' ? t.trim() : ''))
        .filter(Boolean)
      updatedMetrics.tags = cleanTags
    }

    if (tagComments !== undefined) {
      // Sanitize: only string values, strip empty comments
      const cleanComments: Record<string, string> = {}
      for (const [k, v] of Object.entries(tagComments as Record<string, unknown>)) {
        if (typeof v === 'string' && v.trim()) {
          cleanComments[k] = v.trim()
        }
      }
      updatedMetrics.tagComments = cleanComments
    }

    await plane.callLogs.setTranscriptionMetrics(id, updatedMetrics)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    rethrowDataPlane(error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error updating call log tags:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
})
