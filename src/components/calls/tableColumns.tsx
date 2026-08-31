// components/CallLogs/tableColumns.tsx

import React, { useState } from "react"
import { ColumnDef } from '@tanstack/react-table'
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Phone, Clock, CheckCircle, XCircle, Copy, Check } from "lucide-react"
import { CallLog } from "@/types/logs"
import { formatDuration, formatToIndianDateTime } from '@/utils/callLogsUtils'
import { DynamicJsonCell } from './sub-components'
import { CostTooltip } from "../tool-tip/costToolTip"
import { BASIC_COLUMNS } from "@/hooks/useCallLogsColumns"
import { TagEditor } from './TagEditor'
import { FlagEditor, FlagData } from './FlagEditor'
import { cn } from "@/lib/utils"
import { isViewerRole } from '@/utils/callLogsUtils'

// ── Basic-column cell renderers ──────────────────────────────────────────
// Extracted out of the big switch in createTableColumns's cell renderer so
// that function's cognitive complexity stays low. Each function renders the
// exact same output the corresponding case previously did.

function renderCustomerNumberCell(call: CallLog) {
  const customerNumber = call.customer_number || ""
  const isLongNumber = customerNumber.length > 13 // "+916268181226" is 13 chars
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex w-full items-center gap-2 min-w-[180px] max-w-[180px]">
          <div className="w-6 h-6 rounded-full flex items-center justify-center bg-primary/10 shrink-0">
            <Phone className="w-3 h-3 text-primary" />
          </div>
          <span
            className={cn(
              "font-medium text-gray-900 dark:text-gray-100 text-sm",
              isLongNumber && "truncate"
            )}
            style={{ maxWidth: isLongNumber ? '140px' : 'none' }}
          >
            {customerNumber}
          </span>
        </div>
      </TooltipTrigger>
      {isLongNumber && (
        <TooltipContent>
          <p className="max-w-xs break-all">{customerNumber}</p>
        </TooltipContent>
      )}
    </Tooltip>
  )
}

function CallIdCell({ callId }: Readonly<{ callId: string }>) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(callId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <code className="text-xs bg-muted/60 dark:bg-gray-700/60 px-2 py-0.5 rounded-md font-mono">
            …{callId.slice(-8)}
          </code>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs break-all">{callId}</p>
        </TooltipContent>
      </Tooltip>
      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 dark:hover:bg-gray-700/60 transition-colors shrink-0 cursor-pointer"
        aria-label="Copy call ID"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

function renderCallIdCell(call: CallLog) {
  if (!call.call_id) return <span className="text-muted-foreground">—</span>
  return <CallIdCell callId={call.call_id} />
}

function renderCallEndedReasonCell(call: CallLog) {
  if (call.wcall_event === "call_started") return <span className="text-muted-foreground">—</span>
  return (
    <Badge
      variant={call.call_ended_reason === "completed" ? "default" : "destructive"}
      className="text-xs font-medium px-2 py-0.5"
    >
      {call.call_ended_reason === "completed" ? (
        <CheckCircle className="w-3 h-3 mr-1" />
      ) : (
        <XCircle className="w-3 h-3 mr-1" />
      )}
      {call.call_ended_reason}
    </Badge>
  )
}

function renderBillingDurationCell(call: CallLog) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      <Clock className="w-4 h-4 text-muted-foreground" />
      {formatDuration(call?.billing_duration_seconds ?? 0)}
    </div>
  )
}

function renderDurationCell(call: CallLog) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      <Clock className="w-4 h-4 text-muted-foreground" />
      {formatDuration(call.duration_seconds ?? 0)}
    </div>
  )
}

function renderCallStartedAtCell(call: CallLog) {
  if (!call.call_started_at) return <span className="text-muted-foreground">—</span>
  return <span>{formatToIndianDateTime(call.call_started_at)}</span>
}

function getWcallEventLabel(wcallEvent: CallLog['wcall_event']): string {
  if (wcallEvent === "call_ended") return "Ended"
  if (wcallEvent === "call_started") return "Started"
  return wcallEvent ?? "-"
}

function renderWcallEventCell(call: CallLog) {
  return (
    <Badge variant={call.wcall_event === "call_ended" ? "default" : "secondary"} className="text-xs font-medium px-2 py-0.5">
      {getWcallEventLabel(call.wcall_event)}
    </Badge>
  )
}

function renderTotalCostCell(call: CallLog) {
  return call?.total_llm_cost || call?.total_tts_cost || call?.total_stt_cost ? (
    <CostTooltip call={call} />
  ) : "-"
}

function renderTagsCell(
  call: CallLog,
  availableTags: string[],
  canComment: boolean,
  onTagsUpdated?: () => void
) {
  return (
    <TagEditor
      callId={call.id}
      initialTags={
        Array.isArray(call.transcription_metrics?.tags)
          ? call.transcription_metrics.tags
          : []
      }
      initialTagComments={
        call.transcription_metrics?.tagComments &&
        typeof call.transcription_metrics.tagComments === 'object' &&
        !Array.isArray(call.transcription_metrics.tagComments)
          ? (call.transcription_metrics.tagComments as Record<string, string>)
          : {}
      }
      availableTags={availableTags}
      canComment={canComment}
      onUpdated={onTagsUpdated}
    />
  )
}

