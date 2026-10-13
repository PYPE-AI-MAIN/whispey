// Per-call latency figures (STT, LLM, TTS, end-of-utterance, end-to-end), as
// shown on the call's full trace page and in the Call Logs split view. One
// implementation so both pages report the same numbers.

export interface LatencyTurn {
  user_transcript?: string | null
  agent_response?: string | null
  stt_metrics?: any
  llm_metrics?: any
  tts_metrics?: any
  eou_metrics?: any
}

export type LatencyStats = { avg: number; min: number; max: number; count: number; p50: number; p75: number }

export function isVapiAgentConfig(agent: any): boolean {
  if (!agent) return false
  const hasVapiKeys = Boolean(agent.vapi_api_key_encrypted && agent.vapi_project_key_encrypted)
  const hasVapiConfig = Boolean(agent?.configuration?.vapi?.assistantId)
  return hasVapiKeys || hasVapiConfig || agent.agent_type === 'vapi'
}

export function computeConversationMetrics(transcriptLogs: LatencyTurn[], isVapiAgent: boolean) {
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
   
  transcriptLogs.forEach((log) => {
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
}

/** Colour for a latency value (seconds): green / amber / red by stage. */
export function latencyTone(value: number, type: "stt" | "llm" | "tts" | "eou" | "total" | "e2e"): "good" | "fair" | "poor" {
  const thresholds = {
    stt: { good: 1, fair: 2 },
    llm: { good: 1, fair: 3 },
    tts: { good: 1, fair: 2 },
    eou: { good: 0.5, fair: 1.5 },
    total: { good: 3, fair: 6 },
    e2e: { good: 4, fair: 8 },
  }
  const t = thresholds[type]
  if (value <= t.good) return "good"
  if (value <= t.fair) return "fair"
  return "poor"
}

export const formatLatency = (seconds: number) => (seconds < 1 ? `${(seconds * 1000).toFixed(0)}ms` : `${seconds.toFixed(1)}s`)
