'use client'
import React, { useEffect, useState } from 'react'
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
  Check
} from 'lucide-react'
import Overview from './Overview'
import CallLogs from './calls/CallLogs'
import CampaignLogs from './campaigns/CampaignLogs'
import Header from '@/components/shared/Header'

import { useSupabaseQuery } from '../hooks/useSupabase'
import FieldExtractorDialog from './FieldExtractorLogs'
import { supabase } from '../lib/supabase'

interface DashboardProps {
  agentId: string
}

interface DateRange {
  from: Date | undefined
  to?: Date | undefined
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

const formatDateDisplay = (date: Date) => {
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  })
}

const Dashboard: React.FC<DashboardProps> = ({ agentId }) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Date filter state
  const [quickFilter, setQuickFilter] = useState('7d')
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 7),
    to: new Date()
  })
  const [isCustomRange, setIsCustomRange] = useState(false)
  
  const activeTab = searchParams.get('tab') || 'overview'
  const shouldFetch = agentId && agentId !== 'undefined' && agentId.trim() !== ''

  const quickFilters = [
    { id: '1d', label: '1D', days: 1 },
    { id: '7d', label: '7D', days: 7 },
    { id: '30d', label: '30D', days: 30 }
  ]

  // Date range for API calls
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

  const handleQuickFilter = (filterId: string) => {
    setQuickFilter(filterId)
    setIsCustomRange(false)
    
    const days = quickFilters.find(f => f.id === filterId)?.days || 7
    const endDate = new Date()
    const startDate = subDays(endDate, days)
    setDateRange({ from: startDate, to: endDate })
  }

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      setDateRange(range)
      setIsCustomRange(true)
      setQuickFilter('')
    }
  }

  const { data: agents, loading: agentLoading, error: agentError, refetch: refetchAgent } = useSupabaseQuery('pype_voice_agents', {
    select: 'id, name, agent_type, configuration, environment, created_at, is_active, project_id,field_extractor_prompt,field_extractor',
    filters: shouldFetch ? [{ column: 'id', operator: 'eq', value: agentId }] : []
  })

  const agent = shouldFetch ? agents?.[0] : null

  const { data: projects, loading: projectLoading, error: projectError } = useSupabaseQuery('pype_voice_projects', {
    select: 'id, name, description, environment, created_at, is_active',
    filters: (shouldFetch && agent?.project_id) ? [{ column: 'id', operator: 'eq', value: agent.project_id }] : []
  })

  const project = (shouldFetch && agent?.project_id) ? projects?.[0] : null

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
    router.push(`/agents/${agentId}${query}`)
  }

  const getEnvironmentColor = (environment: string) => {
    switch (environment.toLowerCase()) {
      case 'production':
      case 'prod':
        return 'bg-red-50 text-red-700 border border-red-100'
      case 'staging':
      case 'stage':
        return 'bg-orange-50 text-orange-700 border border-orange-100'
      case 'development':
      case 'dev':
        return 'bg-blue-50 text-blue-700 border border-blue-100'
      default:
        return 'bg-gray-50 text-gray-700 border border-gray-100'
    }
  }

  const getAgentTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'inbound':
        return 'bg-blue-50 text-blue-700 border border-blue-100'
      case 'outbound':
        return 'bg-green-50 text-green-700 border border-green-100'
      case 'custom':
        return 'bg-purple-50 text-purple-700 border border-purple-100'
      default:
        return 'bg-gray-50 text-gray-700 border border-gray-100'
    }
  }

  useEffect(() => {
    if (!searchParams.get('tab')) {
      handleTabChange('overview')
    }
  }, [searchParams])

  const isEnhancedProject = agent?.project_id === ENHANCED_PROJECT_ID

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'logs', label: 'Call Logs', icon: List },
    ...(isEnhancedProject ? [{ id: 'campaign-logs', label: 'Campaign Logs', icon: Database }] : [])
  ]

  // Prepare breadcrumb data for Header
  const breadcrumb = agent ? {
    project: project?.name || 'Project',
    item: agent.name
  } : undefined

  if (!shouldFetch) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 max-w-md text-center">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Invalid Agent ID</h2>
            <p className="text-sm text-gray-500 mb-4">Agent ID missing or invalid</p>
            <Button onClick={() => router.push('/')} className="w-full bg-blue-500 hover:bg-blue-600 text-white">
              <Home className="h-4 w-4 mr-2" />
              Back to Workspaces
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (agentLoading || (shouldFetch && projectLoading)) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 bg-white rounded-xl border border-gray-200 shadow-sm flex items-center justify-center mx-auto">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
            <div>
              <h3 className="text-base font-medium text-gray-900 mb-1">Loading Dashboard</h3>
              <p className="text-sm text-gray-500">Fetching agent data...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (agentError || projectError || !agent) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 max-w-md text-center">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Agent not found</h2>
            <p className="text-sm text-gray-500 mb-4">{agentError || projectError || 'Agent not found'}</p>
            <Button onClick={handleBack} variant="outline" className="w-full border-gray-200">
              <ChevronLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header breadcrumb={breadcrumb} />

      {/* Polished Apple Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-8 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Navigation & Identity */}
            <div className="flex items-center gap-6">
              <button 
                onClick={handleBack}
                className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all duration-200"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">{agent.name}</h1>
                <div className="flex items-center gap-2">
                  <Badge className={`text-xs font-medium px-3 py-1 rounded-full ${getEnvironmentColor(agent.environment)}`}>
                    {agent.environment}
                  </Badge>
                </div>
              </div>

              {/* Refined Tab Navigation */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 ml-8">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                        isActive
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Right: Refined Controls */}
            <div className="flex items-center gap-6">
              {/* Polished Period Filters */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-600">Period</span>
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  {quickFilters.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => handleQuickFilter(filter.id)}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                        quickFilter === filter.id && !isCustomRange
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
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
                      className={`px-4 py-2 text-sm font-medium rounded-lg border-gray-200 transition-all duration-200 ${
                        isCustomRange 
                          ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' 
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      Custom
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-gray-200 shadow-xl rounded-xl" align="end">
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
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'overview' && (
          <Overview 
            project={project} 
            agent={agent}
            dateRange={apiDateRange}
            quickFilter={quickFilter}
            isCustomRange={isCustomRange}
          />
        )}
        {activeTab === 'logs' && (
          <CallLogs project={project} agent={agent} onBack={handleBack} />
        )}
        {activeTab === 'campaign-logs' && isEnhancedProject && (
          <CampaignLogs project={project} agent={agent} onBack={handleBack} />
        )}
      </div>
    </div>
  )
}

export default Dashboard