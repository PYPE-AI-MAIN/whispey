// src/components/observability/TracesTable.tsx
"use client"

import { useState, useMemo, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, CheckCircle, XCircle, AlertTriangle, Wrench, TrendingUp, Brain, Mic, Volume2, Activity, Download, Loader2, Copy, Check } from "lucide-react"
import { OTelSpan } from "@/types/openTelemetry";
import { useSupabaseQuery } from "../../hooks/useSupabase"
import TraceDetailSheet from "./TraceDetailSheet/TraceDetailSheet"
import { cn } from "@/lib/utils"
import { useSessionTrace, useSessionSpansInfinite } from "@/hooks/useSessionTrace" // Changed import
import SessionTraceView from "./SessionTraceView"
import WaterfallView from "./WaterFallView";
import ConfigTab from "./ConfigTab";
import { getAgentPlatform } from "@/utils/agentDetection";
import { formatProviderLabel } from "@/utils/providerDisplay";
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useTranscriptEnglishToggle } from "@/hooks/useTranscriptEnglishToggle"
import { useCallTranscript, type TraceLog } from "@/hooks/useCallTranscript"
import { useConfigTabAccess } from "@/hooks/useConfigTabAccess"

interface TracesTableProps {
  agentId: string
  projectId?: string
  sessionId?: string
  agent?: any
  filters: {
    search: string
    status: string
    timeRange: string
  }
}



// Shared metrics-logs select lives with the transcript hook; re-exported for ObservabilityStats.
export { METRICS_LOGS_SELECT } from "@/hooks/useCallTranscript"

// Extracted so TracesTable's row-render callback doesn't carry this branching itself
// (keeps that callback's cognitive complexity down).
function getLatencyColorClass(latency: number): string {
  if (latency === 0) return "text-gray-400 dark:text-gray-500"
  if (latency > 5000) return "text-red-600 dark:text-red-400"
  if (latency > 2000) return "text-amber-600 dark:text-amber-400"
  return "text-emerald-600 dark:text-emerald-400"
}

function getStatusIcon(status: string) {
  if (status === "bug_report") return <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400" />
  if (status === "error") return <XCircle className="w-4 h-4 text-red-500 dark:text-red-400" />
  if (status === "warning") return <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
  return <CheckCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
}

// One tool-call line in the Conversation column — pulled out of the row map so its
// own conditionals don't add to the row callback's cognitive complexity.
function ToolCallLine({ tool, idx }: Readonly<{ tool: any; idx: number }>) {
  const toolName = tool.tool_name || tool.name || 'unknown'
  const isError = tool.success === false || tool.status === 'error'
  const result = tool.result === undefined ? null : String(tool.result)
  const argKeys = tool.arguments && typeof tool.arguments === 'object'
    ? Object.keys(tool.arguments)
    : []
  return (
    <div key={idx} className="flex items-start gap-1 text-xs">
      <Wrench className={cn(
        "w-3 h-3 mt-0.5 shrink-0",
        isError ? "text-red-500 dark:text-red-400" : "text-amber-500 dark:text-amber-400"
      )} />
      <div className="min-w-0">
        <span className={cn(
          "font-medium",
          isError ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-400"
        )}>
          {toolName}
        </span>
        {argKeys.length > 0 && (
          <span className="text-gray-400 dark:text-gray-500 font-mono ml-1">
            ({argKeys.join(', ')})
          </span>
        )}
        {result && (
          <span className="text-gray-500 dark:text-gray-400 ml-1">
            → {result.length > 60 ? result.slice(0, 60) + '…' : result}
          </span>
        )}
        {isError && (
          <span className="ml-1 text-red-500 dark:text-red-400 font-medium">✗ failed</span>
        )}
      </div>
    </div>
  )
}

