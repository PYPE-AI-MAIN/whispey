// components/CallLogs/tableColumns.tsx

import React from "react"
import { ColumnDef } from '@tanstack/react-table'
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Phone, Clock, CheckCircle, XCircle } from "lucide-react"
import { CallLog } from "@/types/logs"
import { formatDuration, formatToIndianDateTime } from '@/utils/callLogsUtils'
import { DynamicJsonCell } from './sub-components'
import { CostTooltip } from "../tool-tip/costToolTip"
import { BASIC_COLUMNS } from "@/hooks/useCallLogsColumns"

export const createTableColumns = (
  visibleColumns: {
    basic: string[]
    metadata: string[]
    transcription_metrics: string[]
    metrics: string[]
  }
): ColumnDef<CallLog>[] => {
  const cols: ColumnDef<CallLog>[] = []

  // Basic columns
  visibleColumns.basic.forEach((key) => {
    const col = BASIC_COLUMNS.find((c) => c.key === key)
    
    cols.push({
      id: key,
      accessorKey: key,
      header: col?.label ?? key,
      cell: ({ row }) => {
        const call = row.original

        switch (key) {
          case "customer_number":
            return (
              <div className="flex w-full items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center bg-primary/10">
                  <Phone className="w-3 h-3 text-primary" />
                </div>
                <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{call.customer_number}</span>
              </div>
            )
          case "call_id":
            return (
              <code className="text-xs bg-muted/60 dark:bg-gray-700/60 px-2 py-0.5 rounded-md font-mono">
                {call.call_id.slice(-8)}
              </code>
            )
          case "call_ended_reason":
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
          case "billing_duration_seconds":
            return (
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="w-4 h-4 text-muted-foreground" />
                {formatDuration(call?.billing_duration_seconds ?? 0)}
              </div>
            )
          case "duration_seconds":
            return (
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="w-4 h-4 text-muted-foreground" />
                {formatDuration(call.duration_seconds)}
              </div>
            )
          case "call_started_at":
            return <span>{formatToIndianDateTime(call.call_started_at)}</span>
          case "total_cost":
            return call?.total_llm_cost || call?.total_tts_cost || call?.total_stt_cost ? (
              <CostTooltip call={call} />
            ) : "-"
          default:
            return <span>{call[key as keyof CallLog] as any ?? "-"}</span>
        }
      },
      minSize: 150,
    })
  })

  // Metadata columns
  visibleColumns.metadata.forEach((key) => {
    cols.push({
      id: `metadata-${key}`,
      accessorFn: (row) => row.metadata?.[key],
      header: key,
      cell: ({ row }) => (
        <DynamicJsonCell 
          data={row.original.metadata} 
          fieldKey={key}
          maxWidth="500px"
        />
      ),
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
      header: metricId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      cell: ({ row }) => {
        const call = row.original
        let value: React.ReactNode = "-"
        let tooltipContent: string | null = null
        
        if (call.metrics && typeof call.metrics === 'object') {
          const metricData = (call.metrics as any)[metricId]
          if (metricData) {
            const score = metricData.score
            const reason = metricData.reason || "-"
            
            value = (
              <Badge 
                variant={score >= 0.7 ? "default" : score >= 0.5 ? "secondary" : "destructive"}
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
                <div className="font-semibold mb-2 text-white">{metricId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</div>
                <div className="text-xs text-gray-100 whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto pr-2">
                  {tooltipContent}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        ) : value
      },
      size: 150,
    })
  })

  return cols
}