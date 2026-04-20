// Enhanced chart hook - COUNT with multi-line support
import React, { useState, useEffect, useMemo, useRef, createContext, useContext } from 'react'
import { postSupabaseSelect } from '@/lib/supabase-select-client'
import type { Filter } from '@/lib/supabase-query-types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  X,
  Loader2,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

export interface ChartConfig {
  id: string
  title: string
  field: string
  source: 'table' | 'metadata' | 'transcription_metrics'
  chartType: 'line' | 'bar' | 'pie'
  filterValue?: string
  color: string
  groupBy: 'day' | 'week' | 'month'
}


interface ChartDataPoint {
  date: string
  [key: string]: string | number
}

interface DatabaseRecord {
  created_at: string
  [key: string]: any
  metadata?: { [key: string]: any }
  transcription_metrics?: { [key: string]: any }
}

interface ProcessedRecord {
  created_at: string
  fieldValue: string
}

/** Same primary as Overview analytics charts */
const CUSTOM_CHART_PRIMARY = '#3b82f6'

const TABLE_CHART_FIELDS: string[] = ['call_ended_reason', 'transcript_type', 'environment']

/** Theme `default` Button uses a near-white primary in dark mode; use explicit blue for chart UI. */
const CHART_BUILDER_PRIMARY_BTN =
  'bg-blue-600 text-white shadow-sm hover:bg-blue-700 dark:bg-blue-500 dark:text-white dark:hover:bg-blue-400'

const DEFAULT_NEW_CHART: Partial<ChartConfig> = {
  chartType: 'bar',
  color: CUSTOM_CHART_PRIMARY,
  groupBy: 'day',
}

const CHART_BUILDER_STORAGE_V = 1

function chartBuilderStorageKey(persistKey: string) {
  return `whispey_chart_builder_${persistKey}`
}

function readPersistedChartBuilder(persistKey: string | undefined): {
  charts: ChartConfig[]
  newChart: Partial<ChartConfig>
} | null {
  if (typeof window === 'undefined' || !persistKey) return null
  try {
    const raw = sessionStorage.getItem(chartBuilderStorageKey(persistKey))
    if (!raw) return null
    const data = JSON.parse(raw) as { charts?: unknown; newChart?: unknown }
    const charts = Array.isArray(data.charts) ? (data.charts as ChartConfig[]) : []
    const partial =
      data.newChart && typeof data.newChart === 'object' && !Array.isArray(data.newChart)
        ? (data.newChart as Partial<ChartConfig>)
        : {}
    return {
      charts,
      newChart: { ...DEFAULT_NEW_CHART, ...partial },
    }
  } catch {
    return null
  }
}

function writePersistedChartBuilder(
  persistKey: string | undefined,
  charts: ChartConfig[],
  newChart: Partial<ChartConfig>
) {
  if (typeof window === 'undefined' || !persistKey) return
  try {
    sessionStorage.setItem(
      chartBuilderStorageKey(persistKey),
      JSON.stringify({ v: CHART_BUILDER_STORAGE_V, charts, newChart })
    )
  } catch (e) {
    console.warn('Chart builder: could not persist state', e)
  }
}

/** Chart-type tiles: theme-aware fill; border and tint change when selected. */
const CHART_TYPE_TILE_BASE =
  'flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 text-xs font-semibold transition-all duration-200 [&_svg]:shrink-0 bg-gray-100 text-gray-600 dark:bg-gray-900 dark:text-gray-300'
const CHART_TYPE_TILE_BORDER_IDLE = 'border-gray-200 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-500'
const CHART_TYPE_TILE_BORDER_ACTIVE = 'border-blue-600 bg-blue-50 text-blue-700 hover:border-blue-600 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:border-blue-500'

// Chart Context
interface ChartContextType {
  charts: ChartConfig[]
  setCharts: React.Dispatch<React.SetStateAction<ChartConfig[]>>
  newChart: Partial<ChartConfig>
  setNewChart: React.Dispatch<React.SetStateAction<Partial<ChartConfig>>>
  addChart: () => void
  removeChart: (id: string) => void
  updateChartGroupBy: (id: string, groupBy: 'day' | 'week' | 'month') => void
}

const ChartContext = createContext<ChartContextType | undefined>(undefined)

export const useChartContext = () => {
  const context = useContext(ChartContext)
  if (!context) {
    throw new Error('useChartContext must be used within a ChartProvider')
  }
  return context
}

// Chart Provider Component
interface ChartProviderProps {
  children: React.ReactNode
  /** When set, chart list + add-chart form draft survive leaving the page (sessionStorage, per agent). */
  persistKey?: string
}