// One fallback-event line — same reasoning as ToolCallLine above.
function FallbackEventLine({ fb, idx }: Readonly<{ fb: any; idx: number }>) {
  const isRecovery = fb.event_type === 'provider_recovered'
  const isTotalFailure = !isRecovery && fb.all_providers_failed
  const eventKey = `${fb.provider_type}-${fb.event_type}-${fb.timestamp}-${idx}`

  let icon = <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-red-500 dark:text-red-400" />
  let textClass = "text-red-700 dark:text-red-300"
  let summary = `${fb.provider_type || 'Provider'} fallback: ${fb.provider_label || formatProviderLabel(fb.provider_name)} → ${fb.fallback_label || formatProviderLabel(fb.fallback_provider)}`
  if (isRecovery) {
    icon = <CheckCircle className="w-3 h-3 mt-0.5 shrink-0 text-emerald-500 dark:text-emerald-400" />
    textClass = "text-emerald-700 dark:text-emerald-300"
    summary = `${fb.provider_type || 'Provider'} recovered: ${fb.provider_label || formatProviderLabel(fb.provider_name)}`
  } else if (isTotalFailure) {
    icon = <XCircle className="w-3 h-3 mt-0.5 shrink-0 text-red-500 dark:text-red-400" />
    summary = `${fb.provider_type || 'Provider'} failed, no fallback available: ${fb.provider_label || formatProviderLabel(fb.provider_name)}`
  }

  return (
    <div key={eventKey} className="flex items-start gap-1 text-xs">
      {icon}
      <span className={textClass}>{summary}</span>
      {!isRecovery && fb.error_reason && (
        <span className="text-gray-400 dark:text-gray-500">
          — {fb.error_reason.length > 50 ? fb.error_reason.slice(0, 50) + '…' : fb.error_reason}
        </span>
      )}
    </div>
  )
}

