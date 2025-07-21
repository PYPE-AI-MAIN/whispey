"use client"

import type React from "react"
import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Download, Phone, Clock, CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react"
import { useInfiniteScroll } from "../../hooks/useSupabase"
import CallDetailsDrawer from "./CallDetailsDrawer"
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
  const [search, setSearch] = useState("")
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null)

  // Simplified query options
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
      filters: [{ column: "agent_id", operator: "eq", value: agent.id }],
      orderBy: { column: "created_at", ascending: false },
      limit: 50,
    }),
    [agent.id],
  )

  const { data: calls, loading, hasMore, error, loadMore } = useInfiniteScroll("pype_voice_call_logs", queryOptions)

  // Intersection observer for infinite scroll
  const loadMoreRef = useRef<HTMLDivElement>(null)

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

  // Filter calls based on search
  const filteredCalls = useMemo(() => {
    if (!search) return calls
    const searchLower = search.toLowerCase()
    return calls.filter(
      (call: CallLog) =>
        call.customer_number.toLowerCase().includes(searchLower) ||
        call.call_id.toLowerCase().includes(searchLower) ||
        call.call_ended_reason.toLowerCase().includes(searchLower),
    )
  }, [calls, search])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

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

  
  const formatTimeShort = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const exportToCSV = () => {
    const csvContent = [
      ["Call ID", "Customer", "Duration", "Status", "Environment", "Date"].join(","),
      ...filteredCalls.map((call) =>
        [
          call.call_id,
          call.customer_number,
          formatDuration(call.duration_seconds),
          call.call_ended_reason,
          call.environment,
          formatTime(call.created_at),
        ].join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `call-logs-${agent.name}-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
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

      {/* Table Container */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto">
          {loading && calls.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                <p className="text-muted-foreground">Loading calls...</p>
              </div>
            </div>
          ) : filteredCalls.length === 0 && !loading ? (
            <div className="text-center py-12">
              <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{search ? "No calls match your search" : "No calls found"}</h3>
              <p className="text-muted-foreground">
                {search
                  ? "Try adjusting your search terms to find what you're looking for."
                  : "Calls will appear here once your agent starts handling conversations."}
              </p>
            </div>
          ) : (
            <div className="border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[140px]">Customer</TableHead>
                    <TableHead className="w-[120px]">Call ID</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[80px]">Duration</TableHead>
                    <TableHead className="w-[120px]">Started</TableHead>                    
                    <TableHead className="w-[80px]">Recording</TableHead>
                    <TableHead className="w-[50px]">Avg Latency</TableHead>
                    <TableHead className="w-[50px]">Meta Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="mx-2">
                  {filteredCalls.map((call: CallLog) => (
                    <TableRow
                      key={call.id}
                      className={cn(
                        "cursor-pointer hover:bg-muted/50 transition-colors",
                        selectedCall?.id === call.id && "bg-muted",
                      )}
                      onClick={() => setSelectedCall(call)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          {call.customer_number}
                        </div>
                      </TableCell>

                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{call.call_id.slice(-8)}</code>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={call.call_ended_reason === "completed" ? "default" : "destructive"}
                          className="text-xs"
                        >
                          {call.call_ended_reason === "completed" ? (
                            <CheckCircle className="w-3 h-3 mr-1" />
                          ) : (
                            <XCircle className="w-3 h-3 mr-1" />
                          )}
                          {call.call_ended_reason}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          {formatDuration(call.duration_seconds)}
                        </div>
                      </TableCell>

                      <TableCell className="text-sm text-muted-foreground">
                        {formatToIndianDateTime(call.call_started_at)}
                        {/* {call.call_started_at} */}
                      </TableCell>


                      <TableCell>
                        {call.recording_url ? (
                          <Badge variant="secondary" className="text-xs">
                            Available
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {call?.avg_latency ? `${call.avg_latency.toFixed(4)}ms` : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {call.metadata ? (
                          Object.entries(call.metadata).map(([key, value]) => {
                            const isObject = typeof value === "object" && value !== null

                            return (
                              <div key={key}>
                                <span className="font-medium">{key}:</span>{" "}
                                {isObject ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="underline cursor-help text-blue-600">
                                        (hover)
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                      <pre className="text-xs max-w-[300px] whitespace-pre-wrap break-words">
                                        {JSON.stringify(value, null, 2)}
                                      </pre>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  String(value)
                                )}
                              </div>
                            )
                          })
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
              {!hasMore && filteredCalls.length > 0 && (
                <div className="text-center py-4 text-muted-foreground text-sm border-t">
                  All calls loaded ({filteredCalls.length} total)
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Call Details Drawer */}
      <CallDetailsDrawer isOpen={!!selectedCall} callData={selectedCall} onClose={() => setSelectedCall(null)} />
    </div>
  )
}

export default CallLogs
