'use client'
import React, { useEffect, useMemo, useState } from 'react'
import '../utils/verifyDistinctConfig' // Load verification utility for console debugging
import { Tooltip } from 'recharts'
import {
  Phone,
  Clock,
  CheckCircle,
  TrendUp,
  CircleNotch,
  Warning,
  CalendarBlank,
  CurrencyDollar,
  Lightning,
  XCircle,
  ChartBar,
  Activity,
  Users,
  Percent,
} from 'phosphor-react'

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { useOverviewQuery } from '../hooks/useOverviewQuery'
import { getUserProjectRole } from '@/services/getUserRole'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Loader2, MoreHorizontal, Trash2, Download } from 'lucide-react'
import { EnhancedChartBuilder, ChartProvider } from './EnhancedChartBuilder'
import { FloatingActionMenu } from './FloatingActionMenu'
import { useDynamicFields } from '../hooks/useDynamicFields'
import { useUser } from "@clerk/nextjs"
import CustomTotalsBuilder from './CustomTotalBuilds'
import { CustomTotalsService } from '@/services/customTotalService'
import { CustomTotalConfig, CustomTotalResult } from '../types/customTotals'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { supabase } from '@/lib/supabase'
import Papa from 'papaparse'
import { useTheme } from 'next-themes'
import { useMobile } from '@/hooks/use-mobile'
import { MetricGroupTabs } from './MetricGroupTabs'
import { MetricGroupManager } from './MetricGroupManager'
import { MetricGroupService } from '@/services/metricGroupService'
import { MetricGroup, METRIC_IDS, CHART_IDS } from '@/types/metricGroups'

interface OverviewProps {
  project: any
  agent: any
  dateRange: {
    from: string
    to: string
  }
  quickFilter?: string
  isCustomRange?: boolean
  isLoading?: boolean
}

const ICON_COMPONENTS = {
  phone: Phone,
  clock: Clock,
  'dollar-sign': CurrencyDollar,
  'trending-up': TrendUp,
  calculator: Activity,
  users: Users
}

const COLOR_CLASSES = {
  blue: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  green: 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400',
  purple: 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  orange: 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
  red: 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400',
  emerald: 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
}

const AVAILABLE_COLUMNS = [
  { key: 'customer_number', label: 'Customer Number', type: 'text' as const },
  { key: 'duration_seconds', label: 'Duration (seconds)', type: 'number' as const },
  { key: 'billing_duration_seconds', label: 'Billing Duration (seconds)', type: 'number' as const },
  { key: 'avg_latency', label: 'Avg Latency', type: 'number' as const },
  { key: 'call_started_at', label: 'Call Date', type: 'date' as const },
  { key: 'call_ended_reason', label: 'Call Status', type: 'text' as const },
  { key: 'total_llm_cost', label: 'LLM Cost', type: 'number' as const },
  { key: 'total_tts_cost', label: 'TTS Cost', type: 'number' as const },
  { key: 'total_stt_cost', label: 'STT Cost', type: 'number' as const },
  { key: 'metadata', label: 'Metadata', type: 'jsonb' as const },
  { key: 'transcription_metrics', label: 'Transcription Metrics', type: 'jsonb' as const }
]

