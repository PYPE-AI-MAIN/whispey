"use client"

import type React from "react"
import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Phone, Clock, CheckCircle, XCircle, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { useInfiniteScroll } from "../../hooks/useSupabase"
import CallDetailsDrawer from "./CallDetailsDrawer"
import CallFilter, { FilterRule } from "./CallFilter"
import ColumnSelector from "./ColumnSelector"
import { cn } from "@/lib/utils"

interface CallLog {
  id: string
  call_id: string
  agent_id: string
  customer_number: string
  call_ended_reason: string
  transcript_type: string
  transcript_json: any
  metadata: any
  environment: string
  call_started_at: string
  call_ended_at: string
  avg_latency?: number
  recording_url: string
  duration_seconds: number
  created_at: string
  transcription_metrics?: any
}

interface CallLogsProps {
  project: any
  agent: any
  onBack: () => void
}

// Dynamic JSON Cell Component
const DynamicJsonCell: React.FC<{ 
  data: any; 
  fieldKey: string;
  maxWidth?: string;
}> = ({ data, fieldKey, maxWidth = "200px" }) => {
  if (!data || typeof data !== 'object') {
    return <span className="text-muted-foreground text-xs">-</span>
  }

  const value = data[fieldKey]
  
  if (value === undefined || value === null) {
    return <span className="text-muted-foreground text-xs">-</span>
  }

  // Handle different data types
  if (typeof value === 'object') {
    return (
      <div 
        className="overflow-x-auto overflow-y-hidden max-w-full border rounded-md bg-muted/20"
        style={{ maxWidth }}
      >
        <div className="p-2 min-w-max">
          <pre className="text-xs font-mono whitespace-nowrap text-foreground">
            {JSON.stringify(value, null, 2)}
          </pre>
        </div>
      </div>
    )
  }

  // Handle primitive values
  return (
    <div className="text-xs" style={{ maxWidth }}>
      <span className="text-foreground font-medium break-words">
        {String(value)}
      </span>
    </div>
  )
}

const CallLogs: React.FC<CallLogsProps> = ({ project, agent, onBack }) => {
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null)
  const [activeFilters, setActiveFilters] = useState<FilterRule[]>([])
  const [visibleColumns, setVisibleColumns] = useState<{
    metadata: string[]
    transcription_metrics: string[]
  }>({
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
      transcription_metrics
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
    setVisibleColumns(prev => ({
      metadata: prev.metadata.length === 0 ? dynamicColumns.metadata : prev.metadata.filter(col => dynamicColumns.metadata.includes(col)),
      transcription_metrics: prev.transcription_metrics.length === 0 ? dynamicColumns.transcription_metrics : prev.transcription_metrics.filter(col => dynamicColumns.transcription_metrics.includes(col))
    }))
  }, [dynamicColumns])

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

  const handleColumnChange = (type: 'metadata' | 'transcription_metrics', column: string, visible: boolean) => {
    setVisibleColumns(prev => ({
      ...prev,
      [type]: visible 
        ? [...prev[type], column]
        : prev[type].filter(col => col !== column)
    }))
  }

  const handleSelectAll = (type: 'metadata' | 'transcription_metrics', visible: boolean) => {
    setVisibleColumns(prev => ({
      ...prev,
      [type]: visible ? dynamicColumns[type] : []
    }))
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
    <div className="h-screen flex flex-col bg-background">
      {/* Header with Filters and Column Selector */}
      <div className="p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between">
          <CallFilter 
            onFiltersChange={handleFiltersChange}
            onClear={handleClearFilters}
            availableMetadataFields={dynamicColumns.metadata}
            availableTranscriptionFields={dynamicColumns.transcription_metrics}
          />
          
          <div className="flex items-center gap-2">
            <ColumnSelector
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
      <div className="flex-1 overflow-hidden">
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
          <div className="h-full overflow-auto">
            {/* Dynamic horizontal scroll wrapper */}
            <div 
              className="overflow-x-auto border "
              style={{ minWidth: `${minTableWidth}px` }}
            >
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b-2">
                  <TableRow className="bg-muted/80 hover:bg-muted/80">
                    {/* Fixed Columns */}
                    <TableHead className="w-[160px] font-semibold text-foreground pl-6">Customer</TableHead>
                    <TableHead className="w-[130px] font-semibold text-foreground">Call ID</TableHead>
                    <TableHead className="w-[110px] font-semibold text-foreground">Status</TableHead>
                    <TableHead className="w-[90px] font-semibold text-foreground">Duration</TableHead>
                    <TableHead className="w-[140px] font-semibold text-foreground">Started</TableHead>
                    <TableHead className="w-[90px] font-semibold text-foreground">Recording</TableHead>
                    <TableHead className="w-[100px] font-semibold text-foreground border-r-2 border-primary/30">Avg Latency</TableHead>
                    
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
                <TableBody>
                  {calls.map((call: CallLog) => (
                    <TableRow
                      key={call.id}
                      className={cn(
                        "cursor-pointer hover:bg-muted/30 transition-all duration-200 border-b border-border/50",
                        selectedCall?.id === call.id && "bg-muted/50",
                      )}
                      onClick={() => setSelectedCall(call)}
                    >
                      {/* Fixed Columns */}
                      <TableCell className="font-medium pl-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Phone className="w-4 h-4 text-primary" />
                          </div>
                          <span className="font-medium">{call.customer_number}</span>
                        </div>
                      </TableCell>

                      <TableCell className="py-4">
                        <code className="text-xs bg-muted/60 px-3 py-1.5 rounded-md font-mono">
                          {call.call_id.slice(-8)}
                        </code>
                      </TableCell>

                      <TableCell className="py-4">
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
                      </TableCell>

                      <TableCell className="py-4">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          {formatDuration(call.duration_seconds)}
                        </div>
                      </TableCell>

                      <TableCell className="text-sm text-muted-foreground py-4">
                        {formatToIndianDateTime(call.call_started_at)}
                      </TableCell>

                      <TableCell className="py-4">
                        {call.recording_url ? (
                          <Badge variant="secondary" className="text-xs px-2.5 py-1">
                            Available
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground py-4 border-r-2 border-primary/30">
                        {call?.avg_latency ? (
                          <span className="font-mono">{call.avg_latency.toFixed(2)}ms</span>
                        ) : (
                          "-"
                        )}
                      </TableCell>

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
            </div>
            
            {/* Load More Trigger */}
            {hasMore && (
              <div ref={loadMoreRef} className="flex justify-center py-6 border-t">
                {loading && <Loader2 className="w-6 h-6 animate-spin text-primary" />}
              </div>
            )}

            {/* End of List */}
            {!hasMore && calls.length > 0 && (
              <div className="text-center py-4 text-muted-foreground text-sm border-t">
                All calls loaded ({calls.length} total)
              </div>
            )}
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