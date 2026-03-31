'use client'
import React, { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
  X
} from 'lucide-react'
import Overview from './Overview'
import CallLogs from './calls/CallLogs'
import CampaignLogs from './campaigns/CampaignLogs'
import Header from '@/components/shared/Header'
import { useSupabaseQuery } from '../hooks/useSupabase'
import FieldExtractorDialog from './FieldExtractorLogs'
import MetricsDialog from './MetricsDialog'
import { AlertTriangle, Link as LinkIcon } from 'lucide-react'
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import QuickStartGuide from './QuickStartGuide'
import { useMobile } from '@/hooks/use-mobile'
import { useMemberVisibility } from '@/hooks/useMemberVisibility'
import { canShowOrgSection } from '@/types/visibility'
import { useAgentById } from '@/hooks/useAgentById'
import { useCallLogsStore, DEFAULT_DATE_FILTER } from '@/stores/callLogsStore'

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

const formatDateISO = (date: Date) => {
  return date.toISOString().split('T')[0]
}

// Component for skeleton when agent data is loading
function AgentHeaderSkeleton({ isMobile }: { isMobile: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`${isMobile ? 'h-6 w-32' : 'h-8 w-40'} bg-gray-200 dark:bg-gray-700 rounded animate-pulse`}></div>
      <div className={`${isMobile ? 'h-5 w-16' : 'h-6 w-20'} bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse`}></div>
    </div>
  )
}

