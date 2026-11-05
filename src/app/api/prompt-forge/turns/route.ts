import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { requireForgeUser } from '@/server/promptForge/access'

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 })
  }

  try {
    const supabase = createServiceRoleClient()

    // The call must belong to a project where the caller can use Prompt Forge.
    const { data: call } = await supabase
      .from('pype_voice_call_logs')
      .select('agent_id, transcript_json')
      .eq('id', sessionId)
      .maybeSingle()
    if (!call) return NextResponse.json({ error: 'Call not found' }, { status: 404 })
    const { data: agent } = await supabase.from('pype_voice_agents').select('project_id').eq('id', call.agent_id).maybeSingle()
    const access = await requireForgeUser(agent?.project_id)
    if ('response' in access) return access.response

    const { data: metricsData, error } = await supabase
      .from('pype_voice_metrics_logs')
      .select('id, user_transcript, agent_response, tool_calls, unix_timestamp, created_at')
      .eq('session_id', sessionId)
      .order('unix_timestamp', { ascending: true })

    if (error) throw error

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
    console.error('[prompt-forge/turns]', err)
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 })
  }
}
