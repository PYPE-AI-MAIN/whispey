'use client'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
import {
  EnhancedChartBuilder,
  ChartProvider,
  OverviewCustomChartCard,
  buildOverviewMergedChartSlots,
  useChartContext,
} from './EnhancedChartBuilder'
import { FloatingActionMenu } from './FloatingActionMenu'
import { useDynamicFields } from '../hooks/useDynamicFields'
import { useUser } from "@clerk/nextjs"
import CustomTotalsBuilder from './CustomTotalBuilds'
import { CustomTotalConfig, CustomTotalResult } from '../types/customTotals'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'
import Papa from 'papaparse'
import { useTheme } from 'next-themes'
import { useMobile } from '@/hooks/use-mobile'
import { Skeleton } from './ui/skeleton'
import { MetricGroupTabs } from './MetricGroupTabs'
import { MetricGroupManager } from './MetricGroupManager'
import { MetricGroupService } from '@/services/metricGroupService'
import { MetricGroup, METRIC_IDS, CHART_IDS } from '@/types/metricGroups'
import type { AgentOverviewVisibility } from '@/types/visibility'
import { canShowOrgSection } from '@/types/visibility'
import { useMemberVisibility } from '@/hooks/useMemberVisibility'

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
  /** True when the overview tab is currently visible. Defers the API fetch
   *  until the user actually opens this tab (avoids wasted requests while
   *  the component is hidden behind another tab). */
  isActive?: boolean
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

/** Maps metric card IDs → `permissions.visibility.agent.overview` keys in Supabase. */
const OVERVIEW_KEY_BY_METRIC_ID: Partial<Record<string, keyof AgentOverviewVisibility>> = {
  [METRIC_IDS.TOTAL_CALLS]: 'totalCalls',
  [METRIC_IDS.TOTAL_MINUTES]: 'totalMinutes',
  [METRIC_IDS.TOTAL_BILLING_MINUTES]: 'billing',
  [METRIC_IDS.TOTAL_COST]: 'totalCost',
  [METRIC_IDS.AVG_LATENCY]: 'responseTime',
  [METRIC_IDS.SUCCESSFUL_CALLS]: 'success',
  /** Failed Calls card — DB JSON uses `retry` */
  [METRIC_IDS.FAILED_CALLS]: 'retry',
}

/** Maps built-in chart IDs → overview keys; all charts also require `overview.charts`. */
const OVERVIEW_KEY_BY_CHART_ID: Partial<Record<string, keyof AgentOverviewVisibility>> = {
  [CHART_IDS.DAILY_CALLS]: 'totalCalls',
  [CHART_IDS.DAILY_MINUTES]: 'totalMinutes',
  [CHART_IDS.AVG_LATENCY]: 'responseTime',
  [CHART_IDS.SUCCESS_ANALYSIS]: 'success',
}

