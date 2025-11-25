'use client'

import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSupabaseQuery } from '@/hooks/useSupabase'
import { format, subHours, startOfDay, endOfDay } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  CalendarDays, 
  AlertCircle, 
  Loader2,
  RefreshCw,
  ChevronDown,
  X,
  Clock
} from 'lucide-react'
import { useMobile } from '@/hooks/use-mobile'
import ErrorAggregation from '../ErrorAggregation'
import ErrorLogsDisplay from '../ErrorLogsDisplay'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import type { DateRange } from 'react-day-picker'

interface ErrorMonitoringProps {
  projectId: string
}

interface Agent {
  id: string
  name: string
  agent_type: string
  is_active: boolean
  project_id: string
}

const ErrorMonitoring: React.FC<ErrorMonitoringProps> = ({ projectId }) => {
  const { isMobile } = useMobile(768)
  
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set())
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subHours(new Date(), 24),
    to: new Date()
  })
  const [startTime, setStartTime] = useState<string>(format(subHours(new Date(), 24), 'HH:mm'))
  const [endTime, setEndTime] = useState<string>(format(new Date(), 'HH:mm'))
  const [componentFilter, setComponentFilter] = useState<string | null>(null)
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false)

  // Fetch ALL agents from database (not filtered by project)
  const { data: agents, loading: agentsLoading } = useSupabaseQuery('pype_voice_agents', {
    select: 'id, name, agent_type, is_active, project_id',
    filters: [] // No filters - get all agents
  })

  const agentList = (agents || []) as Agent[]

  // Group agents by project for better organization
  const agentsByProject = useMemo(() => {
    const grouped: Record<string, Agent[]> = {}
    agentList.forEach(agent => {
      if (!grouped[agent.project_id]) {
        grouped[agent.project_id] = []
      }
      grouped[agent.project_id].push(agent)
    })
    return grouped
  }, [agentList])

  // Calculate time range for API
  const timeRange = useMemo(() => {
    if (!dateRange.from || !dateRange.to) {
      const now = new Date()
      return {
        from: subHours(now, 24),
        to: now
      }
    }

    // Combine date with time
    const fromDate = new Date(dateRange.from)
    const [startHour, startMin] = startTime.split(':').map(Number)
    fromDate.setHours(startHour, startMin, 0, 0)

    const toDate = new Date(dateRange.to)
    const [endHour, endMin] = endTime.split(':').map(Number)
    toDate.setHours(endHour, endMin, 59, 999)

    return { from: fromDate, to: toDate }
  }, [dateRange, startTime, endTime])

  // Calculate hours back from time range
  const hoursBack = useMemo(() => {
    const diffMs = timeRange.to.getTime() - timeRange.from.getTime()
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60))
    return Math.max(1, diffHours)
  }, [timeRange])

  // Fetch recent errors for selected agents
  const { data: recentErrors, isLoading: errorsLoading, refetch: refetchErrors } = useQuery({
    queryKey: ['admin-all-errors', Array.from(selectedAgents), componentFilter, timeRange.from, timeRange.to],
    queryFn: async () => {
      const agentIds = Array.from(selectedAgents)
      if (agentIds.length === 0) return null

      const params = new URLSearchParams({
        projectId: 'all',
        hoursBack: hoursBack.toString(),
        limit: '1000'
      })

      params.append('agentIds', agentIds.join(','))

      if (componentFilter) {
        params.append('component', componentFilter)
      }

      // Add time range if available
      if (timeRange.from && timeRange.to) {
        params.append('startTime', timeRange.from.toISOString())
        params.append('endTime', timeRange.to.toISOString())
      }

      const response = await fetch(`/api/admin/all-errors?${params}`)
      if (!response.ok) throw new Error('Failed to fetch errors')
      const data = await response.json()
      
      // Filter errors by time range on client side (in case API doesn't support it)
      if (data.errors && timeRange.from && timeRange.to) {
        data.errors = data.errors.filter((error: any) => {
          const errorTime = new Date(error.Timestamp || error.timestamp)
          return errorTime >= timeRange.from && errorTime <= timeRange.to
        })
      }
      
      return data
    },
    enabled: selectedAgents.size > 0,
    refetchInterval: 30000
  })

  // Calculate dynamic error aggregation
  const errorAggregation = useMemo(() => {
    if (!recentErrors?.errors || recentErrors.errors.length === 0) {
      return { byType: {}, byComponent: {}, bySipStatus: {}, byHttpStatus: {}, total: 0 }
    }

    const byType: Record<string, number> = {}
    const byComponent: Record<string, number> = {}
    const bySipStatus: Record<string, number> = {}
    const byHttpStatus: Record<string, number> = {}

    recentErrors.errors.forEach((error: any) => {
      // Count by component:errorType
      const typeKey = `${error.Component}:${error.ErrorType}`
      byType[typeKey] = (byType[typeKey] || 0) + 1

      // Count by component
      byComponent[error.Component] = (byComponent[error.Component] || 0) + 1

      // Count by SIP status
      if (error.SipStatus) {
        const sipKey = `SIP ${error.SipStatus}`
        bySipStatus[sipKey] = (bySipStatus[sipKey] || 0) + 1
      }

      // Count by HTTP status
      if (error.HttpStatus) {
        const httpKey = `HTTP ${error.HttpStatus}`
        byHttpStatus[httpKey] = (byHttpStatus[httpKey] || 0) + 1
      }
    })

    return {
      byType,
      byComponent,
      bySipStatus,
      byHttpStatus,
      total: recentErrors.errors.length
    }
  }, [recentErrors])

  const handleToggleAgent = (agentId: string) => {
    const newSelected = new Set(selectedAgents)
    if (newSelected.has(agentId)) {
      newSelected.delete(agentId)
    } else {
      newSelected.add(agentId)
    }
    setSelectedAgents(newSelected)
  }

  const handleClearSelection = () => {
    setSelectedAgents(new Set())
  }

  const selectedAgentNames = useMemo(() => {
    return Array.from(selectedAgents)
      .map(id => agentList.find(a => a.id === id)?.name)
      .filter(Boolean)
  }, [selectedAgents, agentList])

  return (
    <>
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Agent Selection Dropdown */}
          <Popover open={agentDropdownOpen} onOpenChange={setAgentDropdownOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={agentDropdownOpen}
                className="w-[280px] justify-between"
              >
                {selectedAgents.size === 0 ? (
                  "Select agents..."
                ) : (
                  <span className="truncate">
                    {selectedAgents.size} agent{selectedAgents.size !== 1 ? 's' : ''} selected
                  </span>
                )}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-[320px] p-0" 
              align="start" 
              sideOffset={4}
              style={{ maxHeight: '500px' }}
            >
              <Command className="h-full">
                <CommandInput placeholder="Search agents..." className="h-9 border-b" />
                <CommandList style={{ maxHeight: '440px', overflowY: 'auto' }}>
                  <CommandEmpty>No agents found.</CommandEmpty>
                  {agentsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    Object.entries(agentsByProject).map(([projectId, projectAgents]) => (
                      <CommandGroup key={projectId} heading={`Project: ${projectId.substring(0, 8)}...`}>
                        {projectAgents.map((agent) => (
                          <CommandItem
                            key={agent.id}
                            value={agent.name}
                            onSelect={() => handleToggleAgent(agent.id)}
                            className="cursor-pointer"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className={`w-4 h-4 border rounded flex items-center justify-center flex-shrink-0 ${
                                selectedAgents.has(agent.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                              }`}>
                                {selectedAgents.has(agent.id) && (
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{agent.name}</p>
                                <p className="text-xs text-gray-500 truncate">{agent.agent_type}</p>
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ))
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {selectedAgents.size > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearSelection}
              className="h-9"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                {dateRange.from && dateRange.to ? (
                  !isMobile ? (
                    `${format(dateRange.from, 'MMM dd')} - ${format(dateRange.to, 'MMM dd')}`
                  ) : (
                    'Date Range'
                  )
                ) : (
                  'Select Date Range'
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4" align="end">
              <div className="space-y-4">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => {
                    if (range) {
                      setDateRange(range)
                      if (range.from && !range.to) {
                        // If only start date selected, set end date to same day
                        setDateRange({ from: range.from, to: range.from })
                      }
                    }
                  }}
                  numberOfMonths={2}
                  className="rounded-md border"
                />
                <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                  <div className="space-y-2">
                    <Label className="text-xs flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Start Time
                    </Label>
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      End Time
                    </Label>
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchErrors()}
            disabled={errorsLoading || selectedAgents.size === 0}
          >
            <RefreshCw className={`h-4 w-4 ${errorsLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Selected Agents Display */}
      {selectedAgents.size > 0 && (
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            {selectedAgentNames.slice(0, 5).map((name, idx) => (
              <Badge key={idx} variant="secondary" className="text-sm">
                {name}
              </Badge>
            ))}
            {selectedAgentNames.length > 5 && (
              <Badge variant="secondary" className="text-sm">
                +{selectedAgentNames.length - 5} more
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Error Aggregation */}
      {selectedAgents.size > 0 && (
        <>
          <ErrorAggregation
            aggregation={errorAggregation}
            isLoading={errorsLoading}
          />

          {/* Error Logs */}
          <ErrorLogsDisplay
            errors={recentErrors?.errors || []}
            isLoading={errorsLoading}
            componentFilter={componentFilter}
            onComponentFilterChange={setComponentFilter}
            selectedAgents={Array.from(selectedAgents)}
            agents={agentList}
          />
        </>
      )}

      {selectedAgents.size === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No Agents Selected
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Select one or more agents from the dropdown above to view error monitoring across all agents in the database
              </p>
              <Badge variant="outline" className="text-sm">
                Total agents available: {agentList.length}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}

export default ErrorMonitoring
