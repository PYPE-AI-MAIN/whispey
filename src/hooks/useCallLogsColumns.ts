import { useMemo, useEffect, useState } from 'react'
import { CallLog } from "@/types/logs"
import { toCamelCase, isColumnVisibleForRole } from '@/utils/callLogsUtils'
import { FilterRule } from '@/components/CallFilter'


export const BASIC_COLUMNS = [
  { key: "customer_number", label: "Customer Number" },
  { key: "call_id", label: "Call ID" },
  { key: "call_ended_reason", label: "Call Status" },
  { key: "duration_seconds", label: "Duration" },
  { key: "billing_duration_seconds", label: "Billing Duration" },
  { key: "total_cost", label: "Total Cost (₹)" },
  { key: "call_started_at", label: "Start Time" },
  { key: "avg_latency", label: "Avg Latency (ms)", hidden: true },
  { key: "total_llm_cost", label: "LLM Cost (₹)", hidden: true },
  { key: "total_tts_cost", label: "TTS Cost (₹)", hidden: true },
  { key: "total_stt_cost", label: "STT Cost (₹)", hidden: true }
] as const

interface VisibleColumns {
  basic: string[]
  metadata: string[]
  transcription_metrics: string[]
  metrics: string[]
}

export const useCallLogsColumns = (agent: any, calls: CallLog[], role: string | null) => {
  // Parse dynamic columns from agent config
  const dynamicColumnsKey = useMemo(() => {
    if (!agent?.field_extractor_prompt) return []
    try {
      const prompt = agent.field_extractor_prompt
      if (typeof prompt === 'string') {
        const parsed = JSON.parse(prompt)
        return Array.isArray(parsed) ? parsed.map((item: any) => toCamelCase(item.key)) : []
      } else if (Array.isArray(prompt)) {
        return prompt.map((item: any) => toCamelCase(item.key))
      }
      return []
    } catch (error) {
      console.error('Error parsing field_extractor_prompt:', error)
      return []
    }
  }, [agent?.field_extractor_prompt])

  // Extract dynamic columns from calls
  const dynamicColumns = useMemo(() => {
    const metadataKeys = new Set<string>()
    const transcriptionKeys = new Set<string>()
    const metricsKeys = new Set<string>()

    calls.forEach((call: CallLog) => {
      if (call.metadata && typeof call.metadata === 'object') {
        Object.keys(call.metadata).forEach(key => metadataKeys.add(key))
      }
      if (call.transcription_metrics && typeof call.transcription_metrics === 'object') {
        Object.keys(call.transcription_metrics).forEach(key => transcriptionKeys.add(key))
      }
      if (call.metrics && typeof call.metrics === 'object') {
        Object.keys(call.metrics).forEach(metricId => metricsKeys.add(metricId))
      }
    })

    return {
      metadata: Array.from(metadataKeys).sort(),
      transcription_metrics: Array.from(transcriptionKeys).sort(),
      metrics: Array.from(metricsKeys).sort()
    }
  }, [calls])

  // Get filtered basic columns based on role
  const filteredBasicColumns = useMemo(() => {
    return BASIC_COLUMNS.filter(col => 
      !('hidden' in col && col.hidden) && isColumnVisibleForRole(col.key, role)
    )
  }, [role])

  // Manage visible columns state
  const [visibleColumns, setVisibleColumns] = useState<VisibleColumns>({
    basic: filteredBasicColumns.map(col => col.key),
    metadata: [],
    transcription_metrics: [],
    metrics: []
  })

  // Update visible columns when role or dynamic columns change
  useEffect(() => {
    if (role !== null) {
      const allowedBasicColumns = filteredBasicColumns.map(col => col.key)
      setVisibleColumns(prev => ({
        basic: allowedBasicColumns,
        metadata: prev.metadata.length === 0 ? dynamicColumns.metadata : prev.metadata.filter((col) => dynamicColumns.metadata.includes(col)),
        transcription_metrics: prev.transcription_metrics.length === 0 ? dynamicColumnsKey : prev.transcription_metrics,
        metrics: prev.metrics.length === 0 ? dynamicColumns.metrics : prev.metrics.filter((col) => dynamicColumns.metrics.includes(col))
      }))
    }
  }, [role, dynamicColumns, dynamicColumnsKey, filteredBasicColumns])

  return {
    visibleColumns,
    setVisibleColumns,
    dynamicColumns,
    dynamicColumnsKey,
    filteredBasicColumns
  }
}