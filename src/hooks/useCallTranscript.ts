// Builds the turn-by-turn transcript of one call: metrics-log turns when they
// carry transcript text, otherwise turns paired from call_logs.transcript_json,
// enriched with function_tool spans and bug-report marks. Moved out of
// TracesTable unchanged so the call detail page and the redesigned Call Logs
// read a call the same way.
import { useMemo } from "react"
import { useSupabaseQuery } from "@/hooks/useSupabase"
import { useSessionTrace } from "@/hooks/useSessionTrace"
import type { OTelSpan } from "@/types/openTelemetry"

export interface TraceLog {
  id: string
  session_id: string
  turn_id: string
  user_transcript: string
  agent_response: string
  trace_id?: string
  otel_spans?: OTelSpan[]
  tool_calls?: any[]
  enhanced_data?: { fallback_events?: any[]; [key: string]: any }
  trace_duration_ms?: number
  trace_cost_usd?: number
  stt_metrics?: any
  llm_metrics?: any
  tts_metrics?: any
  eou_metrics?: any
  created_at: string
  unix_timestamp: number
  phone_number?: string
  lesson_day?: number
  call_success?: boolean
  lesson_completed?: boolean
  bug_report?: boolean
  metadata?: any
}

// Shared select for pype_voice_metrics_logs used here AND in ObservabilityStats.
// MUST be identical in both places so React Query deduplicates into a single network request.
// `otel_spans` is intentionally excluded — it is a large embedded JSONB tree per turn
// that duplicates data already in the pype_voice_spans table and is not rendered directly.
export const METRICS_LOGS_SELECT =
  "id, session_id, turn_id, user_transcript, agent_response, " +
  "stt_metrics, llm_metrics, tts_metrics, eou_metrics, " +
  "tool_calls, enhanced_data, trace_id, trace_duration_ms, trace_cost_usd, " +
  "created_at, unix_timestamp, bug_report, " +
  "call_success, lesson_day, lesson_completed, phone_number"

// For views that only show the conversation: enhanced_data also carries a full
// copy of the agent's prompt on every turn (~100 KB+ each), so only the part
// they use (fallback_events) is fetched — a 12-turn call drops from ~1.4 MB to a
// few KB. The trace pages keep METRICS_LOGS_SELECT, as their turn sheet shows the prompt.
export const METRICS_LOGS_TRANSCRIPT_SELECT = METRICS_LOGS_SELECT.replace(
  "enhanced_data",
  "fallback_events:enhanced_data->fallback_events"
)

