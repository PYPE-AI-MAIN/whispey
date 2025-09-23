// src/components/observability/ObservabilityStats.tsx
"use client"

import { useMemo } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useSupabaseQuery } from "../../hooks/useSupabase"
import { cn } from "@/lib/utils"
import { Clock, MessageSquare, AlertTriangle, Activity, Mic, Brain, Volume2, Radio } from "lucide-react"

interface ObservabilityStatsProps {
  sessionId?: string
  agentId: string
  callData?: any[]
  agent?: any
}

interface TranscriptLog {
  id: string
  session_id: string
  turn_id: string
  user_transcript: string
  agent_response: string
  stt_metrics: any
  llm_metrics: any
  tts_metrics: any
  eou_metrics: any
  created_at: string
  unix_timestamp: number
  bug_report?: boolean
}

const ObservabilityStats: React.FC<ObservabilityStatsProps> = ({ sessionId, agentId, callData, agent }) => {
  const {
    data: transcriptLogs,
    loading: transcriptLoading,
  } = useSupabaseQuery("pype_voice_metrics_logs", {
    select: "*",
    filters: sessionId 
      ? [{ column: "session_id", operator: "eq", value: sessionId }]
      : [{ column: "session_id::text", operator: "like", value: `${agentId}%` }],
    orderBy: { column: "unix_timestamp", ascending: true },
  })

  const bugReportData = useMemo(() => {
    if (!callData?.length) return null
    try {
      const call = callData[0]
      if (!call?.metadata) return null
      
      const metadata = typeof call.metadata === "string" ? JSON.parse(call?.metadata?.toString() || "") : call?.metadata

      const bugData = metadata?.bug_flagged_turns || null
      return metadata?.bug_flagged_turns || null
    } catch (e) {
      return null
    }
  }, [callData])

  const isVapiAgent = useMemo(() => {
    if (!agent) return false
    
    const hasVapiKeys = Boolean(agent.vapi_api_key_encrypted && agent.vapi_project_key_encrypted)
    const hasVapiConfig = Boolean(agent?.configuration?.vapi?.assistantId)
    const isVapiType = agent.agent_type === 'vapi'
    
    return hasVapiKeys || hasVapiConfig || isVapiType
  }, [agent])

  const conversationMetrics: any = useMemo(() => {
    if (!transcriptLogs?.length) return null
   
    const metrics = {
      stt: [] as number[],
      llm: [] as number[],
      tts: [] as number[],
      eou: [] as number[],
      agentResponseLatencies: [] as number[],
      totalTurnLatencies: [] as number[],
      endToEndLatencies: [] as number[],
      totalTurns: transcriptLogs.length,
    }
   
    transcriptLogs.forEach((log: TranscriptLog) => {
      if (log.stt_metrics?.duration) metrics.stt.push(log.stt_metrics.duration)
      if (log.llm_metrics?.ttft) metrics.llm.push(log.llm_metrics.ttft)
      if (log.tts_metrics?.ttfb) metrics.tts.push(log.tts_metrics.ttfb)
      if (log.eou_metrics?.end_of_utterance_delay) metrics.eou.push(log.eou_metrics.end_of_utterance_delay)
   
      if (log.user_transcript && log.agent_response && log.llm_metrics?.ttft && log.tts_metrics) {
        const llmTime = log.llm_metrics.ttft || 0
        const ttsTime = (log.tts_metrics.ttfb || 0) + (log.tts_metrics.duration || 0)
        const agentResponseTime = llmTime + ttsTime
        metrics.agentResponseLatencies.push(agentResponseTime)
      }
   
      if (log.tts_metrics) {
        const sttTime = isVapiAgent ? (log.stt_metrics?.duration || 0) : 0
        const llmTime = log.llm_metrics?.ttft || 0
        const ttsTime = (log.tts_metrics?.ttfb || 0) + (log.tts_metrics?.duration || 0)
        const totalTurnTime = llmTime + ttsTime + sttTime
   
        if (totalTurnTime > 0) {
          metrics.totalTurnLatencies.push(totalTurnTime)
        }
      }
   
      if (
        log.eou_metrics?.end_of_utterance_delay &&
        log.llm_metrics?.ttft &&
        log.tts_metrics
      ) {
        const eouTime = log.eou_metrics.end_of_utterance_delay || 0
        const sttTime = isVapiAgent ? (log.stt_metrics?.duration || 0) : 0
        const llmTime = log.llm_metrics.ttft || 0
        const ttsTime = (log.tts_metrics?.ttfb || 0) + (log.tts_metrics?.duration || 0)
        const endToEndTime = eouTime + sttTime + llmTime + ttsTime
        metrics.endToEndLatencies.push(endToEndTime)
      }
    })
   
    const calculateStats = (values: number[]) => {
      if (values.length === 0) return { avg: 0, min: 0, max: 0, count: 0, p50: 0, p75: 0 }
      
      const sorted = [...values].sort((a, b) => a - b)
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length
      const min = Math.min(...values)
      const max = Math.max(...values)
      
      const getPercentile = (arr: number[], percentile: number) => {
        const index = Math.ceil((percentile / 100) * arr.length) - 1
        return arr[Math.max(0, Math.min(index, arr.length - 1))] || 0
      }
      
      const p50 = getPercentile(sorted, 50)
      const p75 = getPercentile(sorted, 75)
      
      return { avg, min, max, count: values.length, p50, p75 }
    }
   
    console.log({
      isVapiAgent,
      agentExists: !!agent,
      agentType: agent?.agent_type,
      totalTurnLatencies: metrics.totalTurnLatencies.slice(0, 5),
      endToEndLatencies: metrics.endToEndLatencies.slice(0, 5),
      p75EndToEnd: calculateStats(metrics.endToEndLatencies).p75
    })
   
    return {
      ...metrics,
      sttStats: calculateStats(metrics.stt),
      llmStats: calculateStats(metrics.llm),
      ttsStats: calculateStats(metrics.tts),
      eouStats: calculateStats(metrics.eou),
      agentResponseStats: calculateStats(metrics.agentResponseLatencies),
      totalTurnStats: calculateStats(metrics.totalTurnLatencies),
      endToEndStats: calculateStats(metrics.endToEndLatencies),
      p50TotalLatency: calculateStats(metrics.totalTurnLatencies).p50,
      p50AgentResponseTime: calculateStats(metrics.agentResponseLatencies).p50,
      p50EndToEndLatency: calculateStats(metrics.endToEndLatencies).p50,
    }
   }, [transcriptLogs, agent, isVapiAgent])

  const getLatencyColor = (value: number, type: "stt" | "llm" | "tts" | "eou" | "total" | "e2e") => {
    const thresholds = {
      stt: { good: 1, fair: 2 },
      llm: { good: 1, fair: 3 },
      tts: { good: 1, fair: 2 },
      eou: { good: 0.5, fair: 1.5 },
      total: { good: 3, fair: 6 },
      e2e: { good: 4, fair: 8 },
    }
    const threshold = thresholds[type]
    if (value <= threshold.good) return "text-emerald-600 dark:text-emerald-400"
    if (value <= threshold.fair) return "text-amber-600 dark:text-amber-400"
    return "text-red-600 dark:text-red-400"
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`
    return `${seconds.toFixed(1)}s`
  }

  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`
  }

  if (transcriptLoading) {
    return (
      <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
        <div className="animate-pulse">
          <div className="flex items-center justify-between mb-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-32"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-20"></div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-200 dark:bg-gray-600 rounded"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-12"></div>
                </div>
              ))}
            </div>
            <div className="flex gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="text-center">
                  <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-8 mb-1"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-6"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const callDuration = callData?.[0]?.duration_seconds || 0
  const bugCount = Array.isArray(bugReportData) ? bugReportData.length : 0
  const turnCount = transcriptLogs?.length || 0

  return (
    <TooltipProvider>
      <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Session Overview</h3>
            <div className="flex items-center gap-2">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {sessionId ? `Session ${sessionId.slice(0, 8)}...` : `Agent ${agentId.slice(0, 8)}...`}
              </div>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  isVapiAgent ? "bg-blue-500" : "bg-orange-500"
                )}></div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {isVapiAgent ? "Vapi" : "LiveKit"}
                  </span>
                </div>
              </div>
            </div>
            
          </div>
          
          {/* Stats Grid */}
          <div className="flex items-center justify-between">
            {/* Primary Stats */}
            <div className="flex items-center gap-8">
              {/* Turns */}
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{turnCount}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">turns</span>
                </div>
              </div>

              {/* Duration */}
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCallDuration(callDuration)}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">duration</span>
                </div>
              </div>

              {/* Overall P75 Latency */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 cursor-help">
                    <Activity className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <div className="flex items-baseline gap-1">
                      <span className={cn(
                        "text-lg font-bold",
                        conversationMetrics ? getLatencyColor(conversationMetrics.endToEndStats.p75, "e2e") : "text-gray-900 dark:text-gray-100"
                      )}>
                        {conversationMetrics?.endToEndStats.p75 > 0 ? formatDuration(conversationMetrics.endToEndStats.p75) : "N/A"}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">p75</span>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                  <div className="text-xs">
                    <div className="font-medium">75th Percentile End-to-End Latency</div>
                    <div className="text-gray-400 dark:text-gray-500">75% of responses were faster</div>
                    {conversationMetrics?.endToEndStats.p50 > 0 && (
                      <div className="text-gray-400 dark:text-gray-500">P50: {formatDuration(conversationMetrics.endToEndStats.p50)}</div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>

              {/* Bug Reports */}
              <div className={cn(
                "flex items-center gap-2",
                bugCount > 0 && "px-2 py-1 bg-amber-100 dark:bg-amber-900/20 rounded-md"
              )}>
                <AlertTriangle className={cn(
                  "w-4 h-4",
                  bugCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-500 dark:text-gray-400"
                )} />
                <div className="flex items-baseline gap-1">
                  <span className={cn(
                    "text-lg font-bold",
                    bugCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-gray-900 dark:text-gray-100"
                  )}>
                    {bugCount}
                  </span>
                  <span className={cn(
                    "text-xs",
                    bugCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-500 dark:text-gray-400"
                  )}>
                    bugs
                  </span>
                </div>
              </div>
            </div>

            {/* Performance Breakdown */}
            {conversationMetrics && (
            <div className="flex items-center gap-8 text-xs">
              {/* Pipeline Metrics Group */}
              <div className="flex items-center gap-6">
                {/* Conditionally include STT in pipeline group for Vapi */}
                {isVapiAgent && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 cursor-help">
                        <Mic className="w-3 h-3 text-blue-500" />
                        <div className="text-right">
                          <div className={cn("font-bold text-sm", getLatencyColor(conversationMetrics.sttStats.p75, "stt"))}>
                            {formatDuration(conversationMetrics.sttStats.p75)}
                          </div>
                          <div className="text-blue-600 dark:text-blue-400 text-xs">STT P75</div>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                      <div className="text-xs">
                        <div className="font-medium">Speech-to-Text Performance</div>
                        <div className="text-gray-400 dark:text-gray-500">P50: {formatDuration(conversationMetrics.sttStats.p50)}</div>
                        <div className="text-gray-400 dark:text-gray-500">P75: {formatDuration(conversationMetrics.sttStats.p75)}</div>
                        <div className="text-gray-400 dark:text-gray-500">Avg: {formatDuration(conversationMetrics.sttStats.avg)}</div>
                        <div className="text-blue-600 dark:text-blue-400 text-xs font-medium mt-1 pt-1 border-t border-gray-200 dark:border-gray-600">
                          Included in total latency
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )}

                {/* LLM */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 cursor-help">
                      <Brain className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                      <div className="text-right">
                        <div className={cn("font-bold text-sm", getLatencyColor(conversationMetrics.llmStats.p75, "llm"))}>
                          {formatDuration(conversationMetrics.llmStats.p75)}
                        </div>
                        <div className="text-gray-400 dark:text-gray-500 text-xs">TTFT P75</div>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                    <div className="text-xs">
                      <div className="font-medium">Language Model Performance</div>
                      <div className="text-gray-400 dark:text-gray-500">P50: {formatDuration(conversationMetrics.llmStats.p50)}</div>
                      <div className="text-gray-400 dark:text-gray-500">P75: {formatDuration(conversationMetrics.llmStats.p75)}</div>
                      <div className="text-gray-400 dark:text-gray-500">Avg: {formatDuration(conversationMetrics.llmStats.avg)}</div>
                    </div>
                  </TooltipContent>
                </Tooltip>

                {/* TTS */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 cursor-help">
                      <Volume2 className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                      <div className="text-right">
                        <div className={cn("font-bold text-sm", getLatencyColor(conversationMetrics.ttsStats.p75, "tts"))}>
                          {formatDuration(conversationMetrics.ttsStats.p75)}
                        </div>
                        <div className="text-gray-400 dark:text-gray-500 text-xs">TTFB P75</div>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                    <div className="text-xs">
                      <div className="font-medium">Text-to-Speech Performance</div>
                      <div className="text-gray-400 dark:text-gray-500">P50: {formatDuration(conversationMetrics.ttsStats.p50)}</div>
                      <div className="text-gray-400 dark:text-gray-500">P75: {formatDuration(conversationMetrics.ttsStats.p75)}</div>
                      <div className="text-gray-400 dark:text-gray-500">Avg: {formatDuration(conversationMetrics.ttsStats.avg)}</div>
                    </div>
                  </TooltipContent>
                </Tooltip>

                {/* EOU */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 cursor-help">
                      <Radio className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                      <div className="text-right">
                        <div className={cn("font-bold text-sm", getLatencyColor(conversationMetrics.eouStats.p75, "eou"))}>
                          {formatDuration(conversationMetrics.eouStats.p75)}
                        </div>
                        <div className="text-gray-400 dark:text-gray-500 text-xs">EOU P75</div>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                    <div className="text-xs">
                      <div className="font-medium">End of Utterance Performance</div>
                      <div className="text-gray-400 dark:text-gray-500">P50: {formatDuration(conversationMetrics.eouStats.p50)}</div>
                      <div className="text-gray-400 dark:text-gray-500">P75: {formatDuration(conversationMetrics.eouStats.p75)}</div>
                      <div className="text-gray-400 dark:text-gray-500">Avg: {formatDuration(conversationMetrics.eouStats.avg)}</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Reference Metrics Group - Only for non-Vapi */}
              {!isVapiAgent && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-50 dark:bg-gray-700 border border-dashed border-gray-300 dark:border-gray-600">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Reference</span>
                    <span className="text-[6px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">(not included in total)</span>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 cursor-help">
                        <Mic className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                        <div className="text-right">
                          <div className={cn("font-bold text-sm", getLatencyColor(conversationMetrics.sttStats.p75, "stt"))}>
                            {formatDuration(conversationMetrics.sttStats.p75)}
                          </div>
                          <div className="text-gray-400 dark:text-gray-500 text-xs">STT P75</div>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                      <div className="text-xs">
                        <div className="font-medium">Speech-to-Text Performance</div>
                        <div className="text-gray-400 dark:text-gray-500">P50: {formatDuration(conversationMetrics.sttStats.p50)}</div>
                        <div className="text-gray-400 dark:text-gray-500">P75: {formatDuration(conversationMetrics.sttStats.p75)}</div>
                        <div className="text-gray-400 dark:text-gray-500">Avg: {formatDuration(conversationMetrics.sttStats.avg)}</div>
                        <div className="text-orange-600 dark:text-orange-400 text-xs font-medium mt-1 pt-1 border-t border-gray-200 dark:border-gray-600">
                          Not included in total latency
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

export default ObservabilityStats