// Mobile-responsive skeleton components
function MetricsGridSkeleton({ role, isMobile }: { role: string | null; isMobile: boolean }) {
  const getVisibleCardCount = () => {
    if (role === 'user') return 3
    return 6
  }

  return (
    <div className={`grid gap-3 ${isMobile ? 'grid-cols-2' : 'grid-cols-6 gap-4'}`}>
      {Array.from({ length: getVisibleCardCount() }).map((_, index) => (
        <div key={index} className="group">
          <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm">
            <div className={isMobile ? 'p-3' : 'p-5'}>
              <div className={`flex items-start justify-between ${isMobile ? 'mb-2' : 'mb-4'}`}>
                <div className={`${isMobile ? 'w-7 h-7' : 'w-9 h-9'} bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse`}></div>
                <div className={`${isMobile ? 'w-8 h-4' : 'w-12 h-5'} bg-gray-100 dark:bg-gray-700 rounded animate-pulse`}></div>
              </div>
              <div className="space-y-1">
                <div className={`${isMobile ? 'h-2 w-16' : 'h-3 w-20'} bg-gray-200 dark:bg-gray-600 animate-pulse rounded`}></div>
                <div className={`${isMobile ? 'h-6 w-12' : 'h-8 w-16'} bg-gray-200 dark:bg-gray-600 animate-pulse rounded`}></div>
                <div className={`${isMobile ? 'h-2 w-12' : 'h-3 w-16'} bg-gray-100 dark:bg-gray-700 animate-pulse rounded`}></div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ChartGridSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 gap-6'}`}>
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm">
          <div className={`border-b border-gray-200 dark:border-gray-700 ${isMobile ? 'px-4 py-4' : 'px-7 py-6'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`${isMobile ? 'w-7 h-7' : 'w-9 h-9'} bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse`}></div>
                <div>
                  <div className={`${isMobile ? 'h-4 w-24 mb-1' : 'h-5 w-32 mb-2'} bg-gray-200 dark:bg-gray-600 animate-pulse rounded`}></div>
                  <div className={`${isMobile ? 'h-3 w-32' : 'h-4 w-48'} bg-gray-100 dark:bg-gray-700 animate-pulse rounded`}></div>
                </div>
              </div>
              <div className="text-right">
                <div className={`${isMobile ? 'h-3 w-8 mb-1' : 'h-4 w-12 mb-1'} bg-gray-100 dark:bg-gray-700 animate-pulse rounded`}></div>
                <div className={`${isMobile ? 'h-4 w-6' : 'h-5 w-8'} bg-gray-200 dark:bg-gray-600 animate-pulse rounded`}></div>
              </div>
            </div>
          </div>
          <div className={isMobile ? 'p-4' : 'p-7'}>
            <div className={`${isMobile ? 'h-48' : 'h-80'} bg-gray-50 dark:bg-gray-800 rounded-lg animate-pulse flex items-center justify-center`}>
              <Loader2 className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} animate-spin text-gray-400 dark:text-gray-500`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

const Overview: React.FC<OverviewProps> = ({ 
  project, 
  agent,
  dateRange,
  isLoading: parentLoading
}) => {

  const { theme } = useTheme()
  const { isMobile } = useMobile(768)
  const [role, setRole] = useState<string | null>(null)
  const [customTotals, setCustomTotals] = useState<CustomTotalConfig[]>([])
  const [customTotalResults, setCustomTotalResults] = useState<CustomTotalResult[]>([])
  const [loadingCustomTotals, setLoadingCustomTotals] = useState(false)
  const [roleLoading, setRoleLoading] = useState(true)

  // Metric Groups State
  const [metricGroups, setMetricGroups] = useState<MetricGroup[]>([])
  const [activeGroupId, setActiveGroupId] = useState<string | 'all'>('all')
  const [showGroupManager, setShowGroupManager] = useState(false)
  const [loadingGroups, setLoadingGroups] = useState(false)

  const { user } = useUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress

  // Data fetching
  const { data: analytics, loading: analyticsLoading, error } = useOverviewQuery({
    agentId: agent?.id,
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
  })

  const { 
    metadataFields, 
    transcriptionFields, 
    loading: fieldsLoading,
    error: fieldsError 
  } = useDynamicFields(agent?.id)

  // Load user role
  useEffect(() => {
    if (userEmail && project?.id && !parentLoading) {
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
    } else if (parentLoading) {
      setRoleLoading(true)
    } else {
      setRoleLoading(false)
      setRole('user')
    }
  }, [userEmail, project?.id, parentLoading])

  // Load metric groups
  const loadMetricGroups = async () => {
    if (!project?.id || !agent?.id || !userEmail) return
    setLoadingGroups(true)
    try {
      const groups = await MetricGroupService.getMetricGroups(project.id, agent.id, userEmail)
      setMetricGroups(groups)
    } catch (error) {
      console.error('Failed to load metric groups:', error)
    } finally {
      setLoadingGroups(false)
    }
  }

  useEffect(() => {
    if (role !== null && !roleLoading && !parentLoading) {
      loadMetricGroups()
    }
  }, [role, roleLoading, parentLoading, project?.id, agent?.id, userEmail])

  const loadCustomTotals = async () => {
    if (!project?.id || !agent?.id) return
    try {
      const configs = await CustomTotalsService.getCustomTotals(project.id, agent.id)
      setCustomTotals(configs)
    } catch (error) {
      console.error('❌ [Overview] Failed to load custom totals:', error)
    }
  }

  useEffect(() => {
    if (role !== null && !roleLoading && !parentLoading) {
      loadCustomTotals()
    }
  }, [role, roleLoading, parentLoading, project?.id, agent?.id])

  useEffect(() => {
    const run = async () => {
      if (customTotals.length === 0 || roleLoading || parentLoading || !agent?.id) {
        console.log('⏸️ [Overview] Skipping calculation - conditions not met:', {
          customTotalsLength: customTotals.length,
          roleLoading,
          parentLoading,
          agentId: agent?.id
        })
        return
      }
      setLoadingCustomTotals(true)
      try {
        const results = await CustomTotalsService.batchCalculateCustomTotals(
          customTotals,
          agent.id,
          dateRange.from,
          dateRange.to
        )
        setCustomTotalResults(results)
      } catch (e) {
        console.error('❌ [Overview] Batch calc failed', e)
      } finally {
        setLoadingCustomTotals(false)
      }
    }
    run()
  }, [customTotals, dateRange.from, dateRange.to, roleLoading, parentLoading, agent?.id])

  // Metric Group Handlers
  const handleSaveMetricGroup = async (group: Omit<MetricGroup, 'id' | 'created_at' | 'updated_at'>) => {
    const result = await MetricGroupService.createMetricGroup(group)
    
    if (result.success) {
      await loadMetricGroups()
    } else {
      alert(`Failed to create group: ${result.error}`)
    }
  }

  const handleUpdateMetricGroup = async (id: string, updates: Partial<MetricGroup>) => {
    const result = await MetricGroupService.updateMetricGroup(id, updates)
    if (result.success) {
      await loadMetricGroups()
    } else {
      alert(`Failed to update group: ${result.error}`)
    }
  }

  const handleDeleteMetricGroup = async (id: string) => {
    if (!project?.id || !agent?.id || !userEmail) return
    const result = await MetricGroupService.deleteMetricGroup(id, project.id, agent.id, userEmail)
    if (result.success) {
      await loadMetricGroups()
      if (activeGroupId === id) {
        setActiveGroupId('all')
      }
    } else {
      alert(`Failed to delete group: ${result.error}`)
    }
  }

  // Filter metrics based on active group
  const visibleMetricIds = useMemo(() => {
    if (activeGroupId === 'all') {
      // Show all metrics
      const baseMetrics = Object.values(METRIC_IDS)
      const customMetricIds = customTotals.map(ct => `custom_${ct.id}`)
      return [...baseMetrics, ...customMetricIds]
    }

    const activeGroup = metricGroups.find(g => g.id === activeGroupId)
    return activeGroup?.metric_ids || []
  }, [activeGroupId, metricGroups, customTotals])

  const visibleChartIds = useMemo(() => {
      if (activeGroupId === 'all') {
        // Show all charts
        return Object.values(CHART_IDS)
      }

      const activeGroup = metricGroups.find(g => g.id === activeGroupId)
      return activeGroup?.chart_ids || []
    }, [activeGroupId, metricGroups])

    // Check if a chart should be visible
    const isChartVisible = (chartId: string) => {
      return visibleChartIds.includes(chartId)
    }

  // Check if a metric should be visible
  const isMetricVisible = (metricId: string) => {
    return visibleMetricIds.includes(metricId)
  }

  // Build filters for download (same as before)
  const buildFiltersForDownload = (
    config: CustomTotalConfig,
    agentId: string,
    dateFrom?: string,
    dateTo?: string
  ) => {
    const andFilters: { column: string; operator: string; value: any }[] = []

    andFilters.push({ column: 'agent_id', operator: 'eq', value: agentId })
    if (dateFrom) andFilters.push({ column: 'call_started_at', operator: 'gte', value: `${dateFrom} 00:00:00` })
    if (dateTo) andFilters.push({ column: 'call_started_at', operator: 'lte', value: `${dateTo} 23:59:59.999` })

    const getColumnName = (col: string, jsonField?: string, forText?: boolean) => {
      if (!jsonField) return col
      return `${col}${forText ? '->>' : '->'}${jsonField}`
    }

    if ((config.aggregation === 'COUNT' || (config.aggregation === 'COUNT_DISTINCT' && !!config.jsonField)) && config.jsonField) {
      const existsCol = getColumnName(config.column, config.jsonField, true)
      andFilters.push({ column: existsCol, operator: 'not.is', value: null })
      andFilters.push({ column: existsCol, operator: 'neq', value: '' })
    }

    const isTextOp = (op: string) => ['contains', 'json_contains', 'equals', 'json_equals', 'starts_with'].includes(op)

    const toSimpleCond = (f: CustomTotalConfig['filters'][number]) => {
      const col = getColumnName(f.column, f.jsonField, isTextOp(f.operation))
      switch (f.operation) {
        case 'equals':
        case 'json_equals':
          return { column: col, operator: 'eq', value: f.value }
        case 'contains':
        case 'json_contains':
          return { column: col, operator: 'ilike', value: `%${f.value}%` }
        case 'starts_with':
          return { column: col, operator: 'ilike', value: `${f.value}%` }
        case 'greater_than':
        case 'json_greater_than':
          return { column: col.includes('->') ? `${col}::numeric` : col, operator: 'gt', value: f.value }
        case 'less_than':
        case 'json_less_than':
          return { column: col.includes('->') ? `${col}::numeric` : col, operator: 'lt', value: f.value }
        case 'json_exists': {
          return { column: col, operator: 'json_exists', value: null }
        }
        default:
          return null
      }
    }

    const filters = (config.filters || []).map(toSimpleCond).filter(Boolean) as { column: string; operator: string; value: any }[]

    let orString: string | null = null
    if (config.filterLogic === 'OR' && filters.length > 0) {
      const parts = filters.map(f => {
        if (f.operator === 'json_exists') {
          return `and(${f.column}.not.is.null,${f.column}.neq.)`
        }
        if (f.operator === 'eq') return `${f.column}.eq.${encodeURIComponent(String(f.value))}`
        if (f.operator === 'ilike') return `${f.column}.ilike.*${encodeURIComponent(String(f.value).replace(/%/g, ''))}*`
        if (f.operator === 'gt') return `${f.column}.gt.${encodeURIComponent(String(f.value))}`
        if (f.operator === 'lt') return `${f.column}.lt.${encodeURIComponent(String(f.value))}`
        return ''
      }).filter(Boolean)
      orString = parts.join(',') || null
    } else {
      for (const f of filters) {
        if (f.operator === 'json_exists') {
          andFilters.push({ column: f.column, operator: 'not.is', value: null })
          andFilters.push({ column: f.column, operator: 'neq', value: '' })
        } else {
          andFilters.push(f)
        }
      }
    }

    return { andFilters, orString }
  }

  const handleDownloadCustomTotal = async (config: CustomTotalConfig) => {
    try {
      let query = supabase
        .from('pype_voice_call_logs')
        .select('id,agent_id,customer_number,call_id,call_ended_reason,call_started_at,call_ended_at,duration_seconds,metadata,transcription_metrics,avg_latency,created_at')
        .order('created_at', { ascending: false })
        .limit(2000)

      const { andFilters, orString } = buildFiltersForDownload(config, agent.id, dateRange?.from, dateRange?.to)
      for (const f of andFilters) {
        switch (f.operator) {
          case 'eq':
            query = query.eq(f.column, f.value)
            break
          case 'ilike':
            query = query.ilike(f.column, f.value)
            break
          case 'gte':
            query = query.gte(f.column, f.value)
            break
          case 'lte':
            query = query.lte(f.column, f.value)
            break
          case 'gt':
            query = query.gt(f.column, f.value)
            break
          case 'lt':
            query = query.lt(f.column, f.value)
            break
          case 'not.is':
            query = query.not(f.column, 'is', f.value)
            break
          case 'neq':
            query = query.neq(f.column, f.value)
            break
        }
      }
      if (orString) {
        query = query.or(orString)
      }

      const { data, error } = await query
      if (error) {
        alert(`Failed to fetch logs: ${error.message}`)
        return
      }
      
      const asObj = (v: any): Record<string, any> => {
        try {
          if (!v) return {}
          return typeof v === 'string' ? (JSON.parse(v) || {}) : v
        } catch {
          return {}
        }
      }

      const pickJsonValue = (obj: Record<string, any>, key?: string): any => {
        if (!obj || !key) return undefined
        if (key in obj) return obj[key]
        const noSpace = key.replace(/\s+/g, '')
        if (noSpace in obj) return obj[noSpace]
        const lowerFirst = key.charAt(0).toLowerCase() + key.slice(1)
        if (lowerFirst in obj) return obj[lowerFirst]
        const found = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase())
        return found ? obj[found] : undefined
      }

      const rows = (data || []).map((row: any) => {
        const tm = asObj(row.transcription_metrics)
        const md = asObj(row.metadata)
        const flattenedMd = Object.fromEntries(Object.entries(md).map(([k, v]) => [
          `metadata_${k}`, typeof v === 'object' ? JSON.stringify(v) : v
        ]))
        const flattenedTm = Object.fromEntries(Object.entries(tm).map(([k, v]) => [
          `transcription_${k}`, typeof v === 'object' ? JSON.stringify(v) : v
        ]))

        return {
          id: row.id,
          customer_number: row.customer_number,
          call_id: row.call_id,
          call_ended_reason: row.call_ended_reason,
          call_started_at: row.call_started_at,
          duration_seconds: row.duration_seconds,
          avg_latency: row.avg_latency,
          ...flattenedMd,
          ...flattenedTm,

          ...(config.jsonField && config.column === 'transcription_metrics'
            ? { [config.jsonField]: pickJsonValue(tm, config.jsonField) }
            : {}),
          ...(config.jsonField && config.column === 'metadata'
            ? { [config.jsonField]: pickJsonValue(md, config.jsonField) }
            : {}),
        }
      })

      if (!rows.length) {
        alert('No logs found for this custom total and date range.')
        return
      }

      const csv = Papa.unparse(rows)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${config.name.replace(/\s+/g, '_').toLowerCase()}_${dateRange.from}_to_${dateRange.to}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      console.error(e)
      alert('Failed to download CSV')
    }
  }

  const handleSaveCustomTotal = async (config: CustomTotalConfig) => {
    if (!project?.id || !agent?.id) return
    try {
      const result = await CustomTotalsService.saveCustomTotal(config, project.id, agent.id)
      if (result.success) {
        await loadCustomTotals()
      } else {
        alert(`Failed to save: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to save custom total:', error)
      alert('Failed to save custom total')
    }
  }

  const handleDeleteCustomTotal = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this custom total?')) return

    try {
      const result = await CustomTotalsService.deleteCustomTotal(configId)
      if (result.success) {
        await loadCustomTotals()
      } else {
        alert(`Failed to delete: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to delete custom total:', error)
      alert('Failed to delete custom total')
    }
  }

  const formatCustomTotalValue = (result: CustomTotalResult, config: CustomTotalConfig) => {
    if (result.error) return 'Error'
    
    const value = typeof result.value === 'number' ? result.value : parseFloat(result.value as string) || 0
    
    switch (config.aggregation) {
      case 'AVG':
        return value.toFixed(2)
      case 'SUM':
        if (config.column.includes('cost')) {
          return `₹${value.toFixed(2)}`
        }
        return value.toLocaleString()
      case 'COUNT':
      case 'COUNT_DISTINCT':
        return value.toLocaleString()
      default:
        return value.toString()
    }
  }

  const getChartColors = () => {
    const isDark = theme === 'dark'
    return {
      primary: '#007aff',
      success: isDark ? '#30d158' : '#28a745',
      danger: isDark ? '#ff453a' : '#dc3545',
      grid: isDark ? '#374151' : '#f3f4f6',
      text: isDark ? '#d1d5db' : '#6b7280',
      background: isDark ? '#1f2937' : '#ffffff',
      muted: isDark ? '#9ca3af' : '#6b7280'
    }
  }

  const colors = getChartColors()

  const successRate = (analytics?.totalCalls && analytics?.successfulCalls !== undefined && analytics.totalCalls > 0) 
    ? (analytics.successfulCalls / analytics.totalCalls) * 100 
    : 0

  if (parentLoading || roleLoading || analyticsLoading) {
    return (
      <div className="h-full bg-gray-50 dark:bg-gray-900">
        <div className={`space-y-6 ${isMobile ? 'p-4' : 'p-8 space-y-8'}`}>
          <MetricsGridSkeleton role={role} isMobile={isMobile} />
          <ChartGridSkeleton isMobile={isMobile} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full bg-gray-50 dark:bg-gray-900">
        <div className={isMobile ? 'p-4' : 'p-8'}>
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-6 max-w-sm">
              <div className={`${isMobile ? 'w-12 h-12' : 'w-16 h-16'} bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-800 flex items-center justify-center mx-auto shadow-sm`}>
                <Warning weight="light" className={`${isMobile ? 'w-6 h-6' : 'w-7 h-7'} text-red-400 dark:text-red-500`} />
              </div>
              <div className="space-y-2">
                <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-medium text-gray-900 dark:text-gray-100`}>Unable to Load Analytics</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="h-full bg-gray-50 dark:bg-gray-900">
        <div className={isMobile ? 'p-4' : 'p-8'}>
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-8">
              <div className={`${isMobile ? 'w-16 h-16' : 'w-20 h-20'} bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center justify-center mx-auto shadow-sm`}>
                <CalendarBlank weight="light" className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} text-gray-400 dark:text-gray-500`} />
              </div>
              <div className="space-y-2">
                <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} font-medium text-gray-900 dark:text-gray-100`}>No Data Available</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
                  No calls found for the selected time period. Try adjusting your date range or check back later.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900">
      {/* Metric Group Tabs */}
      <MetricGroupTabs
        groups={metricGroups}
        activeGroupId={activeGroupId}
        onGroupChange={setActiveGroupId}
        onManageGroups={() => setShowGroupManager(true)}
        customTotalsCount={customTotals.length}
      />

      <div className={`space-y-6 ${isMobile ? 'p-4' : 'p-8 space-y-8'}`}>
        {/* Metrics Grid - Filtered by active group */}
        <div className={`grid gap-3 ${isMobile ? 'grid-cols-2' : 'grid-cols-6 gap-4'}`}>
          {/* Total Calls */}
          {isMetricVisible(METRIC_IDS.TOTAL_CALLS) && (
            <div className="group">
              <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-gray-600 transition-all duration-300">
                <div className={isMobile ? 'p-3' : 'p-5'}>
                  <div className={`flex items-start justify-between ${isMobile ? 'mb-2' : 'mb-4'}`}>
                    <div className={`p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800`}>
                      <Phone weight="regular" className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-blue-600 dark:text-blue-400`} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className={`${isMobile ? 'text-xs' : 'text-xs'} font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider`}>Total Calls</h3>
                    <p className={`${isMobile ? 'text-lg' : 'text-2xl'} font-light text-gray-900 dark:text-gray-100 tracking-tight`}>{analytics?.totalCalls?.toLocaleString() || '0'}</p>
                    <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-400 dark:text-gray-500 font-medium`}>All time</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Total Minutes */}
          {isMetricVisible(METRIC_IDS.TOTAL_MINUTES) && (
            <div className="group">
              <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-gray-600 transition-all duration-300">
                <div className={isMobile ? 'p-3' : 'p-5'}>
                  <div className={`flex items-start justify-between ${isMobile ? 'mb-2' : 'mb-4'}`}>
                    <div className={`p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-800`}>
                      <Clock weight="regular" className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-emerald-600 dark:text-emerald-400`} />
                    </div>
                    {!isMobile && (
                      <div className="text-right">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">
                          {analytics?.totalCalls && analytics?.totalMinutes ? Math.round(analytics.totalMinutes / analytics.totalCalls) : 0}m avg
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <h3 className={`${isMobile ? 'text-xs' : 'text-xs'} font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider`}>Total Minutes</h3>
                    <p className={`${isMobile ? 'text-lg' : 'text-2xl'} font-light text-gray-900 dark:text-gray-100 tracking-tight`}>{analytics?.totalMinutes?.toLocaleString() || '0'}</p>
                    <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-400 dark:text-gray-500 font-medium`}>
                      {isMobile && analytics?.totalCalls && analytics?.totalMinutes 
                        ? `${Math.round(analytics.totalMinutes / analytics.totalCalls)}m avg`
                        : 'Duration'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Total Billing Minutes */}
          {isMetricVisible(METRIC_IDS.TOTAL_BILLING_MINUTES) && (
            <div className="group">
              <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-gray-600 transition-all duration-300">
                <div className={isMobile ? 'p-3' : 'p-5'}>
                  <div className={`flex items-start justify-between ${isMobile ? 'mb-2' : 'mb-4'}`}>
                    <div className={`p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-800`}>
                      <Clock weight="regular" className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-emerald-600 dark:text-emerald-400`} />
                    </div>
                    {!isMobile && (
                      <div className="text-right">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">
                          {analytics?.totalCalls && analytics?.totalBillingMinutes 
                            ? `${Math.round(analytics.totalBillingMinutes / analytics.totalCalls)}m avg`
                            : '0m avg'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <h3 className={`${isMobile ? 'text-xs' : 'text-xs'} font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider`}>Billing Minutes</h3>
                    <p className={`${isMobile ? 'text-lg' : 'text-2xl'} font-light text-gray-900 dark:text-gray-100 tracking-tight`}>
                      {analytics?.totalBillingMinutes ? `${Math.round(analytics.totalBillingMinutes)}m` : '0m'}
                    </p>
                    <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-400 dark:text-gray-500 font-medium`}>
                      {isMobile && analytics?.totalCalls && analytics?.totalBillingMinutes 
                        ? `${Math.round(analytics.totalBillingMinutes / analytics.totalCalls)}m avg`
                        : 'Duration'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Total Cost */}
          {isMetricVisible(METRIC_IDS.TOTAL_COST) && role !== 'user' && (
            <div className="group">
              <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-gray-600 transition-all duration-300">
                <div className={isMobile ? 'p-3' : 'p-5'}>
                  <div className={`flex items-start justify-between ${isMobile ? 'mb-2' : 'mb-4'}`}>
                    <div className={`p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800`}>
                      <CurrencyDollar weight="regular" className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-amber-600 dark:text-amber-400`} />
                    </div>
                    {!isMobile && (
                      <div className="text-right">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">INR</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <h3 className={`${isMobile ? 'text-xs' : 'text-xs'} font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider`}>Total Cost</h3>
                    <p className={`${isMobile ? 'text-lg' : 'text-2xl'} font-light text-gray-900 dark:text-gray-100 tracking-tight`}>₹{analytics?.totalCost?.toFixed(2) || '0.00'}</p>
                    <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-400 dark:text-gray-500 font-medium`}>Cumulative</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Average Latency */}
          {isMetricVisible(METRIC_IDS.AVG_LATENCY) && role !== 'user' && (
            <div className="group">
              <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-gray-600 transition-all duration-300">
                <div className={isMobile ? 'p-3' : 'p-5'}>
                  <div className={`flex items-start justify-between ${isMobile ? 'mb-2' : 'mb-4'}`}>
                    <div className={`p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800`}>
                      <Lightning weight="regular" className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-purple-600 dark:text-purple-400`} />
                    </div>
                    {!isMobile && (
                      <div className="text-right">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">avg</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <h3 className={`${isMobile ? 'text-xs' : 'text-xs'} font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider`}>Response Time</h3>
                    <p className={`${isMobile ? 'text-lg' : 'text-2xl'} font-light text-gray-900 dark:text-gray-100 tracking-tight`}>
                      {analytics?.averageLatency?.toFixed(2) || '0.00'}
                      <span className={`${isMobile ? 'text-sm ml-0.5' : 'text-lg ml-1'} text-gray-400 dark:text-gray-500`}>s</span>
                    </p>
                    <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-400 dark:text-gray-500 font-medium`}>Performance</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Successful Calls */}
          {isMetricVisible(METRIC_IDS.SUCCESSFUL_CALLS) && (
            <div className="group">
              <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-gray-600 transition-all duration-300">
                <div className={isMobile ? 'p-3' : 'p-5'}>
                  <div className={`flex items-start ${isMobile ? 'mb-2' : 'mb-4'}`}>
                    <div className={`p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800`}>
                      <CheckCircle weight="regular" className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-green-600 dark:text-green-400`} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className={`${isMobile ? 'text-xs' : 'text-xs'} font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider`}>Successful</h3>
                    <p className={`${isMobile ? 'text-lg' : 'text-2xl'} font-light text-green-600 dark:text-green-400 tracking-tight`}>{analytics?.successfulCalls?.toLocaleString() || '0'}</p>
                    <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-400 dark:text-gray-500 font-medium`}>Completed calls</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Failed Calls */}
          {isMetricVisible(METRIC_IDS.FAILED_CALLS) && (
            <div className="group">
              <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-gray-600 transition-all duration-300">
                <div className={isMobile ? 'p-3' : 'p-5'}>
                  <div className={`flex items-start ${isMobile ? 'mb-2' : 'mb-4'}`}>
                    <div className={`p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800`}>
                      <XCircle weight="regular" className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-red-600 dark:text-red-400`} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className={`${isMobile ? 'text-xs' : 'text-xs'} font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider`}>Retry</h3>
                    <p className={`${isMobile ? 'text-lg' : 'text-2xl'} font-light text-red-600 dark:text-red-400 tracking-tight`}>{analytics?.totalCalls && analytics?.successfulCalls !== undefined ? (analytics.totalCalls - analytics.successfulCalls).toLocaleString() : '0'}</p>
                    <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-400 dark:text-gray-500 font-medium`}>Incomplete calls</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Custom Totals - filtered */}
          {customTotals.map((config) => {
            if (!isMetricVisible(`custom_${config.id}`)) return null
            
            const result = customTotalResults.find(r => r.configId === config.id)
            const IconComponent = ICON_COMPONENTS[config.icon as keyof typeof ICON_COMPONENTS] || Users
            const colorClass = COLOR_CLASSES[config.color as keyof typeof COLOR_CLASSES] || COLOR_CLASSES.blue

            return (
              <div key={config.id} className="group">
                <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-gray-600 transition-all duration-300">
                  <div className={isMobile ? 'p-3' : 'p-5'}>
                    <div className={`flex items-start justify-between ${isMobile ? 'mb-2' : 'mb-4'}`}>
                      <div className={`p-2 ${colorClass.replace('bg-', 'bg-').replace('text-', 'border-')} rounded-lg border`}>
                        <IconComponent weight="regular" className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} ${colorClass.split(' ')[1]}`} />
                      </div>

                      <div className={`flex items-center gap-1 ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`${isMobile ? 'h-5 w-5' : 'h-6 w-6'} p-0 hover:bg-gray-100 dark:hover:bg-gray-700`}
                          onClick={() => handleDownloadCustomTotal(config)}
                          title="Download matching logs"
                        >
                          <Download className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'} text-gray-400 dark:text-gray-500`} />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className={`${isMobile ? 'h-5 w-5' : 'h-6 w-6'} p-0 hover:bg-gray-100 dark:hover:bg-gray-700`}
                            >
                              <MoreHorizontal className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'} text-gray-400 dark:text-gray-500`} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDeleteCustomTotal(config.id)}>
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h3 className={`${isMobile ? 'text-xs' : 'text-xs'} font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate`} title={config.name}>
                        {config.name}
                      </h3>
                      <p className={`${isMobile ? 'text-lg' : 'text-2xl'} font-light text-gray-900 dark:text-gray-100 tracking-tight`}>
                        {loadingCustomTotals || !result ? (
                          <Loader2 className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} animate-spin`} />
                        ) : (
                          formatCustomTotalValue(result, config)
                        )}
                      </p>
                      <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-400 dark:text-gray-500 font-medium`}>
                        {config.filters.length > 0 
                          ? `${config.filters.length} filter${config.filters.length > 1 ? 's' : ''}`
                          : 'No filters'
                        }
                      </p>
                      {result?.error && (
                        <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-red-500 dark:text-red-400 mt-1`}>
                          {result.error}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Show message when no metrics visible */}
        {activeGroupId !== 'all' && visibleMetricIds.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No metrics in this group. Click "Manage" to add metrics.
            </p>
          </div>
        )}

        {/* Charts - Filtered by active group */}
        <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 gap-6'}`}>
          {/* Daily Calls Chart */}
          {isChartVisible(CHART_IDS.DAILY_CALLS) && (
            <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
              <div className={`border-b border-gray-200 dark:border-gray-700 ${isMobile ? 'px-4 py-4' : 'px-7 py-6'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800`}>
                      <TrendUp weight="regular" className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-blue-600 dark:text-blue-400`} />
                    </div>
                    <div>
                      <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900 dark:text-gray-100 tracking-tight`}>Daily Call Volume</h3>
                      <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-500 dark:text-gray-400 mt-0.5`}>
                        {isMobile ? 'Trend analysis' : 'Trend analysis over selected period'}
                      </p>
                    </div>
                  </div>
                  {!isMobile && (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Peak</div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {analytics?.dailyData && analytics.dailyData.length > 0 
                            ? Math.max(...analytics.dailyData.map(d => d.calls || 0)) 
                            : 0
                          }
                        </div>
                      </div>
                      <div className="w-px h-8 bg-gray-200 dark:bg-gray-700"></div>
                      <div className="text-right">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Avg</div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {analytics?.dailyData && analytics.dailyData.length > 0 
                            ? Math.round(analytics.dailyData.reduce((sum, d) => sum + (d.calls || 0), 0) / analytics.dailyData.length) 
                            : 0
                          }
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className={isMobile ? 'p-4' : 'p-7'}>
                <div className={isMobile ? 'h-48' : 'h-80'}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics?.dailyData || []} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                      <defs>
                        <linearGradient id="callsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#007aff" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#007aff" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="1 1" stroke={colors.grid} />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: isMobile ? 9 : 11, fill: colors.text, fontWeight: 500 }}
                        height={40}
                        tickFormatter={(value) => {
                          const date = new Date(value)
                          return `${date.getMonth() + 1}/${date.getDate()}`
                        }}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: isMobile ? 9 : 11, fill: colors.text, fontWeight: 500 }}
                        width={isMobile ? 35 : 45}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: colors.background,
                          border: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
                          borderRadius: '12px',
                          fontSize: isMobile ? '12px' : '13px',
                          fontWeight: '500',
                          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                          backdropFilter: 'blur(20px)',
                          color: theme === 'dark' ? '#f3f4f6' : '#374151'
                        }}
                        labelStyle={{ color: theme === 'dark' ? '#f3f4f6' : '#374151', fontWeight: '600' }}
                        labelFormatter={(value) => {
                          const date = new Date(value)
                          return date.toLocaleDateString('en-US', { 
                            weekday: 'short',
                            month: 'short', 
                            day: 'numeric' 
                          })
                        }}
                        formatter={(value) => [`${value}`, 'Calls']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="calls" 
                        stroke={colors.primary} 
                        strokeWidth={isMobile ? 2 : 3}
                        fill="url(#callsGradient)"
                        dot={false}
                        activeDot={{ 
                          r: isMobile ? 4 : 6, 
                          fill: colors.primary, 
                          strokeWidth: 3, 
                          stroke: colors.background,
                          filter: 'drop-shadow(0 2px 4px rgba(0, 122, 255, 0.3))'
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Daily Minutes Chart */}
          {isChartVisible(CHART_IDS.DAILY_MINUTES) && (
            <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
              <div className={`border-b border-gray-200 dark:border-gray-700 ${isMobile ? 'px-4 py-4' : 'px-7 py-6'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800`}>
                      <ChartBar weight="regular" className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-blue-600 dark:text-blue-400`} />
                    </div>
                    <div>
                      <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900 dark:text-gray-100 tracking-tight`}>Usage Minutes</h3>
                      <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-500 dark:text-gray-400 mt-0.5`}>
                        {isMobile ? 'Daily duration' : 'Daily conversation duration'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className={isMobile ? 'p-4' : 'p-7'}>
                <div className={isMobile ? 'h-48' : 'h-80'}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics?.dailyData || []} margin={{ top: 20, right: 20, left: 20, bottom: 40 }}>
                      <defs>
                        <linearGradient id="minutesGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={colors.primary} stopOpacity={0.8}/>
                          <stop offset="95%" stopColor={colors.primary} stopOpacity={0.4}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="1 1" stroke={colors.grid} />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: isMobile ? 9 : 11, fill: colors.text, fontWeight: 500 }}
                        height={40}
                        tickFormatter={(value) => {
                          const date = new Date(value)
                          return `${date.getMonth() + 1}/${date.getDate()}`
                        }}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: isMobile ? 9 : 11, fill: colors.text, fontWeight: 500 }}
                        width={isMobile ? 35 : 40}
                        tickFormatter={(value) => `${value}m`}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: colors.background,
                          border: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
                          borderRadius: '12px',
                          fontSize: isMobile ? '12px' : '13px',
                          fontWeight: '500',
                          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                          backdropFilter: 'blur(20px)',
                          color: theme === 'dark' ? '#f3f4f6' : '#374151'
                        }}
                        formatter={(value) => [`${value} min`, 'Duration']}
                        labelFormatter={(value) => {
                          const date = new Date(value)
                          return date.toLocaleDateString('en-US', { 
                            weekday: 'short',
                            month: 'short', 
                            day: 'numeric' 
                          })
                        }}
                      />
                      <Bar 
                        dataKey="minutes" 
                        fill="url(#minutesGradient)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Average Latency Chart */}
          {isChartVisible(CHART_IDS.AVG_LATENCY) && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300">
              <div className={`border-b border-gray-200 dark:border-gray-700 ${isMobile ? 'px-4 py-4' : 'px-7 py-6'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-100 dark:border-orange-800`}>
                      <Activity weight="regular" className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-orange-600 dark:text-orange-400`} />
                    </div>
                    <div>
                      <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900 dark:text-gray-100 tracking-tight`}>Response Performance</h3>
                      <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-gray-500 dark:text-gray-400 mt-0.5`}>
                        {isMobile ? 'Latency metrics' : 'Average latency metrics'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className={isMobile ? 'p-4' : 'p-7'}>
                <div className={isMobile ? 'h-48' : 'h-80'}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics?.dailyData || []} margin={{ top: 20, right: 20, left: 20, bottom: 40 }}>
                      <defs>
                        <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ff9500" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#ff9500" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="1 1" stroke={colors.grid} />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: isMobile ? 9 : 11, fill: colors.text, fontWeight: 500 }}
                        height={40}
                        tickFormatter={(value) => {
                          const date = new Date(value)
                          return `${date.getMonth() + 1}/${date.getDate()}`
                        }}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: isMobile ? 9 : 11, fill: colors.text, fontWeight: 500 }}
                        width={isMobile ? 35 : 40}
                        tickFormatter={(value) => `${value}s`}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: colors.background,
                          border: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
                          borderRadius: '12px',
                          fontSize: isMobile ? '12px' : '13px',
                          fontWeight: '500',
                          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                          backdropFilter: 'blur(20px)',
                          color: theme === 'dark' ? '#f3f4f6' : '#374151'
                        }}
                        formatter={(value) => [`${value}s`, 'Latency']}
                        labelFormatter={(value) => {
                          const date = new Date(value)
                          return date.toLocaleDateString('en-US', { 
                            weekday: 'short',
                            month: 'short', 
                            day: 'numeric' 
                          })
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="avg_latency" 
                        stroke="#ff9500" 
                        strokeWidth={isMobile ? 2 : 3}
                        fill="url(#latencyGradient)"
                        dot={false}
                        activeDot={{ 
                          r: isMobile ? 4 : 6, 
                          fill: '#ff9500', 
                          strokeWidth: 3, 
                          stroke: colors.background,
                          filter: 'drop-shadow(0 2px 4px rgba(255, 149, 0, 0.3))'
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Show message when no charts or metrics visible */}
        {activeGroupId !== 'all' && visibleChartIds.length === 0 && visibleMetricIds.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No metrics or charts in this group. Click "Manage" to add them.
            </p>
          </div>
        )}

        {/* Chart Analytics Section */}
        {!isMobile && (
          <ChartProvider>
            <div className="space-y-6">
              <EnhancedChartBuilder 
                agentId={agent?.id}
                dateFrom={dateRange.from}
                dateTo={dateRange.to}
                metadataFields={metadataFields}
                transcriptionFields={transcriptionFields}
                fieldsLoading={fieldsLoading}
              />

              {userEmail && !fieldsLoading && agent?.id && project?.id && (
                <FloatingActionMenu
                  metadataFields={metadataFields}
                  transcriptionFields={transcriptionFields}
                  agentId={agent.id}
                  projectId={project.id}
                  userEmail={userEmail}
                  availableColumns={role === 'user' 
                    ? AVAILABLE_COLUMNS.filter(col => col.key !== 'billing_duration_seconds')
                    : AVAILABLE_COLUMNS
                  }
                  onSaveCustomTotal={handleSaveCustomTotal}
                />
              )}
            </div>
          </ChartProvider>
        )}
      </div>

      {/* Metric Group Manager Modal */}
      {userEmail && project?.id && agent?.id && (
        <MetricGroupManager
          open={showGroupManager}
          onOpenChange={setShowGroupManager}
          groups={metricGroups}
          customTotals={customTotals}
          projectId={project.id}
          agentId={agent.id}
          userEmail={userEmail}
          role={role}
          onSave={handleSaveMetricGroup}
          onUpdate={handleUpdateMetricGroup}
          onDelete={handleDeleteMetricGroup}
        />
      )}
    </div>
  )
}

export default Overview