export function useCallTranscript({
  sessionId, agentId, light = false,
}: { sessionId?: string; agentId: string; light?: boolean }) {
  const { data: sessionTrace } = useSessionTrace(sessionId || null, agentId)

  // Lightweight targeted fetch — only function_tool spans for turn enrichment.
  // Avoids loading the full paginated span set just to find a handful of tool calls.
  const { data: functionToolSpans = [] } = useSupabaseQuery<any>('pype_voice_spans',
    sessionTrace?.trace_key ? {
      select: 'span_id, name, start_time_ns, duration_ms, status, attributes, captured_at',
      filters: [
        { column: 'trace_key', operator: 'eq', value: sessionTrace.trace_key },
        { column: 'name', operator: 'eq', value: 'function_tool' },
      ],
      auth: agentId ? { agentId } : undefined,
    } : null
  );

  // Get call data to access bug report metadata + transcript fallback + audio URL.
  // Select only the columns actually used; limit:1 matches page.tsx query so React
  // Query can share the same cache entry (identical select + filters + limit).
  const { data: callData } = useSupabaseQuery("pype_voice_call_logs", {
    select: "id, agent_id, metadata, transcript_json, recording_url, call_started_at, created_at",
    filters: sessionId 
      ? [{ column: "id", operator: "eq", value: sessionId }]
      : [{ column: "agent_id", operator: "eq", value: agentId }],
    orderBy: { column: "created_at", ascending: false },
    limit: 1,
    auth: { agentId },
  })

  // trace data — use the shared select so React Query deduplicates with ObservabilityStats
  const {
    data: rawTraceData,
    isLoading: traceDataLoading,
    error,
  } = useSupabaseQuery("pype_voice_metrics_logs", {
    select: light ? METRICS_LOGS_TRANSCRIPT_SELECT : METRICS_LOGS_SELECT,
    filters: sessionId 
      ? [{ column: "session_id", operator: "eq", value: sessionId }]
      : [{ column: "session_id::text", operator: "like", value: `${agentId}%` }],
    orderBy: { column: "unix_timestamp", ascending: true },
    auth: { agentId },
  })

  // The light select returns fallback_events at the top level; put it back where turns expect it.
  const traceData = useMemo(() => {
    if (!light || !rawTraceData) return rawTraceData
    return rawTraceData.map(({ fallback_events, ...row }: any) => ({ ...row, enhanced_data: { fallback_events: fallback_events ?? undefined } }))
  }, [light, rawTraceData])

  // Extract bug report data from call metadata
  const bugReportData = useMemo(() => {
    if (!callData?.length) return null
    
    const call = callData[0]
    if (!call?.metadata) return null

    try {
      const metadata = typeof call.metadata === "string" ? JSON.parse(call.metadata) : call.metadata
      return {
        bug_reports: metadata?.bug_reports || null,
        bug_flagged_turns: metadata?.bug_flagged_turns || null
      }
    } catch (e) {
      return null
    }
  }, [callData])

  // Check for bug report flags
  const checkBugReportFlags = useMemo(() => {
    const bugReportTurnIds = new Set()

    // Use metadata bug_flagged_turns
    if (bugReportData?.bug_flagged_turns && Array.isArray(bugReportData.bug_flagged_turns)) {
      bugReportData.bug_flagged_turns.forEach((flaggedTurn: any) => {
        if (flaggedTurn.turn_id) {
          bugReportTurnIds.add(flaggedTurn.turn_id.toString())
        }
      })
    }

    // Fallback: Check transcript logs for explicit bug_report flags
    if (traceData?.length) {
      traceData.forEach((log: TraceLog) => {
        if (log.bug_report === true) {
          bugReportTurnIds.add(log.turn_id.toString())
        }
      })
    }

    return bugReportTurnIds
  }, [traceData, bugReportData])

  // Filter and process data
  const processedTraces = useMemo(() => {
    if (traceData?.length) {
      const filtered = traceData.filter((item: TraceLog) => 
        item.user_transcript || item.agent_response || item.tool_calls?.length || item.otel_spans?.length
      )
    
      filtered.sort((a, b) => {
        const aTurnNum = parseInt(a.turn_id.replace('turn_', '')) || 0
        const bTurnNum = parseInt(b.turn_id.replace('turn_', '')) || 0
        return aTurnNum - bTurnNum
      })

      // If at least one turn has actual transcript text, use the metrics data.
      // Otherwise fall through to transcript_json so the conversation is still visible.
      const hasTranscriptContent = filtered.some(t => t.user_transcript || t.agent_response)
      if (hasTranscriptContent) return filtered
    }

    // Fallback: build traces from transcript_json in call_logs.
    // Used when metrics logs are absent OR contain no transcript text.
    if (callData?.length) {
      const call = callData[0]
      let transcriptJson = call?.transcript_json
      if (!transcriptJson) return []

      if (typeof transcriptJson === 'string') {
        try { transcriptJson = JSON.parse(transcriptJson) } catch { return [] }
      }
      if (!Array.isArray(transcriptJson) || transcriptJson.length === 0) return []

      // Pair messages into conversation turns: each turn holds one user message
      // and the immediately following assistant reply (or vice-versa for agent-opens flows).
      const getText = (msg: any): string => {
        const c = msg.content
        if (Array.isArray(c)) return c.join(' ').trim()
        return (c || '').trim()
      }

      const turns: TraceLog[] = []
      let turnIdx = 0
      let i = 0

      while (i < transcriptJson.length) {
        const msg = transcriptJson[i]
        const role = msg.role?.toLowerCase()
        const text = getText(msg)

        if (!text) { i++; continue }

        if (role === 'assistant') {
          // Whether assistant[i] is followed by a user message (opening
          // greeting) or is an orphan message at the end, it's emitted as
          // its own standalone turn either way.
          turns.push({
            id: `transcript_${turnIdx}`,
            session_id: call.id,
            turn_id: `turn_${turnIdx + 1}`,
            user_transcript: '',
            agent_response: text,
            created_at: call.created_at,
            unix_timestamp: turnIdx,
          } as TraceLog)
          turnIdx++
          i++
        } else if (role === 'user') {
          // Pair user message with the immediately following assistant reply
          const nextMsg = transcriptJson[i + 1]
          const nextRole = nextMsg?.role?.toLowerCase()
          const nextText = nextMsg ? getText(nextMsg) : ''

          if (nextRole === 'assistant' && nextText) {
            turns.push({
              id: `transcript_${turnIdx}`,
              session_id: call.id,
              turn_id: `turn_${turnIdx + 1}`,
              user_transcript: text,
              agent_response: nextText,
              created_at: call.created_at,
              unix_timestamp: turnIdx,
            } as TraceLog)
            turnIdx++
            i += 2 // consume both
          } else {
            // User message with no following assistant reply
            turns.push({
              id: `transcript_${turnIdx}`,
              session_id: call.id,
              turn_id: `turn_${turnIdx + 1}`,
              user_transcript: text,
              agent_response: '',
              created_at: call.created_at,
              unix_timestamp: turnIdx,
            } as TraceLog)
            turnIdx++
            i++
          }
        } else {
          i++
        }
      }

      return turns.filter(t => t.user_transcript || t.agent_response)
    }

    return []
  }, [traceData, callData])

  // Enrich turns that have no tool_calls using the targeted functionToolSpans fetch.
  // In LiveKit's span structure, function_tool is a child of agent_turn which
  // is a sibling of user_turn — no user_turn ancestor exists, so match by time.
  const enrichedTraces = useMemo(() => {
    if (!processedTraces.length || !functionToolSpans.length) return processedTraces

    // captured_at is an ISO string ("2026-04-07T10:05:23.763").
    // start_time_ns is a nanosecond integer. Convert to seconds for comparison.
    const toUnixSec = (span: any): number | null => {
      if (span.start_time_ns) return span.start_time_ns / 1e9
      if (span.captured_at) return new Date(span.captured_at + 'Z').getTime() / 1000
      return null
    }

    // Assign each function_tool span to the closest TraceLog turn (within 120s).
    const toolsByTurnId = new Map<string, any[]>()
    functionToolSpans.forEach((toolSpan: any) => {
      const spanSec = toUnixSec(toolSpan)
      if (spanSec === null) return

      let closestTurn: TraceLog | null = null
      let minDiff = Infinity
      processedTraces.forEach((turn: TraceLog) => {
        const diff = Math.abs(turn.unix_timestamp - spanSec)
        if (diff < minDiff) { minDiff = diff; closestTurn = turn }
      })

      if (closestTurn && minDiff < 120) {
        const id = (closestTurn as TraceLog).turn_id
        if (!toolsByTurnId.has(id)) toolsByTurnId.set(id, [])
        toolsByTurnId.get(id)!.push(toolSpan)
      }
    })

    if (!toolsByTurnId.size) return processedTraces

    return processedTraces.map((turn: TraceLog) => {
      if (turn.tool_calls?.length) return turn
      const toolSpans = toolsByTurnId.get(turn.turn_id)
      if (!toolSpans?.length) return turn

      return {
        ...turn,
        tool_calls: toolSpans.map((s: any) => {
          const a = s.attributes || {}
          // LiveKit OTEL attribute keys for function_tool spans
          const toolName = a['lk.function_tool.name'] ?? a['livekit.function.name'] ?? a['function.name'] ?? 'unknown'
          const rawArgs = a['lk.function_tool.arguments'] ?? a['lk.pii.function_tool.arguments'] ?? a['livekit.function.arguments'] ?? a['function.arguments'] ?? null
          let args: any = null
          if (rawArgs) {
            try { args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs } catch { args = rawArgs }
          }
          const result = a['lk.function_tool.output'] ?? a['lk.pii.function_tool.output'] ?? a['livekit.function.result'] ?? a['function.result'] ?? undefined
          const isError = a['lk.function_tool.is_error'] === true || s.status?.code === 2 || s.status === 'error'
          return {
            tool_name: toolName,
            name: toolName,
            arguments: args,
            result,
            success: !isError,
            status: isError ? 'error' : 'success',
            duration_ms: s.duration_ms,
          }
        }),
      }
    })
  }, [processedTraces, functionToolSpans])

  return {
    sessionTrace, callData, traceData, traceDataLoading, error,
    bugReportData, checkBugReportFlags, turns: enrichedTraces as TraceLog[],
  }
}
