"use client"

import type React from "react"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { supabase } from "../../lib/supabase"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import CallFilter, { type FilterRule } from "./CallFilter"
import ColumnSelector from "./ColumnSelector"
import { Settings2, Save, Trash2, Eye, Filter, Columns, RefreshCw, AlertCircle, Database, Search } from "lucide-react"

// ===== TYPES AND INTERFACES =====
interface AgentCustomLogsViewProps {
  agentId: string
  dateRange: { from: string; to: string }
}

interface CustomView {
  id: string
  name: string
  filters: FilterRule[]
  visible_columns: {
    basic: string[]
    metadata: string[]
    transcription_metrics: string[]
  }
  created_at?: string
  updated_at?: string
}

interface CallLog {
  id: string
  call_id: string
  customer_number: string
  call_started_at: string
  duration_seconds: number
  avg_latency?: number
  call_ended_reason: string
  metadata: Record<string, any>
  transcription_metrics: Record<string, any>
}

enum LoadingState {
  IDLE = "idle",
  LOADING = "loading",
  ERROR = "error",
  SUCCESS = "success",
}

// ===== CONSTANTS =====
const PAGE_SIZE = 20
const DEFAULT_BASIC_COLUMNS = ["customer_number", "call_id", "call_ended_reason", "duration_seconds", "call_started_at", "avg_latency"]

const BASIC_COLUMN_DEFINITIONS = [
  { key: "customer_number", label: "Customer Number" },
  { key: "call_id", label: "Call ID" },
  { key: "call_ended_reason", label: "Call Status" },
  { key: "duration_seconds", label: "Duration" },
  { key: "call_started_at", label: "Start Time" },
  { key: "avg_latency", label: "Avg Latency (ms)" },
]

// ===== CUSTOM HOOKS =====
const useLocalStorage = (key: string, defaultValue: string) => {
  const [value, setValue] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(key) || defaultValue
    }
    return defaultValue
  })

  const setStoredValue = useCallback((newValue: string) => {
    setValue(newValue)
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, newValue)
    }
  }, [key])

  return [value, setStoredValue] as const
}

const useInfiniteScroll = (callback: () => void, hasMore: boolean, isLoading: boolean) => {
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!hasMore || isLoading) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          callback()
        }
      },
      { threshold: 1 }
    )

    const current = loadMoreRef.current
    if (current) observer.observe(current)

    return () => {
      if (current) observer.unobserve(current)
    }
  }, [hasMore, isLoading, callback])

  return loadMoreRef
}

// ===== UTILITY FUNCTIONS =====
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

const formatDateTime = (timestamp: string): string => {
  const date = new Date(timestamp)
  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  })
}

const getStatusVariant = (status: string) => {
  switch (status.toLowerCase()) {
    case "completed":
      return "default"
    case "failed":
      return "destructive"
    case "busy":
      return "secondary"
    default:
      return "outline"
  }
}

