// src/components/observability/TracesTable.tsx
"use client"

import { useState, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Clock, CheckCircle, XCircle, AlertTriangle, Wrench, TrendingUp, Brain, Mic, Volume2 } from "lucide-react"
import { useSupabaseQuery } from "../../hooks/useSupabase"
import TraceDetailSheet from "./TraceDetailSheet"
import { cn } from "@/lib/utils"

interface TracesTableProps {
  agentId: string
  sessionId?: string
  filters: {
    search: string
    status: string
    timeRange: string
  }
}

interface TraceLog {
  id: string
  session_id: string
  turn_id: string
  user_transcript: string
  agent_response: string
  trace_id?: string
  otel_spans?: any[]
  tool_calls?: any[]
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
}

const TracesTable: React.FC<TracesTableProps> = ({ agentId, sessionId, filters }) => {
  const [selectedTrace, setSelectedTrace] = useState<TraceLog | null>(null)
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false)

  // trace data
  const { data: traceData, loading, error } = useSupabaseQuery("pype_voice_metrics_logs", {
    select: "*",
    filters: sessionId 
      ? [{ column: "session_id", operator: "eq", value: sessionId }]
      : [{ column: "session_id::text", operator: "like", value: `${agentId}%` }],
    orderBy: { column: "created_at", ascending: false }
  })

  // Filter and process data
  const processedTraces = useMemo(() => {
    if (!traceData?.length) return []
    
    let filtered = traceData.filter((item: TraceLog) => 
      item.user_transcript || item.agent_response || item.tool_calls?.length || item.otel_spans?.length
    )
  
    return filtered
  }, [traceData, filters])

  const getTraceStatus = (trace: TraceLog) => {
    const spans = trace.otel_spans || []
    const toolErrors = trace.tool_calls?.some(tool => tool.status === 'error' || tool.success === false)
    const hasLLMError = trace.llm_metrics && Object.keys(trace.llm_metrics).length === 0
    const callFailed = trace.call_success === false
    
    if (spans.some((span: any) => span.status === "error") || toolErrors || hasLLMError || callFailed) return "error"
    if (spans.some((span: any) => span.status === "warning") || !trace.call_success) return "warning"
    return "success"
  }

  const getMainOperation = (trace: TraceLog) => {
    // Determine the main operation type based on available data
    if (trace.tool_calls?.length) return "tool"
    if (trace.llm_metrics && Object.keys(trace.llm_metrics).length > 0) return "llm"
    if (trace.stt_metrics && Object.keys(trace.stt_metrics).length > 0) return "stt"
    if (trace.tts_metrics && Object.keys(trace.tts_metrics).length > 0) return "tts"
    return "general"
  }

  const getOperationIcon = (operation: string) => {
    switch (operation) {
      case "tool": return <Wrench className="w-3 h-3" />
      case "llm": return <Brain className="w-3 h-3" />
      case "stt": return <Mic className="w-3 h-3" />
      case "tts": return <Volume2 className="w-3 h-3" />
      default: return <Clock className="w-3 h-3" />
    }
  }

  const getOperationColor = (operation: string) => {
    switch (operation) {
      case "tool": return "text-orange-600"
      case "llm": return "text-purple-600"
      case "stt": return "text-blue-600"
      case "tts": return "text-green-600"
      default: return "text-gray-600"
    }
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
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

  const truncateText = (text: string, maxLength: number = 50) => {
    if (!text) return ""
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + "..."
  }

  const getToolCallsInfo = (toolCalls: any[] = []) => {
    const total = toolCalls.length
    const successful = toolCalls.filter(tool => tool.status === 'success' || tool.success !== false).length
    return { total, successful }
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
    return metrics
  }

  const getTotalDuration = (trace: TraceLog) => {
    // Try to get duration from trace_duration_ms first
    if (trace.trace_duration_ms) return trace.trace_duration_ms

    
    // Calculate from spans
    if (trace.otel_spans?.length) {
      return trace.otel_spans.reduce((total, span) => total + (span.duration_ms || 0), 0)
    }
    
    // Calculate from individual metrics
    let total = 0
    if (trace.stt_metrics?.duration) total += trace.stt_metrics.duration * 1000 // Convert to ms
    if (trace.llm_metrics?.ttft) total += trace.llm_metrics.ttft * 1000
    if (trace.tts_metrics?.ttfb) total += trace.tts_metrics.ttfb * 1000
    
    return total
  }

  const handleRowClick = (trace: TraceLog) => {
    setSelectedTrace(trace)
    setIsDetailSheetOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-gray-500">Loading traces...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-red-600 text-sm">
          Error loading traces: {error}
        </div>
      </div>
    )
  }


  

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Compact Header */}
        <div className="border-b bg-gray-50/30 px-4 py-2">
          <div className="grid grid-cols-12 gap-3 text-xs font-medium text-gray-600 uppercase tracking-wide">
            <div className="col-span-2">Trace Info</div>
            <div className="col-span-4">Conversation</div>
            <div className="col-span-2">Operations</div>
            <div className="col-span-1">Duration</div>
            <div className="col-span-1">Cost</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1">Time</div>
          </div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto">
          {processedTraces.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-sm text-gray-500">
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
            <div className="divide-y divide-gray-100">
              {processedTraces.map((trace: TraceLog) => {
                const status = getTraceStatus(trace)
                const toolInfo = getToolCallsInfo(trace.tool_calls)
                const mainOp = getMainOperation(trace)
                const metrics = getMetricsInfo(trace)
                const duration = getTotalDuration(trace)

                console.log({trace})
                
                return (
                  <div
                    key={trace.id}
                    onClick={() => handleRowClick(trace)}
                    className="grid grid-cols-12 gap-3 px-4 py-2.5 hover:bg-blue-50/30 cursor-pointer border-l-2 border-l-transparent hover:border-l-blue-500 transition-all text-sm"
                  >
                    {/* Trace Info */}
                    <div className="col-span-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <div className={cn("text-sm", getOperationColor(mainOp))}>
                          {getOperationIcon(mainOp)}
                        </div>
                        <div className="font-mono text-xs text-blue-600 font-semibold">
                          {trace.trace_id ? `${trace.trace_id.slice(0, 8)}...` : `Turn-${trace.turn_id}`}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 space-y-0.5">
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
                          <span className="text-blue-600 font-medium">→</span>
                          <span className="ml-1 text-gray-800">{truncateText(trace.user_transcript, 60)}</span>
                        </div>
                      )}
                      {trace.agent_response && (
                        <div className="text-xs">
                          <span className="text-gray-500 font-medium">←</span>
                          <span className="ml-1 text-gray-600">{truncateText(trace.agent_response, 60)}</span>
                        </div>
                      )}
                      {!trace.user_transcript && !trace.agent_response && (
                        <div className="text-xs text-gray-400 italic">
                          {trace.lesson_day ? `Lesson Day ${trace.lesson_day}` : 'System operation'}
                        </div>
                      )}
                    </div>

                    {/* Operations */}
                    <div className="col-span-2 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {toolInfo.total > 0 && (
                          <div className="flex items-center gap-1 text-xs">
                            <Wrench className="w-3 h-3 text-orange-600" />
                            <span className="font-medium text-orange-700">{toolInfo.total}</span>
                            <span className="text-gray-400">
                              ({toolInfo.successful}✓)
                            </span>
                          </div>
                        )}
                        {metrics.length > 0 && (
                          <div className="flex gap-1">
                            {metrics.map((metric, idx) => (
                              <Badge key={idx} variant="outline" className="text-[10px] px-1 py-0">
                                {metric.type}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {trace.otel_spans?.length || 0} spans
                      </div>
                    </div>

                    {/* Duration */}
                    <div className="col-span-1">
                      <span className={cn(
                        "text-xs font-semibold",
                        duration === 0 ? "text-gray-400" : 
                        duration > 5000 ? "text-red-600" :
                        duration > 2000 ? "text-amber-600" : "text-green-600"
                      )}>
                        {duration > 0 ? formatDuration(duration) : "N/A"}
                      </span>
                    </div>

                    {/* Cost */}
                    <div className="col-span-1">
                      <span className="text-xs font-semibold text-purple-600">
                        {trace.trace_cost_usd ? formatCost(parseFloat(trace.trace_cost_usd.toString())) : "N/A"}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="col-span-1">
                      <div className="flex items-center">
                        {status === "error" ? (
                          <XCircle className="w-4 h-4 text-red-500" />
                        ) : status === "warning" ? (
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                    </div>

                    {/* Time */}
                    <div className="col-span-1">
                      <span className="text-xs text-gray-500">
                        {formatRelativeTime(trace.created_at)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Trace Detail Sheet */}
      <TraceDetailSheet
        isOpen={isDetailSheetOpen}
        trace={selectedTrace}
        onClose={() => {
          setIsDetailSheetOpen(false)
          setSelectedTrace(null)
        }}
      />
    </>
  )
}

export default TracesTable