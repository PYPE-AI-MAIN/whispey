'use client'

import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSupabaseQuery } from '@/hooks/useSupabase'
import { format, subHours } from 'date-fns'
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
  Clock,
  Activity,
  TrendingUp,
  Phone,
  Mic,
  MessageSquare,
  Volume2
} from 'lucide-react'
import { useMobile } from '@/hooks/use-mobile'
import ErrorAggregation from '../ErrorAggregation'
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
  
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subHours(new Date(), 24),
    to: new Date()
  })
  const [startTime, setStartTime] = useState<string>(format(subHours(new Date(), 24), 'HH:mm'))
  const [endTime, setEndTime] = useState<string>(format(new Date(), 'HH:mm'))

  // Fetch ALL agents from database
  const { data: agents, loading: agentsLoading } = useSupabaseQuery('pype_voice_agents', {
    select: 'id, name, agent_type, is_active, project_id',
    filters: []
  })

  const agentList = (agents || []) as Agent[]
  const allAgentIds = useMemo(() => agentList.map(a => a.id), [agentList])

  // Calculate time range for API
  const timeRange = useMemo(() => {
    if (!dateRange.from || !dateRange.to) {
      const now = new Date()
      return {
        from: subHours(now, 24),
        to: now
      }
    }

    const fromDate = new Date(dateRange.from)
    const [startHour, startMin] = startTime.split(':').map(Number)
    fromDate.setHours(startHour, startMin, 0, 0)

    const toDate = new Date(dateRange.to)
    const [endHour, endMin] = endTime.split(':').map(Number)
    toDate.setHours(endHour, endMin, 59, 999)

    return { from: fromDate, to: toDate }
  }, [dateRange, startTime, endTime])

  const hoursBack = useMemo(() => {
    const diffMs = timeRange.to.getTime() - timeRange.from.getTime()
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60))
    return Math.max(1, diffHours)
  }, [timeRange])

  // Fetch errors for all agents
  const { data: recentErrors, isLoading: errorsLoading, refetch: refetchErrors } = useQuery({
    queryKey: ['admin-all-errors', allAgentIds, timeRange.from, timeRange.to],
    queryFn: async () => {
      if (allAgentIds.length === 0) return null

      const params = new URLSearchParams({
        projectId: 'all',
        hoursBack: hoursBack.toString(),
        limit: '1000'
      })

      params.append('agentIds', allAgentIds.join(','))

      if (timeRange.from && timeRange.to) {
        params.append('startTime', timeRange.from.toISOString())
        params.append('endTime', timeRange.to.toISOString())
      }

      const response = await fetch(`/api/admin/all-errors?${params}`)
      if (!response.ok) throw new Error('Failed to fetch errors')
      const data = await response.json()
      
      if (data.errors && timeRange.from && timeRange.to) {
        data.errors = data.errors.filter((error: any) => {
          const errorTime = new Date(error.Timestamp || error.timestamp)
          return errorTime >= timeRange.from && errorTime <= timeRange.to
        })
      }
      
      return data
    },
    enabled: allAgentIds.length > 0,
    refetchInterval: 30000
  })

  // Calculate aggregations
  const errorAggregation = useMemo(() => {
    if (!recentErrors?.errors || recentErrors.errors.length === 0) {
      return { 
        byType: {}, 
        byComponent: {}, 
        bySipStatus: {}, 
        byHttpStatus: {}, 
        total: 0,
        sipErrors: 0,
        sttErrors: 0,
        llmErrors: 0,
        ttsErrors: 0,
        serverErrors: 0
      }
    }

    const byType: Record<string, number> = {}
    const byComponent: Record<string, number> = {}
    const bySipStatus: Record<string, number> = {}
    const byHttpStatus: Record<string, number> = {}
    
    let sipErrors = 0
    let sttErrors = 0
    let llmErrors = 0
    let ttsErrors = 0
    let serverErrors = 0

    recentErrors.errors.forEach((error: any) => {
      const typeKey = `${error.Component}:${error.ErrorType}`
      byType[typeKey] = (byType[typeKey] || 0) + 1
      byComponent[error.Component] = (byComponent[error.Component] || 0) + 1

      // Count by component type
      const component = (error.Component || '').toLowerCase()
      if (component === 'sip') sipErrors++
      else if (component === 'stt') sttErrors++
      else if (component === 'llm') llmErrors++
      else if (component === 'tts') ttsErrors++
      else if (component === 'server') serverErrors++

      if (error.SipStatus) {
        const sipKey = `SIP ${error.SipStatus}`
        bySipStatus[sipKey] = (bySipStatus[sipKey] || 0) + 1
      }

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
      total: recentErrors.errors.length,
      sipErrors,
      sttErrors,
      llmErrors,
      ttsErrors,
      serverErrors
    }
  }, [recentErrors])

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Activity className="h-3 w-3" />
              Total Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agentList.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Total Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {errorAggregation.total}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Phone className="h-3 w-3" />
              SIP Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {errorAggregation.sipErrors}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Mic className="h-3 w-3" />
              STT Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {errorAggregation.sttErrors}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              LLM Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {errorAggregation.llmErrors}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Volume2 className="h-3 w-3" />
              TTS Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {errorAggregation.ttsErrors}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="flex items-center gap-1">
                <Activity className="h-3 w-3 animate-pulse text-green-500" />
                Live Monitoring
              </Badge>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {agentList.length} agents · Auto-refresh every 30s
              </span>
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
                disabled={errorsLoading}
              >
                <RefreshCw className={`h-4 w-4 ${errorsLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {(agentsLoading || errorsLoading) && (
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <span className="ml-3 text-gray-500">
                {agentsLoading ? 'Loading agents...' : 'Loading error data...'}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Aggregation */}
      {!agentsLoading && !errorsLoading && allAgentIds.length > 0 && (
        <ErrorAggregation
          aggregation={errorAggregation}
          isLoading={errorsLoading}
        />
      )}

      {/* No Agents State */}
      {!agentsLoading && allAgentIds.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No Agents Found
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                There are no agents in the database to monitor
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default ErrorMonitoring
