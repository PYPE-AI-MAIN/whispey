import { useMemo, useEffect } from 'react'
import { CallLog } from "@/types/logs"
import { toCamelCase, isColumnVisibleForRole } from '@/utils/callLogsUtils'
import { FilterRule } from '@/components/CallFilter'
import { useCallLogsStore } from '@/stores/callLogsStore'


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

// Metadata columns to exclude from default selection
const EXCLUDED_METADATA_COLUMNS = [
  'complete_configuration',
  'usage',
  'sip_trunk_id',
  'campaignId',
  'contactId',
  'agent_name',
  'metadata'
]

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

  // Get visible columns from store
  const { visibleColumns, setVisibleColumns } = useCallLogsStore()

  // Initialize visible columns if empty or update when role/dynamic columns change
  useEffect(() => {
    if (role !== null) {
      const allowedBasicColumns = filteredBasicColumns.map(col => col.key) as string[]
      
      setVisibleColumns((prev) => {
        // Initialize if basic columns are empty or don't match current role
        const needsInitialization = 
          prev.basic.length === 0 || 
          !allowedBasicColumns.every(col => prev.basic.includes(col))
        
        // Select all metadata, transcription_metrics, and metrics by default if they're empty
        // Exclude certain metadata columns from default selection
        const availableMetadata = dynamicColumns.metadata.filter(
          (col) => !EXCLUDED_METADATA_COLUMNS.includes(col)
        )
        const metadata = prev.metadata.length === 0 && availableMetadata.length > 0
          ? availableMetadata
          : prev.metadata.filter((col) => dynamicColumns.metadata.includes(col))
        
        // Merge both data from calls AND agent config for backward compatibility
        // This ensures:
        // 1. Fields like final_disposition from actual data appear
        // 2. Fields from agent config are still available (backward compatible)
        const allAvailableTranscriptionMetrics = Array.from(
          new Set([...dynamicColumns.transcription_metrics, ...dynamicColumnsKey])
        ).sort()
        
        const transcriptionMetrics = prev.transcription_metrics.length === 0 && allAvailableTranscriptionMetrics.length > 0
          ? allAvailableTranscriptionMetrics
          : prev.transcription_metrics.filter((col) => allAvailableTranscriptionMetrics.includes(col))
        
        const metrics = prev.metrics.length === 0 && dynamicColumns.metrics.length > 0
          ? dynamicColumns.metrics
          : prev.metrics.filter((col) => dynamicColumns.metrics.includes(col))
        
        if (needsInitialization) {
          return {
        basic: allowedBasicColumns,
            metadata: metadata,
            transcription_metrics: transcriptionMetrics,
            metrics: metrics
          }
        } else {
          // Just filter out invalid columns while preserving user selections
          return {
            basic: prev.basic.filter(col => allowedBasicColumns.includes(col)),
            metadata: metadata,
            transcription_metrics: transcriptionMetrics,
            metrics: metrics
          }
        }
      })
    }
  }, [role, dynamicColumns, dynamicColumnsKey, filteredBasicColumns, setVisibleColumns])

  // Merge transcription_metrics from both data and agent config for backward compatibility
  const mergedTranscriptionMetrics = useMemo(() => {
    return Array.from(
      new Set([...dynamicColumns.transcription_metrics, ...dynamicColumnsKey])
    ).sort()
  }, [dynamicColumns.transcription_metrics, dynamicColumnsKey])

  return {
    visibleColumns,
    setVisibleColumns,
    dynamicColumns: {
      ...dynamicColumns,
      transcription_metrics: mergedTranscriptionMetrics
    },
    dynamicColumnsKey,
    filteredBasicColumns
  }
}