export const ChartProvider: React.FC<ChartProviderProps> = ({ children, persistKey }) => {
  const [charts, setCharts] = useState<ChartConfig[]>([])
  const [newChart, setNewChart] = useState<Partial<ChartConfig>>({ ...DEFAULT_NEW_CHART })
  const persistSnapshotRef = useRef({ charts, newChart })
  persistSnapshotRef.current = { charts, newChart }

  useEffect(() => {
    if (!persistKey) {
      setCharts([])
      setNewChart({ ...DEFAULT_NEW_CHART })
      return
    }
    const loaded = readPersistedChartBuilder(persistKey)
    if (loaded) {
      setCharts(loaded.charts)
      setNewChart(loaded.newChart)
    }
  }, [persistKey])

  useEffect(() => {
    if (!persistKey) return
    const id = window.setTimeout(() => {
      const { charts: c, newChart: n } = persistSnapshotRef.current
      writePersistedChartBuilder(persistKey, c, n)
    }, 200)
    return () => window.clearTimeout(id)
  }, [charts, newChart, persistKey])

  const addChart = () => {
    if (!newChart.field || !newChart.source) return

    const chart: ChartConfig = {
      id: Date.now().toString(),
      title: newChart.title || `${newChart.field} Count${newChart.filterValue ? ` (${newChart.filterValue})` : ''}`,
      field: newChart.field,
      source: newChart.source as 'table' | 'metadata' | 'transcription_metrics',
      chartType: (newChart.chartType as 'line' | 'bar' | 'pie') || 'bar',
      filterValue: newChart.filterValue,
      color: newChart.color || CUSTOM_CHART_PRIMARY,
      groupBy: newChart.groupBy as 'day' | 'week' | 'month' || 'day'
    }

    setCharts(prev => [...prev, chart])
    setNewChart({ ...DEFAULT_NEW_CHART })
  }

  const removeChart = (id: string) => {
    setCharts(prev => prev.filter(c => c.id !== id))
  }

  const updateChartGroupBy = (id: string, groupBy: 'day' | 'week' | 'month') => {
    setCharts(prev => prev.map(chart => 
      chart.id === id ? { ...chart, groupBy } : chart
    ))
  }

  return (
    <ChartContext.Provider value={{
      charts,
      setCharts,
      newChart,
      setNewChart,
      addChart,
      removeChart,
      updateChartGroupBy
    }}>
      {children}
    </ChartContext.Provider>
  )
}


export const useCountChartData = (
  config: ChartConfig,
  agentId: string,
  dateFrom: string,
  dateTo: string
) => {
  const [data, setData] = useState<ChartDataPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uniqueValues, setUniqueValues] = useState<string[]>([])

  useEffect(() => {
    if (!config.field) return

    let cancelled = false

    const fetchChartData = async () => {
      try {
        setLoading(true)
        setError(null)

        const baseFilters: Filter[] = [
          { column: 'agent_id', operator: 'eq', value: agentId },
          { column: 'created_at', operator: 'gte', value: `${dateFrom}T00:00:00` },
          { column: 'created_at', operator: 'lte', value: `${dateTo}T23:59:59` },
        ]

        let select = 'created_at'
        let filters: Filter[] = [...baseFilters]

        if (config.filterValue) {
          if (config.source === 'table') {
            filters = [...filters, { column: config.field, operator: 'eq', value: config.filterValue }]
          } else if (config.source === 'metadata') {
            filters = [
              ...filters,
              { column: `metadata->>${config.field}`, operator: 'eq', value: config.filterValue },
            ]
          } else if (config.source === 'transcription_metrics') {
            filters = [
              ...filters,
              {
                column: `transcription_metrics->>${config.field}`,
                operator: 'eq',
                value: config.filterValue,
              },
            ]
          }
        } else {
          if (config.source === 'table') {
            select = `created_at, ${config.field}`
          } else if (config.source === 'metadata') {
            select = 'created_at, metadata'
            filters = [
              ...filters,
              { column: `metadata->${config.field}`, operator: 'not.is', value: null },
            ]
          } else if (config.source === 'transcription_metrics') {
            select = 'created_at, transcription_metrics'
            filters = [
              ...filters,
              {
                column: `transcription_metrics->${config.field}`,
                operator: 'not.is',
                value: null,
              },
            ]
          }
        }

        const records = (await postSupabaseSelect<DatabaseRecord>({
          table: 'pype_voice_call_logs',
          query: { select, filters, limit: 10000 },
          auth: { agentId },
        })) as DatabaseRecord[]

        if (cancelled) return

        if (!records || records.length === 0) {
          if (!cancelled) {
            setData([])
            setUniqueValues([])
          }
          return
        }


        if (config.filterValue) {
          // SINGLE LINE LOGIC: Just count by date
          const grouped = records.reduce((acc, record) => {
            const date = new Date(record.created_at)
            const dateKey = getDateKey(date, config.groupBy)

            if (!acc[dateKey]) {
              acc[dateKey] = 0
            }
            acc[dateKey]++
            return acc
          }, {} as { [key: string]: number })

          const chartData: ChartDataPoint[] = Object.entries(grouped)
            .map(([dateKey, count]) => ({
              date: dateKey,
              value: count
            }))
            .sort((a, b) => a.date.localeCompare(b.date))

          if (cancelled) return
          setData(chartData)
          setUniqueValues([])
        } else {
          // MULTI-LINE LOGIC: Extract field values and group by both date AND value
          const processedRecords: ProcessedRecord[] = records.map(record => {
            let fieldValue: any
            
            if (config.source === 'table') {
              fieldValue = record[config.field]
            } else if (config.source === 'metadata') {
              fieldValue = record.metadata?.[config.field]
            } else if (config.source === 'transcription_metrics') {
              fieldValue = record.transcription_metrics?.[config.field]
            }

            // Convert to string, handling booleans properly
            let fieldString: string
            if (fieldValue === null || fieldValue === undefined) {
              fieldString = 'null'
            } else if (typeof fieldValue === 'boolean') {
              fieldString = fieldValue.toString() // true -> "true", false -> "false"
            } else {
              fieldString = String(fieldValue)
            }

            return {
              created_at: record.created_at,
              fieldValue: fieldString
            }
          }).filter((record: ProcessedRecord) => record.fieldValue !== 'null') // Remove null values


          // Get unique values and their counts
          const valueCounts = processedRecords.reduce((acc, record) => {
            acc[record.fieldValue] = (acc[record.fieldValue] || 0) + 1
            return acc
          }, {} as { [key: string]: number })

          // Sort by count (descending) and take top 10
          const topValues = Object.entries(valueCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([value]) => value)

          const uniqueVals: string[] = topValues
          if (cancelled) return
          setUniqueValues(uniqueVals)

          if (uniqueVals.length === 0) {
            if (!cancelled) {
              setData([])
            }
            return
          }

          // Group by date AND field value (with "Others" for remaining values)
          const grouped = processedRecords.reduce((acc, record) => {
            const date = new Date(record.created_at)
            const dateKey = getDateKey(date, config.groupBy)
            // Group less common values as "Others"
            const fieldValue = uniqueVals.includes(record.fieldValue) ? record.fieldValue : 'Others'

            if (!acc[dateKey]) {
              acc[dateKey] = {}
            }
            if (!acc[dateKey][fieldValue]) {
              acc[dateKey][fieldValue] = 0
            }
            acc[dateKey][fieldValue]++
            return acc
          }, {} as { [date: string]: { [value: string]: number } })

          // Add "Others" to uniqueVals if there are more than 10 total unique values
          const allUniqueVals = Object.keys(valueCounts)
          const finalUniqueVals = allUniqueVals.length > 10 ? [...uniqueVals, 'Others'] : uniqueVals
          if (cancelled) return
          setUniqueValues(finalUniqueVals)


          // Convert to chart format
          const chartData: ChartDataPoint[] = Object.entries(grouped)
            .map(([dateKey, valueCounts]) => {
              const dataPoint: ChartDataPoint = { date: dateKey }
              
              // Add count for each unique value (0 if missing)
              finalUniqueVals.forEach(value => {
                dataPoint[value] = valueCounts[value] || 0
              })
              
              return dataPoint
            })
            .sort((a, b) => a.date.localeCompare(b.date))

          if (cancelled) return
          setData(chartData)
        }

      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch chart data')
          console.error('❌ Chart data fetch error:', err)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchChartData()
    return () => {
      cancelled = true
    }
  }, [config, agentId, dateFrom, dateTo])

  return { data, loading, error, uniqueValues }
}

// Helper function to get date key based on groupBy
const getDateKey = (date: Date, groupBy: 'day' | 'week' | 'month'): string => {
  switch (groupBy) {
    case 'week':
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      return weekStart.toISOString().split('T')[0]
    
    case 'month':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    
    default: // day
      return date.toISOString().split('T')[0]
  }
}

// Simplified field discovery - same as before
export const useQuickFieldDiscovery = (agentId: string, dateFrom: string, dateTo: string) => {
  const [fields, setFields] = useState<{
    metadata: string[]
    transcription_metrics: string[]
  }>({ metadata: [], transcription_metrics: [] })
  
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const discoverFields = async () => {
      try {
        setLoading(true)

        const agentRows = (await postSupabaseSelect<{ field_extractor_keys?: unknown }>({
          table: 'pype_voice_agents',
          query: {
            select: 'field_extractor_keys',
            filters: [{ column: 'id', operator: 'eq', value: agentId }],
          },
          auth: { agentId },
        })) as { field_extractor_keys?: unknown }[]
        const agentData = agentRows[0]

        const sampleRecords = (await postSupabaseSelect<{ metadata?: unknown }>({
          table: 'pype_voice_call_logs',
          query: {
            select: 'metadata',
            filters: [
              { column: 'agent_id', operator: 'eq', value: agentId },
              { column: 'created_at', operator: 'gte', value: `${dateFrom}T00:00:00` },
              { column: 'created_at', operator: 'lte', value: `${dateTo}T23:59:59` },
              { column: 'metadata', operator: 'not.is', value: null },
            ],
            limit: 20,
          },
          auth: { agentId },
        })) as { metadata?: unknown }[]

        // Extract metadata field names
        const metadataKeys = new Set<string>()
        sampleRecords?.forEach((record:any) => {
          if (record.metadata && typeof record.metadata === 'object') {
            Object.keys(record.metadata).forEach(key => {
              if (key && record.metadata[key] != null) {
                metadataKeys.add(key)
              }
            })
          }
        })

        // Never expose apikey/api_url (auth-only)
        const sensitiveKeys = ['apikey', 'api_url']
        const metadataList = Array.from(metadataKeys).filter((k) => !sensitiveKeys.includes(k))
        const fek = agentData?.field_extractor_keys
        const transcriptionList = Array.isArray(fek) ? fek : []
        setFields({
          metadata: metadataList,
          transcription_metrics: transcriptionList as string[],
        })
      } catch (error) {
        console.error('Field discovery error:', error)
      } finally {
        setLoading(false)
      }
    }

    if (true) {
      discoverFields()
    }
  }, [agentId, dateFrom, dateTo])

  return { fields, loading }
}

