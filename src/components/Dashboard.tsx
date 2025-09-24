'use client'
import React, { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { supabase } from '../lib/supabase'
import { AlertTriangle, Link as LinkIcon } from 'lucide-react'
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import QuickStartGuide from './QuickStartGuide'
import { useMobile } from '@/hooks/use-mobile'

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
  const { isMobile } = useMobile(768)

  const [vapiStatus, setVapiStatus] = useState<VapiStatus | null>(null)
  const [vapiStatusLoading, setVapiStatusLoading] = useState(false)
  const [connectingWebhook, setConnectingWebhook] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  
  // Date filter state - these work immediately, no loading needed
  const [quickFilter, setQuickFilter] = useState('7d')
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 7),
    to: new Date()
  })
  const [isCustomRange, setIsCustomRange] = useState(false)

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

  // Data fetching - now happens in parallel with UI rendering
  const { data: agents, loading: agentLoading, error: agentError, refetch: refetchAgent } = useSupabaseQuery('pype_voice_agents', {
    select: 'id, name, agent_type, configuration, environment, created_at, is_active, project_id,field_extractor_prompt,field_extractor',
    filters: [{ column: 'id', operator: 'eq', value: agentId }]
  })

  const agent = agents?.[0]

  const { data: projects, loading: projectLoading, error: projectError } = useSupabaseQuery('pype_voice_projects', 
    agent?.project_id ? {
      select: 'id, name, description, environment, created_at, is_active',
      filters: [{ column: 'id', operator: 'eq', value: agent.project_id }]
    } : null
  )

  // Check if agent has any calls
  const { data: callsCheck, loading: callsCheckLoading } = useSupabaseQuery('pype_voice_call_logs',
    agent?.id ? {
      select: 'id',
      filters: [{ column: 'agent_id', operator: 'eq', value: agent.id }],
      limit: 1
    } : null
  )

  const hasCalls = callsCheck && callsCheck.length > 0

  // MODIFIED: Show QuickStart only for non-VAPI agents without calls
  // For VAPI agents without calls, show simple "No calls yet" message
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

  // Date filter handlers - work immediately
  const handleQuickFilter = (filterId: string) => {
    setQuickFilter(filterId)
    setIsCustomRange(false)
    
    const days = quickFilters.find(f => f.id === filterId)?.days || 7
    const endDate = new Date()
    const startDate = subDays(endDate, days)
    setDateRange({ from: startDate, to: endDate })
    
    // Close mobile menu after selection
    if (isMobile) {
      setShowMobileMenu(false)
    }
  }

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setDateRange(range)
      setIsCustomRange(true)
      setQuickFilter('')
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
    const current = new URLSearchParams(Array.from(searchParams.entries()))
    current.set('tab', tab)
    const search = current.toString()
    const query = search ? `?${search}` : ""
    
    // Use the full path with projectId
    if (agent?.project_id) {
      router.push(`/${agent.project_id}/agents/${agentId}${query}`)
    }
    
    // Close mobile menu after tab change
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

  // Set default tab if none specified
  useEffect(() => {
    if (!searchParams.get('tab')) {
      handleTabChange('overview')
    }
  }, [searchParams])

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

  // Show tabs immediately - can be calculated without agent data
  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'logs', label: 'Call Logs', icon: List },
    // Only add campaign-logs if we know it's enhanced (will show when agent data loads)
    ...(isEnhancedProject ? [{ id: 'campaign-logs', label: 'Campaign Logs', icon: Database }] : [])
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
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{agentError}</p>
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

              {/* VAPI button - show skeleton or button based on agent data */}
              {agentLoading ? (
                <div className={`${isMobile ? 'h-8 w-24' : 'h-9 w-32'} bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse ml-4`}></div>
              ) : isVapiAgent ? (
                <div className="relative">
                  <Button
                    onClick={() => {
                      if (vapiStatus?.connected) {
                        router.push(`/agents/${agentId}/vapi`)
                      } else {
                        handleWebhookSetup()
                      }
                    }}
                    className="ml-4"
                    size={isMobile ? "sm" : "default"}
                    variant="outline"
                    disabled={vapiStatusLoading || connectingWebhook}
                  >
                    {vapiStatusLoading ? (
                      <Loader2 className={`${isMobile ? 'w-3 h-3 mr-1.5' : 'w-4 h-4 mr-2'} animate-spin`} />
                    ) : connectingWebhook ? (
                      <Loader2 className={`${isMobile ? 'w-3 h-3 mr-1.5' : 'w-4 h-4 mr-2'} animate-spin`} />
                    ) : vapiStatus?.connected ? (
                      <Bot className={`${isMobile ? 'w-3 h-3 mr-1.5' : 'w-4 h-4 mr-2'}`} />
                    ) : (
                      <LinkIcon className={`${isMobile ? 'w-3 h-3 mr-1.5' : 'w-4 h-4 mr-2'}`} />
                    )}
                    
                    <span className={isMobile ? 'text-xs' : 'text-sm'}>
                      {vapiStatusLoading ? 'Checking...' :
                      connectingWebhook ? 'Connecting...' :
                      vapiStatus?.connected ? (isMobile ? 'Settings' : 'Agent Settings') : (isMobile ? 'Connect' : 'Connect VAPI')}
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
                    
                    {/* Field Extractor - skeleton while agent loading */}
                    {agentLoading ? (
                      <div className="h-9 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                    ) : agent ? (
                      <FieldExtractorDialog
                        initialData={JSON.parse(agent?.field_extractor_prompt || '[]')}
                        isEnabled={!!agent?.field_extractor}
                        onSave={async (data, enabled) => {
                          const { error } = await supabase
                            .from('pype_voice_agents')
                            .update({ field_extractor_prompt: JSON.stringify(data), field_extractor: enabled })
                            .eq('id', agent.id)
                          if (!error) {
                            alert('Saved field extractor config.')
                            refetchAgent()
                          } else {
                            alert('Error saving config: ' + error.message)
                          }
                        }}
                      />
                    ) : null}
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

              {/* Field Extractor for mobile */}
              {agent && (
                <div>
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Tools</div>
                  <FieldExtractorDialog
                    initialData={JSON.parse(agent?.field_extractor_prompt || '[]')}
                    isEnabled={!!agent?.field_extractor}
                    onSave={async (data, enabled) => {
                      const { error } = await supabase
                        .from('pype_voice_agents')
                        .update({ field_extractor_prompt: JSON.stringify(data), field_extractor: enabled })
                        .eq('id', agent.id)
                      if (!error) {
                        alert('Saved field extractor config.')
                        refetchAgent()
                      } else {
                        alert('Error saving config: ' + error.message)
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
      <div className="flex-1 overflow-y-auto">
        {showQuickStart ? (
          <QuickStartGuide agentId={agentId} />
        ) : showNoCallsMessage ? (
          <NoCallsMessage />
        ) : (
          <>
            {activeTab === 'overview' && (
              <Overview 
                project={project} 
                agent={agent}
                dateRange={apiDateRange}
                quickFilter={quickFilter}
                isCustomRange={isCustomRange}
                isLoading={agentLoading || projectLoading}
              />
            )}
            {activeTab === 'logs' && (
              <CallLogs 
                project={project} 
                agent={agent} 
                onBack={handleBack}
                isLoading={agentLoading || projectLoading || callsCheckLoading}
              />
            )}
            {activeTab === 'campaign-logs' && isEnhancedProject && (
              <CampaignLogs 
                project={project} 
                agent={agent} 
                onBack={handleBack}
                isLoading={agentLoading || projectLoading}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Dashboard