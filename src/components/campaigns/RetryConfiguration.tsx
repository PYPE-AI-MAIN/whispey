// components/campaigns/RetryConfiguration.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw, Info, Plus, X, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RetryConfig } from '@/utils/campaigns/constants'
import { supabase } from '@/lib/supabase'

interface RetryConfigurationProps {
  onFieldChange: (field: string, value: any) => void
  values: {
    retryConfig: RetryConfig[]
    agentId?: string
  }
}

export function RetryConfiguration({ onFieldChange, values }: RetryConfigurationProps) {
  const [availableMetrics, setAvailableMetrics] = useState<string[]>([])
  const [availableFields, setAvailableFields] = useState<string[]>([])
  const [loadingFields, setLoadingFields] = useState(false)

  const errorCodeLabels: { [key: string]: string } = {
    '408': 'Request Timeout',
    '480': 'Temporarily Unavailable',
    '486': 'Busy Here',
    '500': 'Server Internal Error',
    '503': 'Service Unavailable',
  }

  // Fetch agent metrics and field extractor fields
  useEffect(() => {
    if (values.agentId) {
      fetchAgentFields()
    } else {
      setAvailableMetrics([])
      setAvailableFields([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.agentId])

  const fetchAgentFields = async () => {
    if (!values.agentId) {
      console.log('No agentId provided, clearing fields')
      setAvailableMetrics([])
      setAvailableFields([])
      return
    }

    console.log('Fetching agent fields for agentId:', values.agentId)
    setLoadingFields(true)
    try {
      // First try with metrics column
      let agent: any = null
      let { data, error } = await supabase
        .from('pype_voice_agents')
        .select('field_extractor_prompt, metrics, configuration')
        .eq('id', values.agentId)
        .single()

      // If metrics column doesn't exist, try without it
      if (error && error.code === '42703') {
        console.log('Metrics column not found, trying without it and checking configuration...')
        const { data: data2, error: error2 } = await supabase
          .from('pype_voice_agents')
          .select('field_extractor_prompt, configuration')
          .eq('id', values.agentId)
          .single()
        
        if (error2) {
          console.error('Error fetching agent config:', error2)
          setAvailableMetrics([])
          setAvailableFields([])
          return
        }
        
        agent = data2
        // Try to extract metrics from configuration if it exists
        if (agent?.configuration && typeof agent.configuration === 'object') {
          const config = agent.configuration as any
          if (config.metrics) {
            agent.metrics = config.metrics
          }
        }
      } else if (error) {
        console.error('Error fetching agent config:', error)
        setAvailableMetrics([])
        setAvailableFields([])
        return
      } else {
        agent = data
      }

      if (!agent) {
        console.error('No agent data found')
        setAvailableMetrics([])
        setAvailableFields([])
        return
      }

      console.log('Agent data fetched:', { 
        hasFieldExtractor: !!agent?.field_extractor_prompt,
        hasMetrics: !!agent?.metrics,
        metricsType: typeof agent?.metrics
      })

      // Extract transcription fields from field_extractor_prompt
      if (agent?.field_extractor_prompt) {
        try {
          let promptConfig: any
          const prompt = agent.field_extractor_prompt
          
          if (typeof prompt === 'string') {
            promptConfig = JSON.parse(prompt)
          } else if (Array.isArray(prompt)) {
            promptConfig = prompt
          } else {
            console.log('field_extractor_prompt is not string or array:', typeof prompt)
            setAvailableFields([])
            return
          }
          
          if (Array.isArray(promptConfig)) {
            const fields = promptConfig
              .filter((p: any) => p.key && typeof p.key === 'string')
              .map((p: any) => p.key)
            console.log('Extracted field extractor fields:', fields)
            setAvailableFields(fields.sort())
          } else {
            console.log('promptConfig is not an array:', promptConfig)
            setAvailableFields([])
          }
        } catch (e) {
          console.error('Error parsing field_extractor_prompt:', e)
          setAvailableFields([])
        }
      } else {
        console.log('No field_extractor_prompt found')
        setAvailableFields([])
      }

      // Extract metrics fields from metrics
      if (agent?.metrics) {
        try {
          let metricsConfig: any
          if (typeof agent.metrics === 'string') {
            metricsConfig = JSON.parse(agent.metrics)
          } else {
            metricsConfig = agent.metrics
          }
          
          console.log('Parsed metrics config:', metricsConfig)
          
          if (typeof metricsConfig === 'object' && metricsConfig !== null) {
            const metricIds = Object.keys(metricsConfig)
              .filter(key => {
                const metric = metricsConfig[key]
                // Check if metric is enabled (could be object with enabled property, or just truthy)
                return metric && (metric.enabled !== false)
              })
            console.log('Extracted metric IDs:', metricIds)
            setAvailableMetrics(metricIds.sort())
          } else {
            console.log('metricsConfig is not an object:', typeof metricsConfig)
            setAvailableMetrics([])
          }
        } catch (e) {
          console.error('Error parsing metrics:', e)
          setAvailableMetrics([])
        }
      } else {
        console.log('No metrics found in agent config')
        setAvailableMetrics([])
      }
    } catch (err) {
      console.error('Error fetching agent fields:', err)
      setAvailableMetrics([])
      setAvailableFields([])
    } finally {
      setLoadingFields(false)
    }
  }

  const handleRetryChange = (index: number, field: keyof RetryConfig, value: any) => {
    const updatedConfig = [...values.retryConfig]
    updatedConfig[index] = {
      ...updatedConfig[index],
      [field]: value
    }
    onFieldChange('retryConfig', updatedConfig)
  }

  const addRetryConfig = () => {
    const newConfig: RetryConfig = {
      type: 'sipCode',
      errorCodes: ['480'],
      delayMinutes: 5,
      maxRetries: 2,
    }
    onFieldChange('retryConfig', [...values.retryConfig, newConfig])
  }

  const removeRetryConfig = (index: number) => {
    const updatedConfig = values.retryConfig.filter((_, i) => i !== index)
    onFieldChange('retryConfig', updatedConfig)
  }

  // Debug: Log current state
  useEffect(() => {
    console.log('RetryConfiguration state:', {
      agentId: values.agentId,
      availableMetrics: availableMetrics.length,
      availableFields: availableFields.length,
      loadingFields
    })
  }, [values.agentId, availableMetrics, availableFields, loadingFields])

  return (
    <div className="space-y-3 p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          <Label className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Retry Configuration
          </Label>
          {!values.agentId && (
            <span className="text-xs text-amber-600 dark:text-amber-400 ml-2">
              (Select an agent first)
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRetryConfig}
          className="h-8 text-xs"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Retry Rule
        </Button>
      </div>

      <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
          Configure retry behavior for different error codes. Each error code can have its own retry settings. You can also add metric or field extractor based retries.
        </AlertDescription>
      </Alert>

      {/* Retry Configurations */}
      <div className="space-y-3">
        {values.retryConfig.map((config, index) => {
          // For backward compatibility: if type is not set, assume it's sipCode
          const retryType = config.type || (config.errorCodes ? 'sipCode' : 'sipCode')
          const errorCode = config.errorCodes?.[0]
          const label = errorCode ? errorCodeLabels[errorCode] || errorCode : ''
          
          return (
            <div key={index} className="p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {retryType === 'sipCode' && errorCode && (
                    <>
                      <span className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {errorCode}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {label}
                      </span>
                    </>
                  )}
                  {retryType === 'metric' && (
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Metric: {config.metricName || 'Not selected'}
                    </span>
                  )}
                  {retryType === 'fieldExtractor' && (
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Field: {config.fieldName || 'Not selected'}
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRetryConfig(index)}
                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Retry Type Selector - show for all items */}
              <div className="mb-3">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                  Retry Type
                </Label>
                <Select
                  value={retryType}
                  onValueChange={(value: 'sipCode' | 'metric' | 'fieldExtractor') => {
                    // Create a new config based on the selected type, preserving common fields
                    const updatedConfig = [...values.retryConfig]
                    
                    // Clear type-specific fields and set defaults based on new type
                    if (value === 'sipCode') {
                      updatedConfig[index] = {
                        type: 'sipCode',
                        errorCodes: config.errorCodes && config.errorCodes.length > 0 ? config.errorCodes : ['480'],
                        delayMinutes: config.delayMinutes || 5,
                        maxRetries: config.maxRetries || 2,
                      } as unknown as RetryConfig
                    } else if (value === 'metric') {
                      // Remove errorCodes for metric type
                      const newConfig: any = {
                        type: 'metric',
                        operator: '<',
                        threshold: 0.5,
                        delayMinutes: config.delayMinutes || 5,
                        maxRetries: config.maxRetries || 2,
                      }
                      if (availableMetrics.length > 0) {
                        newConfig.metricName = availableMetrics[0]
                      }
                      updatedConfig[index] = newConfig as unknown as RetryConfig
                    } else if (value === 'fieldExtractor') {
                      // Remove errorCodes for fieldExtractor type
                      const newConfig: any = {
                        type: 'fieldExtractor',
                        operator: 'missing',
                        delayMinutes: config.delayMinutes || 5,
                        maxRetries: config.maxRetries || 2,
                      }
                      if (availableFields.length > 0) {
                        newConfig.fieldName = availableFields[0]
                      }
                      updatedConfig[index] = newConfig as unknown as RetryConfig
                    }
                    
                    onFieldChange('retryConfig', updatedConfig)
                  }}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sipCode">SIP Code</SelectItem>
                    <SelectItem value="metric">Metric</SelectItem>
                    <SelectItem value="fieldExtractor">Field Extractor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* SIP Code Fields - support multiple error codes */}
              {retryType === 'sipCode' && (
                <div className="mb-3">
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                    SIP Error Codes (comma-separated)
                  </Label>
                  <Input
                    type="text"
                    value={config.errorCodes?.join(', ') || ''}
                    onChange={(e) => {
                      const codes = e.target.value
                        .split(',')
                        .map(s => s.trim())
                        .filter(s => s.length > 0)
                      handleRetryChange(index, 'errorCodes', codes)
                    }}
                    className="h-9 text-sm"
                    placeholder="408, 480, 486"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Common codes: 408 (Timeout), 480 (Unavailable), 486 (Busy), 500 (Server Error), 503 (Service Unavailable)
                  </p>
                </div>
              )}

                {/* Metric Fields */}
                {config.type === 'metric' && (
                  <>
                    <div>
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                        Metric Name
                      </Label>
                      {loadingFields ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading metrics...
                        </div>
                      ) : availableMetrics.length > 0 ? (
                        <Select
                          value={config.metricName || ''}
                          onValueChange={(value) => {
                            handleRetryChange(index, 'metricName', value)
                          }}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select metric" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableMetrics.map((metric) => (
                              <SelectItem key={metric} value={metric}>
                                {metric}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          No metrics configured for this agent. Configure metrics in agent settings.
                        </div>
                      )}
                    </div>

                    {config.metricName && (
                      <>
                        <div>
                          <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                            Operator
                          </Label>
                          <Select
                            value={config.operator || '<'}
                            onValueChange={(value: '<' | '>' | '<=' | '>=' | '==' | '!=') => {
                              handleRetryChange(index, 'operator', value)
                            }}
                          >
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="<">Less than (&lt;)</SelectItem>
                              <SelectItem value=">">Greater than (&gt;)</SelectItem>
                              <SelectItem value="<=">Less than or equal (&lt;=)</SelectItem>
                              <SelectItem value=">=">Greater than or equal (&gt;=)</SelectItem>
                              <SelectItem value="==">Equal (==)</SelectItem>
                              <SelectItem value="!=">Not equal (!=)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                            Threshold
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={config.threshold ?? 0.5}
                            onChange={(e) => {
                              handleRetryChange(index, 'threshold', parseFloat(e.target.value) || 0)
                            }}
                            className="h-9 text-sm"
                            placeholder="0.5"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Retry if metric value {config.operator || '<'} threshold (e.g., 0.5 for scores, 70 for percentages)
                          </p>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Field Extractor Fields */}
                {config.type === 'fieldExtractor' && (
                  <>
                    <div>
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                        Field Name
                      </Label>
                      {loadingFields ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading fields...
                        </div>
                      ) : availableFields.length > 0 ? (
                        <Select
                          value={config.fieldName || ''}
                          onValueChange={(value) => {
                            handleRetryChange(index, 'fieldName', value)
                          }}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select field" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableFields.map((field) => (
                              <SelectItem key={field} value={field}>
                                {field}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          No field extractor fields configured for this agent. Configure field extractor in agent settings.
                        </div>
                      )}
                    </div>

                    {config.fieldName && (
                      <>
                        <div>
                          <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                            Operator
                          </Label>
                          <Select
                            value={config.operator || 'missing'}
                            onValueChange={(value: 'missing' | 'equals' | 'not_equals' | 'contains' | 'not_contains') => {
                              handleRetryChange(index, 'operator', value)
                              if (value === 'missing') {
                                handleRetryChange(index, 'expectedValue', undefined)
                              }
                            }}
                          >
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="missing">Missing</SelectItem>
                              <SelectItem value="equals">Equals</SelectItem>
                              <SelectItem value="not_equals">Not Equals</SelectItem>
                              <SelectItem value="contains">Contains</SelectItem>
                              <SelectItem value="not_contains">Not Contains</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {config.operator && (config.operator as string) !== 'missing' && (
                          <div>
                            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                              Expected Value
                            </Label>
                            <Input
                              type="text"
                              value={config.expectedValue || ''}
                              onChange={(e) => {
                                handleRetryChange(index, 'expectedValue', e.target.value)
                              }}
                              className="h-9 text-sm"
                              placeholder="Enter expected value"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}

              {/* Common Fields: Delay and Max Retries - keep original structure */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                    Delay (minutes)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max="1440"
                    value={config.delayMinutes || 0}
                    onChange={(e) => handleRetryChange(index, 'delayMinutes', parseInt(e.target.value) || 0)}
                    className="h-8 text-xs"
                    placeholder="30"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    0-1440 min
                  </p>
                </div>

                <div>
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                    Max Retries
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    value={config.maxRetries || 0}
                    onChange={(e) => handleRetryChange(index, 'maxRetries', parseInt(e.target.value) || 0)}
                    className="h-8 text-xs"
                    placeholder="2"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    0-10 attempts
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