function buildPreviewChartConfig(newChart: Partial<ChartConfig>): ChartConfig | null {
  if (!newChart.field || !newChart.source) return null
  return {
    id: '__preview__',
    title:
      newChart.title ||
      `${newChart.field} Count${newChart.filterValue ? ` (${newChart.filterValue})` : ''}`,
    field: newChart.field,
    source: newChart.source as 'table' | 'metadata' | 'transcription_metrics',
    chartType: (newChart.chartType as 'line' | 'bar' | 'pie') || 'bar',
    filterValue: newChart.filterValue,
    color: newChart.color || CUSTOM_CHART_PRIMARY,
    groupBy: (newChart.groupBy as 'day' | 'week' | 'month') || 'day',
  }
}

const PREVIEW_CHART_W = 440
const PREVIEW_CHART_H = 228

/** Production-style palette: blue family + slate for “Others”. */
const SERIES_COLORS = [
  '#3b82f6',
  '#2563eb',
  '#60a5fa',
  '#38bdf8',
  '#0ea5e9',
  '#22d3ee',
  '#6366f1',
  '#818cf8',
  '#94a3b8',
]

function formatCartesianTooltipLabel(label: unknown): string {
  if (label == null || label === '') return '—'
  if (typeof label === 'string' && /^\d{4}-\d{2}-\d{2}/.test(label)) {
    try {
      return new Date(label).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return String(label)
    }
  }
  return String(label)
}

