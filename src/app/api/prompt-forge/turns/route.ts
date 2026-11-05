import { NextRequest, NextResponse } from 'next/server'
import { requireForgeUser } from '@/server/promptForge/access'
import { withDataPlane, rethrowDataPlane, projectIdForAgent } from '@/server/data-plane'

export const runtime = 'nodejs'

function transcriptJsonToTurns(transcriptJson: any[]): any[] {
  const getText = (msg: any): string => {
    const c = msg.content
    if (Array.isArray(c)) return c.join(' ').trim()
    return (c || '').trim()
  }

  const turns: any[] = []
  let i = 0
  while (i < transcriptJson.length) {
    const msg = transcriptJson[i]
    const role = msg.role?.toLowerCase()
    const text = getText(msg)
    if (!text) { i++; continue }

    if (role === 'user') {
      const next = transcriptJson[i + 1]
      const nextRole = next?.role?.toLowerCase()
      const agentText = (nextRole === 'assistant') ? getText(next) : ''
      turns.push({ id: `transcript_${turns.length}`, user_transcript: text, agent_response: agentText, tool_calls: [] })
      i += agentText ? 2 : 1
    } else if (role === 'assistant') {
      turns.push({ id: `transcript_${turns.length}`, user_transcript: '', agent_response: text, tool_calls: [] })
      i++
    } else {
      i++
    }
  }
  return turns
}

export const GET = withDataPlane(async (dp, request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  const agentId = searchParams.get('agent_id')

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 })
  }
  // The call lives in the project's data plane, so the agent id is required to find it.
  if (!agentId) {
    return NextResponse.json({ error: 'agent_id required' }, { status: 400 })
  }

  try {
    // The caller must be able to use Prompt Forge in the hinted agent's project, and the call must be that agent's.
    const projectId = await projectIdForAgent(agentId)
    const access = await requireForgeUser(projectId ?? undefined)
    if ('response' in access) return access.response

    const plane = await dp.forProject(projectId!)
    const call = await plane.callData.getCallLog(sessionId, 'agent_id, transcript_json')
    if (!call || call.agent_id !== agentId) return NextResponse.json({ error: 'Call not found' }, { status: 404 })

    const metricsData = await plane.callData.listTurns(sessionId)

    const hasContent = (metricsData ?? []).some(t => t.user_transcript || t.agent_response)
    if (hasContent) return NextResponse.json(metricsData)

    // Fallback: transcript_json from call log (used by pipecat agents)
    let transcriptJson = call.transcript_json
    if (!transcriptJson) return NextResponse.json([])
    if (typeof transcriptJson === 'string') {
      try { transcriptJson = JSON.parse(transcriptJson) } catch { return NextResponse.json([]) }
    }
    if (!Array.isArray(transcriptJson) || transcriptJson.length === 0) return NextResponse.json([])

    return NextResponse.json(transcriptJsonToTurns(transcriptJson))
  } catch (err: any) {
    rethrowDataPlane(err)
    console.error('[prompt-forge/turns]', err)
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 })
  }
})