const TracesTable: React.FC<TracesTableProps> = ({ agentId, projectId, agent, sessionId, filters }) => { // NOSONAR javascript:S3776

  const canViewConfig = useConfigTabAccess(projectId)
  const [selectedTrace, setSelectedTrace] = useState<TraceLog | null>(null)
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("turns");


  const { data: sessionTrace, isLoading: traceLoading } = useSessionTrace(sessionId || null, agentId);

  // Fetch spans only when the user opens the "trace" or "waterfall" tab —
  // the full span set is large (~600kB) and only needed for those views.
  const spansEnabled = activeTab === "trace" || activeTab === "waterfall";
  const {
    allSpans: sessionSpans,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isLoading: spansLoading,
    totalCount: totalSpansCount
  } = useSessionSpansInfinite(sessionTrace, spansEnabled, agentId);




  const isVapiAgent = useMemo(() => {
    if (!agent) return false
    
    const hasVapiKeys = Boolean(agent.vapi_api_key_encrypted && agent.vapi_project_key_encrypted)
    const hasVapiConfig = Boolean(agent?.configuration?.vapi?.assistantId)
    const isVapiType = agent.agent_type === 'vapi'
    
    return hasVapiKeys || hasVapiConfig || isVapiType
  }, [agent])


  const {
    callData, traceDataLoading, error, bugReportData, checkBugReportFlags, turns: enrichedTraces,
  } = useCallTranscript({ sessionId, agentId })

  const { viewEnglish, setViewEnglish, isTranslating, formatTranscript } =
    useTranscriptEnglishToggle(enrichedTraces)

  const getTraceStatus = (trace: TraceLog) => {
    // Check if this turn is flagged for bug reports
    if (checkBugReportFlags.has(trace.turn_id.toString())) {
      return "bug_report"
    }

    const spans = trace.otel_spans || []
    const toolErrors = trace.tool_calls?.some(tool => tool.status === 'error' || tool.success === false)
    const hasLLMError = trace.llm_metrics && Object.keys(trace.llm_metrics).length === 0
    const callFailed = trace.call_success === false
    
    if (spans.some((span: OTelSpan) => span.status?.code === 'ERROR' || span.status?.code === 2) || toolErrors || hasLLMError || callFailed) return "error"
    if (spans.some((span: OTelSpan) => span.status?.code === 'UNSET') || !trace.call_success) return "warning"
    return "success"
  }

  const getMainOperation = (trace: TraceLog) => {
    // Determine the main operation type based on available data
    if (trace.tool_calls?.length) return "tool"
    if (trace.llm_metrics && Object.keys(trace.llm_metrics).length > 0) return "llm"
    if (trace.stt_metrics && Object.keys(trace.stt_metrics).length > 0) return "stt"
    if (trace.tts_metrics && Object.keys(trace.tts_metrics).length > 0) return "tts"
    if (trace.eou_metrics && Object.keys(trace.eou_metrics).length > 0) return "eou"
    return "general"
  }

  const getOperationIcon = (operation: string) => {
    switch (operation) {
      case "tool": return <Wrench className="w-3 h-3" />
      case "eou": return <Activity className="w-3 h-3" />
      case "llm": return <Brain className="w-3 h-3" />
      case "stt": return <Mic className="w-3 h-3" />
      case "tts": return <Volume2 className="w-3 h-3" />
      default: return <Clock className="w-3 h-3" />
    }
  }

  // Each operation already has its own icon (see getOperationIcon above) — color
  // doesn't need to re-encode the same distinction. Reserved for "tool" only,
  // since a tool call is the one thing in this column worth scanning for; every
  // other stage (stt/llm/tts/eou) reads as plain text like the rest of the row.
  // (Previously stt/llm/tts/eou each had their own hue, and "eou" and "tool"
  // shared the same orange — neither told you anything the icon didn't.)

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(1)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }
  const formatCost = (cost: number) => {
    if (cost < 0.000001) return "~$0"
    return `$${cost.toFixed(6)}`
  }

  const formatRelativeTime = (timestamp: string) => {
    const now = Date.now()
    const time = new Date(timestamp).getTime()
    const diff = now - time
    
    if (diff < 60 * 1000) return `${Math.floor(diff / 1000)}s`
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}m`
    if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}h`
    return `${Math.floor(diff / (24 * 60 * 60 * 1000))}d`
  }


  const getToolCallsInfo = (toolCalls: any[] = []) => {
    const total = toolCalls.length
    const successful = toolCalls.filter(tool => tool.status === 'success' || tool.success !== false).length
    return { total, successful }
  }

  const getFallbackEvents = (trace: TraceLog): any[] => {
    return trace.enhanced_data?.fallback_events || []
  }

  const getMetricsInfo = (trace: TraceLog) => {
    const metrics = []
    if (trace.stt_metrics && Object.keys(trace.stt_metrics).length > 0) {
      metrics.push({ type: 'STT', duration: trace.stt_metrics.duration })
    }
    if (trace.llm_metrics && Object.keys(trace.llm_metrics).length > 0) {
      metrics.push({ type: 'LLM', ttft: trace.llm_metrics.ttft })
    }
    if (trace.tts_metrics && Object.keys(trace.tts_metrics).length > 0) {
      metrics.push({ type: 'TTS', ttfb: trace.tts_metrics.ttfb })
    }
    if (trace.eou_metrics && Object.keys(trace.eou_metrics).length > 0) {
      metrics.push({ type: 'EOU', delay: trace.eou_metrics.end_of_utterance_delay })
    }
    return metrics
  }

  const getTotalLatency = (trace: TraceLog) => {
    let total = 0
    
    if (isVapiAgent && trace.stt_metrics?.duration) {
      total += trace.stt_metrics.duration * 1000 // Convert seconds to ms
    }
  
    // LLM TTFT (always include for all platforms)
    if (trace.llm_metrics?.ttft) {
      total += trace.llm_metrics.ttft * 1000 // Convert seconds to ms
    }
  
    // TTS TTFB (always include for all platforms)  
    if (trace.tts_metrics?.ttfb) {
      total += trace.tts_metrics.ttfb * 1000 // Convert seconds to ms
    }
  
    // EOU metrics (always include for all platforms)
    if (trace.eou_metrics?.end_of_utterance_delay) {
      total += trace.eou_metrics.end_of_utterance_delay * 1000
    }
  
    return total
  }

  const [copied, setCopied] = useState(false)

  const copyTranscript = () => {
    if (!enrichedTraces.length) return
    const lines: string[] = []

    const stringifyToolValue = (val: any) => {
      if (val === undefined || val === null) return ''
      if (typeof val === 'string') return val
      try { return JSON.stringify(val) } catch { return String(val) }
    }

    enrichedTraces.forEach((trace: TraceLog) => {
      if (trace.user_transcript?.trim()) lines.push(`User: ${trace.user_transcript.trim()}`)

      // Tool calls sit between the user turn and the agent response, matching the transcript order.
      if (trace.tool_calls?.length) {
        trace.tool_calls.forEach((tool: any) => {
          const name = tool.tool_name || tool.name || 'unknown'
          const args = stringifyToolValue(tool.arguments)
          const result = tool.error == null ? stringifyToolValue(tool.result) : stringifyToolValue(tool.error)
          const ok = tool.success !== false && tool.status !== 'error'
          const status = ok ? '' : ' [error]'
          const resultSuffix = result ? ` -> ${result}` : ''
          lines.push(`Tool call${status}: ${name}(${args})${resultSuffix}`)
        })
      }

      if (trace.agent_response?.trim())  lines.push(`Agent: ${trace.agent_response.trim()}`)
    })
    navigator.clipboard.writeText(lines.join('\n\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const downloadFullTranscript = () => {
    if (!enrichedTraces.length) return

    // Format all conversation turns as JSON
    const transcriptData = {
      session_id: sessionId || 'unknown',
      agent_id: agentId,
      total_turns: enrichedTraces.length,
      exported_at: new Date().toISOString(),
      turns: enrichedTraces.map((trace: TraceLog) => {
        const turnData: any = {
          turn_id: trace.turn_id,
        }
        
        // Add user transcript if available
        if (trace.user_transcript && trace.user_transcript.trim()) {
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
        if (trace.agent_response && trace.agent_response.trim()) {
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

    // Create JSON string with pretty formatting
    const transcriptJson = JSON.stringify(transcriptData, null, 2)

    // Create filename with session ID and timestamp
    const sessionIdShort = sessionId ? sessionId.slice(-8) : 'unknown'
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const filename = `transcript-session-${sessionIdShort}-${timestamp}.json`

    // Create blob and download
    const blob = new Blob([transcriptJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }


const handleRowClick = (trace: TraceLog) => {
  const hasBugReport = checkBugReportFlags.has(trace.turn_id.toString())
  
  const relevantBugReports = bugReportData?.bug_reports?.filter((report: any) => {
    const reportFlaggedTurns = bugReportData?.bug_flagged_turns?.filter(
      (flaggedTurn: any) => flaggedTurn.bug_report_id === report.id || 
      flaggedTurn.timestamp === report.timestamp
    ) || []
    
    return reportFlaggedTurns.some((flaggedTurn: any) => 
      flaggedTurn.turn_id.toString() === trace.turn_id.toString()
    )
  }) || []

  const enrichedTrace = {
    ...trace,
    bug_report: hasBugReport,
    bug_report_data: {
      ...bugReportData,
      bug_reports: relevantBugReports
    }
  }
  
  setSelectedTrace(enrichedTrace)
  setIsDetailSheetOpen(true)
}

  if (traceDataLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-gray-900">
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading traces...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-gray-900">
        <div className="text-center text-red-600 dark:text-red-400 text-sm">
          Error loading traces: {error.message}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col h-full bg-white dark:bg-gray-900">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 px-3 py-1.5">
          <div className="flex items-center justify-between">
            <nav className="flex space-x-2">
              <button 
                onClick={() => setActiveTab("turns")}
                className={cn(
                  "px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors",
                  activeTab === "turns" 
                    ? "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800" 
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                )}
              >
                Turns ({enrichedTraces.length})
              </button>
            {sessionTrace && (
            <>
              <button 
                onClick={() => setActiveTab("trace")}
                className={cn(
                  "px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors",
                  activeTab === "trace" 
                    ? "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800" 
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                )}
              >
                Trace {spansLoading ? "…" : totalSpansCount > 0 ? `(${totalSpansCount})` : ""}
              </button>
              <button 
                onClick={() => setActiveTab("waterfall")}
                className={cn(
                  "px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors",
                  activeTab === "waterfall" 
                    ? "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800" 
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                )}
              >
                Timeline {spansLoading ? "…" : totalSpansCount > 0 ? `(${totalSpansCount})` : ""}
              </button>
            </>
          )}
          {canViewConfig && (
            <button
              onClick={() => setActiveTab("config")}
              className={cn(
                "px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors",
                activeTab === "config"
                  ? "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              )}
            >
              Config
            </button>
          )}
          </nav>
          
          {/* Transcript: English toggle + download */}
          {activeTab === "turns" && enrichedTraces.length > 0 && (
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <Switch
                  id="transcript-view-english"
                  checked={viewEnglish}
                  onCheckedChange={setViewEnglish}
                  disabled={isTranslating}
                  aria-label="Show transcript in English"
                />
                <Label
                  htmlFor="transcript-view-english"
                  className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer whitespace-nowrap"
                >
                  English
                </Label>
                {isTranslating && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-500" aria-hidden />
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadFullTranscript}
                className="h-8 text-xs flex items-center gap-1.5"
              >
                <Download className="w-3 h-3" />
                Download Transcript
              </Button>
            </div>
          )}
          </div>
        </div>
  
        {/* Tab Content */}
        {activeTab === "turns" && (
          <>
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 px-4 py-2">
              <div className="grid grid-cols-12 gap-3 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                <div className="col-span-3">Trace Info</div>
                <div className="col-span-4 flex items-center gap-2">
                  Conversation
                  <button
                    onClick={copyTranscript}
                    title="Copy transcript"
                    className="flex items-center gap-1 text-[11px] font-normal normal-case tracking-normal text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  >
                    {copied
                      ? <><Check className="w-3 h-3 text-emerald-500" /><span className="text-emerald-500">Copied</span></>
                      : <><Copy className="w-3 h-3" /><span>Copy</span></>
                    }
                  </button>
                </div>
                <div className="col-span-2">Operations</div>
                <div className="col-span-1">Latency</div>
                <div className="col-span-1">Cost</div>
                <div className="col-span-1">Status</div>
              </div>
            </div>
  
            {/* Table Body */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
              {enrichedTraces.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-sm text-gray-500 dark:text-gray-400">
                    <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <div>No traces found</div>
                    {filters.search || filters.status !== "all" ? (
                      <div className="text-xs mt-1">Try adjusting your filters</div>
                    ) : (
                      <div className="text-xs mt-1">Traces will appear here when data is available</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {enrichedTraces.map((trace: TraceLog) => {
                    const status = getTraceStatus(trace)
                    const toolInfo = getToolCallsInfo(trace.tool_calls)
                    const mainOp = getMainOperation(trace)
                    const metrics = getMetricsInfo(trace)
                    const fallbackEvents = getFallbackEvents(trace)
                    const fallbackFailureCount = fallbackEvents.filter((fb: any) => fb.event_type !== 'provider_recovered').length
                    const latency = getTotalLatency(trace)
                    const hasBugReport = checkBugReportFlags.has(trace.turn_id.toString())
                    const spansLength = trace.otel_spans?.length || 0
                    
                    return (
                      <button
                        type="button"
                        key={trace.id}
                        onClick={() => handleRowClick(trace)}
                        className={cn(
                          "w-full appearance-none bg-transparent text-left grid grid-cols-12 gap-3 px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer border-l-2 transition-all text-sm",
                          hasBugReport
                            ? "border-l-red-500 bg-red-50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20"
                            : "border-l-transparent hover:border-l-blue-500 dark:hover:border-l-blue-400"
                        )}
                      >
                        {/* Trace Info */}
                        <div className="col-span-3 space-y-1">
                          <div className="flex items-center gap-2">
                            {/* Every operation already has its own icon shape
                                (getOperationIcon above) and, for tool calls, its own
                                neutral badge in the Operations column — a colored
                                icon here too would just compete for attention. */}
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {getOperationIcon(mainOp)}
                            </div>
                            <div className="font-mono text-xs text-blue-600 dark:text-blue-400 font-semibold">
                              {trace.trace_id ? `${trace.trace_id.slice(0, 8)}...` : `Turn-${trace.turn_id}`}
                            </div>
                            {hasBugReport && (
                              <div className="flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400" />
                                <Badge variant="destructive" className="text-xs px-1 py-0">
                                  Bug
                                </Badge>
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500 space-y-0.5">
                            <div>Session: {trace.session_id.slice(-8)}</div>
                            {trace.phone_number && (
                              <div>📞 {trace.phone_number.slice(-4)}</div>
                            )}
                          </div>
                        </div>
  
                        {/* Conversation */}
                        <div className="col-span-4 space-y-1">
                          {trace.user_transcript && (
                            <div className="text-xs">
                              <span className="text-blue-600 dark:text-blue-400 font-medium">→</span>
                              <span className="ml-1 text-gray-800 dark:text-gray-200">
                                {formatTranscript(trace.user_transcript)}
                              </span>
                            </div>
                          )}

                          {/* Tool calls — shown between user input and agent response */}
                          {trace.tool_calls && trace.tool_calls.length > 0 && (
                            <div className="space-y-0.5 pl-1 border-l-2 border-amber-300 dark:border-amber-800/60 ml-1">
                              {trace.tool_calls.map((tool: any, idx: number) => (
                                <ToolCallLine key={`${tool.tool_name || tool.name || 'unknown'}-${idx}`} tool={tool} idx={idx} />
                              ))}
                            </div>
                          )}

                          {trace.agent_response && (
                            <div className={cn(
                              "text-xs",
                              hasBugReport && "text-red-700 dark:text-red-300 font-medium"
                            )}>
                              <span className={cn(
                                "font-medium",
                                hasBugReport ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-gray-400"
                              )}>←</span>
                              <span className={cn(
                                "ml-1",
                                hasBugReport ? "text-red-800 dark:text-red-300" : "text-gray-600 dark:text-gray-300"
                              )}>{formatTranscript(trace.agent_response)}</span>
                              {hasBugReport && (
                                <span className="ml-2 text-red-600 dark:text-red-400 font-medium">[REPORTED]</span>
                              )}
                            </div>
                          )}
                          {/* Provider fallback events (STT/TTS/LLM failover) — short summary only,
                              same pattern as tool_calls: full detail lives in the row's detail
                              sheet (click row → Fallback Events card), not duplicated here. */}
                          {fallbackEvents.length > 0 && (
                            <div className="space-y-0.5 pl-1 border-l-2 border-red-200 dark:border-red-800 ml-1">
                              {fallbackEvents.map((fb: any, idx: number) => (
                                <FallbackEventLine key={`${fb.provider_type}-${fb.event_type}-${fb.timestamp}-${idx}`} fb={fb} idx={idx} />
                              ))}
                            </div>
                          )}

                          {!trace.user_transcript && !trace.agent_response && (!trace.tool_calls || trace.tool_calls.length === 0) && (
                            <div className="text-xs text-gray-400 dark:text-gray-500 italic">
                              {trace.lesson_day ? `Lesson Day ${trace.lesson_day}` : 'System operation'}
                            </div>
                          )}
                        </div>
  
                        {/* Operations */}
                        <div className="col-span-2 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {toolInfo.total > 0 && (
                              <div className="flex items-center gap-1 text-xs">
                                <Wrench className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                                <span className="font-medium text-amber-700 dark:text-amber-400">{toolInfo.total}</span>
                                <span className="text-gray-400 dark:text-gray-500">
                                  ({toolInfo.successful}✓)
                                </span>
                              </div>
                            )}
                            {metrics.length > 0 && (
                              <div className="flex gap-1">
                                {metrics.map((metric) => (
                                  <Badge key={metric.type} variant="outline" className="text-[11px] px-1 py-0 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800">
                                    {metric.type}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {fallbackFailureCount > 0 && (
                              <div className="flex items-center gap-1 text-xs">
                                <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400" />
                                <span className="font-medium text-red-700 dark:text-red-300">{fallbackFailureCount}</span>
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {spansLength > 0 ? `${spansLength} spans` : ""}
                          </div>
                        </div>
  
                        {/* Latency — same good/fair/bad shades ObservabilityStats' getLatencyColor
                            uses (was text-green-600 here, a different green from that component's
                            text-emerald-600 for the same "good" meaning) */}
                        <div className="col-span-1">
                          <span className={cn("text-xs font-semibold", getLatencyColorClass(latency))}>
                            {latency > 0 ? formatDuration(latency) : "N/A"}
                          </span>
                        </div>

                        {/* Cost — plain like Turns/Duration in the stats row above; a
                            number doesn't need its own hue unless it's signaling status */}
                        <div className="col-span-1">
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            {trace.trace_cost_usd ? formatCost(parseFloat(trace.trace_cost_usd.toString())) : "N/A"}
                          </span>
                        </div>

                        {/* Status */}
                        <div className="col-span-1">
                          <div className="flex items-center pl-5">
                            {getStatusIcon(status)}
                          </div>
                        </div>

                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
        
        {activeTab === "trace" && (
          <SessionTraceView 
            trace={sessionTrace} 
            loading={traceLoading || spansLoading}
            spans={sessionSpans}
            hasNextPage={hasNextPage}
            fetchNextPage={fetchNextPage}
            isFetchingNextPage={isFetchingNextPage}
            totalCount={totalSpansCount}
          />
        )}


        {activeTab === "waterfall" && (
          <WaterfallView 
            trace={{...sessionTrace, spans: sessionSpans}} 
            loading={traceLoading || spansLoading} 
          />
        )}

        {activeTab === "config" && canViewConfig && (
          <ConfigTab sessionId={sessionId} />
        )}
      </div>
  
      {/* Trace Detail Sheet */}
      <TraceDetailSheet
        isOpen={isDetailSheetOpen}
        trace={selectedTrace}
        agent={agent}
        recordingUrl={callData?.[0]?.recording_url}
        callStartTime={callData?.[0]?.call_started_at}
        formatTranscript={formatTranscript}
        onClose={() => {
          setIsDetailSheetOpen(false)
          setSelectedTrace(null)
        }}
      />
    </>
  )
}

export default TracesTable