function formatSeriesLabel(label: unknown, maxChars = 28): string {
  const text = String(label ?? '').trim()
  if (!text) return '—'
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars - 1)}…`
}

function buildPieSlices(
  config: ChartConfig,
  data: ChartDataPoint[],
  uniqueValues: string[]
): { name: string; value: number; fill: string; pieTotal: number }[] {
  if (config.filterValue) {
    const total = data.reduce((sum, row) => sum + (Number(row.value) || 0), 0)
    if (total <= 0) return []
    return [
      {
        name: config.filterValue,
        value: total,
        fill: config.color || CUSTOM_CHART_PRIMARY,
        pieTotal: total,
      },
    ]
  }
  const rows = uniqueValues.map((name, i) => {
    const value = data.reduce((sum, row) => sum + (Number(row[name]) || 0), 0)
    const fill = name === 'Others' ? '#94a3b8' : SERIES_COLORS[i % SERIES_COLORS.length]
    return { name, value, fill }
  })
  const positive = rows.filter((r) => r.value > 0)
  const pieTotal = positive.reduce((s, r) => s + r.value, 0)
  if (pieTotal <= 0) return []
  return positive.map((r) => ({ ...r, pieTotal }))
}

const CountChartVisualization: React.FC<{
  config: ChartConfig
  agentId: string
  dateFrom: string
  dateTo: string
  chartHeightClass?: string
  /** Use fixed pixel size so Recharts renders inside dialogs/flex (100% height often measures 0). */
  fixedDimensions?: { width: number; height: number }
}> = ({ config, agentId, dateFrom, dateTo, chartHeightClass = 'h-80', fixedDimensions }) => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const tickFill = isDark ? '#94a3b8' : '#64748b'
  /** Prod: dashed horizontal + solid vertical, visible but soft */
  const gridStroke = isDark ? 'rgba(148, 163, 184, 0.24)' : 'rgba(100, 116, 139, 0.22)'
  const tooltipBg = isDark ? '#1f2937' : '#ffffff'
  const tooltipBorder = isDark ? '#374151' : '#e5e7eb'
  const tooltipLabel = isDark ? '#f3f4f6' : '#111827'
  const gradPrefix = `cc_${String(config.id).replace(/\W/g, '_')}`

  const { data, loading, error, uniqueValues } = useCountChartData(config, agentId, dateFrom, dateTo)

  const pieSlices = useMemo(
    () => (config.chartType === 'pie' ? buildPieSlices(config, data, uniqueValues) : []),
    [config, data, uniqueValues]
  )

  const boxStyle = fixedDimensions
    ? { width: fixedDimensions.width, height: fixedDimensions.height }
    : undefined

  if (loading) {
    return (
      <div
        className={cn(!fixedDimensions && chartHeightClass, 'flex items-center justify-center')}
        style={boxStyle}
      >
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={cn(!fixedDimensions && chartHeightClass, 'flex items-center justify-center px-2 text-center text-sm text-red-500')}
        style={boxStyle}
      >
        Error: {error}
      </div>
    )
  }

  const noCartesianData = !data || data.length === 0
  const noPieData = config.chartType === 'pie' && pieSlices.length === 0
  if (noCartesianData || noPieData) {
    return (
      <div
        className={cn(!fixedDimensions && chartHeightClass, 'flex items-center justify-center px-2 text-center text-sm text-muted-foreground')}
        style={boxStyle}
      >
        No data available
      </div>
    )
  }

  const sliceStroke = isDark ? '#1f2937' : '#ffffff'

  const CartesianTooltipContent = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div
        className="pointer-events-none z-[80] min-w-[200px] max-w-[min(calc(100vw-2rem),320px)] rounded-lg border p-3 shadow-lg"
        style={{
          backgroundColor: tooltipBg,
          borderColor: tooltipBorder,
          color: tooltipLabel,
        }}
      >
        <p className="mb-2 break-words font-medium">{formatCartesianTooltipLabel(label)}</p>
        {(fixedDimensions ? payload.slice(0, 6) : payload).map((entry: any, index: number) => {
          const seriesColor = entry.color ?? entry.payload?.fill
          const dataKey = entry.dataKey as string | undefined
          const seriesName = dataKey === 'value' ? config.field : (dataKey ?? entry.name ?? 'Series')
          const raw =
            entry.value ??
            (dataKey != null && entry.payload && typeof entry.payload === 'object'
              ? (entry.payload as Record<string, unknown>)[dataKey]
              : undefined)
          const num = Number(raw)
          const display = Number.isFinite(num)
            ? num.toLocaleString()
            : raw != null && raw !== ''
              ? String(raw)
              : '—'
          return (
            <div key={index} className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <span
                  className="mt-0.5 h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: seriesColor }}
                />
                <span
                  className="break-words text-left text-sm leading-snug opacity-90"
                  title={String(seriesName)}
                >
                  {formatSeriesLabel(seriesName, tooltipLabelLimit)}
                </span>
              </div>
              <span className="shrink-0 pt-0.5 text-sm font-semibold tabular-nums">{display}</span>
            </div>
          )
        })}
        {fixedDimensions && payload.length > 6 && (
          <p className="mt-2 text-xs opacity-80">+{payload.length - 6} more series</p>
        )}
      </div>
    )
  }

  const PieTooltipContent = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const item = payload[0]
    const name = item?.name ?? item?.payload?.name
    const value = Number(item?.value ?? 0)
    const fill = item?.payload?.fill
    const total = Number(item?.payload?.pieTotal ?? 0)
    const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
    return (
      <div
        className="rounded-lg border p-3 shadow-lg"
        style={{
          backgroundColor: tooltipBg,
          borderColor: tooltipBorder,
          color: tooltipLabel,
        }}
      >
        <div className="mb-1 flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: fill }} />
          <span className="min-w-0 break-words font-medium" title={String(name)}>
            {formatSeriesLabel(name, tooltipLabelLimit)}
          </span>
        </div>
        <div className="text-sm tabular-nums">
          {value.toLocaleString()}{' '}
          <span className="opacity-75">({pct}%)</span>
        </div>
      </div>
    )
  }

  const lineStroke = config.filterValue ? config.color || CUSTOM_CHART_PRIMARY : undefined
  const barPrimary = config.color || CUSTOM_CHART_PRIMARY

  /** Extra right/bottom space in the add-chart preview so the last point and tooltips are not clipped. */
  const cartesianMargin = fixedDimensions
    ? { top: 12, right: 48, left: 0, bottom: 44 }
    : { top: 16, right: 36, left: 4, bottom: 28 }
  const legendLabelLimit = fixedDimensions ? 18 : 28
  const tooltipLabelLimit = fixedDimensions ? 32 : 52

  const formatXDateTick = (value: string) => {
    if (config.groupBy === 'day') {
      const d = new Date(value)
      return `${d.getMonth() + 1}/${d.getDate()}`
    }
    if (config.groupBy === 'month') {
      const [y, m] = value.split('-')
      return m && y ? `${Number(m)}/${y.slice(2)}` : value
    }
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const chartTree =
    config.chartType === 'pie' ? (
      <PieChart margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <Pie
          data={pieSlices}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="42%"
          innerRadius={fixedDimensions ? '42%' : '46%'}
          outerRadius={fixedDimensions ? '68%' : '72%'}
          paddingAngle={1.5}
          stroke={sliceStroke}
          strokeWidth={2}
          isAnimationActive={false}
        >
          {pieSlices.map((_, i) => (
            <Cell key={`cell-${i}`} fill={pieSlices[i].fill} />
          ))}
        </Pie>
        <Tooltip
          content={<PieTooltipContent />}
          isAnimationActive={false}
          cursor={false}
          allowEscapeViewBox={{ x: false, y: true }}
          wrapperStyle={{ zIndex: 80 }}
        />
        <Legend
          verticalAlign="bottom"
          align="center"
          wrapperStyle={{ paddingTop: 8, width: '100%' }}
          formatter={(value) => (
            <span style={{ color: tickFill, fontSize: 12 }} title={String(value)}>
              {formatSeriesLabel(value, legendLabelLimit)}
            </span>
          )}
        />
      </PieChart>
    ) : config.chartType === 'line' ? (
      <LineChart data={data} margin={cartesianMargin}>
        <defs>
          {config.filterValue && lineStroke && (
            <linearGradient id={`${gradPrefix}_line`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={lineStroke} stopOpacity={0.14} />
              <stop offset="95%" stopColor={lineStroke} stopOpacity={0} />
            </linearGradient>
          )}
        </defs>
        <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" vertical={false} horizontal />
        <CartesianGrid stroke={gridStroke} strokeDasharray="0" vertical horizontal={false} />
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: tickFill, fontWeight: 500 }}
          tickFormatter={formatXDateTick}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: tickFill, fontWeight: 500 }}
          tickFormatter={(value) => value.toLocaleString()}
          width={48}
        />
        <Tooltip
          content={<CartesianTooltipContent />}
          cursor={{ stroke: tickFill, strokeWidth: 1, strokeOpacity: 0.4 }}
          isAnimationActive={false}
          shared
          allowEscapeViewBox={{ x: false, y: true }}
          wrapperStyle={{ zIndex: 80 }}
        />
        {config.filterValue ? (
          <Line
            type="natural"
            dataKey="value"
            stroke={lineStroke}
            strokeWidth={3}
            fill={lineStroke ? `url(#${gradPrefix}_line)` : undefined}
            dot={false}
            activeDot={{
              r: 6,
              fill: lineStroke,
              strokeWidth: 2,
              stroke: tooltipBg,
              filter: 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.35))',
            }}
          />
        ) : (
          uniqueValues.map((value, index) => {
            const color = value === 'Others' ? '#94a3b8' : SERIES_COLORS[index % SERIES_COLORS.length]
            return (
              <Line
                key={value}
                type="natural"
                dataKey={value}
                stroke={color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{
                  r: 5,
                  fill: color,
                  strokeWidth: 2,
                  stroke: tooltipBg,
                  filter: 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.25))',
                }}
              />
            )
          })
        )}
        {!config.filterValue && uniqueValues.length > 1 && (
          <Legend
            wrapperStyle={{ paddingTop: 16 }}
            iconType="line"
            formatter={(value) => (
              <span style={{ color: tickFill, fontSize: 12 }} title={String(value)}>
                {formatSeriesLabel(value, legendLabelLimit)}
              </span>
            )}
          />
        )}
      </LineChart>
    ) : (
      <BarChart data={data} margin={cartesianMargin}>
        <defs>
          {config.filterValue && (
            <linearGradient id={`${gradPrefix}_bar`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={barPrimary} stopOpacity={0.92} />
              <stop offset="95%" stopColor={barPrimary} stopOpacity={0.52} />
            </linearGradient>
          )}
        </defs>
        <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" vertical={false} horizontal />
        <CartesianGrid stroke={gridStroke} strokeDasharray="0" vertical horizontal={false} />
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: tickFill, fontWeight: 500 }}
          tickFormatter={formatXDateTick}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: tickFill, fontWeight: 500 }}
          tickFormatter={(value) => value.toLocaleString()}
          width={48}
        />
        <Tooltip
          content={<CartesianTooltipContent />}
          cursor={{ fill: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
          isAnimationActive={false}
          shared
          allowEscapeViewBox={{ x: false, y: true }}
          wrapperStyle={{ zIndex: 80 }}
        />
        {config.filterValue ? (
          <Bar
            dataKey="value"
            fill={`url(#${gradPrefix}_bar)`}
            radius={[4, 4, 0, 0]}
            maxBarSize={56}
            activeBar={{ fillOpacity: 0.88 }}
          />
        ) : (
          uniqueValues.map((value, index) => {
            const color = value === 'Others' ? '#94a3b8' : SERIES_COLORS[index % SERIES_COLORS.length]
            return (
              <Bar
                key={value}
                dataKey={value}
                stackId="stack"
                fill={color}
                radius={index === uniqueValues.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                activeBar={{ fillOpacity: 0.88 }}
              />
            )
          })
        )}
        {!config.filterValue && uniqueValues.length > 1 && (
          <Legend
            wrapperStyle={{ paddingTop: 16 }}
            formatter={(value) => (
              <span style={{ color: tickFill, fontSize: 12 }} title={String(value)}>
                {formatSeriesLabel(value, legendLabelLimit)}
              </span>
            )}
          />
        )}
      </BarChart>
    )

  if (fixedDimensions) {
    return (
      <div className="flex w-full justify-center overflow-visible">
        <ResponsiveContainer width={fixedDimensions.width} height={fixedDimensions.height}>
          {chartTree}
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className={cn(chartHeightClass, 'overflow-visible')}>
      <ResponsiveContainer width="100%" height="100%">
        {chartTree}
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Merges built-in overview charts with custom charts for a flat 2-column grid:
 * row1 = up to 2 fixed; row2 = 3rd fixed + 1st custom (or 2 custom if no 3rd fixed); then pairs of custom.
 */
export function buildOverviewMergedChartSlots(
  fixedVisibleInOrder: readonly string[],
  customCharts: ChartConfig[]
): Array<
  | { key: string; kind: 'fixed'; chartId: string }
  | { key: string; kind: 'custom'; chart: ChartConfig }
> {
  const F = [...fixedVisibleInOrder]
  const N = [...customCharts]
  const cells: Array<
    | { key: string; kind: 'fixed'; chartId: string }
    | { key: string; kind: 'custom'; chart: ChartConfig }
  > = []
  let fi = 0
  let ni = 0

  if (F.length === 0) {
    while (ni < N.length) {
      cells.push({ key: `c-${N[ni].id}`, kind: 'custom', chart: N[ni] })
      ni++
      if (ni < N.length) {
        cells.push({ key: `c-${N[ni].id}`, kind: 'custom', chart: N[ni] })
        ni++
      }
    }
    return cells
  }

  const row1: typeof cells = []
  if (fi < F.length) row1.push({ key: `f-${F[fi]}`, kind: 'fixed', chartId: F[fi++] })
  if (fi < F.length) row1.push({ key: `f-${F[fi]}`, kind: 'fixed', chartId: F[fi++] })
  else if (ni < N.length) row1.push({ key: `c-${N[ni].id}-r1`, kind: 'custom', chart: N[ni++] })
  if (row1.length < 2 && ni < N.length) row1.push({ key: `c-${N[ni].id}-r1b`, kind: 'custom', chart: N[ni++] })
  cells.push(...row1.slice(0, 2))

  if (fi < F.length) {
    cells.push({ key: `f-${F[fi]}`, kind: 'fixed', chartId: F[fi++] })
    if (ni < N.length) cells.push({ key: `c-${N[ni].id}-r2a`, kind: 'custom', chart: N[ni++] })
  } else {
    if (ni < N.length) cells.push({ key: `c-${N[ni].id}-r2b`, kind: 'custom', chart: N[ni++] })
    if (ni < N.length) cells.push({ key: `c-${N[ni].id}-r2c`, kind: 'custom', chart: N[ni++] })
  }

  while (ni < N.length) {
    cells.push({ key: `c-${N[ni].id}-rn`, kind: 'custom', chart: N[ni++] })
    if (ni < N.length) cells.push({ key: `c-${N[ni].id}-rn`, kind: 'custom', chart: N[ni++] })
  }

  return cells
}

/** Single custom chart card for overview merged grid (requires ChartProvider). */
export const OverviewCustomChartCard: React.FC<{
  chart: ChartConfig
  agentId: string
  dateFrom: string
  dateTo: string
}> = ({ chart, agentId, dateFrom, dateTo }) => {
  const { removeChart, updateChartGroupBy } = useChartContext()
  const TypeIcon =
    chart.chartType === 'pie'
      ? PieChartIcon
      : chart.chartType === 'bar'
        ? BarChart3
        : LineChartIcon
  return (
    <Card
      className={cn(
        'relative z-0 flex h-full min-h-0 flex-col gap-0 overflow-visible py-0 hover:z-[25]',
        'rounded-xl border border-gray-300 bg-white text-gray-900 shadow-sm transition-all duration-300',
        'hover:shadow-md hover:border-gray-400',
        'dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:border-gray-600'
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-gray-200 px-6 py-5 dark:border-gray-700 sm:px-7 sm:py-6">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="shrink-0 rounded-lg border border-blue-100 bg-blue-50 p-2 dark:border-blue-800 dark:bg-blue-900/20">
            <TypeIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <CardTitle className="truncate text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              {chart.title}
            </CardTitle>
            {chart.chartType === 'pie' ? (
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                Share of calls in selected date range
              </p>
            ) : (
              !chart.filterValue && (
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  Showing top 10 most frequent values
                </p>
              )
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {chart.chartType !== 'pie' && (
            <Select
              value={chart.groupBy}
              onValueChange={(value: 'day' | 'week' | 'month') => updateChartGroupBy(chart.id, value)}
            >
              <SelectTrigger className="h-8 w-[5.5rem] border-gray-200 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Daily</SelectItem>
                <SelectItem value="week">Weekly</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeChart(chart.id)}
            className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-visible px-6 pb-7 pt-6 sm:px-7">
        <CountChartVisualization config={chart} agentId={agentId} dateFrom={dateFrom} dateTo={dateTo} />
      </CardContent>
    </Card>
  )
}

// Enhanced Chart Builder Component
interface EnhancedChartBuilderProps {
  agentId: string
  dateFrom: string
  dateTo: string
  metadataFields: string[]
  transcriptionFields: string[]
  fieldsLoading: boolean
  /** Controlled open state for the add-chart dialog (e.g. overview tab bar). */
  createDialogOpen?: boolean
  onCreateDialogOpenChange?: (open: boolean) => void
  /** When false, chart cards are rendered by the parent (overview merged grid); only dialog/loading remain. */
  renderChartGrid?: boolean
}

const EnhancedChartBuilderContent: React.FC<EnhancedChartBuilderProps> = ({
  agentId,
  dateFrom,
  dateTo,
  metadataFields,
  transcriptionFields,
  fieldsLoading,
  createDialogOpen: createDialogOpenProp,
  onCreateDialogOpenChange,
  renderChartGrid = true,
}) => {
  const { charts, newChart, setNewChart, addChart } = useChartContext()
  const [internalDialogOpen, setInternalDialogOpen] = useState(false)
  const isDialogControlled =
    createDialogOpenProp !== undefined && onCreateDialogOpenChange !== undefined
  const createDialogOpen = isDialogControlled ? createDialogOpenProp : internalDialogOpen

  const setCreateDialogOpen = (open: boolean) => {
    if (isDialogControlled) {
      onCreateDialogOpenChange!(open)
    } else {
      setInternalDialogOpen(open)
    }
  }

  const handleCreateDialogOpenChange = (open: boolean) => {
    setCreateDialogOpen(open)
    // Fresh form whenever the dialog is opened or dismissed without persisting this draft elsewhere.
    setNewChart({ ...DEFAULT_NEW_CHART })
  }

  const fields = {
    metadata: metadataFields,
    transcription_metrics: transcriptionFields
  }

  const allowedFields = useMemo((): string[] => {
    if (!newChart.source) return []
    if (newChart.source === 'table') return TABLE_CHART_FIELDS
    if (newChart.source === 'metadata') return metadataFields
    return transcriptionFields
  }, [newChart.source, metadataFields, transcriptionFields])

  const fieldValid = Boolean(
    newChart.field && allowedFields.length > 0 && allowedFields.includes(newChart.field)
  )

  const previewReady = Boolean(newChart.source && fieldValid)

  useEffect(() => {
    if (!newChart.field || allowedFields.length === 0) return
    if (!allowedFields.includes(newChart.field)) {
      setNewChart((prev) => ({ ...prev, field: undefined }))
    }
  }, [allowedFields, newChart.field, setNewChart])

  const previewConfig = React.useMemo(() => {
    if (!previewReady) return null
    return buildPreviewChartConfig(newChart)
  }, [
    previewReady,
    newChart.field,
    newChart.source,
    newChart.chartType,
    newChart.filterValue,
    newChart.color,
    newChart.groupBy,
    newChart.title,
  ])

  const handleAddChart = () => {
    addChart()
    setCreateDialogOpen(false)
  }

  const createDialogPrevRef = useRef(false)
  useEffect(() => {
    if (!isDialogControlled) return
    if (createDialogOpenProp && !createDialogPrevRef.current) {
      setNewChart({ ...DEFAULT_NEW_CHART })
    }
    createDialogPrevRef.current = !!createDialogOpenProp
  }, [createDialogOpenProp, isDialogControlled, setNewChart])

  const sourceSubtitle =
    newChart.source === 'table'
      ? 'Table fields'
      : newChart.source === 'metadata'
        ? 'Metadata'
        : newChart.source === 'transcription_metrics'
          ? 'Transcription metrics'
          : 'Select a source'

  const chartType = newChart.chartType || 'bar'

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      {fieldsLoading ? (
        <Card
          className={cn(
            'h-full min-h-0 rounded-xl border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-800'
          )}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-center text-gray-500 dark:text-gray-400">
              <Loader2 className="mr-2 h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
              <span>Discovering available fields...</span>
            </div>
          </CardContent>
        </Card>
      ) : (
      <Dialog open={createDialogOpen} onOpenChange={handleCreateDialogOpenChange}>
        {renderChartGrid && charts.length > 0 ? (
          <div
            className={cn(
              'grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-6',
              charts.length > 1 && 'lg:grid-cols-2'
            )}
          >
            {charts.map((chart) => (
              <OverviewCustomChartCard
                key={chart.id}
                chart={chart}
                agentId={agentId}
                dateFrom={dateFrom}
                dateTo={dateTo}
              />
            ))}
          </div>
        ) : renderChartGrid && charts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center dark:border-gray-600 dark:bg-gray-800/50">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Use <span className="font-medium text-gray-700 dark:text-gray-300">Add chart</span> in the
              overview bar to create a custom chart.
            </p>
          </div>
        ) : null}

        <DialogContent
          showCloseButton
          className={cn(
            'max-h-[min(90vh,720px)] w-full max-w-[calc(100vw-2rem)] gap-0 overflow-visible rounded-xl border border-gray-300 bg-white p-0 text-gray-900 shadow-xl',
            'dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100',
            previewReady ? 'sm:max-w-4xl lg:max-w-5xl' : 'sm:max-w-xl'
          )}
        >
          <div className="flex min-h-0 max-h-[min(90vh,720px)] flex-col overflow-visible lg:flex-row">
            <div
              className={cn(
                'flex min-h-0 max-h-[min(90vh,720px)] w-full flex-col overflow-hidden border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
                previewReady && 'lg:w-[min(100%,380px)] lg:shrink-0 lg:border-r'
              )}
            >
              <div className="border-b border-gray-200 px-6 py-5 dark:border-gray-700">
                <DialogHeader className="space-y-1 text-left">
                  <DialogTitle className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                    Add a custom chart
                  </DialogTitle>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Count calls over time by field. Optional filter shows a single series; leave it empty to compare top values.
                  </p>
                </DialogHeader>
              </div>
              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Chart type
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewChart(prev => ({ ...prev, chartType: 'bar' }))}
                      className={cn(
                        CHART_TYPE_TILE_BASE,
                        chartType === 'bar' ? CHART_TYPE_TILE_BORDER_ACTIVE : CHART_TYPE_TILE_BORDER_IDLE
                      )}
                    >
                      <BarChart3 className="h-5 w-5" />
                      Bar
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewChart(prev => ({ ...prev, chartType: 'line' }))}
                      className={cn(
                        CHART_TYPE_TILE_BASE,
                        chartType === 'line' ? CHART_TYPE_TILE_BORDER_ACTIVE : CHART_TYPE_TILE_BORDER_IDLE
                      )}
                    >
                      <LineChartIcon className="h-5 w-5" />
                      Line
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewChart(prev => ({ ...prev, chartType: 'pie' }))}
                      className={cn(
                        CHART_TYPE_TILE_BASE,
                        chartType === 'pie' ? CHART_TYPE_TILE_BORDER_ACTIVE : CHART_TYPE_TILE_BORDER_IDLE
                      )}
                    >
                      <PieChartIcon className="h-5 w-5" />
                      Pie
                    </button>
                  </div>
                  {chartType === 'pie' && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Pie shows total share across the range (grouping applies to bar/line only).
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="chart-data-source" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Data source
                  </Label>
                  <Select
                    value={newChart.source as string}
                    onValueChange={(value) =>
                      setNewChart(prev => ({
                        ...prev,
                        source: value as 'table' | 'metadata' | 'transcription_metrics',
                        field: undefined,
                        filterValue: undefined,
                      }))
                    }
                  >
                    <SelectTrigger
                      id="chart-data-source"
                      className="h-11 w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-none data-[placeholder]:text-gray-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:data-[placeholder]:text-gray-400 [&_[data-slot=select-value]]:text-gray-900 dark:[&_[data-slot=select-value]]:text-gray-100"
                    >
                      <SelectValue placeholder="Select data source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="table">Table Fields ({TABLE_CHART_FIELDS.length})</SelectItem>
                      <SelectItem value="metadata">Metadata ({fields.metadata.length} fields)</SelectItem>
                      <SelectItem value="transcription_metrics">
                        Transcription ({fields.transcription_metrics.length} fields)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newChart.source && (
                  <div className="space-y-2">
                    <Label htmlFor="chart-field" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Field
                    </Label>
                    <Select
                      key={newChart.source}
                      value={fieldValid ? newChart.field : undefined}
                      onValueChange={(value) => setNewChart(prev => ({ ...prev, field: value }))}
                    >
                      <SelectTrigger
                        id="chart-field"
                        className="h-11 w-full rounded-lg border-gray-300 bg-white text-gray-900 shadow-none data-[placeholder]:text-gray-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:data-[placeholder]:text-gray-400 [&_[data-slot=select-value]]:text-gray-900 dark:[&_[data-slot=select-value]]:text-gray-100"
                      >
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {(newChart.source === 'table'
                          ? TABLE_CHART_FIELDS
                          : fields[newChart.source as keyof typeof fields]
                        ).map((field: string) => (
                          <SelectItem key={field} value={field}>
                            {field}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="chart-filter" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Filter value (optional)
                  </Label>
                  <Input
                    id="chart-filter"
                    className="h-11 rounded-lg border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-400"
                    placeholder="e.g. Yes, completed, Successful"
                    value={newChart.filterValue || ''}
                    onChange={(e) => setNewChart(prev => ({ ...prev, filterValue: e.target.value }))}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">Empty = multiple series for top values.</p>
                </div>
              </div>

              <DialogFooter className="border-t border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800 sm:justify-end">
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-lg border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-900/50"
                  >
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  className={cn('rounded-lg', CHART_BUILDER_PRIMARY_BTN)}
                  onClick={handleAddChart}
                  disabled={!previewReady}
                >
                  Add chart
                </Button>
              </DialogFooter>
            </div>

            {previewReady ? (
              <div className="flex min-h-[280px] flex-1 flex-col overflow-visible bg-gray-50 p-6 dark:bg-gray-900 lg:min-h-0">
                <div className="relative flex flex-1 flex-col overflow-visible rounded-xl">
                  <span className="absolute left-4 top-4 z-10 rounded-full border border-gray-200 bg-white/95 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 shadow-sm backdrop-blur-sm dark:border-gray-700 dark:bg-gray-800/95 dark:text-gray-400">
                    Preview
                  </span>
                  <div className="flex flex-1 flex-col justify-center overflow-visible">
                    <div className="mx-auto w-full max-w-lg overflow-visible rounded-xl border border-gray-300 bg-white p-5 pr-3 pb-6 text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 sm:pr-5">
                      <div className="mb-1">
                        <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          {`${newChart.field} counts`}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {`${sourceSubtitle} · ${dateFrom} to ${dateTo}`}
                        </p>
                      </div>
                      <div className="mt-4 min-h-[240px] overflow-visible">
                        {previewConfig ? (
                          <CountChartVisualization
                            key={`${previewConfig.field}-${previewConfig.source}-${previewConfig.chartType}-${previewConfig.groupBy}-${previewConfig.filterValue ?? ''}`}
                            config={previewConfig}
                            agentId={agentId}
                            dateFrom={dateFrom}
                            dateTo={dateTo}
                            fixedDimensions={{ width: PREVIEW_CHART_W, height: PREVIEW_CHART_H }}
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      )}
    </div>
  )
}

// Main export component (now used within ChartProvider in parent)
export const EnhancedChartBuilder: React.FC<EnhancedChartBuilderProps> = (props) => {
  return <EnhancedChartBuilderContent {...props} />
}