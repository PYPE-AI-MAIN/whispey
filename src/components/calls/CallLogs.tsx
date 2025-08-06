"use client"

import type React from "react"
import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Phone, Clock, CheckCircle, XCircle, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { useInfiniteScroll } from "../../hooks/useSupabase"
import CallDetailsDrawer from "./CallDetailsDrawer"
import CallFilter, { FilterRule } from "../CallFilter"
import ColumnSelector from "../shared/ColumnSelector"
import { cn } from "@/lib/utils"
import { CostTooltip } from "../tool-tip/costToolTip"
import { CallLog } from "../../types/logs"
import { supabase } from "../../lib/supabase"
import Papa from 'papaparse'


interface CallLogsProps {
  project: any
  agent: any
  onBack: () => void
}

function flattenAndPickColumns(
  row: CallLog,
  basic: string[],
  metadata: string[],
  transcription: string[]
): Record<string, any> {
  const flat: Record<string, any> = {};

  // Basic columns (skip "total_cost")
  for (const key of basic) {
    if (key in row) {
      flat[key] = row[key as keyof CallLog];
    }
  }

  // Metadata columns
  if (row.metadata && typeof row.metadata === "object") {
    for (const key of metadata) flat[key] = row.metadata[key];
  }

  // Transcription metrics columns
  if (row.transcription_metrics && typeof row.transcription_metrics === "object") {
    for (const key of transcription) flat[key] = row.transcription_metrics[key];
  }

  return flat;
}



const TruncatedText: React.FC<{ 
  text: string; 
  maxLength?: number;
  className?: string;
}> = ({ text, maxLength = 30, className = "" }) => {
  const truncated = text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
  
  return (
    <span 
      className={cn("break-words", className)}
      title={text.length > maxLength ? text : undefined}
    >
      {truncated}
    </span>
  )
}

