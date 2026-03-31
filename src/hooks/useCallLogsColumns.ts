import { useMemo, useEffect, useRef } from 'react'
import { CallLog } from "@/types/logs"
import { toCamelCase, isColumnVisibleForRole } from '@/utils/callLogsUtils'
import { FilterRule } from '@/components/CallFilter'
import { useCallLogsStore } from '@/stores/callLogsStore'


export const BASIC_COLUMNS = [
  { key: "customer_number", label: "Customer Number" },  // 1
  { key: "call_id", label: "Call ID" },                  // 2
  { key: "call_ended_reason", label: "Call Status" },    // 3
  { key: "duration_seconds", label: "Duration" },        // 4
  { key: "tags", label: "Tags" },                        // 5
  { key: "flag", label: "Flag" },                        // 6
  { key: "billing_duration_seconds", label: "Billing Duration" },
  { key: "total_cost", label: "Total Cost (₹)" },
  { key: "call_started_at", label: "Start Time" },
  { key: "wcall_event", label: "Call Event" },
  { key: "avg_latency", label: "Avg Latency (ms)", hidden: true },
  { key: "total_llm_cost", label: "LLM Cost (₹)", hidden: true },
  { key: "total_tts_cost", label: "TTS Cost (₹)", hidden: true },
  { key: "total_stt_cost", label: "STT Cost (₹)", hidden: true }
] as const

// Metadata columns to exclude from Dynamic Columns (never show apikey/api_url; they are for API auth only)
const EXCLUDED_METADATA_COLUMNS = [
  'complete_configuration',
  'usage',
  'sip_trunk_id',
  'campaignId',
  'contactId',
  'agent_name',
  'metadata',
  'retry_config',
  'apikey',
  'api_url'
]

// transcription_metrics keys managed as first-class BASIC_COLUMNS — skip auto-discovery
const EXCLUDED_TRANSCRIPTION_METRICS_COLUMNS = ['tags', 'tagComments', 'flag']

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
        Object.keys(call.transcription_metrics)
          .filter(key => !EXCLUDED_TRANSCRIPTION_METRICS_COLUMNS.includes(key))
          .forEach(key => transcriptionKeys.add(key))
      }
      if (call.metrics && typeof call.metrics === 'object') {
        Object.keys(call.metrics).forEach(metricId => metricsKeys.add(metricId))
      }
    })

    // Never expose apikey/api_url as metadata columns (auth-only, must not appear in UI)
    const metadataFiltered = Array.from(metadataKeys).filter(
      (key) => !EXCLUDED_METADATA_COLUMNS.includes(key)
    )
    return {
      metadata: metadataFiltered.sort(),
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

  // Shallow array equality helper — avoids JSON.stringify allocations
  const arrEq = (a: string[], b: string[]) =>
    a.length === b.length && a.every((v, i) => v === b[i])

  // Prevent the effect from firing on the first render before role is known
  const roleLoadedRef = useRef(false)

  // Initialize / sync visible columns when role or dynamic columns change.
  // IMPORTANT: the setVisibleColumns callback returns `prev` unchanged when nothing
  // actually changed — this prevents Zustand from triggering a re-render and
  // breaking the infinite-loop guard.
  useEffect(() => {
    if (role === null) return
    roleLoadedRef.current = true

    const allowedBasicColumns = filteredBasicColumns.map(col => col.key) as string[]

    const availableMetadata = dynamicColumns.metadata.filter(
      (col) => !EXCLUDED_METADATA_COLUMNS.includes(col)
    )

    const allAvailableTranscriptionMetrics = Array.from(
      new Set([...dynamicColumns.transcription_metrics, ...dynamicColumnsKey])
    ).sort()

    setVisibleColumns((prev) => {
      const needsInitialization =
        prev.basic.length === 0 ||
        !allowedBasicColumns.every(col => prev.basic.includes(col))

      const nextBasic = needsInitialization
        ? allowedBasicColumns
        : prev.basic.filter(col => allowedBasicColumns.includes(col))

      const nextMetadata = prev.metadata.length === 0 && availableMetadata.length > 0
        ? availableMetadata
        : prev.metadata.filter(col => dynamicColumns.metadata.includes(col))

      const nextTranscription = prev.transcription_metrics.length === 0 && allAvailableTranscriptionMetrics.length > 0
        ? allAvailableTranscriptionMetrics
        : prev.transcription_metrics.filter(col => allAvailableTranscriptionMetrics.includes(col))

      const nextMetrics = prev.metrics.length === 0 && dynamicColumns.metrics.length > 0
        ? dynamicColumns.metrics
        : prev.metrics.filter(col => dynamicColumns.metrics.includes(col))

      // Return the SAME prev reference if nothing changed — Zustand won't re-render
      if (
        arrEq(nextBasic, prev.basic) &&
        arrEq(nextMetadata, prev.metadata) &&
        arrEq(nextTranscription, prev.transcription_metrics) &&
        arrEq(nextMetrics, prev.metrics)
      ) return prev

      return {
        basic: nextBasic,
        metadata: nextMetadata,
        transcription_metrics: nextTranscription,
        metrics: nextMetrics,
      }
    })
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