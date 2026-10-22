// The call transcript as a downloadable JSON file — one format for the full
// trace page and the Call Logs split view.

type ExportTurn = {
  turn_id: string
  user_transcript?: string | null
  agent_response?: string | null
  tool_calls?: any[]
  unix_timestamp?: number
  trace_id?: string
}

export function downloadTranscriptJson(enrichedTraces: ExportTurn[], sessionId: string | undefined, agentId: string) {
  if (!enrichedTraces.length) return
  // Format all conversation turns as JSON
  const transcriptData = {
    session_id: sessionId || 'unknown',
    agent_id: agentId,
    total_turns: enrichedTraces.length,
    exported_at: new Date().toISOString(),
    turns: enrichedTraces.map((trace) => {
      const turnData: any = {
        turn_id: trace.turn_id,
      }
      
      // Add user transcript if available
      if (trace.user_transcript?.trim()) {
        turnData.user = trace.user_transcript.trim()
      }

      // Add tool calls if present — between user and assistant for readability
      if (trace.tool_calls && trace.tool_calls.length > 0) {
        turnData.tool_calls = trace.tool_calls.map((tool: any) => ({
          name: tool.tool_name || tool.name || 'unknown',
          ...(tool.arguments !== undefined && { arguments: tool.arguments }),
          ...(tool.result !== undefined && { result: tool.result }),
          success: tool.success !== false && tool.status !== 'error',
          ...(tool.latency_ms !== undefined && { latency_ms: tool.latency_ms }),
          ...(tool.error && { error: tool.error }),
        }))
      }

      // Add assistant response if available
      if (trace.agent_response?.trim()) {
        turnData.assistant = trace.agent_response.trim()
      }

      // Add timestamp if available
      if (trace.unix_timestamp) {
        turnData.timestamp = new Date(trace.unix_timestamp * 1000).toISOString()
      }

      // Add additional metadata if available
      if (trace.trace_id) {
        turnData.trace_id = trace.trace_id
      }

      return turnData
    })
  }

  const transcriptJson = JSON.stringify(transcriptData, null, 2)
  const sessionIdShort = sessionId ? sessionId.slice(-8) : 'unknown'
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-').slice(0, -5)
  const blob = new Blob([transcriptJson], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `transcript-session-${sessionIdShort}-${timestamp}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
