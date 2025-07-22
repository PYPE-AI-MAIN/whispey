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
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
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
}

interface CallLogsProps {
  project: any
  agent: any
  onBack: () => void
}

const CallLogs: React.FC<CallLogsProps> = ({ project, agent, onBack }) => {
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null)
  const [activeFilters, setActiveFilters] = useState<FilterRule[]>([])

  // Convert FilterRule[] to Supabase filter format
  const convertToSupabaseFilters = (filters: FilterRule[]) => {
    const supabaseFilters = [{ column: "agent_id", operator: "eq", value: agent.id }]
    
    filters.forEach(filter => {
      switch (filter.operation) {
        case 'equals':
          if (filter.column === 'call_started_at') {
            // For date equals, filter for the entire day range
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
              column: filter.column, 
              operator: 'eq', 
              value: filter.value 
            })
          }
          break
        case 'contains':
          supabaseFilters.push({ 
            column: filter.column, 
            operator: 'ilike', 
            value: `%${filter.value}%` 
          })
          break
        case 'starts_with':
          supabaseFilters.push({ 
            column: filter.column, 
            operator: 'ilike', 
            value: `${filter.value}%` 
          })
          break
        case 'greater_than':
          if (filter.column === 'call_started_at') {
            // After this date (start of next day)
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
              column: filter.column, 
              operator: 'gt', 
              value: filter.value 
            })
          }
          break
        case 'less_than':
          if (filter.column === 'call_started_at') {
            // Before this date (end of previous day)
            supabaseFilters.push({ 
              column: filter.column, 
              operator: 'lt', 
              value: `${filter.value} 00:00:00`
            })
          } else {
            supabaseFilters.push({ 
              column: filter.column, 
              operator: 'lt', 
              value: filter.value 
            })
          }
          break
      }
    })
    
    return supabaseFilters
  }

  // Simplified query options with dynamic filters
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
      created_at
    `,
      filters: convertToSupabaseFilters(activeFilters),
      orderBy: { column: "created_at", ascending: false },
      limit: 50,
    }),
    [agent.id, activeFilters],
  )

  console.log(queryOptions)
  const { data: calls, loading, hasMore, error, loadMore, refresh } = useInfiniteScroll("pype_voice_call_logs", queryOptions)

  // Intersection observer for infinite scroll
  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(()=>{
    refresh()
  },[activeFilters])

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
    // Refresh data when filters change
    setTimeout(() => refresh(), 100)
  }

  const handleClearFilters = () => {
    setActiveFilters([])
    // Refresh data when filters are cleared
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

  // const formatTime = (dateString: string) => {
  //   const date = new Date(dateString)
  //   return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  // }

  const formatToIndianDateTime = (timestamp:any) => {
    const date = new Date(timestamp)
    
    // Add 5 hours and 30 minutes (5.5 hours = 330 minutes)
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
      {/* Header with Filters Only */}
      <div className="p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between">
          <CallFilter 
            onFiltersChange={handleFiltersChange}
            onClear={handleClearFilters}
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

      {/* Table Container */}
      <div className="flex-1 overflow-auto">
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
              <h3 className="text-lg font-semibold mb-2">{activeFilters.length > 0 ? "No calls match your filters" : "No calls found"}</h3>
              <p className="text-muted-foreground">
                {activeFilters.length > 0
                  ? "Try adjusting your filters to find what you're looking for."
                  : "Calls will appear here once your agent starts handling conversations."}
              </p>
            </div>
          ) : (
            <div className="h-full overflow-auto">
              <div className="border overflow-hidden">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b-2">
                    <TableRow className="bg-muted/80 hover:bg-muted/80">
                      <TableHead className="w-[160px] font-semibold text-foreground pl-6">Customer</TableHead>
                      <TableHead className="w-[130px] font-semibold text-foreground">Call ID</TableHead>
                      <TableHead className="w-[110px] font-semibold text-foreground">Status</TableHead>
                      <TableHead className="w-[90px] font-semibold text-foreground">Duration</TableHead>
                      <TableHead className="w-[140px] font-semibold text-foreground">Started</TableHead>                    
                      <TableHead className="w-[90px] font-semibold text-foreground">Recording</TableHead>
                      <TableHead className="w-[100px] font-semibold text-foreground">Avg Latency</TableHead>
                      <TableHead className="w-[120px] font-semibold text-foreground pr-6">Meta Data</TableHead>
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
                      
                      <TableCell className="text-xs text-muted-foreground py-4">
                        {call?.avg_latency ? (
                          <span className="font-mono">{call.avg_latency.toFixed(2)}ms</span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      
                      <TableCell className="text-xs text-muted-foreground py-4 pr-6">
                        {call.metadata ? (
                          <div className="space-y-1">
                            {Object.entries(call.metadata).map(([key, value]) => {
                              const isObject = typeof value === "object" && value !== null

                              return (
                                <div key={key} className="flex items-center gap-1">
                                  <span className="font-medium text-foreground">{key}:</span>{" "}
                                  {isObject ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="underline cursor-help text-primary hover:text-primary/80">
                                          (object)
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="left">
                                        <pre className="text-xs max-w-[300px] whitespace-pre-wrap break-words">
                                          {JSON.stringify(value, null, 2)}
                                        </pre>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <span className="truncate max-w-[80px]">{String(value)}</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
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
        </div>
        )}
      </div>
      <CallDetailsDrawer isOpen={!!selectedCall} callData={selectedCall} onClose={() => setSelectedCall(null)} />
    </div>
  )
}


export default CallLogs