// Dynamic JSON Cell Component - Fixed version with better text handling
const DynamicJsonCell: React.FC<{ 
  data: any; 
  fieldKey: string;
  maxWidth?: string;
}> = ({ data, fieldKey, maxWidth = "180px" }) => {
  if (!data || typeof data !== 'object') {
    return <span className="text-muted-foreground text-xs">-</span>
  }

  const value = data[fieldKey]
  
  if (value === undefined || value === null) {
    return <span className="text-muted-foreground text-xs">-</span>
  }

  // Handle different data types
  if (typeof value === 'object') {
    const jsonString = JSON.stringify(value, null, 2)
    const truncatedJson = jsonString.length > 80 ? jsonString.substring(0, 80) + '...' : jsonString
    
    return (
      <div 
        className="w-full max-w-full overflow-hidden border rounded-md bg-muted/20"
        style={{ maxWidth }}
      >
        <div className="p-1.5 w-full overflow-hidden">
          <pre 
            className="text-xs font-mono text-foreground whitespace-pre-wrap break-all overflow-hidden w-full"
            style={{ 
              wordBreak: 'break-all',
              overflowWrap: 'break-word',
              maxWidth: '100%'
            }}
            title={jsonString}
          >
            {truncatedJson}
          </pre>
        </div>
      </div>
    )
  }

  // Handle primitive values - truncate long strings
  const stringValue = String(value)
  const shouldTruncate = stringValue.length > 25
  const displayValue = shouldTruncate ? stringValue.substring(0, 25) + '...' : stringValue

  return (
    <div 
      className="text-xs w-full overflow-hidden" 
      style={{ maxWidth }}
    >
      <span 
        className="text-foreground font-medium block w-full overflow-hidden"
        style={{ 
          wordBreak: 'break-all',
          overflowWrap: 'break-word',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
        title={shouldTruncate ? stringValue : undefined}
      >
        {displayValue}
      </span>
    </div>
  )
}





const CallLogs: React.FC<CallLogsProps> = ({ project, agent, onBack }) => {

  const basicColumns = useMemo(
    () => [
      { key: "customer_number", label: "Customer Number" },
      { key: "call_id", label: "Call ID" },
      { key: "call_ended_reason", label: "Call Status" },
      { key: "duration_seconds", label: "Duration" },
      {
        key: "total_cost",
        label: "Total Cost (₹)",
      },
      { key: "call_started_at", label: "Start Time" },
      { key: "avg_latency", label: "Avg Latency (ms)" },
      { key: "total_llm_cost", label: "LLM Cost (₹)", hidden: true },
      { key: "total_tts_cost", label: "TTS Cost (₹)", hidden: true },
      { key: "total_stt_cost", label: "STT Cost (₹)", hidden: true }
    ],
    [],
  )

  
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null)
  const [activeFilters, setActiveFilters] = useState<FilterRule[]>([])
  const [visibleColumns, setVisibleColumns] = useState<{
    basic: string[]
    metadata: string[]
    transcription_metrics: string[]
  }>({
    basic: basicColumns.filter(col => !col.hidden).map(col => col.key), // initially show all
    metadata: [],
    transcription_metrics: []
  })



  // Convert FilterRule[] to Supabase filter format
  const convertToSupabaseFilters = (filters: FilterRule[]) => {
    const supabaseFilters = [{ column: "agent_id", operator: "eq", value: agent.id }]
    
    filters.forEach(filter => {
      // Determine the column name (with JSONB path if applicable)
      // Use ->> for text operations, -> for existence checks and numeric comparisons
      const getColumnName = (forTextOperation = false) => {
        if (!filter.jsonField) return filter.column
        
        if (forTextOperation) {
          return `${filter.column}->>${filter.jsonField}` // Double arrow for text extraction
        } else {
          return `${filter.column}->${filter.jsonField}` // Single arrow for JSONB data
        }
      }
      
      switch (filter.operation) {
        // Regular operations
        case 'equals':
          if (filter.column === 'call_started_at') {
            const startOfDay = `${filter.value} 00:00:00`
            const endOfDay = `${filter.value} 23:59:59.999`
            supabaseFilters.push({ 
              column: filter.column, 
              operator: 'gte', 
              value: startOfDay
            })
            supabaseFilters.push({ 
              column: filter.column, 
              operator: 'lte', 
              value: endOfDay
            })
          } else {
            supabaseFilters.push({ 
              column: getColumnName(false), 
              operator: 'eq', 
              value: filter.value 
            })
          }
          break
          
        case 'contains':
          supabaseFilters.push({ 
            column: getColumnName(true), // Use ->> for text operations
            operator: 'ilike', 
            value: `%${filter.value}%` 
          })
          break
          
        case 'starts_with':
          supabaseFilters.push({ 
            column: getColumnName(true), // Use ->> for text operations
            operator: 'ilike', 
            value: `${filter.value}%` 
          })
          break
          
        case 'greater_than':
          if (filter.column === 'call_started_at') {
            const nextDay = new Date(filter.value)
            nextDay.setDate(nextDay.getDate() + 1)
            const nextDayStr = nextDay.toISOString().split('T')[0]
            supabaseFilters.push({ 
              column: filter.column, 
              operator: 'gte', 
              value: `${nextDayStr} 00:00:00`
            })
          } else {
            supabaseFilters.push({ 
              column: getColumnName(false), 
              operator: 'gt', 
              value: filter.value 
            })
          }
          break
          
        case 'less_than':
          if (filter.column === 'call_started_at') {
            supabaseFilters.push({ 
              column: filter.column, 
              operator: 'lt', 
              value: `${filter.value} 00:00:00`
            })
          } else {
            supabaseFilters.push({ 
              column: getColumnName(false), 
              operator: 'lt', 
              value: filter.value 
            })
          }
          break
  
        // JSONB-specific operations
        case 'json_equals':
          supabaseFilters.push({ 
            column: getColumnName(true), // Use ->> for text comparison
            operator: 'eq', 
            value: filter.value 
          })
          break
          
        case 'json_contains':
          supabaseFilters.push({ 
            column: getColumnName(true), // Use ->> for text operations
            operator: 'ilike', 
            value: `%${filter.value}%` 
          })
          break
          
        case 'json_greater_than':
          // For numeric JSONB fields, use -> and cast to numeric
          supabaseFilters.push({ 
            column: `${getColumnName(false)}::numeric`, 
            operator: 'gt', 
            value: parseFloat(filter.value) 
          })
          break
          
        case 'json_less_than':
          // For numeric JSONB fields, use -> and cast to numeric
          supabaseFilters.push({ 
            column: `${getColumnName(false)}::numeric`, 
            operator: 'lt', 
            value: parseFloat(filter.value) 
          })
          break
          
        case 'json_exists':
          // Check if the JSONB field exists (is not null)
          supabaseFilters.push({ 
            column: getColumnName(false), // Use -> for existence check
            operator: 'not.is', 
            value: null 
          })
          break
          
        default:
          console.warn(`Unknown filter operation: ${filter.operation}`)
          break
      }
    })
    
    return supabaseFilters
  }

  const handleColumnChange = (type: 'basic' | 'metadata' | 'transcription_metrics', column: string, visible: boolean) => {
    setVisibleColumns(prev => ({
      ...prev,
      [type]: visible 
        ? [...prev[type], column]
        : prev[type].filter(col => col !== column)
    }))
    }
    
    const handleSelectAll = (type: 'basic' | 'metadata' | 'transcription_metrics', visible: boolean) => {
      setVisibleColumns(prev => ({
        ...prev,
        [type]: visible
          ? (type === "basic" ? basicColumns.map(col => col.key) : dynamicColumns[type])
          : []
      }))
    }
  


  const queryOptions = useMemo(
    () => ({
      select: `
      id,
      call_id,
      customer_number,
      call_ended_reason,
      call_started_at,
      call_ended_at,
      duration_seconds,
      recording_url,
      metadata,
      environment,
      transcript_type,
      avg_latency,
      transcript_json,
      created_at,
      transcription_metrics,
      total_llm_cost,
      total_tts_cost,
      total_stt_cost
    `,
      filters: convertToSupabaseFilters(activeFilters),
      orderBy: { column: "created_at", ascending: false },
      limit: 50,
    }),
    [agent.id, activeFilters],
  )

  

  const { data: calls, loading, hasMore, error, loadMore, refresh } = useInfiniteScroll("pype_voice_call_logs", queryOptions)

  // Extract all unique keys from metadata and transcription_metrics across all calls
  const dynamicColumns = useMemo(() => {
    const metadataKeys = new Set<string>()
    const transcriptionKeys = new Set<string>()

    calls.forEach((call: CallLog) => {
      // Extract metadata keys
      if (call.metadata && typeof call.metadata === 'object') {
        Object.keys(call.metadata).forEach(key => metadataKeys.add(key))
      }

      // Extract transcription_metrics keys
      if (call.transcription_metrics && typeof call.transcription_metrics === 'object') {
        Object.keys(call.transcription_metrics).forEach(key => transcriptionKeys.add(key))
      }
    })

    return {
      metadata: Array.from(metadataKeys).sort(),
      transcription_metrics: Array.from(transcriptionKeys).sort()
    }
  }, [calls])

  // Initialize visible columns when dynamic columns change
  useEffect(() => {
    setVisibleColumns((prev) => ({
      basic: prev.basic ?? basicColumns.map((col) => col.key),
      metadata: Array.from(
        new Set(
          (prev.metadata.length === 0 ? dynamicColumns.metadata : prev.metadata.filter((col) => dynamicColumns.metadata.includes(col)))
        )
      ),
      transcription_metrics: Array.from(
        new Set(
          (prev.transcription_metrics.length === 0 ? dynamicColumns.transcription_metrics : prev.transcription_metrics.filter((col) => dynamicColumns.transcription_metrics.includes(col)))
        )
      ),
    }))
  }, [dynamicColumns, basicColumns])
  

  const handleDownloadCSV = async () => {
    const { basic, metadata, transcription_metrics } = visibleColumns;
  
    // Build Supabase select string
    // Always fetch metadata and transcription_metrics if you need their subfields
    const selectColumns = [
      ...(basic.filter(col => col !== "total_cost")), // Exclude total_cost from basic
      ...(metadata.length ? ["metadata"] : []),
      ...(transcription_metrics.length ? ["transcription_metrics"] : []),
    ].join(",");
  
    // Build base query
    let query = supabase
      .from("pype_voice_call_logs")
      .select(selectColumns);
  
    // Apply filters
    for (const { column, operator, value } of convertToSupabaseFilters(activeFilters)) {
      // Typesafe way, assuming only .eq, .ilike, .gte, .lte etc
      // @ts-ignore
      query = query[operator](column, value);
    }
  
    // Fetch in chunks for large data sets
    let allData: CallLog[] = [];
    let page = 0;
    const pageSize = 1000;
    let done = false;
  
    while (!done) {
      const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
      if (error) {
        alert("Failed to fetch data for export: " + error.message);
        return;
      }
      if (data) {
        allData = allData.concat(data as unknown as CallLog[]);
        if (data.length < pageSize) done = true;
        else page += 1;
      } else {
        done = true;
      }
    }
  
    // Map/flatten for CSV according to selected columns
    const csvData = allData.map((row) =>
      flattenAndPickColumns(row, basic, metadata, transcription_metrics)
    );
  
    // Build CSV and trigger download
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "call_logs.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate total dynamic columns for table width
  const totalVisibleColumns = visibleColumns.metadata.length + visibleColumns.transcription_metrics.length
  const baseWidth = 1020 // Fixed columns width
  const dynamicWidth = totalVisibleColumns * 200 // 200px per dynamic column
  const minTableWidth = baseWidth + dynamicWidth

  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    refresh()
  }, [activeFilters])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore()
        }
      },
      { threshold: 0.1 },
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [hasMore, loading, loadMore])

  const handleFiltersChange = (filters: FilterRule[]) => {
    setActiveFilters(filters)
    setTimeout(() => refresh(), 100)
  }

  const handleClearFilters = () => {
    setActiveFilters([])
    setTimeout(() => refresh(), 100)
  }

  const handleRefresh = () => {
    refresh()
  }


  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const formatToIndianDateTime = (timestamp: any) => {
    const date = new Date(timestamp)
    const indianTime = new Date(date.getTime() + (5.5 * 60 * 60 * 1000))
    
    return indianTime.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h3 className="text-lg font-semibold text-gray-900">Unable to load calls</h3>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header with Filters and Column Selector */}
      <div className="flex-none p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between">
          <CallFilter 
            onFiltersChange={handleFiltersChange}
            onClear={handleClearFilters}
            availableMetadataFields={dynamicColumns.metadata}
            availableTranscriptionFields={dynamicColumns.transcription_metrics}
          />
          
          <div className="flex items-center gap-2">
          <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadCSV}
              disabled={loading}
            >
              Download CSV
            </Button>
            <ColumnSelector
              basicColumns={basicColumns.map((col) => col.key)}
              basicColumnLabels={Object.fromEntries(basicColumns.filter(col => !col.hidden).map((col) => [col.key, col.label]))}
              metadataColumns={dynamicColumns.metadata}
              transcriptionColumns={dynamicColumns.transcription_metrics}
              visibleColumns={visibleColumns}
              onColumnChange={handleColumnChange}
              onSelectAll={handleSelectAll}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              className="gap-2 h-8 w-8 p-0"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            
          </div>
        </div>
      </div>

      {/* Horizontally Scrollable Table Container */}
      <div className="flex-1 overflow-y-auto min-h-0">
      {loading && calls.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">Loading calls...</p>
            </div>
          </div>
        ) : calls.length === 0 && !loading ? (
          <div className="text-center py-12">
            <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {activeFilters.length > 0 ? "No calls match your filters" : "No calls found"}
            </h3>
            <p className="text-muted-foreground">
              {activeFilters.length > 0
                ? "Try adjusting your filters to find what you're looking for."
                : "Calls will appear here once your agent starts handling conversations."}
            </p>
          </div>
          ) : (
      <div className="h-full overflow-x-auto overflow-y-hidden"> {/* Horizontal scroll container */}
        <div className="h-full overflow-y-auto" style={{ minWidth: `${minTableWidth}px` }}> {/* Vertical scroll with min-width */}
          <Table className="w-full ">
                <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b-2">
                  <TableRow className="bg-muted/80 hover:bg-muted/80">
                    {/* Fixed Columns */}
                    {visibleColumns.basic.map((key) => {
                      const col = basicColumns.find((c) => c.key === key)
                      return (
                        <TableHead key={`basic-${key}`} className="font-semibold text-foreground min-w-[120px]">
                          {col?.label ?? key}
                        </TableHead>
                      )
                    })}

                    {/* Dynamic Metadata Columns */}
                    {visibleColumns.metadata.map((key) => (
                      <TableHead 
                        key={`metadata-${key}`} 
                        className="w-[200px] font-semibold text-foreground bg-blue-50/50 dark:bg-blue-950/20 border-r border-blue-200/50"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm">{key}</span>
                        </div>
                      </TableHead>
                    ))}
                    
                    {/* Dynamic Transcription Metrics Columns */}
                    {visibleColumns.transcription_metrics.map((key, index) => (
                      <TableHead 
                        key={`transcription-${key}`} 
                        className={cn(
                          "w-[200px] font-semibold text-foreground bg-blue-50/50 dark:bg-blue-950/20",
                          index === 0 && visibleColumns.metadata.length === 0 && "border-l-2 border-primary/30",
                          index < visibleColumns.transcription_metrics.length - 1 && "border-r border-blue-200/50"
                        )}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm">{key}</span>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="overflow-auto">
                  {calls.map((call: CallLog) => (
                    <TableRow
                      key={call.id}
                      className={cn(
                        "cursor-pointer hover:bg-muted/30 transition-all duration-200 border-b border-border/50",
                        selectedCall?.id === call.id && "bg-muted/50",
                      )}
                      onClick={() => setSelectedCall(call)}
                    >
              {visibleColumns.basic.map((key) => {
                let value: React.ReactNode = "-"

                switch (key) {
                  case "customer_number":
                    value = (
                      <div className="flex w-full items-center gap-3">
                        <div className="w-10 h-8 rounded-full  flex items-center justify-center">
                          <Phone className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-medium">{call.customer_number}</span>
                      </div>
                    )
                    break
                  case "call_id":
                    value = (
                      <code className="text-xs bg-muted/60 px-3 py-1.5 rounded-md font-mono">
                        {call.call_id.slice(-8)}
                      </code>
                    )
                    break
                  case "call_ended_reason":
                    value = (
                      <Badge
                        variant={call.call_ended_reason === "completed" ? "default" : "destructive"}
                        className="text-xs font-medium px-2.5 py-1"
                      >
                        {call.call_ended_reason === "completed" ? (
                          <CheckCircle className="w-3 h-3 mr-1.5" />
                        ) : (
                          <XCircle className="w-3 h-3 mr-1.5" />
                        )}
                        {call.call_ended_reason}
                      </Badge>
                    )
                    break
                  case "duration_seconds":
                    value = (
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        {formatDuration(call.duration_seconds)}
                      </div>
                    )
                    break
                  case "call_started_at":
                    value = formatToIndianDateTime(call.call_started_at)
                    break
                  case "avg_latency":
                    value = call?.avg_latency ? (
                      <span className="font-mono">{call.avg_latency.toFixed(2)}s</span>
                    ) : "-"
                    break
                  case "total_cost":
                    value = call?.total_llm_cost || call?.total_tts_cost || call?.total_stt_cost ? (
                      <CostTooltip call={call}/>
                    ) : "-"
                    break
                }

                return (
                  <TableCell key={`basic-${call.id}-${key}`} className="py-4">
                    {value}
                  </TableCell>
                )
              })}
              {/* Dynamic Metadata Columns */}
              {visibleColumns.metadata.map((key) => (
                <TableCell 
                  key={`metadata-${call.id}-${key}`} 
                  className="py-4 bg-blue-50/30 dark:bg-blue-950/10 border-r border-blue-200/50"
                >
                  <DynamicJsonCell 
                    data={call.metadata} 
                    fieldKey={key}
                    maxWidth="180px"
                  />
                </TableCell>
              ))}

              {/* Dynamic Transcription Metrics Columns */}
              {visibleColumns.transcription_metrics.map((key, index) => (
                <TableCell 
                  key={`transcription-${call.id}-${key}`} 
                  className={cn(
                    "py-4 bg-blue-50/30 dark:bg-blue-950/10",
                    index === 0 && visibleColumns.metadata.length === 0 && "border-l-2 border-primary/30",
                    index < visibleColumns.transcription_metrics.length - 1 && "border-r border-blue-200/50"
                  )}
                >
                  <DynamicJsonCell 
                    data={call.transcription_metrics} 
                    fieldKey={key}
                    maxWidth="180px"
                  />
                </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>

              </Table>
                {/* Load More Trigger */}
                {hasMore && (
                  <div ref={loadMoreRef} className="py-6 border-t">
                    {loading && <Loader2 className="w-6 h-6 animate-spin text-primary" />}
                  </div>
                )}

                {/* End of List */}
                {!hasMore && calls.length > 0 && (
                  <div className="py-4 text-muted-foreground text-sm border-t">
                    All calls loaded ({calls.length} total)
                  </div>
                )}
            </div>
          </div>
        )}
      </div>
      <CallDetailsDrawer 
        isOpen={!!selectedCall} 
        callData={selectedCall} 
        onClose={() => setSelectedCall(null)} 
      />
    </div>
  )
}

export default CallLogs