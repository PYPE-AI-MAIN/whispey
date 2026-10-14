'use client'
import { EmptyState } from '@/components/shared/EmptyState'
import React, { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  ChevronLeft,
  BarChart3,
  List,
  Loader2,
  AlertCircle,
  Database,
  Bot,
  Settings,
  Copy,
  Home,
  Circle,
  CalendarDays,
  Check,
  Play,
  Terminal,
  Key,
  Download,
  Menu,
  X,
} from 'lucide-react'
import AnalyticsCanvas from './analytics/AnalyticsCanvas'
import CallLogs from './calls/CallLogs'
import CallLogsV2 from './calls/v2/CallLogsV2'
import CampaignLogs from './campaigns/CampaignLogs'
import { useSupabaseQuery } from '../hooks/useSupabase'
import FieldExtractorDialog from './FieldExtractorLogs'
import { modelChange } from '@/config/fieldExtractorModels'
import MetricsDialog from './MetricsDialog'
import { AlertTriangle, Link as LinkIcon } from 'lucide-react'
import QuickStartGuide from './QuickStartGuide'
import { useMobile } from '@/hooks/use-mobile'
import { useMemberVisibility } from '@/hooks/useMemberVisibility'
import { canShowOrgSection } from '@/types/visibility'
import { useAgentById } from '@/hooks/useAgentById'
import AgentHeaderIdentity from './agents/AgentHeaderIdentity'
import { useCallLogsStore, DEFAULT_DATE_FILTER, scopeCallLogsStoreToUser } from '@/stores/callLogsStore'
import { useUser } from '@clerk/nextjs'
import { useCallLogsViewMode } from '@/hooks/useCallLogsViewMode'

interface DashboardProps {
  agentId: string
}

interface DateRange {
  from: Date | undefined
  to?: Date | undefined
}

interface VapiStatus {
  connected: boolean
  status: string
  message: string
  details?: any
}

const ENHANCED_PROJECT_ID = '371c4bbb-76db-4c61-9926-bd75726a1cda'