// Mobile-responsive skeleton components
function MetricsGridSkeleton({ role, isMobile }: { role: string | null; isMobile: boolean }) {
  const getVisibleCardCount = () => {
    if (role !== 'admin' && role !== 'owner') return 3
    return 6
  }

  return (
    <div className={`grid gap-3 ${isMobile ? 'grid-cols-2' : 'grid-cols-6 gap-4'}`}>
      {Array.from({ length: getVisibleCardCount() }).map((_, index) => (
        <div key={index} className="group">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm">
            <div className={isMobile ? 'p-3' : 'p-5'}>
              <div className={`flex items-start justify-between ${isMobile ? 'mb-2' : 'mb-4'}`}>
                <Skeleton className={`${isMobile ? 'w-7 h-7' : 'w-9 h-9'} rounded-lg`} />
                <Skeleton className={`${isMobile ? 'w-8 h-4' : 'w-12 h-5'}`} />
              </div>
              <div className="space-y-1">
                <Skeleton className={`${isMobile ? 'h-2 w-16' : 'h-3 w-20'}`} />
                <Skeleton className={`${isMobile ? 'h-6 w-12' : 'h-8 w-16'}`} />
                <Skeleton className={`${isMobile ? 'h-2 w-12' : 'h-3 w-16'}`} />
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
        <div
          key={index}
          className="flex flex-col gap-0 overflow-hidden rounded-xl border border-gray-200 bg-white py-0 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="flex flex-row items-center justify-between gap-3 border-b border-gray-200 px-6 py-5 dark:border-gray-800 sm:px-7 sm:py-6">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <Skeleton className={`${isMobile ? 'h-9 w-9' : 'h-9 w-9'} shrink-0 rounded-lg`} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className={isMobile ? 'h-5 w-32' : 'h-5 w-40'} />
                <Skeleton className={isMobile ? 'h-4 w-44' : 'h-4 w-56'} />
              </div>
            </div>
            <div className="hidden shrink-0 space-y-1.5 text-right sm:block">
              <Skeleton className="ml-auto h-3 w-10" />
              <Skeleton className="ml-auto h-5 w-12" />
            </div>
          </div>
          <div className="px-6 pb-7 pt-6 sm:px-7">
            <Skeleton className={`${isMobile ? 'h-48' : 'h-80'} w-full rounded-lg`} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Product order for built-in charts in the overview merge layout */
const OVERVIEW_BUILTIN_CHART_ORDER = [
  CHART_IDS.DAILY_CALLS,
  CHART_IDS.DAILY_MINUTES,
  CHART_IDS.AVG_LATENCY,
] as const

type OverviewDailyDatum = {
  date: string
  calls?: number
  minutes?: number
  avg_latency?: number
}

/** Matches `CountChartVisualization` cartesian layout (non-dialog). */
const OVERVIEW_BUILTIN_CHART_MARGIN = { top: 16, right: 36, left: 4, bottom: 28 }

const overviewBuiltinCardClassName = cn(
  'relative z-0 flex h-full min-h-0 flex-col gap-0 overflow-visible py-0 hover:z-[25]',
  'rounded-xl border border-gray-300 bg-white text-gray-900 shadow-sm transition-all duration-300',
  'hover:shadow-md hover:border-gray-400',
  'dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:border-gray-600'
)

const overviewBuiltinCardHeaderClassName =
  'flex flex-row items-center justify-between gap-3 border-b border-gray-200 px-6 py-5 dark:border-gray-700 sm:px-7 sm:py-6'

const overviewBuiltinCardContentClassName =
  'flex min-h-0 flex-1 flex-col overflow-visible px-6 pb-7 pt-6 sm:px-7'

/** Renders one built-in analytics chart card (daily calls, usage minutes, or latency). */
function OverviewBuiltinChart({
  chartId,
  isMobile,
  analytics,
  colors,
  theme,
}: {
  chartId: string
  isMobile: boolean
  analytics: { dailyData?: OverviewDailyDatum[] } | null | undefined
  colors: {
    primary: string
    success: string
    danger: string
    grid: string
    chartGridStroke: string
    text: string
    background: string
    muted: string
  }
  theme: string | undefined
}) {
  const tickFont = isMobile ? 9 : 11
  const axisTick = { fontSize: tickFont, fill: colors.text, fontWeight: 500 as const }
  const formatDayTick = (value: string | number) => {
    const date = new Date(value)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }
  const tooltipCommon = {
    allowEscapeViewBox: { x: false as const, y: true as const },
    isAnimationActive: false as const,
    wrapperStyle: { zIndex: 80 as const },
    labelStyle: { color: theme === 'dark' ? '#f3f4f6' : '#374151', fontWeight: '600' as const },
    contentStyle: {
      backgroundColor: colors.background,
      border: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
      borderRadius: '12px',
      fontSize: isMobile ? '12px' : '13px',
      fontWeight: '500' as const,
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      backdropFilter: 'blur(20px)',
      color: theme === 'dark' ? '#f3f4f6' : '#374151',
    },
  }

  if (chartId === CHART_IDS.DAILY_CALLS) {
    return (
      <Card className={overviewBuiltinCardClassName}>
        <CardHeader className={overviewBuiltinCardHeaderClassName}>
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="shrink-0 rounded-lg border border-blue-100 bg-blue-50 p-2 dark:border-blue-800 dark:bg-blue-900/20">
              <TrendUp weight="regular" className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} text-blue-600 dark:text-blue-400`} />
            </div>
            <div className="min-w-0">
              <CardTitle className="truncate text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                Daily Call Volume
              </CardTitle>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {isMobile ? 'Trend analysis' : 'Trend analysis over selected period'}
              </p>
            </div>
          </div>
          {!isMobile && (
            <div className="hidden shrink-0 items-center gap-3 sm:flex">
              <div className="text-right">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Peak</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {analytics?.dailyData && analytics.dailyData.length > 0
                    ? Math.max(...analytics.dailyData.map((d: OverviewDailyDatum) => d.calls || 0))
                    : 0}
                </div>
              </div>
              <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />
              <div className="text-right">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Avg</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {analytics?.dailyData && analytics.dailyData.length > 0
                    ? Math.round(
                        analytics.dailyData.reduce(
                          (sum: number, d: OverviewDailyDatum) => sum + (d.calls || 0),
                          0
                        ) / analytics.dailyData.length
                      )
                    : 0}
                </div>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className={overviewBuiltinCardContentClassName}>
          <div className={isMobile ? 'h-48' : 'h-80'}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics?.dailyData || []} margin={OVERVIEW_BUILTIN_CHART_MARGIN}>
                <defs>
                  <linearGradient id="callsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.primary} stopOpacity={0.14} />
                    <stop offset="95%" stopColor={colors.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={colors.chartGridStroke} strokeDasharray="4 4" vertical={false} horizontal />
                <CartesianGrid stroke={colors.chartGridStroke} strokeDasharray="0" vertical horizontal={false} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={axisTick}
                  tickFormatter={formatDayTick}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={axisTick}
                  tickFormatter={(value) => value.toLocaleString()}
                  width={48}
                />
                <Tooltip
                  {...tooltipCommon}
                  cursor={{ stroke: colors.text, strokeWidth: 1, strokeOpacity: 0.4 }}
                  labelFormatter={(value) => {
                    const date = new Date(value)
                    return date.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })
                  }}
                  formatter={(value) => [`${value}`, 'Calls']}
                />
                <Line
                  type="natural"
                  dataKey="calls"
                  stroke={colors.primary}
                  strokeWidth={isMobile ? 2 : 3}
                  fill="url(#callsGradient)"
                  dot={false}
                  isAnimationActive={false}
                  activeDot={{
                    r: isMobile ? 4 : 6,
                    fill: colors.primary,
                    strokeWidth: 2,
                    stroke: colors.background,
                    filter: 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.35))',
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (chartId === CHART_IDS.DAILY_MINUTES) {
    return (
      <Card className={overviewBuiltinCardClassName}>
        <CardHeader className={overviewBuiltinCardHeaderClassName}>
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="shrink-0 rounded-lg border border-blue-100 bg-blue-50 p-2 dark:border-blue-800 dark:bg-blue-900/20">
              <ChartBar weight="regular" className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} text-blue-600 dark:text-blue-400`} />
            </div>
            <div className="min-w-0">
              <CardTitle className="truncate text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                Usage Minutes
              </CardTitle>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {isMobile ? 'Daily duration' : 'Daily conversation duration'}
              </p>
            </div>
          </div>
          {!isMobile && (
            <div className="hidden shrink-0 items-center gap-3 sm:flex">
              <div className="text-right">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Peak</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {analytics?.dailyData && analytics.dailyData.length > 0
                    ? `${Math.max(...analytics.dailyData.map((d: OverviewDailyDatum) => d.minutes || 0))}m`
                    : '0m'}
                </div>
              </div>
              <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />
              <div className="text-right">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Avg</div>
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {analytics?.dailyData && analytics.dailyData.length > 0
                    ? `${Math.round(
                        analytics.dailyData.reduce(
                          (sum: number, d: OverviewDailyDatum) => sum + (d.minutes || 0),
                          0
                        ) / analytics.dailyData.length
                      )}m`
                    : '0m'}
                </div>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className={overviewBuiltinCardContentClassName}>
          <div className={isMobile ? 'h-48' : 'h-80'}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.dailyData || []} margin={OVERVIEW_BUILTIN_CHART_MARGIN}>
                <defs>
                  <linearGradient id="minutesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.primary} stopOpacity={0.92} />
                    <stop offset="95%" stopColor={colors.primary} stopOpacity={0.52} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={colors.chartGridStroke} strokeDasharray="4 4" vertical={false} horizontal />
                <CartesianGrid stroke={colors.chartGridStroke} strokeDasharray="0" vertical horizontal={false} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={axisTick}
                  tickFormatter={formatDayTick}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={axisTick}
                  width={48}
                  domain={[0, 'auto']}
                  tickFormatter={(value) => `${value}m`}
                />
                <Tooltip
                  {...tooltipCommon}
                  cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
                  formatter={(value) => [`${value} min`, 'Duration']}
                  labelFormatter={(value) => {
                    const date = new Date(value)
                    return date.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })
                  }}
                />
                <Bar
                  dataKey="minutes"
                  fill="url(#minutesGradient)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={56}
                  isAnimationActive={false}
                  activeBar={{ fillOpacity: 0.88 }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (chartId === CHART_IDS.AVG_LATENCY) {
    return (
      <Card className={overviewBuiltinCardClassName}>
        <CardHeader className={overviewBuiltinCardHeaderClassName}>
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="shrink-0 rounded-lg border border-orange-100 bg-orange-50 p-2 dark:border-orange-800 dark:bg-orange-900/20">
              <Activity weight="regular" className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'} text-orange-600 dark:text-orange-400`} />
            </div>
            <div className="min-w-0">
              <CardTitle className="truncate text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                Response Performance
              </CardTitle>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {isMobile ? 'Latency metrics' : 'Average latency metrics'}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className={overviewBuiltinCardContentClassName}>
          <div className={isMobile ? 'h-48' : 'h-80'}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics?.dailyData || []} margin={OVERVIEW_BUILTIN_CHART_MARGIN}>
                <defs>
                  <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff9500" stopOpacity={0.14} />
                    <stop offset="95%" stopColor="#ff9500" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={colors.chartGridStroke} strokeDasharray="4 4" vertical={false} horizontal />
                <CartesianGrid stroke={colors.chartGridStroke} strokeDasharray="0" vertical horizontal={false} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={axisTick}
                  tickFormatter={formatDayTick}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={axisTick}
                  width={48}
                  domain={[0, 'auto']}
                  tickFormatter={(value) => `${value}s`}
                />
                <Tooltip
                  {...tooltipCommon}
                  cursor={{ stroke: colors.text, strokeWidth: 1, strokeOpacity: 0.4 }}
                  formatter={(value) => [`${value}s`, 'Latency']}
                  labelFormatter={(value) => {
                    const date = new Date(value)
                    return date.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })
                  }}
                />
                <Line
                  type="natural"
                  dataKey="avg_latency"
                  stroke="#ff9500"
                  strokeWidth={isMobile ? 2 : 3}
                  fill="url(#latencyGradient)"
                  dot={false}
                  isAnimationActive={false}
                  activeDot={{
                    r: isMobile ? 4 : 6,
                    fill: '#ff9500',
                    strokeWidth: 2,
                    stroke: colors.background,
                    filter: 'drop-shadow(0 2px 4px rgba(255, 149, 0, 0.3))',
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}

function OverviewDesktopMergedCharts({
  analytics,
  colors,
  theme,
  isChartVisible,
  agentId,
  dateFrom,
  dateTo,
}: {
  analytics: React.ComponentProps<typeof OverviewBuiltinChart>['analytics']
  colors: React.ComponentProps<typeof OverviewBuiltinChart>['colors']
  theme: string | undefined
  isChartVisible: (chartId: string) => boolean
  agentId: string
  dateFrom: string
  dateTo: string
}) {
  const { charts } = useChartContext()
  const fixedVisible = useMemo(
    () => OVERVIEW_BUILTIN_CHART_ORDER.filter((id) => isChartVisible(id)),
    [isChartVisible]
  )
  const slots = useMemo(
    () => buildOverviewMergedChartSlots(fixedVisible, charts),
    [fixedVisible, charts]
  )
  return (
    <>
      {slots.map((slot) => (
        <div key={slot.key} className="flex h-full min-h-0 min-w-0 flex-col">
          {slot.kind === 'fixed' ? (
            <OverviewBuiltinChart
              chartId={slot.chartId}
              isMobile={false}
              analytics={analytics}
              colors={colors}
              theme={theme}
            />
          ) : (
            <OverviewCustomChartCard
              chart={slot.chart}
              agentId={agentId}
              dateFrom={dateFrom}
              dateTo={dateTo}
            />
          )}
        </div>
      ))}
    </>
  )
}

const Overview: React.FC<OverviewProps> = ({ 
  project, 
  agent,
  dateRange,
  isLoading: parentLoading,
  isActive = true,
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
  const [chartCreateDialogOpen, setChartCreateDialogOpen] = useState(false)

  useEffect(() => {
    setChartCreateDialogOpen(false)
  }, [agent?.id])

  const { user } = useUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress

  const { isOwnerOrAdmin, visibility } = useMemberVisibility(project?.id)

  // Data fetching
  const { data: analytics, loading: analyticsLoading, error } = useOverviewQuery({
    agentId: agent?.id,
    dateFrom: dateRange.from,
    dateTo: dateRange.to,
    enabled: isActive,
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
      const res = await fetch(`/api/custom-totals/${project.id}/${agent.id}`)
      const json = (await res.json()) as { configs?: CustomTotalConfig[] }
      if (!res.ok) {
        throw new Error((json as { error?: string }).error || res.statusText)
      }
      setCustomTotals(json.configs || [])
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
      if (customTotals.length === 0 || roleLoading || parentLoading || !agent?.id || !project?.id) {
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
        const res = await fetch(`/api/custom-totals/calculate/${project.id}/${agent.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            configIds: customTotals.map((c) => c.id),
            dateFrom: dateRange.from,
            dateTo: dateRange.to,
          }),
        })
        const json = (await res.json()) as { results?: CustomTotalResult[]; error?: string }
        if (!res.ok) {
          throw new Error(json.error || res.statusText)
        }
        setCustomTotalResults(json.results || [])
      } catch (e) {
        console.error('❌ [Overview] Batch calc failed', e)
      } finally {
        setLoadingCustomTotals(false)
      }
    }
    run()
  }, [customTotals, dateRange.from, dateRange.to, roleLoading, parentLoading, agent?.id, project?.id])

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
      const baseMetrics = Object.values(METRIC_IDS)
      const customMetricIds = customTotals.map(ct => `custom_${ct.id}`)
      return [...baseMetrics, ...customMetricIds]
    }
    const activeGroup = metricGroups.find(g => g.id === activeGroupId)
    return activeGroup?.metric_ids || []
  }, [activeGroupId, metricGroups, customTotals])

  const visibleChartIds = useMemo(() => {
    if (activeGroupId === 'all') {
      return Object.values(CHART_IDS)
    }
    const activeGroup = metricGroups.find(g => g.id === activeGroupId)
    return activeGroup?.chart_ids || []
  }, [activeGroupId, metricGroups])

  const isMetricVisible = useCallback(
    (metricId: string) => {
      if (!visibleMetricIds.includes(metricId)) return false
          const ov = visibility?.agent?.overview
          if (!ov) return false
      if (metricId.startsWith('custom_')) {
        return canShowOrgSection(visibility, 'metrics')
      }
      const key = OVERVIEW_KEY_BY_METRIC_ID[metricId]
      if (!key) return true
      return ov[key] === true
    },
    [visibleMetricIds, visibility]
  )

  const isChartVisible = useCallback(
    (chartId: string) => {
      if (!visibleChartIds.includes(chartId)) return false
       const ov = visibility?.agent?.overview
       if (!ov) return false
      if (ov.charts !== true) return false
      const key = OVERVIEW_KEY_BY_CHART_ID[chartId]
      if (!key) return true
      return ov[key] === true
    },
    [visibleChartIds, visibility]
  )

  const overviewShowsNothing = useMemo(() => {
    const noMetrics =
      visibleMetricIds.length === 0 ||
      visibleMetricIds.every((id) => !isMetricVisible(id))
    const noCharts =
      visibleChartIds.length === 0 ||
      visibleChartIds.every((id) => !isChartVisible(id))
    return noMetrics && noCharts
  }, [visibleMetricIds, visibleChartIds, isMetricVisible, isChartVisible])

  const handleDownloadCustomTotal = async (config: CustomTotalConfig) => {
    if (!agent?.id) return
    try {
      const res = await fetch(`/api/agents/${agent.id}/custom-total-export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          dateFrom: dateRange?.from,
          dateTo: dateRange?.to,
        }),
      })
      const json = (await res.json()) as { rows?: Record<string, unknown>[]; error?: string }
      if (!res.ok) {
        alert(json.error || 'Failed to fetch logs')
        return
      }
      const rows = json.rows || []
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
    } catch (e: unknown) {
      console.error(e)
      alert('Failed to download CSV')
    }
  }

  const handleSaveCustomTotal = async (config: CustomTotalConfig) => {
    if (!project?.id || !agent?.id) return
    try {
      const res = await fetch(`/api/custom-totals/${project.id}/${agent.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const json = (await res.json()) as { success?: boolean; error?: string }
      if (res.ok) {
        await loadCustomTotals()
      } else {
        alert(`Failed to save: ${json.error || res.statusText}`)
      }
    } catch (error) {
      console.error('Failed to save custom total:', error)
      alert('Failed to save custom total')
    }
  }

  const handleDeleteCustomTotal = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this custom total?')) return

    try {
      const res = await fetch(`/api/custom-totals/${configId}`, { method: 'DELETE' })
      const json = (await res.json()) as { success?: boolean; error?: string }
      if (res.ok) {
        await loadCustomTotals()
      } else {
        alert(`Failed to delete: ${json.error || res.statusText}`)
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
      /** Tailwind blue-500 — matches primary UI accents */
      primary: '#3b82f6',
      success: isDark ? '#30d158' : '#28a745',
      danger: isDark ? '#ff453a' : '#dc3545',
      grid: isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(15, 23, 42, 0.06)',
      /** Aligned with `CountChartVisualization` dashed grid */
      chartGridStroke: isDark ? 'rgba(148, 163, 184, 0.24)' : 'rgba(100, 116, 139, 0.22)',
      text: isDark ? '#94a3b8' : '#64748b',
      background: isDark ? '#1f2937' : '#ffffff',
      muted: isDark ? '#9ca3af' : '#6b7280',
    }
  }

  const colors = getChartColors()

  const successRate = (analytics?.totalCalls && analytics?.successfulCalls !== undefined && analytics.totalCalls > 0) 
    ? (analytics.successfulCalls / analytics.totalCalls) * 100 
    : 0

  if (parentLoading || roleLoading || analyticsLoading) {
    return (
      <div className="h-full bg-gray-50 dark:bg-gray-950">
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
        canManageGroups={isOwnerOrAdmin}
        showAddChart={visibility?.agent?.overview.charts === true}
        onAddChart={() => setChartCreateDialogOpen(true)}
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
          {isMetricVisible(METRIC_IDS.TOTAL_COST) && (
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
          {isMetricVisible(METRIC_IDS.AVG_LATENCY) && (
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

        {overviewShowsNothing && (
          <div className="text-center py-12 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/30">
            <p className="text-sm text-gray-500 dark:text-gray-400 px-4">
              No overview metrics or charts are visible for your account. Permissions are controlled in{' '}
              <span className="font-medium">permissions.visibility.agent.overview</span> (and org metrics for custom totals).
            </p>
          </div>
        )}

        {/* Show message when no metrics visible */}
        {activeGroupId !== 'all' && visibleMetricIds.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No metrics in this group. Click "Manage" to add metrics.
            </p>
          </div>
        )}

        {/* Charts - Filtered by active group */}
        {isMobile ? (
          <div className="grid grid-cols-1 gap-4">
            {OVERVIEW_BUILTIN_CHART_ORDER.map((chartId) =>
              isChartVisible(chartId) ? (
                <OverviewBuiltinChart
                  key={chartId}
                  chartId={chartId}
                  isMobile
                  analytics={analytics}
                  colors={colors}
                  theme={theme}
                />
              ) : null
            )}
          </div>
        ) : visibility?.agent?.overview.charts === true && agent?.id ? (
          <ChartProvider persistKey={`agent-overview-charts-${agent.id}`}>
            <div className="grid grid-cols-2 gap-6">
              <OverviewDesktopMergedCharts
                analytics={analytics}
                colors={colors}
                theme={theme}
                isChartVisible={isChartVisible}
                agentId={agent.id}
                dateFrom={dateRange.from}
                dateTo={dateRange.to}
              />
            </div>
            <EnhancedChartBuilder
              agentId={agent.id}
              dateFrom={dateRange.from}
              dateTo={dateRange.to}
              metadataFields={metadataFields}
              transcriptionFields={transcriptionFields}
              fieldsLoading={fieldsLoading}
              createDialogOpen={chartCreateDialogOpen}
              onCreateDialogOpenChange={setChartCreateDialogOpen}
              renderChartGrid={false}
            />
            {userEmail && !fieldsLoading && agent?.id && project?.id && (
              <FloatingActionMenu
                metadataFields={metadataFields}
                transcriptionFields={transcriptionFields}
                agentId={agent.id}
                projectId={project.id}
                userEmail={userEmail}
                availableColumns={
                  role !== 'admin' && role !== 'owner'
                    ? AVAILABLE_COLUMNS.filter((col) => col.key !== 'billing_duration_seconds')
                    : AVAILABLE_COLUMNS
                }
                onSaveCustomTotal={handleSaveCustomTotal}
              />
            )}
          </ChartProvider>
        ) : null}

        {/* Show message when no charts or metrics visible */}
        {activeGroupId !== 'all' && visibleChartIds.length === 0 && visibleMetricIds.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No metrics or charts in this group. Click "Manage" to add them.
            </p>
          </div>
        )}
      </div>

      {/* Metric Group Manager Modal */}
      {userEmail && project?.id && agent?.id && isOwnerOrAdmin && (
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