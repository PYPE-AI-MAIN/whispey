// src/components/observability/ObservabilityFilters.tsx
"use client"

import { BarChart3 } from "lucide-react"
import { useSupabaseQuery } from "../../hooks/useSupabase"
import { useMemo } from "react"

interface ObservabilityFiltersProps {
  filters: {
    search: string
    status: string
    timeRange: string
  }
  onFiltersChange: (filters: any) => void
  agentId: string
  sessionId?: string
}

const ObservabilityFilters: React.FC<ObservabilityFiltersProps> = ({
  filters,
  onFiltersChange,
  agentId,
  sessionId
}) => {
  // Fetch summary stats
  const { data: traceData } = useSupabaseQuery("pype_voice_metrics_logs", {
    select: "trace_id,trace_duration_ms,trace_cost_usd,otel_spans,created_at",
    filters: sessionId 
      ? [{ column: "session_id", operator: "eq", value: sessionId }]
      : [{ column: "session_id::text", operator: "like", value: `${agentId}%` }],
    orderBy: { column: "created_at", ascending: false }
  })

  // Calculate summary statistics
  const stats = useMemo(() => {
    if (!traceData?.length) return { totalTraces: 0, avgDuration: 0, totalCost: 0, errorCount: 0 }

    const traces = traceData.filter(item => item.trace_id) // Only items with traces
    const totalTraces = traces.length
    const totalDuration = traces.reduce((sum, item) => sum + (item.trace_duration_ms || 0), 0)
    const avgDuration = totalTraces > 0 ? totalDuration / totalTraces / 1000 : 0 // Convert to seconds
    const totalCost = traces.reduce((sum, item) => sum + (parseFloat(item.trace_cost_usd) || 0), 0)
    
    // Count errors from spans
    const errorCount = traces.reduce((count, item) => {
      const spans = item.otel_spans || []
      return count + spans.filter((span: any) => span.status === 'error').length
    }, 0)

    return { totalTraces, avgDuration, totalCost, errorCount }
  }, [traceData])

  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, search: value })
  }

  const handleStatusChange = (value: string) => {
    onFiltersChange({ ...filters, status: value })
  }

  const handleTimeRangeChange = (value: string) => {
    onFiltersChange({ ...filters, timeRange: value })
  }

  const exportTraces = () => {
    // TODO: Implement CSV export of traces
    console.log("Exporting traces...")
  }

  return (
    <div className="flex-shrink-0 border-b bg-gray-50/50">
      {/* Quick Stats Bar */}
      <div className="px-6 py-4 border-b bg-white">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-muted-foreground">Quick Stats:</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600">{stats.totalTraces}</div>
              <div className="text-xs text-muted-foreground">Traces</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">{stats.avgDuration.toFixed(2)}s</div>
              <div className="text-xs text-muted-foreground">Avg Duration</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-purple-600">${stats.totalCost.toFixed(4)}</div>
              <div className="text-xs text-muted-foreground">Total Cost</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      {/* <div className="px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search traces, user input, or trace IDs..."
                value={filters.search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 w-80"
              />
            </div>

            <Select value={filters.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-40">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.timeRange} onValueChange={handleTimeRangeChange}>
              <SelectTrigger className="w-36">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              {filters.search && (
                <Badge variant="secondary" className="text-xs">
                  Search: "{filters.search}"
                </Badge>
              )}
              {filters.status !== "all" && (
                <Badge variant="secondary" className="text-xs">
                  Status: {filters.status}
                </Badge>
              )}
              {sessionId && (
                <Badge variant="outline" className="text-xs">
                  Session: {sessionId.slice(0, 8)}...
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportTraces}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </div> */}
    </div>
  )
}

export default ObservabilityFilters