// Simple No Calls component for VAPI agents
function NoCallsMessage() {
  const { isMobile } = useMobile(768)
  
  return (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="text-center">
        <div className={`${isMobile ? 'w-12 h-12' : 'w-16 h-16'} bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4`}>
          <Bot className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} text-gray-400 dark:text-gray-500`} />
        </div>
        <h3 className={`${isMobile ? 'text-base' : 'text-lg'} font-medium text-gray-900 dark:text-gray-100 mb-2`}>No calls yet</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
          Your VAPI agent is ready. Calls will appear here once you start receiving them.
        </p>
      </div>
    </div>
  )
}

const Dashboard: React.FC<DashboardProps> = ({ agentId }) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  // projectid comes from the URL path — always available, no async needed
  const routeParams = useParams()
  const routeProjectId = Array.isArray(routeParams?.projectid) ? routeParams.projectid[0] : (routeParams?.projectid as string | undefined)
  const { isMobile } = useMobile(768)

  const [vapiStatus, setVapiStatus] = useState<VapiStatus | null>(null)
  const [vapiStatusLoading, setVapiStatusLoading] = useState(false)
  const [connectingWebhook, setConnectingWebhook] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  const [retellStatus, setRetellStatus] = useState<{
    connected: boolean
    status: string
    message: string
  } | null>(null)
  const [retellStatusLoading, setRetellStatusLoading] = useState(false)
  const [connectingRetellWebhook, setConnectingRetellWebhook] = useState(false)
  
  // Date filter state — stored in Zustand (persisted) so it survives navigation.
  const { dateFilterByAgent, setDateFilterForAgent } = useCallLogsStore()
  const storedDateFilter = dateFilterByAgent[agentId] ?? DEFAULT_DATE_FILTER

  const quickFilter    = storedDateFilter.quickFilter
  const isCustomRange  = storedDateFilter.isCustomRange
  const dateRange: DateRange = isCustomRange && storedDateFilter.dateFrom && storedDateFilter.dateTo
    ? { from: new Date(storedDateFilter.dateFrom), to: new Date(storedDateFilter.dateTo) }
    : (() => {
        const days = ({ '1d': 1, '7d': 7, '30d': 30 } as Record<string, number>)[quickFilter] ?? 7
        return { from: subDays(new Date(), days), to: new Date() }
      })()

  const activeTab = searchParams.get('tab') || 'overview'
  
  const quickFilters = [
    { id: '1d', label: '1D', days: 1 },
    { id: '7d', label: '7D', days: 7 },
    { id: '30d', label: '30D', days: 30 }
  ]

  // Date range for API calls - works immediately
  const apiDateRange = React.useMemo(() => {
    if (isCustomRange && dateRange.from && dateRange.to) {
      return {
        from: formatDateISO(dateRange.from),
        to: formatDateISO(dateRange.to)
      }
    }
    
    const days = quickFilters.find(f => f.id === quickFilter)?.days || 7
    const endDate = new Date()
    const startDate = subDays(endDate, days)
    return {
      from: formatDateISO(startDate),
      to: formatDateISO(endDate)
    }
  }, [quickFilter, dateRange, isCustomRange])

  // Fetch agent via API so viewers get role-based response (no field_extractor/metrics data)
  const { data: agentData, isLoading: agentLoading, error: agentError, refetch: refetchAgent } = useAgentById(agentId)
  const agent = agentData ?? null

const { data: projects, isLoading: projectLoading, error: projectError } = useSupabaseQuery(
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


  const isVapiAgent = React.useMemo(() => {
    if (!agent) return false
    
    const hasVapiKeys = Boolean(agent.vapi_api_key_encrypted && agent.vapi_project_key_encrypted)
    const hasVapiConfig = Boolean(agent?.configuration?.vapi?.assistantId)
    const isVapiType = agent.agent_type === 'vapi'
    
    return hasVapiKeys || hasVapiConfig || isVapiType
  }, [agent])

  const showQuickStart = false
  const showNoCallsMessage = !callsCheckLoading && !hasCalls && !agentLoading && agent && isVapiAgent

  const project = agent?.project_id ? projects?.[0] : null
  const { isOwnerOrAdmin, visibility } = useMemberVisibility(project?.id)
  // Show when permissions.visibility allows (Supabase); viewers can see if DB grants it.
  const canSeeFieldExtractor = canShowOrgSection(visibility, 'fieldExtractor')
  const canSeeMetrics = canShowOrgSection(visibility, 'metrics')

  const breadcrumb = React.useMemo(() => {
    if (agentLoading || projectLoading) {
      return {
        project: 'Loading...',
        item: 'Loading...'
      }
    }
    
    if (agent && project) {
      return {
        project: project.name,
        item: agent.name
      }
    }
    
    if (agent && !agent.project_id) {
      return {
        project: 'No Project',
        item: agent.name
      }
    }
    
    if (agent && !project) {
      return {
        project: 'Unknown Project',
        item: agent.name
      }
    }
    
    return {
      project: 'Loading...',
      item: 'Loading...'
    }
  }, [agentLoading, projectLoading, agent, project])


  const isRetellAgent = React.useMemo(() => {
    if (!agent) return false
    return agent.agent_type === 'retell' || Boolean(agent.configuration?.retell?.agentId)
  }, [agent])



  // Date filter handlers — write to Zustand store (persisted across navigation)
  const handleQuickFilter = (filterId: string) => {
    setDateFilterForAgent(agentId, {
      quickFilter: filterId,
      isCustomRange: false,
    })

    if (isMobile) {
      setShowMobileMenu(false)
    }
  }

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setDateFilterForAgent(agentId, {
        quickFilter: '',
        isCustomRange: true,
        dateFrom: formatDateISO(range.from),
        dateTo: formatDateISO(range.to),
      })
    }
  }

  const handleBack = () => {
    if (agent?.project_id) {
      router.push(`/${agent.project_id}/agents`)
    } else {
      router.push('/')
    }
  }

  const handleTabChange = (tab: string) => {
    const pid = routeProjectId ?? agent?.project_id
    if (pid) {
      router.push(`/${pid}/agents/${agentId}?tab=${tab}`)
    }

    if (isMobile) {
      setShowMobileMenu(false)
    }
  }

  const getEnvironmentColor = (environment: string) => {
    switch (environment.toLowerCase()) {
      case 'production':
      case 'prod':
        return 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-100 dark:border-red-800'
      case 'staging':
      case 'stage':
        return 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border border-orange-100 dark:border-orange-800'
      case 'development':
      case 'dev':
        return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800'
      default:
        return 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-100 dark:border-gray-700'
    }
  }

  // activeTab defaults to 'overview' when the URL has no tab param (line above the tabs const).
  // No useEffect needed — tab buttons always call handleTabChange which preserves all params.

  const isEnhancedProject = agent?.project_id === ENHANCED_PROJECT_ID

  // Vapi status checking
  const checkVapiStatus = useCallback(async () => {
    if (!isVapiAgent || !agent?.id) return
    
    setVapiStatusLoading(true)
    try {
      const response = await fetch(`/api/agents/${agent.id}/vapi/status`)
      const data = await response.json()
      setVapiStatus(data)
    } catch (error) {
      console.error('Failed to check Vapi status:', error)
      setVapiStatus({
        connected: false,
        status: 'error',
        message: 'Failed to check connection status'
      })
    } finally {
      setVapiStatusLoading(false)
    }
  }, [isVapiAgent, agent?.id])

  const checkRetellStatus = useCallback(async () => {
    if (!isRetellAgent || !agent?.id) return
    setRetellStatusLoading(true)
    try {
      const response = await fetch(`/api/agents/${agent.id}/retell/status`)
      const data = await response.json()
      setRetellStatus(data)
    } catch {
      setRetellStatus({ connected: false, status: 'error', message: 'Failed to check status' })
    } finally {
      setRetellStatusLoading(false)
    }
  }, [isRetellAgent, agent?.id])
  
  const handleRetellWebhookSetup = async () => {
    if (!agent?.id) return
    setConnectingRetellWebhook(true)
    try {
      const response = await fetch(`/api/agents/${agent.id}/retell/setup-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to setup webhook')
      await checkRetellStatus()
      alert('Retell webhook configured successfully!')
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to setup webhook')
    } finally {
      setConnectingRetellWebhook(false)
    }
  }

  useEffect(() => {
    if (isRetellAgent && agent?.id) {
      checkRetellStatus()
    }
  }, [checkRetellStatus, isRetellAgent, agent?.id])

  const handleWebhookSetup = async () => {
    if (!agent?.id) return
    
    setConnectingWebhook(true)
    try {
      const response = await fetch(`/api/agents/${agent.id}/vapi/setup-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to setup webhook')
      }
      
      await checkVapiStatus()
      alert('Webhook configured successfully! Agent is now ready.')
      
    } catch (error) {
      console.error('Failed to setup webhook:', error)
      alert(error instanceof Error ? error.message : 'Failed to setup webhook')
    } finally {
      setConnectingWebhook(false)
    }
  }

  useEffect(() => {
    if (isVapiAgent && agent?.id) {
      checkVapiStatus()
    }
  }, [checkVapiStatus, isVapiAgent, agent?.id])

  // All tabs — overview and logs are always present; campaign-logs only for enhanced projects
  // Desktop header pills — only extra tabs like Campaign Logs (Overview/Logs nav is in the sub-tab bar)
  const tabs = [
    ...(isEnhancedProject ? [{ id: 'campaign-logs', label: 'Campaign Logs', icon: Database }] : []),
  ]

  // Full tab list used in the desktop sub-tab bar and the mobile menu
  const mobileTabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'logs',     label: 'All Logs', icon: List },
    ...(isEnhancedProject ? [{ id: 'campaign-logs', label: 'Campaign Logs', icon: Database }] : []),
  ]

  // Handle errors without blocking entire dashboard
  if (agentError) {
    return (
      <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className={`${isMobile ? 'px-4 py-3' : 'px-8 py-3'}`}>
            <div className="flex items-center gap-4">
              <button onClick={handleBack} className={`${isMobile ? 'w-8 h-8' : 'w-9 h-9'} flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all duration-200`}>
                <ChevronLeft className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
              </button>
              <div className={`${isMobile ? 'h-7' : 'h-8'} bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 rounded-lg flex items-center`}>
                <AlertCircle className={`${isMobile ? 'w-3 h-3 mr-1.5' : 'w-4 h-4 mr-2'}`} />
                <span className={isMobile ? 'text-xs' : 'text-sm'}>Agent not found</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className={`bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 ${isMobile ? 'mx-4' : 'max-w-md'} text-center`}>
            <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-red-500 dark:text-red-400" />
            </div>
            <h2 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900 dark:text-gray-100 mb-2`}>Agent not found</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{agentError.message}</p>
            <Button onClick={handleBack} variant="outline" className="w-full border-gray-200 dark:border-gray-700">
              <ChevronLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header - Mobile optimized */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className={`${isMobile ? 'px-4 py-3' : 'px-8 py-3'}`}>
          <div className="flex items-center justify-between">
            {/* Left: Navigation & Identity */}
            <div className="flex items-center gap-4">
              <button 
                onClick={handleBack}
                className={`${isMobile ? 'w-8 h-8' : 'w-9 h-9'} flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all duration-200`}
              >
                <ChevronLeft className={`${isMobile ? 'h-4 w-4' : 'h-5 w-5'}`} />
              </button>
              
              <div className="flex items-center gap-3">
                {/* Agent name and badge - skeleton while loading */}
                {agentLoading ? (
                  <AgentHeaderSkeleton isMobile={isMobile} />
                ) : agent ? (
                  <>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <h1 className={`${isMobile ? 'text-lg max-w-[180px]' : 'text-2xl max-w-[250px]'} font-semibold text-gray-900 dark:text-gray-100 tracking-tight truncate cursor-default`}>
                            {agent.name}
                          </h1>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{agent.name}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <div className="flex items-center gap-2">
                      <Badge className={`${isMobile ? 'text-xs px-2 py-0.5' : 'text-xs px-3 py-1'} font-medium rounded-full ${getEnvironmentColor(agent.environment)}`}>
                        {agent.environment}
                      </Badge>
                    </div>
                  </>
                ) : (
                  <div className={`${isMobile ? 'h-7' : 'h-8'} bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 rounded-lg flex items-center`}>
                    <AlertCircle className={`${isMobile ? 'w-3 h-3 mr-1.5' : 'w-4 h-4 mr-2'}`} />
                    <span className={isMobile ? 'text-xs' : 'text-sm'}>Agent not found</span>
                  </div>
                )}
              </div>

              {/* Tab Navigation — header pills only for extra tabs (e.g. Campaign Logs) */}
              {!isMobile && agent && tabs.length > 0 && (
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 ml-6">
                  {tabs.map((tab) => {
                    const Icon = tab.icon
                    return (
                      <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                          activeTab === tab.id
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* VAPI button - show skeleton or button based on agent data */}
             {agentLoading ? (
                <div className={`${isMobile ? 'h-8 w-24' : 'h-9 w-32'} bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse ml-4`}></div>
              ) : isVapiAgent ? (
                <div className="relative">
                  <Button
                    onClick={() => {
                      if (vapiStatus?.connected) {
                        router.push(`/${agent.project_id}/agents/${agentId}/vapi`)
                      } else {
                        handleWebhookSetup()
                      }
                    }}
                    className="ml-4"
                    size={isMobile ? "sm" : "default"}
                    variant="outline"
                    disabled={vapiStatusLoading || connectingWebhook}
                  >
                    {vapiStatusLoading || connectingWebhook ? (
                      <Loader2 className={`${isMobile ? 'w-3 h-3 mr-1.5' : 'w-4 h-4 mr-2'} animate-spin`} />
                    ) : vapiStatus?.connected ? (
                      <Bot className={`${isMobile ? 'w-3 h-3 mr-1.5' : 'w-4 h-4 mr-2'}`} />
                    ) : (
                      <LinkIcon className={`${isMobile ? 'w-3 h-3 mr-1.5' : 'w-4 h-4 mr-2'}`} />
                    )}
                    <span className={isMobile ? 'text-xs' : 'text-sm'}>
                      {vapiStatusLoading ? 'Checking...' :
                      connectingWebhook ? 'Connecting...' :
                      vapiStatus?.connected ? (isMobile ? 'Settings' : 'Agent Settings') :
                      (isMobile ? 'Connect' : 'Connect VAPI')}
                    </span>
                  </Button>

                  {!vapiStatusLoading && vapiStatus && (
                    <div className="absolute -top-1 -right-1">
                      {vapiStatus.connected ? (
                        <div className="w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"
                            title="Webhook connected" />
                      ) : (
                        <div className="w-3 h-3 bg-orange-500 rounded-full border-2 border-white dark:border-gray-800"
                            title="Setup required" />
                      )}
                    </div>
                  )}
                </div>
              ) : isRetellAgent ? (
                <div className="relative">
                  <Button
                    onClick={() => {
                      if (retellStatus?.connected) {
                        router.push(`/${agent.project_id}/agents/${agentId}/retell`)
                      } else {
                        handleRetellWebhookSetup()
                      }
                    }}
                    className="ml-4"
                    size={isMobile ? "sm" : "default"}
                    variant="outline"
                    disabled={retellStatusLoading || connectingRetellWebhook}
                  >
                    {retellStatusLoading || connectingRetellWebhook ? (
                      <Loader2 className={`${isMobile ? 'w-3 h-3 mr-1.5' : 'w-4 h-4 mr-2'} animate-spin`} />
                    ) : retellStatus?.connected ? (
                      <Bot className={`${isMobile ? 'w-3 h-3 mr-1.5' : 'w-4 h-4 mr-2'}`} />
                    ) : (
                      <LinkIcon className={`${isMobile ? 'w-3 h-3 mr-1.5' : 'w-4 h-4 mr-2'}`} />
                    )}
                    <span className={isMobile ? 'text-xs' : 'text-sm'}>
                      {retellStatusLoading ? 'Checking...' :
                      connectingRetellWebhook ? 'Connecting...' :
                      retellStatus?.connected ? (isMobile ? 'Settings' : 'Agent Settings') :
                      (isMobile ? 'Connect' : 'Connect Retell')}
                    </span>
                  </Button>

                  {!retellStatusLoading && retellStatus && (
                    <div className="absolute -top-1 -right-1">
                      {retellStatus.connected ? (
                        <div className="w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"
                            title="Webhook connected" />
                      ) : (
                        <div className="w-3 h-3 bg-orange-500 rounded-full border-2 border-white dark:border-gray-800"
                            title="Setup required" />
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Right: Controls or Mobile Menu Button */}
            {!showQuickStart && !showNoCallsMessage && (
              <div className="flex items-center gap-4">
                {isMobile ? (
                  /* Mobile Menu Button */
                  <button
                    onClick={() => setShowMobileMenu(!showMobileMenu)}
                    className="w-8 h-8 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all"
                  >
                    {showMobileMenu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                  </button>
                ) : (
                  /* Desktop Controls */
                  <>
                    {/* Period Filters */}
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Period</span>
                      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                        {quickFilters.map((filter) => (
                          <button
                            key={filter.id}
                            onClick={() => handleQuickFilter(filter.id)}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                              quickFilter === filter.id && !isCustomRange
                                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white/50 dark:hover:bg-gray-700/50'
                            }`}
                          >
                            {filter.label}
                          </button>
                        ))}
                      </div>
                      
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={`px-4 py-2 text-sm font-medium rounded-lg border-gray-200 dark:border-gray-700 transition-all duration-200 ${
                              isCustomRange 
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30' 
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                          >
                            <CalendarDays className="mr-2 h-4 w-4" />
                            Custom
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 border-gray-200 dark:border-gray-700 shadow-xl rounded-xl" align="end">
                          <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={dateRange?.from}
                            selected={dateRange}
                            onSelect={handleDateRangeSelect}
                            numberOfMonths={2}
                            className="rounded-xl"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    
                    {/* Field Extractor & Metrics - skeleton while agent loading; visibility-controlled */}
                    <div className="flex gap-2">
                      {agentLoading ? (
                        <>
                          <div className="h-9 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                          <div className="h-9 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                        </>
                      ) : agent && (canSeeFieldExtractor || canSeeMetrics) ? (
                        <>
                          {canSeeFieldExtractor && (
                          <FieldExtractorDialog
                            initialData={JSON.parse(agent?.field_extractor_prompt || '[]')}
                            initialVariables={(agent as any)?.field_extractor_variables || {}}
                            isEnabled={!!agent?.field_extractor}
                            onSave={async (data, enabled, variables) => {
                              const res = await fetch(`/api/agents/${agent.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  field_extractor_prompt: JSON.stringify(data),
                                  field_extractor: enabled,
                                  field_extractor_variables: variables,
                                }),
                              })
                              const j = (await res.json()) as { error?: string }
                              if (res.ok) {
                                alert('Saved field extractor config.')
                                refetchAgent()
                              } else {
                                alert('Error saving config: ' + (j.error || res.statusText))
                              }
                            }}
                          />
                          )}
                          {canSeeMetrics && (
                          <MetricsDialog
                            initialMetrics={agent?.metrics ? (typeof agent.metrics === 'string' ? JSON.parse(agent.metrics) : agent.metrics) : {}}
                            onSave={async (metrics) => {
                              const res = await fetch(`/api/agents/${agent.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ metrics }),
                              })
                              const j = (await res.json()) as { error?: string }
                              if (res.ok) {
                                alert('Saved metrics config.')
                                refetchAgent()
                              } else {
                                alert('Error saving metrics: ' + (j.error || res.statusText))
                              }
                            }}
                          />
                          )}
                        </>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobile && showMobileMenu && !showQuickStart && !showNoCallsMessage && (
          <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="px-4 py-3 space-y-3">
              {/* Tab Navigation */}
              {agent && (
                <div>
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Sections</div>
                  <div className="space-y-1">
                    {mobileTabs.map((tab) => {
                      const Icon = tab.icon
                      return (
                        <button
                          key={tab.id}
                          onClick={() => {
                            handleTabChange(tab.id)
                            setShowMobileMenu(false)
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                            activeTab === tab.id
                              ? 'bg-blue-500 text-white'
                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
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

              {/* Period Filters */}
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Period</div>
                <div className="flex flex-wrap gap-2">
                  {quickFilters.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => handleQuickFilter(filter.id)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                        quickFilter === filter.id && !isCustomRange
                          ? 'bg-blue-500 text-white'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${
                          isCustomRange 
                            ? 'bg-blue-500 text-white'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
                        }`}
                      >
                        <CalendarDays className="h-3 w-3" />
                        Custom
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={handleDateRangeSelect}
                        numberOfMonths={1}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Tabs */}
              {/* <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Sections</div>
                <div className="space-y-1">
                  {tabs.map((tab) => {
                    const Icon = tab.icon
                    return (
                      <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                          activeTab === tab.id
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </button>
                    )
                  })}
                </div>
              </div> */}

              {/* Field Extractor for mobile (visibility-controlled) */}
              {agent && canSeeFieldExtractor && (
                <div>
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Tools</div>
                  <FieldExtractorDialog
                    initialData={JSON.parse(agent?.field_extractor_prompt || '[]')}
                    initialVariables={(agent as any)?.field_extractor_variables || {}}
                    isEnabled={!!agent?.field_extractor}
                    onSave={async (data, enabled, variables) => {
                      const res = await fetch(`/api/agents/${agent.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          field_extractor_prompt: JSON.stringify(data),
                          field_extractor: enabled,
                          field_extractor_variables: variables,
                        }),
                      })
                      const j = (await res.json()) as { error?: string }
                      if (res.ok) {
                        alert('Saved field extractor config.')
                        refetchAgent()
                      } else {
                        alert('Error saving config: ' + (j.error || res.statusText))
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Content - Show Quick Start for non-VAPI agents, simple message for VAPI agents */}
      <div className={`flex-1 ${activeTab === 'logs' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {showQuickStart ? (
          <QuickStartGuide agentId={agentId} />
        ) : showNoCallsMessage ? (
          <NoCallsMessage />
        ) : (
          <>
            {/* Keep all tabs mounted, just hide inactive ones */}
            <div className={activeTab === 'overview' ? 'block h-full' : 'hidden'}>
              <Overview 
                project={project} 
                agent={agent}
                dateRange={apiDateRange}
                quickFilter={quickFilter}
                isCustomRange={isCustomRange}
                isLoading={agentLoading || projectLoading}
                isActive={activeTab === 'overview'}
              />
            </div>
            
            <div className={activeTab === 'logs' ? 'flex flex-col h-full' : 'hidden'}>
              {agent && (
                <CallLogs 
                  project={project} 
                  agent={agent}
                  onBack={handleBack}
                  dateRange={apiDateRange}
                  isLoading={agentLoading || projectLoading || callsCheckLoading}
                />
              )}
            </div>
            
            {isEnhancedProject && (
              <div className={activeTab === 'campaign-logs' ? 'block h-full' : 'hidden'}>
                <CampaignLogs 
                  project={project} 
                  agent={agent} 
                  onBack={handleBack}
                  isLoading={agentLoading || projectLoading}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Dashboard