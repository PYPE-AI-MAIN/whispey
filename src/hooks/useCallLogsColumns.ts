import { useMemo, useEffect, useRef, useCallback } from 'react'
import { CallLog } from "@/types/logs"
import { toCamelCase, isColumnVisibleForRole } from '@/utils/callLogsUtils'
import { FilterRule } from '@/components/CallFilter'
import { useCallLogsStore, type VisibleColumns } from '@/stores/callLogsStore'
import { EXCLUDED_METADATA_COLUMNS } from '@/lib/metadataColumnDenylist'


// Shallow array equality helper — avoids JSON.stringify allocations
const arrEq = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i])

/** The columns that exist right now, per group, for syncVisibleColumns. */
interface ColumnAvailability {
  /** Basic columns this role may see. */
  basic: string[]
  /** Metadata columns to fill the group with the first time. */
  metadata: string[]
  /** Metadata columns a kept choice may still hold. */
  metadataKeepIn: string[]
  transcription: string[]
  metrics: string[]
}

// Basic columns: the first time, all of them. After that keep the person's
// choice, and only add basic columns that didn't exist when they last chose.
// (Before, hiding any one basic column brought all of them back.)
function nextBasicColumns(current: string[], allowed: string[], knownBasic: string[] | undefined): string[] {
  if (knownBasic === undefined) {
    return current.length > 0 ? current.filter(col => allowed.includes(col)) : allowed
  }
  return [
    ...current.filter(col => allowed.includes(col)),
    ...allowed.filter(col => !knownBasic.includes(col) && !current.includes(col)),
  ]
}

// Dynamic groups: filled with everything once, the first time there is
// anything to show; an empty group after that is a deliberate "hide all".
const seedOnce = (current: string[], available: string[], done: boolean | undefined, keepIn: string[]) =>
  !done && current.length === 0 && available.length > 0 ? available : current.filter(col => keepIn.includes(col))

/**
 * The visible columns brought in line with the columns that exist now.
 * Returns the SAME prev reference if nothing changed — Zustand won't re-render.
 */
function syncVisibleColumns(prev: VisibleColumns, available: ColumnAvailability): VisibleColumns {
  const seeded = prev.seeded ?? {}
  const nextBasic = nextBasicColumns(prev.basic, available.basic, seeded.basic)
  const nextMetadata = seedOnce(prev.metadata, available.metadata, seeded.metadata, available.metadataKeepIn)
  const nextTranscription = seedOnce(prev.transcription_metrics, available.transcription, seeded.transcription_metrics, available.transcription)
  const nextMetrics = seedOnce(prev.metrics, available.metrics, seeded.metrics, available.metrics)

  const nextSeeded = {
    basic: available.basic,
    metadata: seeded.metadata || available.metadata.length > 0,
    transcription_metrics: seeded.transcription_metrics || available.transcription.length > 0,
    metrics: seeded.metrics || available.metrics.length > 0,
  }

  if (
    arrEq(nextBasic, prev.basic) &&
    arrEq(nextMetadata, prev.metadata) &&
    arrEq(nextTranscription, prev.transcription_metrics) &&
    arrEq(nextMetrics, prev.metrics) &&
    arrEq(nextSeeded.basic, seeded.basic ?? []) &&
    nextSeeded.metadata === !!seeded.metadata &&
    nextSeeded.transcription_metrics === !!seeded.transcription_metrics &&
    nextSeeded.metrics === !!seeded.metrics
  ) return prev

  return {
    basic: nextBasic,
    metadata: nextMetadata,
    transcription_metrics: nextTranscription,
    metrics: nextMetrics,
    seeded: nextSeeded,
  }
}

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

// Whole-column JSONB/blob fields that are real columns on pype_voice_call_logs but
// aren't part of BASIC_COLUMNS — offered as single toggleable entries in the
// superadmin restriction picker and the download dialog (unlike metadata/
// transcription_metrics sub-keys, which are broken out individually elsewhere).
export const EXTRA_RESTRICTABLE_COLUMNS = [
  { key: "transcript_json", label: "Transcript" },
  { key: "metadata", label: "Metadata" },
  { key: "transcription_metrics", label: "Transcription Metrics" },
] as const

// EXCLUDED_METADATA_COLUMNS is imported from @/lib/metadataColumnDenylist (single source of
// truth, shared with flag-rules validation) — do not re-declare it inline here.

// transcription_metrics keys managed as first-class BASIC_COLUMNS — skip auto-discovery
const EXCLUDED_TRANSCRIPTION_METRICS_COLUMNS = new Set(['tags', 'tagComments', 'flag', 'qa'])


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
          .filter(key => !EXCLUDED_TRANSCRIPTION_METRICS_COLUMNS.has(key))
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
    const sortedMetadata = metadataFiltered.toSorted((a, b) => a.localeCompare(b))
    const sortedTranscriptionMetrics = Array.from(transcriptionKeys).sort((a, b) => a.localeCompare(b))
    const sortedMetrics = Array.from(metricsKeys).sort((a, b) => a.localeCompare(b))
    return {
      metadata: sortedMetadata,
      transcription_metrics: sortedTranscriptionMetrics,
      metrics: sortedMetrics
    }
  }, [calls])

  // Get filtered basic columns based on role
  const filteredBasicColumns = useMemo(() => {
    return BASIC_COLUMNS.filter(col => 
      !('hidden' in col && col.hidden) && isColumnVisibleForRole(col.key, role)
    )
  }, [role])

  // This agent's columns (falling back to the person's general choice until they customise it)
  const agentId: string = agent?.id ?? ''
  const visibleColumns = useCallLogsStore((s) => s.visibleColumnsByAgent[agentId] ?? s.visibleColumns)
  const setForAgent = useCallLogsStore((s) => s.setVisibleColumnsForAgent)
  const setVisibleColumns = useCallback(
    (columns: VisibleColumns | ((prev: VisibleColumns) => VisibleColumns)) => setForAgent(agentId, columns),
    [agentId, setForAgent]
  )

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
    ).sort((a, b) => a.localeCompare(b))

    setVisibleColumns((prev) => syncVisibleColumns(prev, {
      basic: allowedBasicColumns,
      metadata: availableMetadata,
      metadataKeepIn: dynamicColumns.metadata,
      transcription: allAvailableTranscriptionMetrics,
      metrics: dynamicColumns.metrics,
    }))
  }, [role, dynamicColumns, dynamicColumnsKey, filteredBasicColumns, setVisibleColumns])

  // Merge transcription_metrics from both data and agent config for backward compatibility
  const mergedTranscriptionMetrics = useMemo(() => {
    return Array.from(
      new Set([...dynamicColumns.transcription_metrics, ...dynamicColumnsKey])
    ).sort((a, b) => a.localeCompare(b))
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