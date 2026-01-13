// utils/callLogsUtils.ts

import Papa from 'papaparse'
import { supabase } from "@/lib/supabase"
import { CallLog } from "@/types/logs"
import { FilterRule } from '@/components/CallFilter'
import { Filter } from '@/hooks/useSupabase'

// Pure utility functions - no React dependencies
export const toCamelCase = (str: string): string => {
  return str
    .replace(/[^\w\s]/g, '')
    .replace(/\s+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^./, c => c.toLowerCase())
}

export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export const formatToIndianDateTime = (timestamp: any): string => {
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

export const ROLE_RESTRICTIONS = {
  user: [
    'total_cost',
    'total_llm_cost', 
    'total_tts_cost',
    'total_stt_cost',
    'avg_latency',
    'billing_duration_seconds'
  ],
} as const

export const isColumnVisibleForRole = (columnKey: string, role: string | null): boolean => {
  if (!role) return false
  const restrictedColumns = ROLE_RESTRICTIONS[role as keyof typeof ROLE_RESTRICTIONS]
  if (!restrictedColumns) return true
  return !(restrictedColumns as readonly string[]).includes(columnKey)
}

export const convertToSupabaseFilters = (filters: FilterRule[], agentId?: string): Filter[] => {
  if (!agentId) return []
  
  const supabaseFilters: Filter[] = [{ column: "agent_id", operator: "eq", value: agentId }]
  
  console.log('🔄 Converting filters:', JSON.stringify(filters, null, 2))
  
  filters.forEach(filter => {
    const getColumnName = (forTextOperation = false) => {
      // Backward compatibility: If JSONB column but no jsonField, skip this filter
      if ((filter.column === 'metadata' || filter.column === 'transcription_metrics') && !filter.jsonField) {
        const jsonbOperations = ['json_equals', 'json_contains', 'json_greater_than', 'json_less_than', 'json_exists']
        if (jsonbOperations.includes(filter.operation)) {
          console.warn(`Skipping invalid filter: ${filter.column} with operation ${filter.operation} missing jsonField`)
          return null // Signal to skip this filter
        }
      }
      
      if (!filter.jsonField) return filter.column
      if (forTextOperation) {
        return `${filter.column}->>'${filter.jsonField}'`
      } else {
        return `${filter.column}->'${filter.jsonField}'`
      }
    }
    
    const columnName = getColumnName(false)
    const columnNameText = getColumnName(true)
    
    // Skip if column name is null (invalid filter)
    if (columnName === null || columnNameText === null) {
      return
    }
    
    switch (filter.operation) {
      case 'equals':
        if (filter.column === 'call_started_at') {
          const startOfDay = `${filter.value} 00:00:00`
          const endOfDay = `${filter.value} 23:59:59.999`
          supabaseFilters.push({ column: filter.column, operator: 'gte', value: startOfDay })
          supabaseFilters.push({ column: filter.column, operator: 'lte', value: endOfDay })
        } else {
          supabaseFilters.push({ column: columnName, operator: 'eq', value: filter.value })
        }
        break
      case 'contains':
        supabaseFilters.push({ column: columnNameText, operator: 'ilike', value: `%${filter.value}%` })
        break
      case 'starts_with':
        supabaseFilters.push({ column: columnNameText, operator: 'ilike', value: `${filter.value}%` })
        break
      case 'greater_than':
        if (filter.column === 'call_started_at') {
          const nextDay = new Date(filter.value)
          nextDay.setDate(nextDay.getDate() + 1)
          const nextDayStr = nextDay.toISOString().split('T')[0]
          supabaseFilters.push({ column: filter.column, operator: 'gte', value: `${nextDayStr} 00:00:00` })
        } else {
          supabaseFilters.push({ column: columnName, operator: 'gt', value: filter.value })
        }
        break
      case 'less_than':
        if (filter.column === 'call_started_at') {
          supabaseFilters.push({ column: filter.column, operator: 'lt', value: `${filter.value} 00:00:00` })
        } else {
          supabaseFilters.push({ column: columnName, operator: 'lt', value: filter.value })
        }
        break
      case 'json_equals':
        supabaseFilters.push({ column: columnNameText, operator: 'eq', value: filter.value })
        break
      case 'json_contains':
        supabaseFilters.push({ column: columnNameText, operator: 'ilike', value: `%${filter.value}%` })
        break
      case 'json_greater_than':
        supabaseFilters.push({ column: `${columnName}::numeric`, operator: 'gt', value: parseFloat(filter.value) })
        break
      case 'json_less_than':
        supabaseFilters.push({ column: `${columnName}::numeric`, operator: 'lt', value: parseFloat(filter.value) })
        break
      case 'json_exists':
        // Use ->> (text extraction) for json_exists, same as build_single_filter_condition
        supabaseFilters.push({ column: columnNameText, operator: 'not.is', value: null })
        break
      default:
        console.warn(`Unknown filter operation: ${filter.operation}`)
        break
    }
  })
  
  console.log('✅ Converted filters:', JSON.stringify(supabaseFilters, null, 2))
  return supabaseFilters
}

export const getSelectColumns = (role: string | null): string => {
  if (!role) return '*'
  
  let columns = [
    'id', 'agent_id', 'call_id', 'customer_number', 'call_ended_reason',
    'call_started_at', 'call_ended_at', 'duration_seconds', 'recording_url',
    'metadata', 'environment', 'transcript_type', 'transcript_json',
    'created_at', 'transcription_metrics', 'billing_duration_seconds', 'metrics'
  ]

  if (isColumnVisibleForRole('avg_latency', role)) {
    columns.push('avg_latency')
  }
  
  if (isColumnVisibleForRole('total_llm_cost', role)) {
    columns.push('total_llm_cost', 'total_tts_cost', 'total_stt_cost')
  }

  return columns.join(',')
}

export const flattenCallLogForCSV = (
  row: CallLog,
  basic: string[],
  metadata: string[],
  transcription: string[]
): Record<string, any> => {
  const flat: Record<string, any> = {}

  for (const key of basic) {
    if (key in row && key !== 'total_cost') {
      flat[key] = row[key as keyof CallLog]
    }
  }

  if (basic.includes('total_cost')) {
    const totalCost = (row.total_llm_cost || 0) + (row.total_tts_cost || 0) + (row.total_stt_cost || 0)
    flat['total_cost'] = totalCost
  }

  if (row.metadata && typeof row.metadata === "object" && metadata.length > 0) {
    for (const key of metadata) {
      const value = row.metadata[key]
      flat[`metadata_${key}`] = value !== undefined && value !== null 
        ? (typeof value === 'object' ? JSON.stringify(value) : String(value))
        : ''
    }
  } else if (metadata.length > 0) {
    for (const key of metadata) {
      flat[`metadata_${key}`] = ''
    }
  }

  if (row.transcription_metrics && typeof row.transcription_metrics === "object" && transcription.length > 0) {
    for (const key of transcription) {
      const value = row.transcription_metrics[key]
      flat[`transcription_${key}`] = value !== undefined && value !== null 
        ? (typeof value === 'object' ? JSON.stringify(value) : String(value))
        : ''
    }
  } else if (transcription.length > 0) {
    for (const key of transcription) {
      flat[`transcription_${key}`] = ''
    }
  }

  return flat
}

export const downloadCSV = async (
  agentId: string,
  activeFilters: FilterRule[],
  visibleColumns: {
    basic: string[]
    metadata: string[]
    transcription_metrics: string[]
  }
) => {
  const { basic, metadata, transcription_metrics } = visibleColumns

  const selectColumns = [
    'id', 'agent_id',
    ...basic.filter(col => col !== "total_cost"),
    ...(metadata.length > 0 ? ['metadata'] : []),
    ...(transcription_metrics.length > 0 ? ['transcription_metrics'] : []),
  ]

  try {
    let query = supabase.from("pype_voice_call_logs").select(selectColumns.join(','))
    const filters = convertToSupabaseFilters(activeFilters, agentId)
    
    for (const filter of filters) {
      switch (filter.operator) {
        case 'eq': query = query.eq(filter.column, filter.value); break
        case 'ilike': query = query.ilike(filter.column, filter.value); break
        case 'gte': query = query.gte(filter.column, filter.value); break
        case 'lte': query = query.lte(filter.column, filter.value); break
        case 'gt': query = query.gt(filter.column, filter.value); break
        case 'lt': query = query.lt(filter.column, filter.value); break
        case 'not.is': query = query.not(filter.column, 'is', filter.value); break
        default: console.warn(`Unknown operator: ${filter.operator}`)
      }
    }

    query = query.order('created_at', { ascending: false })

    let allData: CallLog[] = []
    let page = 0
    const pageSize = 1000
    let hasMoreData = true

    while (hasMoreData) {
      const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1)
      
      if (error) {
        throw new Error("Failed to fetch data for export: " + error.message)
      }

      if (data && data.length > 0) {
        allData = allData.concat(data as unknown as CallLog[])
        if (data.length < pageSize) {
          hasMoreData = false
        } else {
          page += 1
        }
      } else {
        hasMoreData = false
      }
    }

    if (allData.length === 0) {
      throw new Error("No data found to export")
    }

    const csvData = allData.map((row) => {
      return flattenCallLogForCSV(row, basic, metadata, transcription_metrics)
    })

    const csv = Papa.unparse(csvData)
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `call_logs_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

  } catch (error) {
    console.error('Download error:', error)
    throw error
  }
}