// src/components/reprocess/ReprocessCallLogs.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Sparkles, AlertCircle, CalendarDays, CheckCircle } from 'lucide-react'
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

interface ReanalyzeCallLogsProps {
  projectId?: string
  agentId?: string
  isDialogOpen?: boolean | null
}

export default function ReanalyzeCallLogs({ projectId, agentId, isDialogOpen }: ReanalyzeCallLogsProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
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
    if (dateRange?.from && dateRange?.to && !success) {
      fetchLogCount()
    } else {
      setLogCount(null)
    }
  }, [dateRange, reprocessType, reprocessOptions, transcriptionFields, metricsFields, agentId, projectId, success])

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

  const triggerReanalysis = async () => {
    setLoading(true)
    setError(null)
    setSuccess(false)

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

      // Show success message
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start reanalysis')
    } finally {
      setLoading(false)
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

  return (
    <div className="space-y-6">
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
                    disabled={loading || success}
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
                disabled={loading || success}
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
                disabled={loading || success}
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
                          disabled={loading || success}
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
                          disabled={loading || success}
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
              disabled={loading || success || !dateRange?.from || !dateRange?.to || counting}
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

            {/* Success Display */}
            {success && (
              <Alert className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  <div className="font-medium mb-1">Analysis started successfully!</div>
                  <div className="text-sm mb-3">
                    The re-analysis process has been initiated. This may take a few minutes to complete. 
                    The results will be updated automatically when processing is finished.
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSuccess(false)
                      setError(null)
                    }}
                    className="mt-2"
                  >
                    Start New Analysis
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
    </div>
  )
}