// Date utility functions
const subDays = (date: Date, days: number) => {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

const parseLocalDate = (s: string): Date => {
  const [y, mo, d] = s.split('-').map(Number)
  return new Date(y, mo - 1, d)  // local midnight, no UTC shift
}

const formatDateISO = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const formatShort = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

// Period control styling — shared by the desktop pill buttons and their mobile
// counterparts. When `locked` (manual filters active on the Logs tab), the button
// always renders in its plain/unselected look so it never appears chosen or
// interactive, regardless of which period is actually active underneath.
const periodPillClass = (active: boolean, locked: boolean) => {
  if (locked) return 'text-muted-foreground'
  if (active) return 'bg-card text-foreground shadow-sm'
  return 'text-muted-foreground hover:text-foreground hover:bg-white/50'
}

const periodCustomPillClass = (active: boolean, locked: boolean) => {
  if (locked) return 'text-muted-foreground'
  if (active) return 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/15'
  return 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
}

const periodMobilePillClass = (active: boolean, locked: boolean) => {
  if (!locked && active) return 'bg-blue-500 text-white'
  return 'bg-card text-foreground border border-border'
}

const PERIOD_LOCKED_MESSAGE = 'Clear the date filter to use Period'

interface PeriodOptionButtonProps {
  readonly onClick: () => void
  readonly disabled: boolean
  readonly className: string
  readonly children: React.ReactNode
}

// A Period quick-filter button. When disabled, it stays a real <button> (marked
// `aria-disabled` rather than the native `disabled` attribute) and doubles as its
// own Tooltip trigger — a native `disabled` button won't fire the hover/focus
// events a Tooltip needs, but `aria-disabled` keeps it interactive for that
// purpose while onClick still no-ops via the caller's own guard.
function PeriodOptionButton({ onClick, disabled, className, children }: PeriodOptionButtonProps) {
  if (!disabled) {
    return (
      <button onClick={onClick} className={className}>
        {children}
      </button>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-disabled="true" onClick={onClick} className={className}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{PERIOD_LOCKED_MESSAGE}</TooltipContent>
    </Tooltip>
  )
}

// Component for skeleton when agent data is loading
// Simple No Calls component for VAPI agents
function NoCallsMessage() {
  return (
    <div className="flex-1 flex items-center justify-center h-full">
      <EmptyState
        icon={Bot}
        title="No calls yet"
        description="Your VAPI agent is ready. Calls will appear here once you start receiving them."
      />
    </div>
  )
}

// Renders the legacy or the redesigned Call Logs page, per the user's saved choice.
// Both take the same props, so switching never changes what data is loaded.
function CallLogsForMode(props: React.ComponentProps<typeof CallLogs>) {
  const [viewMode] = useCallLogsViewMode()
  return viewMode === 'new' ? <CallLogsV2 {...props} /> : <CallLogs {...props} />
}

type Agent = NonNullable<ReturnType<typeof useAgentById>['data']>

const QUICK_FILTERS = [
  { id: '1d', label: '1D', days: 1 },
  { id: '7d', label: '7D', days: 7 },
  { id: '30d', label: '30D', days: 30 },
]

const isVapiAgentOf = (agent: Agent | null): boolean => {
  if (!agent) return false
  const hasVapiKeys = Boolean(agent.vapi_api_key_encrypted && agent.vapi_project_key_encrypted)
  const hasVapiConfig = Boolean(agent.configuration?.vapi?.assistantId)
  return hasVapiKeys || hasVapiConfig || agent.agent_type === 'vapi'
}

const isRetellAgentOf = (agent: Agent | null): boolean => {
  if (!agent) return false
  return agent.agent_type === 'retell' || Boolean(agent.configuration?.retell?.agentId)
}

// ── Vapi / Retell connection status ─────────────────────────────────────────

interface IntegrationConfig {
  name: string
  segment: 'vapi' | 'retell'
  checkError: string
  setupSuccess: string
  logErrors: boolean
}

const VAPI_CONFIG: IntegrationConfig = {
  name: 'VAPI',
  segment: 'vapi',
  checkError: 'Failed to check connection status',
  setupSuccess: 'Webhook configured successfully! Agent is now ready.',
  logErrors: true,
}

const RETELL_CONFIG: IntegrationConfig = {
  name: 'Retell',
  segment: 'retell',
  checkError: 'Failed to check status',
  setupSuccess: 'Retell webhook configured successfully!',
  logErrors: false,
}

function useIntegrationStatus(agentId: string | undefined, enabled: boolean, cfg: IntegrationConfig) {
  const [status, setStatus] = useState<VapiStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const check = useCallback(async () => {
    if (!enabled || !agentId) return
    setLoading(true)
    try {
      const response = await fetch(`/api/agents/${agentId}/${cfg.segment}/status`)
      setStatus(await response.json())
    } catch (error) {
      if (cfg.logErrors) console.error(`Failed to check ${cfg.name} status:`, error)
      setStatus({ connected: false, status: 'error', message: cfg.checkError })
    } finally {
      setLoading(false)
    }
  }, [enabled, agentId, cfg])

  const setup = async () => {
    if (!agentId) return
    setConnecting(true)
    try {
      const response = await fetch(`/api/agents/${agentId}/${cfg.segment}/setup-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to setup webhook')
      await check()
      alert(cfg.setupSuccess)
    } catch (error) {
      if (cfg.logErrors) console.error('Failed to setup webhook:', error)
      alert(error instanceof Error ? error.message : 'Failed to setup webhook')
    } finally {
      setConnecting(false)
    }
  }

  useEffect(() => {
    if (enabled && agentId) check()
  }, [check, enabled, agentId])

  return { status, loading, connecting, setup }
}

type IntegrationState = ReturnType<typeof useIntegrationStatus>

function IntegrationIcon({ busy, connected, className }: Readonly<{ busy: boolean; connected: boolean; className: string }>) {
  if (busy) return <Loader2 className={`${className} animate-spin`} />
  if (connected) return <Bot className={className} />
  return <LinkIcon className={className} />
}

function integrationLabel(state: IntegrationState, isMobile: boolean, name: string): string {
  if (state.loading) return 'Checking...'
  if (state.connecting) return 'Connecting...'
  if (state.status?.connected) return isMobile ? 'Settings' : 'Agent Settings'
  return isMobile ? 'Connect' : `Connect ${name}`
}

function IntegrationButton({ name, state, isMobile, onOpen }: Readonly<{ name: string; state: IntegrationState; isMobile: boolean; onOpen: () => void }>) {
  const iconClass = isMobile ? 'w-3 h-3 mr-1.5' : 'w-4 h-4 mr-2'
  const connected = Boolean(state.status?.connected)
  return (
    <div className="relative">
      <Button
        onClick={() => (connected ? onOpen() : state.setup())}
        className="ml-4"
        size={isMobile ? 'sm' : 'default'}
        variant="outline"
        disabled={state.loading || state.connecting}
      >
        <IntegrationIcon busy={state.loading || state.connecting} connected={connected} className={iconClass} />
        <span className={isMobile ? 'text-xs' : 'text-sm'}>{integrationLabel(state, isMobile, name)}</span>
      </Button>
      {!state.loading && state.status && (
        <div className="absolute -top-1 -right-1">
          <div
            className={`w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${connected ? 'bg-green-500' : 'bg-orange-500'}`}
            title={connected ? 'Webhook connected' : 'Setup required'}
          />
        </div>
      )}
    </div>
  )
}

// ── Date filter ─────────────────────────────────────────────────────────────

function useDateFilter(agentId: string, activeTab: string, onQuickPick: () => void) {
  const { dateFilterByAgent, setDateFilterForAgent, filtersByAgent } = useCallLogsStore()
  const stored = dateFilterByAgent[agentId] ?? DEFAULT_DATE_FILTER
  const quickFilter = stored.quickFilter
  const isCustomRange = stored.isCustomRange

  // Stable range: computed from the store value, not from `new Date()` on every render,
  // so downstream memos and query keys don't see a new object every tick.
  const dateRange: DateRange = React.useMemo(() => {
    if (isCustomRange && stored.dateFrom && stored.dateTo) {
      return { from: parseLocalDate(stored.dateFrom), to: parseLocalDate(stored.dateTo) }
    }
    const days = ({ '1d': 1, '7d': 7, '30d': 30 } as Record<string, number>)[quickFilter] ?? 7
    const to = new Date()
    return { from: subDays(to, days), to }
  }, [quickFilter, isCustomRange, stored.dateFrom, stored.dateTo])

  const customRangeLabel = isCustomRange && dateRange.from && dateRange.to
    ? `${formatShort(dateRange.from)} – ${formatShort(dateRange.to)}`
    : 'Custom'

  // While a manual filter on the date itself is active on the Logs tab, lock Period.
  const isPeriodLocked = activeTab === 'logs' && (filtersByAgent[agentId] ?? []).some((f) => f.type === 'filter' && f.column === 'call_started_at')

  // Day-precision strings so query keys only change when the user actually picks a new date.
  const apiDateRange = React.useMemo(() => ({
    from: formatDateISO(dateRange.from!),
    to: formatDateISO(dateRange.to!),
  }), [dateRange])

  const handleQuickFilter = (filterId: string) => {
    if (isPeriodLocked) return
    setDateFilterForAgent(agentId, { quickFilter: filterId, isCustomRange: false })
    onQuickPick()
  }

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    if (isPeriodLocked || !range?.from || !range?.to) return
    setDateFilterForAgent(agentId, {
      quickFilter: '',
      isCustomRange: true,
      dateFrom: formatDateISO(range.from),
      dateTo: formatDateISO(range.to),
    })
  }

  return { quickFilter, isCustomRange, dateRange, apiDateRange, customRangeLabel, isPeriodLocked, handleQuickFilter, handleDateRangeSelect }
}

type DateFilterState = ReturnType<typeof useDateFilter>

function DesktopPeriodControls({ df }: Readonly<{ df: DateFilterState }>) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm font-medium text-muted-foreground">Period</span>
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
        {QUICK_FILTERS.map((filter) => (
          <PeriodOptionButton
            key={filter.id}
            onClick={() => df.handleQuickFilter(filter.id)}
            disabled={df.isPeriodLocked}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 aria-disabled:opacity-50 aria-disabled:cursor-not-allowed ${periodPillClass(df.quickFilter === filter.id && !df.isCustomRange, df.isPeriodLocked)}`}
          >
            {filter.label}
          </PeriodOptionButton>
        ))}
      </div>

      {df.isPeriodLocked ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-disabled="true"
              className={`px-4 py-2 text-sm font-medium rounded-lg border-border transition-all duration-200 aria-disabled:opacity-50 aria-disabled:cursor-not-allowed ${periodCustomPillClass(df.isCustomRange, true)}`}
            >
              <CalendarDays className="mr-2 h-4 w-4 shrink-0" />
              {df.customRangeLabel}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{PERIOD_LOCKED_MESSAGE}</TooltipContent>
        </Tooltip>
      ) : (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`px-4 py-2 text-sm font-medium rounded-lg border-border transition-all duration-200 ${periodCustomPillClass(df.isCustomRange, false)}`}
            >
              <CalendarDays className="mr-2 h-4 w-4 shrink-0" />
              {df.customRangeLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 border-border shadow-xl rounded-xl" align="end">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={df.dateRange?.from}
              selected={df.dateRange}
              onSelect={df.handleDateRangeSelect}
              numberOfMonths={2}
              className="rounded-xl"
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

function MobilePeriodControls({ df }: Readonly<{ df: DateFilterState }>) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-2">Period</div>
      <div className="flex flex-wrap gap-2">
        {QUICK_FILTERS.map((filter) => (
          <PeriodOptionButton
            key={filter.id}
            onClick={() => df.handleQuickFilter(filter.id)}
            disabled={df.isPeriodLocked}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all aria-disabled:opacity-50 aria-disabled:cursor-not-allowed ${periodMobilePillClass(df.quickFilter === filter.id && !df.isCustomRange, df.isPeriodLocked)}`}
          >
            {filter.label}
          </PeriodOptionButton>
        ))}

        {df.isPeriodLocked ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-disabled="true"
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 aria-disabled:opacity-50 aria-disabled:cursor-not-allowed ${periodMobilePillClass(df.isCustomRange, true)}`}
              >
                <CalendarDays className="h-3 w-3 shrink-0" />
                {df.customRangeLabel}
              </button>
            </TooltipTrigger>
            <TooltipContent>{PERIOD_LOCKED_MESSAGE}</TooltipContent>
          </Tooltip>
        ) : (
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${periodMobilePillClass(df.isCustomRange, false)}`}
              >
                <CalendarDays className="h-3 w-3 shrink-0" />
                {df.customRangeLabel}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={df.dateRange?.from}
                selected={df.dateRange}
                onSelect={df.handleDateRangeSelect}
                numberOfMonths={1}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  )
}

// ── Field extractor and metrics dialogs ─────────────────────────────────────

async function patchAgent(agentId: string, body: Record<string, unknown>, okMessage: string, errorPrefix: string, refetch: () => void) {
  const res = await fetch(`/api/agents/${agentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = (await res.json()) as { error?: string }
  if (res.ok) {
    alert(okMessage)
    refetch()
  } else {
    alert(errorPrefix + (j.error || res.statusText))
  }
}

function parseMetrics(metrics: unknown): unknown {
  if (!metrics) return {}
  return typeof metrics === 'string' ? JSON.parse(metrics) : metrics
}

function FieldExtractorControl({ agent, refetchAgent }: Readonly<{ agent: Agent; refetchAgent: () => void }>) {
  return (
    <FieldExtractorDialog
      initialData={JSON.parse(agent?.field_extractor_prompt || '[]')}
      initialVariables={(agent as any)?.field_extractor_variables || {}}
      isEnabled={!!agent?.field_extractor}
      initialModel={agent?.field_extractor_model}
      onSave={(data, enabled, variables, model) =>
        patchAgent(
          agent.id,
          {
            field_extractor_prompt: JSON.stringify(data),
            field_extractor: enabled,
            field_extractor_variables: variables,
            ...modelChange(agent?.field_extractor_model, model),
          },
          'Saved field extractor config.',
          'Error saving config: ',
          refetchAgent,
        )
      }
    />
  )
}

function MetricsControl({ agent, refetchAgent }: Readonly<{ agent: Agent; refetchAgent: () => void }>) {
  return (
    <MetricsDialog
      initialMetrics={parseMetrics(agent?.metrics) as any}
      onSave={(metrics) => patchAgent(agent.id, { metrics }, 'Saved metrics config.', 'Error saving metrics: ', refetchAgent)}
    />
  )
}

function ConfigControls({ agent, agentLoading, canSeeFieldExtractor, canSeeMetrics, refetchAgent }: Readonly<{
  agent: Agent | null
  agentLoading: boolean
  canSeeFieldExtractor: boolean
  canSeeMetrics: boolean
  refetchAgent: () => void
}>) {
  if (agentLoading) {
    return (
      <div className="flex gap-2">
        <Skeleton className="h-9 w-32 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
    )
  }
  if (!agent || !(canSeeFieldExtractor || canSeeMetrics)) return <div className="flex gap-2" />
  return (
    <div className="flex gap-2">
      {canSeeFieldExtractor && <FieldExtractorControl agent={agent} refetchAgent={refetchAgent} />}
      {canSeeMetrics && <MetricsControl agent={agent} refetchAgent={refetchAgent} />}
    </div>
  )
}

// ── Header pieces ───────────────────────────────────────────────────────────

interface TabDef { id: string; label: string; icon: React.ComponentType<{ className?: string }> }

function HeaderTabs({ tabs, activeTab, onSelect }: Readonly<{ tabs: TabDef[]; activeTab: string; onSelect: (id: string) => void }>) {
  return (
    <div className="flex items-center gap-1 bg-muted rounded-xl p-1 ml-6">
      {tabs.map((tab) => {
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

function AgentNotFound({ error, isMobile, onBack }: Readonly<{ error: Error; isMobile: boolean; onBack: () => void }>) {
  return (
    <div className="h-screen flex flex-col bg-muted/50">
      <div className="bg-card border-b border-border shadow-sm">
        <div className={`${isMobile ? 'px-4 py-3' : 'px-8 py-3'}`}>
          <div className="flex items-center gap-4">
            <button onClick={onBack} className={`${isMobile ? 'w-8 h-8' : 'w-9 h-9'} flex items-center justify-center text-muted-foreground hover:text-muted-foreground hover:bg-muted/50 rounded-xl transition-all duration-200`}>
              <ChevronLeft className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
            </button>
            <div className={`${isMobile ? 'h-7' : 'h-8'} bg-destructive/15 text-destructive px-3 rounded-lg flex items-center`}>
              <AlertCircle className={`${isMobile ? 'w-3 h-3 mr-1.5' : 'w-4 h-4 mr-2'}`} />
              <span className={isMobile ? 'text-xs' : 'text-sm'}>Agent not found</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className={`bg-card rounded-2xl border border-border shadow-sm p-6 ${isMobile ? 'mx-4' : 'max-w-md'} text-center`}>
          <div className="w-12 h-12 bg-destructive/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <h2 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-foreground mb-2`}>Agent not found</h2>
          <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
          <Button onClick={onBack} variant="outline" className="w-full border-border">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    </div>
  )
}

function MobileMenu({ agent, mobileTabs, activeTab, onTabChange, df, canSeeFieldExtractor, refetchAgent }: Readonly<{
  agent: Agent | null
  mobileTabs: TabDef[]
  activeTab: string
  onTabChange: (id: string) => void
  df: DateFilterState
  canSeeFieldExtractor: boolean
  refetchAgent: () => void
}>) {
  return (
    <div className="border-t border-border bg-muted/50">
      <div className="px-4 py-3 space-y-3">
        {agent && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Sections</div>
            <div className="space-y-1">
              {mobileTabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                      activeTab === tab.id ? 'bg-blue-500 text-white' : 'bg-card text-foreground border border-border'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <MobilePeriodControls df={df} />

        {agent && canSeeFieldExtractor && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Tools</div>
            <FieldExtractorControl agent={agent} refetchAgent={refetchAgent} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main content ────────────────────────────────────────────────────────────

function DashboardContent({ agentId, agent, project, activeTab, isEnhancedProject, apiDateRange, loading, callsCheckLoading, openDownloadSettings, showQuickStart, showNoCallsMessage, onBack, refetchAgent }: Readonly<{
  agentId: string
  agent: Agent | null
  project: any
  activeTab: string
  isEnhancedProject: boolean
  apiDateRange: { from: string; to: string }
  loading: boolean
  callsCheckLoading: boolean
  openDownloadSettings: boolean
  showQuickStart: boolean
  showNoCallsMessage: boolean
  onBack: () => void
  refetchAgent: () => void
}>) {
  if (showQuickStart) return <QuickStartGuide agentId={agentId} />
  if (showNoCallsMessage) return <NoCallsMessage />

  return (
    <>
      {/* Keep all tabs mounted, just hide inactive ones */}
      <div className={activeTab === 'overview' ? 'block h-full' : 'hidden'}>
        <AnalyticsCanvas project={project} agent={agent} dateRange={apiDateRange} isLoading={loading} isActive={activeTab === 'overview'} />
      </div>

      <div className={activeTab === 'logs' ? 'flex flex-col h-full' : 'hidden'}>
        {agent && (
          <CallLogsForMode
            project={project}
            agent={agent}
            onBack={onBack}
            dateRange={apiDateRange}
            isLoading={loading || callsCheckLoading}
            openDownloadSettings={activeTab === 'logs' && openDownloadSettings}
            onAgentUpdated={refetchAgent}
          />
        )}
      </div>

      {isEnhancedProject && (
        <div className={activeTab === 'campaign-logs' ? 'block h-full' : 'hidden'}>
          <CampaignLogs project={project} agent={agent} onBack={onBack} isLoading={loading} />
        </div>
      )}
    </>
  )
}

function IntegrationSlot({ agentLoading, isMobile, isVapiAgent, isRetellAgent, vapi, retell, onOpen }: Readonly<{
  agentLoading: boolean
  isMobile: boolean
  isVapiAgent: boolean
  isRetellAgent: boolean
  vapi: IntegrationState
  retell: IntegrationState
  onOpen: (segment: string) => void
}>) {
  if (agentLoading) return <Skeleton className={`${isMobile ? 'h-8 w-24' : 'h-9 w-32'} rounded-lg ml-4`} />
  if (isVapiAgent) return <IntegrationButton name="VAPI" state={vapi} isMobile={isMobile} onOpen={() => onOpen('vapi')} />
  if (isRetellAgent) return <IntegrationButton name="Retell" state={retell} isMobile={isMobile} onOpen={() => onOpen('retell')} />
  return null
}

function HeaderControls({ isMobile, showMobileMenu, onToggleMenu, df, children }: Readonly<{
  isMobile: boolean
  showMobileMenu: boolean
  onToggleMenu: () => void
  df: DateFilterState
  children: React.ReactNode
}>) {
  return (
    <div className="flex items-center flex-wrap justify-end gap-4">
      {isMobile ? (
        <button
          onClick={onToggleMenu}
          className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-muted-foreground hover:bg-muted/50 rounded-xl transition-all"
        >
          {showMobileMenu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      ) : (
        <>
          <DesktopPeriodControls df={df} />
          {children}
        </>
      )}
    </div>
  )
}

const Dashboard: React.FC<DashboardProps> = ({ agentId }) => {
  // Call Logs preferences (filters, columns, view) are saved per signed-in person.
  const { user } = useUser()
  useEffect(() => { if (user?.id) scopeCallLogsStoreToUser(user.id) }, [user?.id])
  const router = useRouter()
  const searchParams = useSearchParams()
  // projectid comes from the URL path — always available, no async needed
  const routeParams = useParams()
  const routeProjectId = Array.isArray(routeParams?.projectid) ? routeParams.projectid[0] : (routeParams?.projectid as string | undefined)
  const { isMobile } = useMobile(768)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  const activeTab = searchParams.get('tab') || 'overview'
  const openDownloadSettings = searchParams.get('openDownloadSettings') === '1'
  const df = useDateFilter(agentId, activeTab, () => { if (isMobile) setShowMobileMenu(false) })

  // Fetch agent via API so viewers get role-based response (no field_extractor/metrics data)
  const { data: agentData, isLoading: agentLoading, error: agentError, refetch: refetchAgent } = useAgentById(agentId)
  const agent = agentData ?? null

  const { data: projects, isLoading: projectLoading } = useSupabaseQuery(
    'pype_voice_projects',
    {
      select: 'id, name, description, environment, created_at, is_active',
      filters: agent?.project_id
        ? [{ column: 'id', operator: 'eq', value: agent.project_id }]
        : [{ column: 'id', operator: 'eq', value: 'never-match' }],
      auth: agent?.project_id ? { projectId: agent.project_id } : undefined,
    }
  )

  const { data: callsCheck, isLoading: callsCheckLoading } = useSupabaseQuery(
    'pype_voice_call_logs',
    {
      select: 'id',
      filters: agent?.id
        ? [{ column: 'agent_id', operator: 'eq', value: agent.id }]
        : [{ column: 'agent_id', operator: 'eq', value: 'never-match' }],
      limit: 1,
      auth: agent?.id ? { agentId: agent.id } : undefined,
    }
  )

  const hasCalls = callsCheck && callsCheck.length > 0
  const isVapiAgent = React.useMemo(() => isVapiAgentOf(agent), [agent])
  const isRetellAgent = React.useMemo(() => isRetellAgentOf(agent), [agent])
  const vapi = useIntegrationStatus(agent?.id, isVapiAgent, VAPI_CONFIG)
  const retell = useIntegrationStatus(agent?.id, isRetellAgent, RETELL_CONFIG)

  const showQuickStart = false
  const showNoCallsMessage = Boolean(!callsCheckLoading && !hasCalls && !agentLoading && agent && isVapiAgent)

  const project = agent?.project_id ? projects?.[0] : null
  const { isViewer, visibility } = useMemberVisibility(project?.id)
  // Show when permissions.visibility allows (Supabase); viewers can see if DB grants it.
  const canSeeFieldExtractor = canShowOrgSection(visibility, 'fieldExtractor')
  const canSeeMetrics = canShowOrgSection(visibility, 'metrics')

  const handleBack = () => {
    router.push(agent?.project_id ? `/${agent.project_id}/agents` : '/')
  }

  const handleTabChange = (tab: string) => {
    const pid = routeProjectId ?? agent?.project_id
    if (pid) router.push(`/${pid}/agents/${agentId}?tab=${tab}`)
    if (isMobile) setShowMobileMenu(false)
  }

  const isEnhancedProject = agent?.project_id === ENHANCED_PROJECT_ID
  const extraTab: TabDef[] = isEnhancedProject ? [{ id: 'campaign-logs', label: 'Campaign Logs', icon: Database }] : []
  // Header pills show only extra tabs; the full list feeds the mobile menu.
  const mobileTabs: TabDef[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'logs', label: 'All Logs', icon: List },
    ...extraTab,
  ]

  const openIntegration = (segment: string) => router.push(`/${agent?.project_id}/agents/${agentId}/${segment}`)
  const showControls = !showQuickStart && !showNoCallsMessage

  if (agentError) return <AgentNotFound error={agentError} isMobile={isMobile} onBack={handleBack} />

  return (
    <div className="h-screen flex flex-col bg-muted/50">
      <div className="bg-card border-b border-border shadow-sm">
        <div className={`${isMobile ? 'px-4 py-3' : 'px-8 py-3'}`}>
          <div className="flex items-center justify-between flex-wrap gap-y-2">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className={`${isMobile ? 'w-8 h-8' : 'w-9 h-9'} flex items-center justify-center text-muted-foreground hover:text-muted-foreground hover:bg-muted/50 rounded-xl transition-all duration-200`}
              >
                <ChevronLeft className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
              </button>

              <div className="flex items-center gap-3">
                <AgentHeaderIdentity agentLoading={agentLoading} agent={agent} isMobile={isMobile} isViewer={isViewer} onSaved={refetchAgent} />
              </div>

              {!isMobile && agent && extraTab.length > 0 && (
                <HeaderTabs tabs={extraTab} activeTab={activeTab} onSelect={handleTabChange} />
              )}

              <IntegrationSlot
                agentLoading={agentLoading}
                isMobile={isMobile}
                isVapiAgent={isVapiAgent}
                isRetellAgent={isRetellAgent}
                vapi={vapi}
                retell={retell}
                onOpen={openIntegration}
              />
            </div>

            {showControls && (
              <HeaderControls isMobile={isMobile} showMobileMenu={showMobileMenu} onToggleMenu={() => setShowMobileMenu(!showMobileMenu)} df={df}>
                <ConfigControls
                  agent={agent}
                  agentLoading={agentLoading}
                  canSeeFieldExtractor={canSeeFieldExtractor}
                  canSeeMetrics={canSeeMetrics}
                  refetchAgent={refetchAgent}
                />
              </HeaderControls>
            )}
          </div>
        </div>

        {isMobile && showMobileMenu && showControls && (
          <MobileMenu
            agent={agent}
            mobileTabs={mobileTabs}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            df={df}
            canSeeFieldExtractor={canSeeFieldExtractor}
            refetchAgent={refetchAgent}
          />
        )}
      </div>

      <div className={`flex-1 ${activeTab === 'logs' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <DashboardContent
          agentId={agentId}
          agent={agent}
          project={project}
          activeTab={activeTab}
          isEnhancedProject={isEnhancedProject}
          apiDateRange={df.apiDateRange}
          loading={agentLoading || projectLoading}
          callsCheckLoading={callsCheckLoading}
          openDownloadSettings={openDownloadSettings}
          showQuickStart={showQuickStart}
          showNoCallsMessage={showNoCallsMessage}
          onBack={handleBack}
          refetchAgent={refetchAgent}
        />
      </div>
    </div>
  )
}

export default Dashboard