function renderFlagCell(call: CallLog, onTagsUpdated?: () => void) {
  return (
    <FlagEditor
      callId={call.id}
      initialFlag={
        call.transcription_metrics?.flag &&
        typeof call.transcription_metrics.flag === 'object'
          ? (call.transcription_metrics.flag as FlagData)
          : null
      }
      onUpdated={onTagsUpdated}
    />
  )
}

function renderBasicCell(
  key: string,
  call: CallLog,
  availableTags: string[],
  canComment: boolean,
  onTagsUpdated?: () => void
) {
  switch (key) {
    case "customer_number":
      return renderCustomerNumberCell(call)
    case "call_id":
      return renderCallIdCell(call)
    case "call_ended_reason":
      return renderCallEndedReasonCell(call)
    case "billing_duration_seconds":
      return renderBillingDurationCell(call)
    case "duration_seconds":
      return renderDurationCell(call)
    case "call_started_at":
      return renderCallStartedAtCell(call)
    case "wcall_event":
      return renderWcallEventCell(call)
    case "total_cost":
      return renderTotalCostCell(call)
    case "tags":
      return renderTagsCell(call, availableTags, canComment, onTagsUpdated)
    case "flag":
      return renderFlagCell(call, onTagsUpdated)
    default:
      return <span>{call[key as keyof CallLog] ?? "-"}</span>
  }
}

// ── Metrics-column cell renderer ─────────────────────────────────────────

function getScoreBadgeVariant(score: number): "default" | "secondary" | "destructive" {
  if (score >= 0.7) return "default"
  if (score >= 0.5) return "secondary"
  return "destructive"
}

function renderMetricCell(call: CallLog, metricId: string) {
  let value: React.ReactNode = "-"
  let tooltipContent: string | null = null

  if (call.metrics && typeof call.metrics === 'object') {
    const metricData = (call.metrics as any)[metricId]
    if (metricData) {
      const score = metricData.score
      const reason = metricData.reason || "-"

      value = (
        <Badge
          variant={getScoreBadgeVariant(score)}
          className="text-xs font-medium cursor-help px-2 py-0.5"
        >
          {typeof score === 'number' ? score.toFixed(2) : score}
        </Badge>
      )

      tooltipContent = reason
    }
  }

  return tooltipContent ? (
    <Tooltip>
      <TooltipTrigger asChild>
        {value}
      </TooltipTrigger>
      <TooltipContent className="max-w-md bg-gray-900 dark:bg-gray-800 border-gray-700 p-0">
        <div className="text-sm p-4">
          <div className="font-semibold mb-2 text-white">{metricId.replaceAll('_', ' ').replaceAll(/\b\w/g, l => l.toUpperCase())}</div>
          <div className="text-xs text-gray-100 whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto pr-2">
            {tooltipContent}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  ) : value
}

export const createTableColumns = (
  visibleColumns: {
    basic: string[]
    metadata: string[]
    transcription_metrics: string[]
    metrics: string[]
  },
  options?: {
    availableTags?: string[]
    onTagsUpdated?: () => void
    /** Current user role — used to gate comment & flag capabilities */
    role?: string | null
  }
): ColumnDef<CallLog>[] => {
  const availableTags = options?.availableTags ?? []
  const onTagsUpdated = options?.onTagsUpdated
  const role = options?.role ?? null
  // owner/admin can add per-tag annotations; viewers cannot
  const canComment = role !== null && !isViewerRole(role)
  const cols: ColumnDef<CallLog>[] = []

  // Basic columns
  visibleColumns.basic.forEach((key) => {
    const col = BASIC_COLUMNS.find((c) => c.key === key)

    cols.push({
      id: key,
      accessorKey: key,
      header: col?.label ?? key,
      cell: ({ row }) => renderBasicCell(key, row.original, availableTags, canComment, onTagsUpdated),
      minSize: key === "customer_number" ? 180 : key === "tags" ? 200 : key === "flag" ? 100 : 150,
      size: key === "customer_number" ? 180 : key === "tags" ? 220 : key === "flag" ? 110 : undefined,
    })
  })

  // Metadata columns
  visibleColumns.metadata.forEach((key) => {
    cols.push({
      id: `metadata-${key}`,
      accessorFn: (row) => row.metadata?.[key],
      header: key,
      cell: ({ row }) => {
        const call = row.original

        // Special rendering for voicemail-detection
        if (key === 'voicemail-detection' && call.metadata?.['voicemail-detection'] === 'true') {
          return (
            <Badge variant="secondary" className="text-xs font-medium px-2 py-0.5 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
              Voicemail
            </Badge>
          )
        }

        return (
          <DynamicJsonCell
            data={call.metadata}
            fieldKey={key}
            maxWidth="500px"
          />
        )
      },
      size: 150,
    })
  })

  // Transcription metrics columns
  visibleColumns.transcription_metrics.forEach((key) => {
    cols.push({
      id: `transcription-${key}`,
      accessorFn: (row) => row.transcription_metrics?.[key],
      header: key,
      cell: ({ row }) => (
        <DynamicJsonCell
          data={row.original.transcription_metrics}
          fieldKey={key}
          maxWidth="300px"
        />
      ),
      size: 150,
    })
  })

  // Metrics columns
  visibleColumns.metrics.forEach((metricId) => {
    cols.push({
      id: `metrics-${metricId}`,
      accessorFn: (row) => row.metrics?.[metricId],
      header: metricId.replaceAll('_', ' ').replaceAll(/\b\w/g, l => l.toUpperCase()),
      cell: ({ row }) => renderMetricCell(row.original, metricId),
      size: 150,
    })
  })

  return cols
}
