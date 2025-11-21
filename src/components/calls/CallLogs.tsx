"use client"

import type React from "react"
import { useState, useEffect, useRef, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Phone, Clock, CheckCircle, XCircle, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import CallFilter, { FilterRule } from "../CallFilter"
import ColumnSelector from "../shared/ColumnSelector"
import { cn } from "@/lib/utils"
import { CostTooltip } from "../tool-tip/costToolTip"
import { CallLog } from "../../types/logs"
import { supabase } from "../../lib/supabase"
import Papa from 'papaparse'
import { useUser } from "@clerk/nextjs"
import { getUserProjectRole } from "@/services/getUserRole"
import { useRouter } from "next/navigation"
import { useCallLogs } from "@/hooks/useCallLogs"

interface CallLogsProps {
  project: any
  agent: any
  onBack: () => void
  isLoading?: boolean
}

// Skeleton for the filter header
function FilterHeaderSkeleton() {
  return (
    <div className="flex-none p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between">
        <div className="h-8 bg-muted animate-pulse rounded w-48"></div>
        <div className="flex items-center gap-2">
          <div className="h-8 bg-muted animate-pulse rounded w-24"></div>
          <div className="h-8 bg-muted animate-pulse rounded w-24"></div>
          <div className="h-8 bg-muted animate-pulse rounded w-8"></div>
        </div>
      </div>
    </div>
  )
}

// Skeleton for table structure
function TableSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      <div className="h-full overflow-x-auto overflow-y-hidden">
        <div className="h-full overflow-y-auto" style={{ minWidth: "1020px" }}>
          <Table className="w-full">
            <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b-2">
              <TableRow className="bg-muted/80 hover:bg-muted/80">
                <TableHead className="font-semibold text-foreground min-w-[120px]">Customer Number</TableHead>
                <TableHead className="font-semibold text-foreground min-w-[120px]">Call ID</TableHead>
                <TableHead className="font-semibold text-foreground min-w-[120px]">Call Status</TableHead>
                <TableHead className="font-semibold text-foreground min-w-[120px]">Duration</TableHead>
                <TableHead className="font-semibold text-foreground min-w-[120px]">Start Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Table row skeletons */}
              {Array.from({ length: 8 }).map((_, index) => (
                <TableRow key={index} className="border-b border-border/50">
                  <TableCell className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-muted animate-pulse rounded-full"></div>
                      <div className="h-5 w-24 bg-muted animate-pulse rounded"></div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="h-6 w-16 bg-muted animate-pulse rounded-md"></div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="h-6 w-20 bg-muted animate-pulse rounded-full"></div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="h-5 w-12 bg-muted animate-pulse rounded"></div>
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="h-5 w-32 bg-muted animate-pulse rounded"></div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}


const TruncatedText: React.FC<{ 
  text: string; 
  maxLength?: number;
  className?: string;
}> = ({ text, maxLength = 30, className = "" }) => {
  const truncated = text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("break-words", className)}>
          {truncated}
        </span>
      </TooltipTrigger>
      {text.length > maxLength && (
        <TooltipContent
          sideOffset={6}
          className="pointer-events-auto max-w-[420px] max-h-64 overflow-auto break-words"
        >
          {text}
        </TooltipContent>
      )}
    </Tooltip>
  )
}

// Dynamic JSON Cell Component
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
          <Tooltip>
            <TooltipTrigger asChild>
              <pre 
                className="text-xs font-mono text-foreground whitespace-pre-wrap break-all overflow-hidden w-full"
                style={{ 
                  wordBreak: 'break-all',
                  overflowWrap: 'break-word',
                  maxWidth: '100%'
                }}
              >
                {truncatedJson}
              </pre>
            </TooltipTrigger>
            <TooltipContent
              sideOffset={6}
              className="pointer-events-auto max-w-[520px] max-h-64 overflow-auto whitespace-pre-wrap break-words"
            >
              {jsonString}
            </TooltipContent>
          </Tooltip>
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
      <Tooltip>
        <TooltipTrigger asChild>
          <span 
            className="text-foreground font-medium block w-full overflow-hidden"
            style={{ 
              wordBreak: 'break-all',
              overflowWrap: 'break-word',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {displayValue}
          </span>
        </TooltipTrigger>
        {shouldTruncate && (
          <TooltipContent
            sideOffset={6}
            className="pointer-events-auto max-w-[420px] max-h-64 overflow-auto break-words"
          >
            {stringValue}
          </TooltipContent>
        )}
      </Tooltip>
    </div>
  )
}