// ===== MAIN COMPONENT =====
const AgentCustomLogsView: React.FC<AgentCustomLogsViewProps> = ({ agentId, dateRange }) => {
  // ===== STATE MANAGEMENT =====
  const [selectedViewId, setStoredSelectedViewId] = useLocalStorage(`selectedView-${agentId}`, "all")
  
  // Core data state
  const [views, setViews] = useState<CustomView[]>([])
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [currentFilters, setCurrentFilters] = useState<FilterRule[]>([])
  const [currentColumns, setCurrentColumns] = useState<{
    basic: string[]
    metadata: string[]
    transcription_metrics: string[]
  }>({
    basic: DEFAULT_BASIC_COLUMNS,
    metadata: [],
    transcription_metrics: [],
  })

  // UI state
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false)
  const [viewName, setViewName] = useState<string>("")
  
  // Pagination state
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  
  // Initialization flags
  const [isInitialized, setIsInitialized] = useState(false)
  const isFirstRender = useRef(true)

  // ===== COMPUTED VALUES =====
  const dynamicColumns = useMemo(() => {
    const metadataKeys = new Set<string>()
    const transcriptionKeys = new Set<string>()

    callLogs.forEach((call) => {
      if (call.metadata && typeof call.metadata === "object") {
        Object.keys(call.metadata).forEach((key) => metadataKeys.add(key))
      }
      if (call.transcription_metrics && typeof call.transcription_metrics === "object") {
        Object.keys(call.transcription_metrics).forEach((key) => transcriptionKeys.add(key))
      }
    })

    return {
      metadata: Array.from(metadataKeys).sort(),
      transcription_metrics: Array.from(transcriptionKeys).sort(),
    }
  }, [callLogs])

  const filteredCallLogs = useMemo(() => {
    if (!searchTerm.trim()) return callLogs

    const searchLower = searchTerm.toLowerCase()
    return callLogs.filter(
      (call) =>
        call.customer_number?.toLowerCase().includes(searchLower) ||
        call.call_id?.toLowerCase().includes(searchLower) ||
        call.call_ended_reason?.toLowerCase().includes(searchLower),
    )
  }, [callLogs, searchTerm])

  const selectedView = useMemo(() => views.find((v) => v.id === selectedViewId), [views, selectedViewId])
  const isLoading = loadingState === LoadingState.LOADING
  const isAllView = selectedViewId === "all"
  const activeFiltersCount = currentFilters.length
  const activeColumnsCount = currentColumns.basic.length + currentColumns.metadata.length + currentColumns.transcription_metrics.length

  // ===== API FUNCTIONS =====
  const fetchViews = useCallback(async (): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from("pype_voice_agent_call_log_views")
        .select("*")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false })

      if (error) throw error
      setViews(data || [])
    } catch (err) {
      console.error("Failed to fetch views:", err)
      setError("Unable to load saved views. Please try again.")
    }
  }, [agentId])

  const convertToSupabaseFilters = useCallback(
    (filters: FilterRule[]) => {
      const supabaseFilters = [{ column: "agent_id", operator: "eq", value: agentId }]

      filters.forEach((filter) => {
        const getColumnName = (forTextOperation = false) => {
          if (!filter.jsonField) return filter.column
          return forTextOperation ? `${filter.column}->>${filter.jsonField}` : `${filter.column}->${filter.jsonField}`
        }

        switch (filter.operation) {
          case "equals":
            if (filter.column === "call_started_at") {
              const startOfDay = `${filter.value} 00:00:00`
              const endOfDay = `${filter.value} 23:59:59.999`
              supabaseFilters.push(
                { column: filter.column, operator: "gte", value: startOfDay },
                { column: filter.column, operator: "lte", value: endOfDay },
              )
            } else {
              supabaseFilters.push({
                column: getColumnName(false),
                operator: "eq",
                value: filter.value,
              })
            }
            break

          case "contains":
            supabaseFilters.push({
              column: getColumnName(true),
              operator: "ilike",
              value: `%${filter.value}%`,
            })
            break

          case "starts_with":
            supabaseFilters.push({
              column: getColumnName(true),
              operator: "ilike",
              value: `${filter.value}%`,
            })
            break

          case "greater_than":
            if (filter.column === "call_started_at") {
              const nextDay = new Date(filter.value)
              nextDay.setDate(nextDay.getDate() + 1)
              const nextDayStr = nextDay.toISOString().split("T")[0]
              supabaseFilters.push({
                column: filter.column,
                operator: "gte",
                value: `${nextDayStr} 00:00:00`,
              })
            } else {
              supabaseFilters.push({
                column: getColumnName(false),
                operator: "gt",
                value: filter.value,
              })
            }
            break

          case "less_than":
            if (filter.column === "call_started_at") {
              supabaseFilters.push({
                column: filter.column,
                operator: "lt",
                value: `${filter.value} 00:00:00`,
              })
            } else {
              supabaseFilters.push({
                column: getColumnName(false),
                operator: "lt",
                value: filter.value,
              })
            }
            break

          case "json_equals":
            supabaseFilters.push({
              column: getColumnName(true),
              operator: "eq",
              value: filter.value,
            })
            break

          case "json_contains":
            supabaseFilters.push({
              column: getColumnName(true),
              operator: "ilike",
              value: `%${filter.value}%`,
            })
            break

          case "json_greater_than":
            supabaseFilters.push({
              column: `${getColumnName(false)}::numeric`,
              operator: "gt",
              value: Number.parseFloat(filter.value).toString(),
            })
            break

          case "json_less_than":
            supabaseFilters.push({
              column: `${getColumnName(false)}::numeric`,
              operator: "lt",
              value: Number.parseFloat(filter.value).toString(),
            })
            break

          case "json_exists":
            supabaseFilters.push({
              column: getColumnName(false),
              operator: "not.is",
              value: "",
            })
            break

          default:
            console.warn(`Unsupported filter operation: ${filter.operation}`)
            break
        }
      })

      return supabaseFilters
    },
    [agentId],
  )

  const fetchCallLogs = useCallback(async (pageNumber: number = 0, reset: boolean = false): Promise<void> => {
    if (pageNumber === 0 || reset) {
      setLoadingState(LoadingState.LOADING)
    }
    setError(null)

    try {
      let query = supabase
        .from("pype_voice_call_logs")
        .select("*")
        .eq("agent_id", agentId)
        .gte("call_started_at", dateRange.from)
        .lte("call_started_at", dateRange.to+1)

      const filters = convertToSupabaseFilters(currentFilters)
      for (const filter of filters) {
        // @ts-ignore
        query = query[filter.operator](filter.column, filter.value)
      }

      const from = pageNumber * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      query = query.order("call_started_at", { ascending: false })
      query = query.range(from, to)

      const { data, error } = await query

      if (error) throw error

      if (data.length < PAGE_SIZE) setHasMore(false)

      if (reset || pageNumber === 0) {
        setCallLogs(data || [])
      } else {
        setCallLogs((prev) => {
          const combined = [...prev, ...data]
          const seen = new Set<string>()
          return combined.filter((log) => {
            if (seen.has(log.call_id)) return false
            seen.add(log.call_id)
            return true
          })
        })
      }
      
      setLoadingState(LoadingState.SUCCESS)
    } catch (err) {
      console.error("Failed to fetch call logs:", err)
      setError("Unable to load call logs. Please check your connection and try again.")
      setLoadingState(LoadingState.ERROR)
    }
  }, [currentFilters, agentId, dateRange, convertToSupabaseFilters])

  // ===== VIEW MANAGEMENT FUNCTIONS =====
  const resetToAllView = useCallback((): void => {
    setCurrentFilters([])
    setCurrentColumns({
      basic: DEFAULT_BASIC_COLUMNS,
      metadata: [],
      transcription_metrics: [],
    })
  }, [])

  const loadView = useCallback((view: CustomView): void => {
    setCurrentFilters(view.filters || [])
    setCurrentColumns({
      basic: view.visible_columns?.basic || DEFAULT_BASIC_COLUMNS,
      metadata: view.visible_columns?.metadata || [],
      transcription_metrics: view.visible_columns?.transcription_metrics || [],
    })
  }, [])

  const handleViewChange = useCallback((value: string): void => {
    setStoredSelectedViewId(value)
    setPage(0)
    setHasMore(true)
    
    if (value === "all") {
      resetToAllView()
    } else {
      const view = views.find((v) => v.id === value)
      if (view) {
        loadView(view)
      }
    }
  }, [views, loadView, resetToAllView, setStoredSelectedViewId])

  const saveView = useCallback(async (): Promise<void> => {
    if (!viewName.trim()) return

    try {
      const { error } = await supabase.from("pype_voice_agent_call_log_views").insert([
        {
          agent_id: agentId,
          name: viewName.trim(),
          filters: currentFilters,
          visible_columns: currentColumns,
        },
      ])

      if (error) throw error

      setViewName("")
      setIsCustomizeOpen(false)
      await fetchViews()
    } catch (err) {
      console.error("Failed to save view:", err)
      setError("Unable to save view. Please try again.")
    }
  }, [viewName, agentId, currentFilters, currentColumns, fetchViews])

  const deleteView = useCallback(async (viewId: string): Promise<void> => {
    try {
      const { error } = await supabase.from("pype_voice_agent_call_log_views").delete().eq("id", viewId)

      if (error) throw error

      setViews((prev) => prev.filter((view) => view.id !== viewId))

      if (selectedViewId === viewId) {
        setStoredSelectedViewId("all")
        resetToAllView()
      }
    } catch (err) {
      console.error("Failed to delete view:", err)
      setError("Unable to delete view. Please try again.")
    }
  }, [selectedViewId, resetToAllView, setStoredSelectedViewId])

  // ===== PAGINATION =====
  const handleLoadMore = useCallback(() => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchCallLogs(nextPage, false)
  }, [page, fetchCallLogs])

  // fetch in background
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const filters = convertToSupabaseFilters(currentFilters)
        let query = supabase
          .from("pype_voice_call_logs")
          .select("*")
          .eq("agent_id", agentId)
          .gte("call_started_at", dateRange.from)
          .lte("call_started_at", dateRange.to + 1)
          .order("call_started_at", { ascending: false })
          .limit(PAGE_SIZE)
  
        for (const filter of filters) {
          // @ts-ignore
          query = query[filter.operator](filter.column, filter.value)
        }
  
        const { data, error } = await query
        if (error) throw error
  
        // Check if there's any new data not already in the list
        if (data && data.length > 0) {
          const latestExistingCallId = callLogs[0]?.call_id
          const isNew = data.some((log) => log.call_id !== latestExistingCallId)
  
          if (isNew) {
            // Append new logs at the beginning
            setCallLogs((prev) => {
              const ids = new Set(prev.map((log) => log.call_id))
              const newOnes = data.filter((log) => !ids.has(log.call_id))
              return [...newOnes, ...prev]
            })
          }
        }
      } catch (err) {
        console.error("Background refresh failed:", err)
      }
    }, 5 * 60 * 1000)
  
    return () => clearInterval(interval)
  }, [agentId, dateRange, currentFilters, callLogs, convertToSupabaseFilters])
  
  

  const loadMoreRef = useInfiniteScroll(handleLoadMore, hasMore, isLoading)

  // ===== EFFECTS =====
  
  // Initialize views on mount
  useEffect(() => {
    fetchViews()
  }, [fetchViews])

  // Initialize selected view after views are loaded
  useEffect(() => {
    if (isFirstRender.current && views.length >= 0) {
      isFirstRender.current = false
      
      if (selectedViewId !== "all") {
        const savedView = views.find((v) => v.id === selectedViewId)
        if (savedView) {
          loadView(savedView)
        } else {
          setStoredSelectedViewId("all")
          resetToAllView()
        }
      } else {
        resetToAllView()
      }
      
      setIsInitialized(true)
    }
  }, [views, selectedViewId, loadView, resetToAllView, setStoredSelectedViewId])

  // Fetch call logs when filters change or component initializes
  useEffect(() => {
    if (isInitialized) {
      setPage(0)
      setHasMore(true)
      fetchCallLogs(0, true)
    }
  }, [currentFilters, isInitialized, fetchCallLogs])

  // Clean up dynamic columns when they change
  useEffect(() => {
    setCurrentColumns((prev) => ({
      basic: prev.basic.length === 0 ? DEFAULT_BASIC_COLUMNS : prev.basic,
      metadata: prev.metadata.filter((col) => dynamicColumns.metadata.includes(col)),
      transcription_metrics: prev.transcription_metrics.filter((col) =>
        dynamicColumns.transcription_metrics.includes(col),
      ),
    }))
  }, [dynamicColumns])

  // ===== RENDER =====
  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError(null)} className="h-auto p-1 hover:bg-red-100">
              ×
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Header Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Database className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Call Logs</h1>
                <p className="text-sm text-gray-500">
                  {dateRange.from} to {dateRange.to}
                </p>
              </div>
            </div>

            {/* Status Indicators */}
            <div className="flex items-center gap-2">
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
                  <Filter className="w-3 h-3" />
                  {activeFiltersCount} filter{activeFiltersCount !== 1 ? "s" : ""}
                </Badge>
              )}
              {activeColumnsCount > 0 && (
                <Badge variant="secondary" className="gap-1 bg-green-50 text-green-700 border-green-200">
                  <Columns className="w-3 h-3" />
                  {activeColumnsCount} column{activeColumnsCount !== 1 ? "s" : ""}
                </Badge>
              )}
              {selectedView && (
                <Badge variant="outline" className="gap-1 bg-purple-50 text-purple-700 border-purple-200">
                  <Eye className="w-3 h-3" />
                  {selectedView.name}
                </Badge>
              )}
              {isAllView && (
                <Badge variant="outline" className="gap-1 bg-gray-50 text-gray-700 border-gray-200">
                  <Eye className="w-3 h-3" />
                  All
                </Badge>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPage(0)
                setHasMore(true)
                fetchCallLogs(0, true)
              }}
              disabled={isLoading}
              className="gap-2 bg-transparent"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>

            <Select value={selectedViewId} onValueChange={handleViewChange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select view" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    All
                  </div>
                </SelectItem>
                {views.length > 0 && <Separator />}
                {views.map((view) => (
                  <SelectItem key={view.id} value={view.id}>
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      {view.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedViewId && selectedViewId !== "all" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => deleteView(selectedViewId)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}

            <Dialog open={isCustomizeOpen} onOpenChange={setIsCustomizeOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
                  <Settings2 className="w-4 h-4" />
                  Customize
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Customize Table View</DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
                  {/* Filters Section */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-medium text-gray-900">Filters</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <CallFilter
                        onFiltersChange={setCurrentFilters}
                        onClear={() => setCurrentFilters([])}
                        availableMetadataFields={dynamicColumns.metadata}
                        availableTranscriptionFields={dynamicColumns.transcription_metrics}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Columns Section */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-medium text-gray-900">Columns</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <ColumnSelector
                        basicColumns={BASIC_COLUMN_DEFINITIONS.map((col) => col.key)}
                        basicColumnLabels={Object.fromEntries(BASIC_COLUMN_DEFINITIONS.map((col) => [col.key, col.label]))}
                        metadataColumns={dynamicColumns.metadata}
                        transcriptionColumns={dynamicColumns.transcription_metrics}
                        visibleColumns={currentColumns}
                        onColumnChange={(type, col, vis) => {
                          setCurrentColumns((prev) => ({
                            ...prev,
                            [type]: vis ? [...prev[type], col] : prev[type].filter((c) => c !== col),
                          }))
                        }}
                        onSelectAll={(type, vis) => {
                          setCurrentColumns((prev) => ({
                            ...prev,
                            [type]: vis
                              ? type === "basic"
                                ? BASIC_COLUMN_DEFINITIONS.map((col) => col.key)
                                : type === "metadata"
                                  ? dynamicColumns.metadata
                                  : dynamicColumns.transcription_metrics
                              : [],
                          }))
                        }}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Save View Section */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-medium text-gray-900">Save View</h3>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <Label htmlFor="viewName">View Name</Label>
                        <Input
                          id="viewName"
                          type="text"
                          placeholder="Enter view name..."
                          value={viewName}
                          onChange={(e) => setViewName(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button onClick={saveView} disabled={!viewName.trim()} className="gap-2">
                          <Save className="w-4 h-4" />
                          Save View
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            type="text"
            placeholder="Search calls..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="max-h-[600px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-gray-50 z-10">
              <TableRow className="border-b border-gray-200">
                {currentColumns.basic.includes("customer_number") && (
                  <TableHead className="font-semibold text-gray-700 bg-gray-50">Customer Number</TableHead>
                )}
                {currentColumns.basic.includes("call_id") && (
                  <TableHead className="font-semibold text-gray-700 bg-gray-50">Call ID</TableHead>
                )}
                {currentColumns.basic.includes("call_ended_reason") && (
                  <TableHead className="font-semibold text-gray-700 bg-gray-50">Status</TableHead>
                )}
                {currentColumns.basic.includes("duration_seconds") && (
                  <TableHead className="font-semibold text-gray-700 bg-gray-50">Duration</TableHead>
                )}
                {currentColumns.basic.includes("call_started_at") && (
                  <TableHead className="font-semibold text-gray-700 bg-gray-50">Start Time</TableHead>
                )}
                {currentColumns.basic.includes("avg_latency") && (
                  <TableHead className="font-semibold text-gray-700 bg-gray-50">Avg Latency</TableHead>
                )}
                {currentColumns.metadata.map((key) => (
                  <TableHead key={`metadata-head-${key}`} className="font-semibold text-gray-700 bg-gray-50">
                    {key}
                  </TableHead>
                ))}
                {currentColumns.transcription_metrics.map((key) => (
                  <TableHead key={`trans-head-${key}`} className="font-semibold text-gray-700 bg-gray-50">
                    {key}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && page === 0 ? (
                <TableRow>
                  <TableCell colSpan={20} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <p className="text-gray-600">Loading call logs...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredCallLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={20} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <Database className="w-6 h-6 text-gray-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-gray-600 font-medium">No call logs found</p>
                        <p className="text-gray-400 text-sm">
                          {searchTerm ? "Try adjusting your search terms" : "Try adjusting your filters or date range"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {filteredCallLogs.map((call) => (
                    <TableRow key={call.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                      {currentColumns.basic.includes("customer_number") && (
                        <TableCell className="font-medium text-gray-900">{call.customer_number}</TableCell>
                      )}
                      {currentColumns.basic.includes("call_id") && (
                        <TableCell className="font-mono text-sm text-gray-600">{call.call_id.slice(-8)}</TableCell>
                      )}
                      {currentColumns.basic.includes("call_ended_reason") && (
                        <TableCell>
                          <Badge variant={getStatusVariant(call.call_ended_reason)}>{call.call_ended_reason}</Badge>
                        </TableCell>
                      )}
                      {currentColumns.basic.includes("duration_seconds") && (
                        <TableCell className="text-gray-700">{formatDuration(call.duration_seconds)}</TableCell>
                      )}
                      {currentColumns.basic.includes("call_started_at") && (
                        <TableCell className="text-sm text-gray-600">{formatDateTime(call.call_started_at)}</TableCell>
                      )}
                      {currentColumns.basic.includes("avg_latency") && (
                        <TableCell className="text-gray-700">
                          {call.avg_latency ? `${call.avg_latency.toFixed(2)}ms` : "—"}
                        </TableCell>
                      )}
                      {currentColumns.metadata.map((key, index) => (
                        <TableCell key={`metadata-${call.id}-${key}`} className="max-w-xs truncate text-gray-600">
                          {typeof call.metadata?.[key] === "object"
                            ? JSON.stringify(call.metadata[key])
                            : (call.metadata?.[key] ?? "—")}
                        </TableCell>
                      ))}
                      {currentColumns.transcription_metrics.map((key, index) => (
                        <TableCell key={`trans-${call.id}-${key}`} className="max-w-xs truncate text-gray-600">
                          {call.transcription_metrics?.[key] ?? "—"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                  {/* Load More Trigger */}
                  {hasMore && (
                    <TableRow>
                      <TableCell colSpan={20} className="text-center py-6" ref={loadMoreRef as any}>
                        {isLoading ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            <span className="text-gray-500 text-sm">Loading more...</span>
                          </div>
                        ) : (
                          <span className="text-gray-500 text-sm">Scroll to load more</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Table Footer */}
        {!isLoading && filteredCallLogs.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing {filteredCallLogs.length} of {callLogs.length} call logs
              {searchTerm && ` (filtered by "${searchTerm}")`}
              {!hasMore && " - All results loaded"}
            </p>
          </div>
        )}
      </div>

      {/* Debug Info (Remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-xs">
          <h4 className="font-semibold text-yellow-800 mb-2">Debug Info:</h4>
          <div className="space-y-1 text-yellow-700">
            <div>Selected View: {selectedViewId}</div>
            <div>Is Initialized: {isInitialized.toString()}</div>
            <div>Current Page: {page}</div>
            <div>Has More: {hasMore.toString()}</div>
            <div>Loading State: {loadingState}</div>
            <div>Active Filters: {activeFiltersCount}</div>
            <div>Call Logs Count: {callLogs.length}</div>
            <div>Filtered Count: {filteredCallLogs.length}</div>
            <div>Basic Columns: {currentColumns.basic.join(', ')}</div>
            <div>Metadata Columns: {currentColumns.metadata.join(', ')}</div>
            <div>Transcription Columns: {currentColumns.transcription_metrics.join(', ')}</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AgentCustomLogsView