// src/components/reprocess/ReprocessCallLogs.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Sparkles, CheckCircle, XCircle, AlertCircle, Clock, CalendarDays } from 'lucide-react'
import { DateRange } from 'react-day-picker'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

// Helper functions for date manipulation
const subDays = (date: Date, days: number) => {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

const formatDate = (date: Date, formatStr: string) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = months[date.getMonth()]
  const day = date.getDate()
  const year = date.getFullYear()
  
  return formatStr
    .replace('MMM', month)
    .replace('dd', day.toString().padStart(2, '0'))
    .replace('yyyy', year.toString())
}

interface ReprocessStatus {
  request_id: string
  status: 'queued' | 'preparing' | 'processing' | 'completed' | 'failed'
  progress_percentage: number
  total_logs: number
  total_batches: number
  batches_queued: number
  batches_completed: number
  logs_processed: number
  logs_failed: number
  filters: {
    from_date: string
    to_date: string
    reprocess_type: string
    reprocess_options: string
    agent_id: string
    project_id: string
  }
  timestamps: {
    created_at: string
    updated_at: string
  }
  estimated_time_remaining_minutes?: number
}

interface ReanalyzeCallLogsProps {
  projectId?: string
  agentId?: string
  isDialogOpen?: boolean | null
}

export default function ReanalyzeCallLogs({ projectId, agentId, isDialogOpen }: ReanalyzeCallLogsProps) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<ReprocessStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)
  const [logCount, setLogCount] = useState<number | null>(null)
  const [counting, setCounting] = useState(false)

  // Form state
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date()
  })
  const [reprocessType, setReprocessType] = useState<'empty_only' | 'all'>('empty_only')
  const [reprocessOptions, setReprocessOptions] = useState<'transcription' | 'metrics' | 'both'>('both')
  const [transcriptionFields, setTranscriptionFields] = useState<string[]>([])
  const [metricsFields, setMetricsFields] = useState<string[]>([])
  
  // Available fields from agent config
  const [availableTranscriptionFields, setAvailableTranscriptionFields] = useState<string[]>([])
  const [availableMetricsFields, setAvailableMetricsFields] = useState<string[]>([])
  const [loadingFields, setLoadingFields] = useState(false)

  // Storage key for persisting analysis state
  const storageKey = `reanalysis_${projectId}_${agentId}`

  // Check for existing running analysis when dialog opens
  useEffect(() => {
    if (isDialogOpen === true && projectId && agentId) {
      const storedRequestId = localStorage.getItem(storageKey)
      if (storedRequestId) {
        // Check if analysis is still running
        checkExistingAnalysis(storedRequestId)
      }
    }
  }, [isDialogOpen, projectId, agentId, storageKey])

  // Fetch available fields from agent config
  useEffect(() => {
    if (agentId) {
      fetchAvailableFields()
    } else {
      setAvailableTranscriptionFields([])
      setAvailableMetricsFields([])
    }
  }, [agentId])

  // Fetch log count when filters change
  useEffect(() => {
    if (dateRange?.from && dateRange?.to && !isAnalysisRunning) {
      fetchLogCount()
    } else {
      setLogCount(null)
    }
  }, [dateRange, reprocessType, reprocessOptions, transcriptionFields, metricsFields, agentId, projectId])

  const fetchAvailableFields = async () => {
    if (!agentId) return

    setLoadingFields(true)
    try {
      // Fetch agent config
      const { data: agent, error } = await supabase
        .from('pype_voice_agents')
        .select('field_extractor_prompt, metrics')
        .eq('id', agentId)
        .single()

      if (error) {
        console.error('Error fetching agent config:', error)
        return
      }

      // Extract transcription fields from field_extractor_prompt
      if (agent?.field_extractor_prompt) {
        try {
          let promptConfig: any
          const prompt = agent.field_extractor_prompt
          
          // Handle both string and array formats
          if (typeof prompt === 'string') {
            promptConfig = JSON.parse(prompt)
          } else if (Array.isArray(prompt)) {
            promptConfig = prompt
          } else {
            return
          }
          
          if (Array.isArray(promptConfig)) {
            const fields = promptConfig
              .filter((p: any) => p.key && typeof p.key === 'string')
              .map((p: any) => p.key)
            setAvailableTranscriptionFields(fields.sort())
          }
        } catch (e) {
          console.error('Error parsing field_extractor_prompt:', e)
          setAvailableTranscriptionFields([])
        }
      } else {
        setAvailableTranscriptionFields([])
      }

      // Extract metrics fields from metrics
      if (agent?.metrics) {
        try {
          const metricsConfig = typeof agent.metrics === 'string' 
            ? JSON.parse(agent.metrics) 
            : agent.metrics
          
          if (typeof metricsConfig === 'object' && metricsConfig !== null) {
            const metricIds = Object.keys(metricsConfig)
              .filter(key => metricsConfig[key]?.enabled !== false)
            setAvailableMetricsFields(metricIds.sort())
          }
        } catch (e) {
          console.error('Error parsing metrics:', e)
          setAvailableMetricsFields([])
        }
      } else {
        setAvailableMetricsFields([])
      }
    } catch (err) {
      console.error('Error fetching available fields:', err)
    } finally {
      setLoadingFields(false)
    }
  }

  const fetchLogCount = async () => {
    if (!dateRange?.from || !dateRange?.to) return

    setCounting(true)
    try {
      const from = new Date(dateRange.from)
      const to = new Date(dateRange.to)
      from.setHours(0, 0, 0, 0)
      to.setHours(23, 59, 59, 999)

      const params = new URLSearchParams({
        from_date: from.toISOString(),
        to_date: to.toISOString(),
        reprocess_type: reprocessType,
        reprocess_options: reprocessOptions,
        ...(agentId && { agent_id: agentId }),
        ...(projectId && { project_id: projectId }),
        ...(transcriptionFields.length > 0 && { transcription_fields: JSON.stringify(transcriptionFields) }),
        ...(metricsFields.length > 0 && { metrics_fields: JSON.stringify(metricsFields) })
      })

      const response = await fetch(`/api/reprocess-call-logs/count?${params.toString()}`)
      const data = await response.json()

      if (response.ok) {
        setLogCount(data.count || 0)
      } else {
        console.error('Error fetching count:', data.error)
        setLogCount(null)
      }
    } catch (err) {
      console.error('Error fetching log count:', err)
      setLogCount(null)
    } finally {
      setCounting(false)
    }
  }

  const checkExistingAnalysis = async (requestId: string) => {
    try {
      const statusData = await getStatus(requestId)
      setStatus(statusData)
      
      // If still running, resume polling
      if (statusData.status !== 'completed' && statusData.status !== 'failed') {
        setPolling(true)
        pollStatus(requestId)
      } else {
        // Analysis completed or failed, clear storage
        localStorage.removeItem(storageKey)
      }
    } catch (err: any) {
      // Request failed - localStorage already cleared in getStatus, just handle silently
      // Only log non-404 errors for debugging
      if (err?.status !== 404) {
        console.error('Error checking existing analysis:', err)
      }
    }
  }

  const triggerReanalysis = async () => {
    // Prevent starting new analysis if one is already running
    if (isAnalysisRunning) {
      setError('An analysis is already in progress. Please wait for it to complete.')
      return
    }

    setLoading(true)
    setError(null)
    setStatus(null)

    try {
      // Validate dates
      if (!dateRange?.from || !dateRange?.to) {
        throw new Error('Please select a date range')
      }

      const from = new Date(dateRange.from)
      const to = new Date(dateRange.to)
      
      // Set time to start of day for from, end of day for to
      from.setHours(0, 0, 0, 0)
      to.setHours(23, 59, 59, 999)

      if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        throw new Error('Invalid date format')
      }

      if (to < from) {
        throw new Error('End date must be after start date')
      }

      // Convert to ISO 8601 format
      const fromISO = from.toISOString()
      const toISO = to.toISOString()

      const requestBody: any = {
        from_date: fromISO,
        to_date: toISO,
        reprocess_type: reprocessType,
        reprocess_options: reprocessOptions,
        agent_id: agentId || null,
        project_id: projectId || null
      }

      // Add transcription_fields if provided
      if (transcriptionFields.length > 0) {
        requestBody.transcription_fields = transcriptionFields
      }

      // Add metrics_fields if provided
      if (metricsFields.length > 0) {
        requestBody.metrics_fields = metricsFields
      }

      const response = await fetch('/api/reprocess-call-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to trigger reprocess')
      }

      // Store request_id in localStorage
      if (projectId && agentId) {
        localStorage.setItem(storageKey, data.request_id)
      }

      // Start polling for status
      setStatus({
        request_id: data.request_id,
        status: 'queued',
        progress_percentage: 0,
        total_logs: 0,
        total_batches: 0,
        batches_queued: 0,
        batches_completed: 0,
        logs_processed: 0,
        logs_failed: 0,
        filters: data.filters,
        timestamps: {
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      })

      setPolling(true)
      pollStatus(data.request_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start reanalysis')
    } finally {
      setLoading(false)
    }
  }

  const getStatus = async (requestId: string): Promise<ReprocessStatus> => {
    const url = `/api/reprocess-status/${requestId}${projectId ? `?project_id=${projectId}` : ''}`
    const response = await fetch(url)

    if (!response.ok) {
      // Clear localStorage immediately if request fails
      if (projectId && agentId) {
        localStorage.removeItem(storageKey)
      }
      
      let errorMessage = 'Failed to get status'
      try {
        const error = await response.json()
        errorMessage = error.error || errorMessage
      } catch {
        if (response.status === 404) {
          errorMessage = 'Reprocess request not found'
        } else {
          errorMessage = `Server returned ${response.status}: ${response.statusText}`
        }
      }
      const error = new Error(errorMessage)
      ;(error as any).status = response.status
      throw error
    }

    return await response.json()
  }

  const pollStatus = async (requestId: string) => {
    const pollInterval = 5000 // 5 seconds
    const maxAttempts = 360 // 30 minutes max
    let attempts = 0

    const poll = async (): Promise<void> => {
      try {
        const statusData = await getStatus(requestId)
        setStatus(statusData)

        // Check if completed
        if (statusData.status === 'completed' || statusData.status === 'failed') {
          setPolling(false)
          // Clear storage when analysis completes or fails
          if (projectId && agentId) {
            localStorage.removeItem(storageKey)
          }
          return
        }

        // Continue polling
        attempts++
        if (attempts >= maxAttempts) {
          setError('Status polling timeout. The reprocess may still be running.')
          setPolling(false)
          return
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval))
        return poll()
      } catch (err: any) {
        // Request failed - localStorage already cleared in getStatus
        setPolling(false)
        setStatus(null)
        
        // If 404, handle silently (request doesn't exist anymore)
        if (err?.status === 404) {
          return
        }
        
        // For other errors, show error message
        setError(err instanceof Error ? err.message : 'Failed to poll status')
      }
    }

    return poll()
  }

  const getStatusIcon = () => {
    if (!status) return null
    
    switch (status.status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
      case 'preparing':
        return <Clock className="w-4 h-4 text-yellow-600" />
      default:
        return <Clock className="w-4 h-4 text-gray-600" />
    }
  }

  const getStatusColor = () => {
    if (!status) return 'default'
    
    switch (status.status) {
      case 'completed':
        return 'default'
      case 'failed':
        return 'destructive'
      case 'processing':
        return 'default'
      default:
        return 'secondary'
    }
  }

  const formatDateRange = () => {
    if (!dateRange?.from) {
      return 'Select date range'
    }
    if (dateRange.from && !dateRange.to) {
      return formatDate(dateRange.from, 'MMM dd, yyyy')
    }
    if (dateRange.from && dateRange.to) {
      return `${formatDate(dateRange.from, 'MMM dd, yyyy')} - ${formatDate(dateRange.to, 'MMM dd, yyyy')}`
    }
    return 'Select date range'
  }

  // Check if analysis is running (not completed or failed)
  const isAnalysisRunning = Boolean(status && status.status !== 'completed' && status.status !== 'failed')

  return (
    <div className="space-y-6">
      {/* Show form only when no active analysis */}
      {!isAnalysisRunning && (
        <Card className="border-gray-200 dark:border-gray-800">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Re-analyze Call Logs
            </CardTitle>
            <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
              Update transcription metrics and analytics for historical call logs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Date Range Picker */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Date Range
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-11",
                      !dateRange && "text-muted-foreground"
                    )}
                    disabled={loading || polling}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {formatDateRange()}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    disabled={(date) => date > new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Analysis Type */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Scope
              </Label>
              <Select
                value={reprocessType}
                onValueChange={(value: 'empty_only' | 'all') => setReprocessType(value)}
                disabled={loading || polling}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="empty_only">Update Missing Data Only</SelectItem>
                  <SelectItem value="all">Re-analyze All Logs</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Analysis Options */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Analysis Type
              </Label>
              <Select
                value={reprocessOptions}
                onValueChange={(value: 'transcription' | 'metrics' | 'both') => {
                  setReprocessOptions(value)
                  // Clear field selections when changing analysis type
                  if (value === 'transcription') {
                    setMetricsFields([])
                  } else if (value === 'metrics') {
                    setTranscriptionFields([])
                  }
                }}
                disabled={loading || polling}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transcription">Transcription Only</SelectItem>
                  <SelectItem value="metrics">Metrics Only</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Transcription Fields Selection */}
            {(reprocessOptions === 'transcription' || reprocessOptions === 'both') && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Transcription Fields (Optional)
                </Label>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Select specific fields to reprocess. Leave empty to process all fields.
                </div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {loadingFields ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading fields...
                    </div>
                  ) : availableTranscriptionFields.length > 0 ? (
                    availableTranscriptionFields.map((field) => (
                      <div key={field} className="flex items-center space-x-2">
                        <Checkbox
                          id={`transcription-${field}`}
                          checked={transcriptionFields.includes(field)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setTranscriptionFields([...transcriptionFields, field])
                            } else {
                              setTranscriptionFields(transcriptionFields.filter(f => f !== field))
                            }
                          }}
                          disabled={loading || polling}
                        />
                        <label
                          htmlFor={`transcription-${field}`}
                          className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer flex-1"
                        >
                          {field}
                        </label>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                      No transcription fields configured for this agent. Configure field extractor in agent settings.
                    </div>
                  )}
                </div>
                {transcriptionFields.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {transcriptionFields.map((field) => (
                      <Badge key={field} variant="secondary" className="text-xs">
                        {field}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Metrics Fields Selection */}
            {(reprocessOptions === 'metrics' || reprocessOptions === 'both') && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Metrics Fields (Optional)
                </Label>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Select specific metrics to reprocess. Leave empty to process all metrics.
                </div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {loadingFields ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading fields...
                    </div>
                  ) : availableMetricsFields.length > 0 ? (
                    availableMetricsFields.map((field) => (
                      <div key={field} className="flex items-center space-x-2">
                        <Checkbox
                          id={`metrics-${field}`}
                          checked={metricsFields.includes(field)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setMetricsFields([...metricsFields, field])
                            } else {
                              setMetricsFields(metricsFields.filter(f => f !== field))
                            }
                          }}
                          disabled={loading || polling}
                        />
                        <label
                          htmlFor={`metrics-${field}`}
                          className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer flex-1"
                        >
                          {field}
                        </label>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                      No metrics configured for this agent. Configure metrics in agent settings.
                    </div>
                  )}
                </div>
                {metricsFields.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {metricsFields.map((field) => (
                      <Badge key={field} variant="secondary" className="text-xs">
                        {field}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Log Count Display */}
            {logCount !== null && !counting && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Call Logs to Process
                    </span>
                  </div>
                  <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                    {logCount.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {counting && (
              <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Counting call logs...
                  </span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button
              onClick={triggerReanalysis}
              disabled={loading || polling || !dateRange?.from || !dateRange?.to || isAnalysisRunning || counting}
              className="w-full h-11 text-base font-medium"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Starting Analysis...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Start Re-analysis
                </>
              )}
            </Button>

            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status Display - Show when analysis is running or completed/failed */}
      {status && (
        <Card className={cn(
          "border-blue-200 dark:border-blue-800",
          isAnalysisRunning ? "bg-blue-50/30 dark:bg-blue-950/10" : "bg-gray-50/30 dark:bg-gray-950/10"
        )}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {getStatusIcon()}
                Status: <Badge variant={getStatusColor()} className="ml-1 capitalize">{status.status}</Badge>
              </CardTitle>
              {!isAnalysisRunning && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStatus(null)
                    setError(null)
                    setPolling(false)
                    // Clear storage when starting new analysis
                    if (projectId && agentId) {
                      localStorage.removeItem(storageKey)
                    }
                  }}
                  className="h-8 text-xs"
                >
                  New Analysis
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{status.progress_percentage}%</span>
                  </div>
                  <Progress value={status.progress_percentage} />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Logs Processed</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {status.logs_processed.toLocaleString()} <span className="text-sm font-normal text-gray-500">/ {status.total_logs.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Batches Completed</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {status.batches_completed} <span className="text-sm font-normal text-gray-500">/ {status.total_batches}</span>
                    </div>
                  </div>
                  {status.logs_failed > 0 && (
                    <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
                      <div className="text-xs text-red-600 dark:text-red-400 mb-1">Logs Failed</div>
                      <div className="text-lg font-semibold text-red-700 dark:text-red-300">{status.logs_failed}</div>
                    </div>
                  )}
                  {status.estimated_time_remaining_minutes && (
                    <div className="bg-white dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Est. Time Remaining</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {status.estimated_time_remaining_minutes} <span className="text-sm font-normal">min</span>
                      </div>
                    </div>
                  )}
                </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