const CallLogs: React.FC<CallLogsProps> = ({ project, agent, onBack, isLoading: parentLoading }) => {
  const router = useRouter()

  // Convert string to camelCase
  function toCamelCase(str: string) {
    return str
      .replace(/[^\w\s]/g, '')
      .replace(/\s+(.)/g, (_, c) => c.toUpperCase())
      .replace(/^./, c => c.toLowerCase())
  }

  const basicColumns = useMemo(
    () => [
      { key: "customer_number", label: "Customer Number" },
      { key: "call_id", label: "Call ID" },
      { key: "call_ended_reason", label: "Call Status" },
      { key: "duration_seconds", label: "Duration" },
      { key: "billing_duration_seconds", label: "Billing Duration" },
      {
        key: "total_cost",
        label: "Total Cost (₹)",
      },
      { key: "call_started_at", label: "Start Time" },
      { key: "avg_latency", label: "Avg Latency (ms)", hidden: true },
      { key: "total_llm_cost", label: "LLM Cost (₹)", hidden: true },
      { key: "total_tts_cost", label: "TTS Cost (₹)", hidden: true },
      { key: "total_stt_cost", label: "STT Cost (₹)", hidden: true }
    ],
    [],
  )

  const ROLE_RESTRICTIONS = {
    user: [
      'total_cost',
      'total_llm_cost', 
      'total_tts_cost',
      'total_stt_cost',
      'avg_latency',
      'billing_duration_seconds'
    ],
  }

  const isColumnVisibleForRole = (columnKey: string, role: string | null): boolean => {
    if (!role) return false
    
    const restrictedColumns = ROLE_RESTRICTIONS[role as keyof typeof ROLE_RESTRICTIONS]
    if (!restrictedColumns) return true
    
    return !restrictedColumns.includes(columnKey)
  }

  const dynamicColumnsKey = useMemo(() => {
    if (!agent?.field_extractor_prompt) return []
    try {
      const prompt = agent.field_extractor_prompt;
      if (typeof prompt === 'string') {
        const parsed = JSON.parse(prompt);
        return Array.isArray(parsed) ? parsed.map((item: any) => toCamelCase(item.key)) : [];
      } else if (Array.isArray(prompt)) {
        return prompt.map((item: any) => toCamelCase(item.key));
      }
      return [];
    } catch (error) {
      console.error('Error parsing field_extractor_prompt:', error);
      return [];
    }
  }, [agent?.field_extractor_prompt])

  const [roleLoading, setRoleLoading] = useState(true)
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null)
  const [activeFilters, setActiveFilters] = useState<FilterRule[]>([])
  const [role, setRole] = useState<string | null>(null)
  const [visibleColumns, setVisibleColumns] = useState<{
    basic: string[]
    metadata: string[]
    transcription_metrics: string[]
  }>({
    basic: basicColumns.filter(col => !col.hidden).map(col => col.key),
    metadata: [],
    transcription_metrics: []
  })

  const getFilteredBasicColumns = useMemo(() => {
    return basicColumns.filter(col => 
      !col.hidden && isColumnVisibleForRole(col.key, role)
    )
  }, [role])

  const { user } = useUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress

  // Load user role first
  useEffect(() => {
    if (userEmail && project?.id) {
      const getUserRole = async () => {
        setRoleLoading(true)
        try {
          const userRole = await getUserProjectRole(userEmail, project.id)
          setRole(userRole.role)
        } catch (error) {
          console.error('Failed to load user role:', error)
          setRole('user')
        } finally {
          setRoleLoading(false)
        }
      }
      getUserRole()
    } else {
      setRoleLoading(false)
      setRole('user')
    }
  }, [userEmail, project?.id])

  // Update visible columns when role changes
  useEffect(() => {
    if (role !== null) {
      const allowedBasicColumns = getFilteredBasicColumns.map(col => col.key)
      setVisibleColumns(prev => ({
        ...prev,
        basic: allowedBasicColumns
      }))
    }
  }, [role, getFilteredBasicColumns])

  // Convert FilterRule[] to Supabase filter format
  const convertToSupabaseFilters = (filters: FilterRule[]) => {
    if (!agent?.id) return []
    
    const supabaseFilters = [{ column: "agent_id", operator: "eq", value: agent.id }]
    
    filters.forEach(filter => {
      const getColumnName = (forTextOperation = false) => {
        if (!filter.jsonField) return filter.column
        
        if (forTextOperation) {
          return `${filter.column}->>${filter.jsonField}`
        } else {
          return `${filter.column}->${filter.jsonField}`
        }
      }
      
      switch (filter.operation) {
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
            column: getColumnName(true),
            operator: 'ilike', 
            value: `%${filter.value}%` 
          })
          break
          
        case 'starts_with':
          supabaseFilters.push({ 
            column: getColumnName(true),
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

        case 'json_equals':
          supabaseFilters.push({ 
            column: getColumnName(true),
            operator: 'eq', 
            value: filter.value 
          })
          break
          
        case 'json_contains':
          supabaseFilters.push({ 
            column: getColumnName(true),
            operator: 'ilike', 
            value: `%${filter.value}%` 
          })
          break
          
        case 'json_greater_than':
          supabaseFilters.push({ 
            column: `${getColumnName(false)}::numeric`, 
            operator: 'gt', 
            value: parseFloat(filter.value) 
          })
          break
          
        case 'json_less_than':
          supabaseFilters.push({ 
            column: `${getColumnName(false)}::numeric`, 
            operator: 'lt', 
            value: parseFloat(filter.value) 
          })
          break
          
        case 'json_exists':
          supabaseFilters.push({ 
            column: getColumnName(false),
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

  const selectColumns = useMemo(() => {
    if (!role) return '*'
    
    let columns = [
      'id',
      'agent_id',
      'call_id',
      'customer_number',
      'call_ended_reason',
      'call_started_at',
      'call_ended_at',
      'duration_seconds',
      'recording_url',
      'metadata',
      'environment',
      'transcript_type',
      'transcript_json',
      'created_at',
      'transcription_metrics',
      'billing_duration_seconds'
    ]
  
    if (isColumnVisibleForRole('avg_latency', role)) {
      columns.push('avg_latency')
    }
    
    if (isColumnVisibleForRole('total_llm_cost', role)) {
      columns.push('total_llm_cost', 'total_tts_cost', 'total_stt_cost')
    }
  
    return columns.join(',')
  }, [role])

  const { 
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    error: queryError,
    fetchNextPage,
    refetch 
  } = useCallLogs({
    agentId: agent?.id,
    filters: convertToSupabaseFilters(activeFilters),
    select: selectColumns,
    enabled: !!agent?.id
  })
  
  // Flatten pages into single array
  const calls = data?.pages.flat() ?? []
  
  // Map to match old API
  const loading = isLoading || isFetchingNextPage
  const hasMore = hasNextPage ?? false
  const loadMore = fetchNextPage
  const refresh = refetch
  const error = queryError?.message

  // Extract all unique keys from metadata and transcription_metrics across all calls
  const dynamicColumns = useMemo(() => {
    const metadataKeys = new Set<string>()
    const transcriptionKeys = new Set<string>()

    calls.forEach((call: CallLog) => {
      if (call.metadata && typeof call.metadata === 'object') {
        Object.keys(call.metadata).forEach(key => metadataKeys.add(key))
      }

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
    setVisibleColumns((prev) => {
      // Only update if actually needed
      const newBasic = prev.basic.length === 0 
        ? basicColumns.filter(col => !col.hidden).map((col) => col.key)
        : prev.basic
        
      const newMetadata = Array.from(
        new Set(
          prev.metadata.length === 0 
            ? dynamicColumns.metadata 
            : prev.metadata.filter((col) => dynamicColumns.metadata.includes(col))
        )
      )
      
      const newTranscription = prev.transcription_metrics.length === 0
        ? dynamicColumnsKey
        : prev.transcription_metrics
      
      // Only update if something actually changed
      if (
        JSON.stringify(prev.basic) === JSON.stringify(newBasic) &&
        JSON.stringify(prev.metadata) === JSON.stringify(newMetadata) &&
        JSON.stringify(prev.transcription_metrics) === JSON.stringify(newTranscription)
      ) {
        return prev // No change, return previous state to prevent re-render
      }
      
      return {
        basic: newBasic,
        metadata: newMetadata,
        transcription_metrics: newTranscription
      }
    })
  }, [dynamicColumns.metadata, dynamicColumnsKey, basicColumns])

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

  const handleDownloadCSV = async () => {
    if (!agent?.id) return
    
    const { basic, metadata, transcription_metrics } = visibleColumns;

    const selectColumns = [
      'id',
      'agent_id',
      ...basic.filter(col => col !== "total_cost"),
      ...(metadata.length > 0 ? ['metadata'] : []),
      ...(transcription_metrics.length > 0 ? ['transcription_metrics'] : []),
    ];

    try {
      let query = supabase
        .from("pype_voice_call_logs")
        .select(selectColumns.join(','));

      const filters = convertToSupabaseFilters(activeFilters);
      
      for (const filter of filters) {
        switch (filter.operator) {
          case 'eq':
            query = query.eq(filter.column, filter.value);
            break;
          case 'ilike':
            query = query.ilike(filter.column, filter.value);
            break;
          case 'gte':
            query = query.gte(filter.column, filter.value);
            break;
          case 'lte':
            query = query.lte(filter.column, filter.value);
            break;
          case 'gt':
            query = query.gt(filter.column, filter.value);
            break;
          case 'lt':
            query = query.lt(filter.column, filter.value);
            break;
          case 'not.is':
            query = query.not(filter.column, 'is', filter.value);
            break;
          default:
            console.warn(`Unknown operator: ${filter.operator}`);
        }
      }

      query = query.order('created_at', { ascending: false });

      let allData: CallLog[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMoreData = true;

      while (hasMoreData) {
        const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) {
          alert("Failed to fetch data for export: " + error.message);
          return;
        }

        if (data && data.length > 0) {
          allData = allData.concat(data as unknown as CallLog[]);
          
          if (data.length < pageSize) {
            hasMoreData = false;
          } else {
            page += 1;
          }
        } else {
          hasMoreData = false;
        }
      }

      if (allData.length === 0) {
        alert("No data found to export");
        return;
      }

      const csvData = allData.map((row) => {
        const flattened = flattenAndPickColumnsFixed(row, basic, metadata, transcription_metrics);
        return flattened;
      });

      const csv = Papa.unparse(csvData);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `call_logs_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Download error:', error);
      alert("Failed to download CSV: " + (error as Error).message);
    }
  };

  function flattenAndPickColumnsFixed(
    row: CallLog,
    basic: string[],
    metadata: string[],
    transcription: string[]
  ): Record<string, any> {
    const flat: Record<string, any> = {};

    for (const key of basic) {
      if (key in row && key !== 'total_cost') {
        flat[key] = row[key as keyof CallLog];
      }
    }

    if (basic.includes('total_cost')) {
      const totalCost = (row.total_llm_cost || 0) + (row.total_tts_cost || 0) + (row.total_stt_cost || 0);
      flat['total_cost'] = totalCost;
    }

    if (row.metadata && typeof row.metadata === "object" && metadata.length > 0) {
      for (const key of metadata) {
        const value = row.metadata[key];
        flat[`metadata_${key}`] = value !== undefined && value !== null 
          ? (typeof value === 'object' ? JSON.stringify(value) : String(value))
          : '';
      }
    } else if (metadata.length > 0) {
      for (const key of metadata) {
        flat[`metadata_${key}`] = '';
      }
    }

    if (row.transcription_metrics && typeof row.transcription_metrics === "object" && transcription.length > 0) {
      for (const key of transcription) {
        const value = row.transcription_metrics[key];
        flat[`transcription_${key}`] = value !== undefined && value !== null 
          ? (typeof value === 'object' ? JSON.stringify(value) : String(value))
          : '';
      }
    } else if (transcription.length > 0) {
      for (const key of transcription) {
        flat[`transcription_${key}`] = '';
      }
    }

    return flat;
  }

  const totalVisibleColumns = visibleColumns.metadata.length + visibleColumns.transcription_metrics.length
  const baseWidth = 1020
  const dynamicWidth = totalVisibleColumns * 200
  const minTableWidth = baseWidth + dynamicWidth

  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1 },
    )
  
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }
  
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const handleFiltersChange = (filters: FilterRule[]) => {
    setActiveFilters(filters)
  }

  const handleClearFilters = () => {
    setActiveFilters([])
  }

  const handleRefresh = () => {
    refetch()
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
  

  // Show skeleton while parent is loading OR role is loading
  if (parentLoading || roleLoading || !agent || !project || (isLoading && !data)) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <FilterHeaderSkeleton />
        <TableSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-none p-4 border-b bg-background/95 dark:bg-gray-900/95">
          <div className="flex items-center justify-between">
            <div className="h-8 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-4 rounded-lg flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              Unable to load calls
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-red-500 dark:text-red-400 mx-auto" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Unable to load calls</h3>
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Header with Filters and Column Selector - Now shows immediately */}
      <div className="flex-none p-4 border-b border-gray-200 dark:border-gray-700 bg-background/95 dark:bg-gray-900/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between">
          <CallFilter 
            onFiltersChange={handleFiltersChange}
            onClear={handleClearFilters}
            availableMetadataFields={dynamicColumns.metadata}
            availableTranscriptionFields={dynamicColumnsKey}
          />
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadCSV}
              disabled={loading || !agent?.id}
              className="border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Download CSV
            </Button>
            <ColumnSelector
              basicColumns={basicColumns.map((col) => col.key)}
              basicColumnLabels={Object.fromEntries(basicColumns.filter(col => !col.hidden).map((col) => [col.key, col.label]))}
              metadataColumns={dynamicColumns.metadata}
              transcriptionColumns={dynamicColumnsKey}
              visibleColumns={visibleColumns}
              onColumnChange={handleColumnChange}
              onSelectAll={handleSelectAll}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              className="gap-2 h-8 w-8 p-0 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-y-auto min-h-0">
          <div className="h-full overflow-x-auto overflow-y-hidden">
            <div className="h-full overflow-y-auto" style={{ minWidth: `${minTableWidth}px` }}>
              <Table className="w-full">
                <TableHeader className="sticky top-0 z-10 bg-background/95 dark:bg-gray-900/95 backdrop-blur-sm border-b-2">
                  <TableRow className="bg-muted/80 dark:bg-gray-800/80 hover:bg-muted/80 dark:hover:bg-gray-800/80">
                    {/* Fixed Columns */}
                    {visibleColumns.basic.map((key) => {
                      const col = basicColumns.find((c) => c.key === key)
                      return (
                        <TableHead key={`basic-${key}`} className="font-semibold text-foreground dark:text-gray-100 min-w-[120px]">
                          {col?.label ?? key}
                        </TableHead>
                      )
                    })}

                    {/* Dynamic Metadata Columns */}
                    {visibleColumns.metadata.map((key) => (
                      <TableHead 
                        key={`metadata-${key}`} 
                        className="w-[200px] font-semibold text-foreground dark:text-gray-100 bg-blue-50/50 dark:bg-blue-950/20 border-r border-blue-200/50 dark:border-blue-800/50"
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
                          "w-[200px] font-semibold text-foreground dark:text-gray-100 bg-blue-50/50 dark:bg-blue-950/20",
                          index === 0 && visibleColumns.metadata.length === 0 && "border-l-2 border-primary/30 dark:border-primary/40",
                          index < visibleColumns.transcription_metrics.length - 1 && "border-r border-blue-200/50 dark:border-blue-800/50"
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
                        "cursor-pointer hover:bg-muted/30 dark:hover:bg-gray-800/50 transition-all duration-200 border-b border-border/50 dark:border-gray-700/50",
                        selectedCall?.id === call.id && "bg-muted/50 dark:bg-gray-800/50",
                      )}
                      onClick={() => {
                        router.push(`/${project?.id}/agents/${call.agent_id}/observability?session_id=${call?.id}`)
                      }}
                    >
                      {visibleColumns.basic.map((key) => {
                        let value: React.ReactNode = "-"

                        switch (key) {
                          case "customer_number":
                            value = (
                              <div className="flex w-full items-center gap-3">
                                <div className="w-10 h-8 rounded-full flex items-center justify-center">
                                  <Phone className="w-4 h-4 text-primary dark:text-primary" />
                                </div>
                                <span className="font-medium text-gray-900 dark:text-gray-100">{call.customer_number}</span>
                              </div>
                            )
                            break
                          case "call_id":
                            value = (
                              <code className="text-xs bg-muted/60 dark:bg-gray-700/60 px-3 py-1.5 rounded-md font-mono text-gray-900 dark:text-gray-100">
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
                          case "billing_duration_seconds":
                              value = (
                                <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                                <Clock className="w-3 h-3 text-muted-foreground dark:text-gray-400" />
                                {formatDuration(call?.billing_duration_seconds ?? 0)}
                              </div>
                              )
                              break
                          case "duration_seconds":
                            value = (
                              <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                                <Clock className="w-3 h-3 text-muted-foreground dark:text-gray-400" />
                                {formatDuration(call.duration_seconds)}
                              </div>
                            )
                            break
                          case "call_started_at":
                            value = <span className="text-gray-900 dark:text-gray-100">{formatToIndianDateTime(call.call_started_at)}</span>
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
                          className="py-4 bg-blue-50/30 dark:bg-blue-950/10 border-r border-blue-200/50 dark:border-blue-800/50"
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
                            index === 0 && visibleColumns.metadata.length === 0 && "border-l-2 border-primary/30 dark:border-primary/40",
                            index < visibleColumns.transcription_metrics.length - 1 && "border-r border-blue-200/50 dark:border-blue-800/50"
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
              {hasNextPage && (
                <div ref={loadMoreRef} className="py-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                  {isFetchingNextPage && <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />}
                </div>
              )}

              {/* End of List */}
              {!hasNextPage && calls.length > 0 && (
                <div className="py-4 text-muted-foreground dark:text-gray-400 text-sm border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-center">
                  All calls loaded ({calls.length} total)
                </div>
              )}
            </div>
          </div>
      </div>
    </div>
  )
}

export default CallLogs