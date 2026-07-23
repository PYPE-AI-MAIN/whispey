// components/campaigns/RetryConfiguration.tsx
'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw, Info, Plus, X, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RetryConfig, VALID_SIP_ERROR_CODES, SIP_CODE_GROUPS, SipCodeGroup as SipCodeGroupType } from '@/utils/campaigns/constants'

// Chip-style input: type a value, press Enter/Add to append it (after
// validation), click the X on a chip to remove it. Used for both SIP error
// codes and backoff minutes so entries can't be silently mistyped/dropped.
function ChipInput({
  values,
  onChange,
  validate,
  formatChip,
  placeholder,
}: Readonly<{
  values: (string | number)[]
  onChange: (next: (string | number)[]) => void
  validate: (raw: string) => { value: string | number; error?: string }
  formatChip: (value: string | number) => string
  placeholder: string
}>) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Stable per-chip ids for React keys — values can repeat (a backoff
  // schedule of 5, 10, 5 is valid), so the value itself can't be a key and a
  // plain array index would shift/misattribute chips on removal.
  const nextId = useRef(0)
  const [ids, setIds] = useState<number[]>(() => values.map(() => nextId.current++))

  // Resync if `values` changed for a reason other than this component's own
  // add/remove (e.g. the parent reset the array on a retry-type switch).
  useEffect(() => {
    if (ids.length !== values.length) {
      setIds(values.map(() => nextId.current++))
    }
  }, [values.length, ids.length])

  const addChip = () => {
    const trimmed = draft.trim()
    if (!trimmed) return
    const { value, error: validationError } = validate(trimmed)
    if (validationError) {
      setError(validationError)
      return
    }
    // Duplicates are allowed on purpose — e.g. a backoff schedule of
    // 5, 10, 5, 5, 30 is a valid retry sequence, not a mistake.
    setIds(prev => [...prev, nextId.current++])
    onChange([...values, value])
    setDraft('')
    setError(null)
  }

  const removeChip = (removeIndex: number) => {
    setIds(prev => prev.filter((_, i) => i !== removeIndex))
    onChange(values.filter((_, i) => i !== removeIndex))
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {values.map((value, i) => (
          <span
            key={ids[i] ?? i}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-mono text-gray-800 dark:text-gray-200"
          >
            {formatChip(value)}
            <button
              type="button"
              onClick={() => removeChip(i)}
              className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addChip()
            }
          }}
          className="h-8 text-xs"
          placeholder={placeholder}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addChip}
          className="h-8 text-xs shrink-0"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add
        </Button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
    </div>
  )
}

// Renders SIP error codes grouped by backend outcome bucket (pype-voice-agent's
// map_sip_to_result groups these codes as the same failure type), each with a
// "select all" for multi-code groups and an info popover explaining every
// code. Pulled out of RetryConfiguration's per-rule render to keep the JSX
// nesting shallow.
function SipCodePicker({
  errorCodes,
  groups,
  isUsedElsewhere,
  onChange,
}: Readonly<{
  errorCodes: string[]
  groups: SipCodeGroupType[]
  isUsedElsewhere: (code: string) => boolean
  onChange: (next: string[]) => void
}>) {
  const toggleCode = (code: string, selected: boolean) => {
    onChange(selected ? errorCodes.filter((c) => c !== code) : [...errorCodes, code])
  }

  const selectAllInGroup = (addable: string[]) => {
    onChange(Array.from(new Set([...errorCodes, ...addable])))
  }

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1 mb-1.5">
        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 block">
          SIP Error Codes
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="shrink-0 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              aria-label="What do these codes mean?"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 text-xs" align="start">
            <div className="space-y-2">
              {VALID_SIP_ERROR_CODES.map((c) => (
                <div key={c.code}>
                  <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                    {c.code}
                  </span>{' '}
                  <span className="font-medium text-gray-900 dark:text-gray-100">{c.label}</span>
                  {!c.enabled && (
                    <span className="ml-1 text-[10px] italic text-gray-400">(coming soon)</span>
                  )}
                  <p className="text-gray-500 dark:text-gray-400">{c.description}</p>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* One section per outcome bucket — codes are toggled once here, not
          repeated in a separate summary row. "select all" only shows when a
          group has more than one code. */}
      <div className="space-y-2">
        {groups.map((group) => (
          <SipCodeGroup
            key={group.key}
            group={group}
            errorCodes={errorCodes}
            isUsedElsewhere={isUsedElsewhere}
            onToggleCode={toggleCode}
            onSelectAll={selectAllInGroup}
          />
        ))}
      </div>
    </div>
  )
}

function SipCodeGroup({
  group,
  errorCodes,
  isUsedElsewhere,
  onToggleCode,
  onSelectAll,
}: Readonly<{
  group: SipCodeGroupType
  errorCodes: string[]
  isUsedElsewhere: (code: string) => boolean
  onToggleCode: (code: string, selected: boolean) => void
  onSelectAll: (addable: string[]) => void
}>) {
  const groupCodes = group.codes
  // Only enabled, unclaimed codes can be picked up by "select all" — the
  // rest are temporarily disabled ("Coming soon") while retry-count/backoff
  // behavior is under RCA. Frontend-only gate; validation still accepts all.
  const addable = groupCodes
    .filter((c) => c.enabled && !errorCodes.includes(c.code) && !isUsedElsewhere(c.code))
    .map((c) => c.code)

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">{group.label}</span>
        {group.codes.length > 1 && (
          <button
            type="button"
            disabled={addable.length === 0}
            onClick={() => onSelectAll(addable)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
          >
            select all
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {groupCodes.map((c) => {
          const selected = errorCodes.includes(c.code)
          const usedElsewhere = !selected && isUsedElsewhere(c.code)
          const disabled = !c.enabled || usedElsewhere
          const title = !c.enabled
            ? `${c.code} — coming soon`
            : usedElsewhere
              ? `${c.code} is already used in another retry rule`
              : c.description
          return (
            <button
              key={c.code}
              type="button"
              disabled={disabled}
              title={title}
              onClick={() => onToggleCode(c.code, selected)}
              className={
                selected
                  ? 'px-2 py-1 rounded-md border text-xs font-mono bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                  : 'px-2 py-1 rounded-md border text-xs font-mono border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent'
              }
            >
              {c.code} — {c.label}
              {!c.enabled && <span className="ml-1 text-[10px] italic">(coming soon)</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface RetryConfigurationProps {
  onFieldChange: (field: string, value: any) => void
  values: {
    retryConfig: RetryConfig[]
    agentId?: string
    agentRuntime?: 'livekit' | 'pipecat' | 'acefone_bridge'
  }
}

export function RetryConfiguration({ onFieldChange, values }: RetryConfigurationProps) {
  const [availableMetrics, setAvailableMetrics] = useState<string[]>([])
  const [availableFields, setAvailableFields] = useState<string[]>([])
  const [loadingFields, setLoadingFields] = useState(false)

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
    if (!values.agentId || values.agentRuntime === 'pipecat') {
      console.log('No agentId or pipecat runtime, clearing fields')
      setAvailableMetrics([])
      setAvailableFields([])
      return
    }

    console.log('Fetching agent fields for agentId:', values.agentId)
    setLoadingFields(true)
    try {
      const res = await fetch(`/api/agents/${values.agentId}`)
      const agent = (await res.json()) as Record<string, unknown> & {
        field_extractor_prompt?: unknown
        metrics?: unknown
        configuration?: unknown
      }
      if (!res.ok) {
        console.error('Error fetching agent config:', agent)
        setAvailableMetrics([])
        setAvailableFields([])
        return
      }

      if (agent?.configuration && typeof agent.configuration === 'object' && !agent.metrics) {
        const config = agent.configuration as { metrics?: unknown }
        if (config.metrics) {
          agent.metrics = config.metrics
        }
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
    // Start with no codes rather than a hardcoded default — a default like
    // ['480', '486'] would immediately collide with an existing rule that
    // already covers those codes, since a code can only belong to one rule.
    const newConfig: RetryConfig = {
      type: 'sipCode',
      errorCodes: [],
      delayMinutes: 5,
      maxRetries: 2,
    }
    onFieldChange('retryConfig', [...values.retryConfig, newConfig])
  }

  // A SIP code can only belong to one retry rule at a time — otherwise it's
  // ambiguous which rule's delay/maxRetries/backoff governs a call that hits
  // that code.
  const isSipCodeUsedElsewhere = (code: string, currentIndex: number) =>
    values.retryConfig.some((cfg, i) => {
      if (i === currentIndex) return false
      const isSipCode = cfg.type === 'sipCode' || !cfg.type
      return isSipCode && Array.isArray(cfg.errorCodes) && cfg.errorCodes.includes(code)
    })

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
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
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

          return (
            <div key={index} className="p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Retry Config #{index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRetryConfig(index)}
                  className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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
                      // No hardcoded default codes — ['480', '486'] would
                      // collide with another rule that already claims them,
                      // since a code can only belong to one rule.
                      updatedConfig[index] = {
                        type: 'sipCode',
                        errorCodes: config.errorCodes && config.errorCodes.length > 0 ? config.errorCodes : [],
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
                <SipCodePicker
                  errorCodes={config.errorCodes || []}
                  groups={SIP_CODE_GROUPS}
                  isUsedElsewhere={(code) => isSipCodeUsedElsewhere(code, index)}
                  onChange={(codes) => handleRetryChange(index, 'errorCodes', codes)}
                />
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

              {/* Retry timing — Fixed delay vs Backoff schedule (mutually exclusive) */}
              {(() => {
                const isBackoff = Array.isArray(config.backoffMinutes) && config.backoffMinutes.length > 0
                return (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                      Retry Timing
                    </Label>
                    <div className="flex items-center gap-4 text-xs text-gray-700 dark:text-gray-300">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name={`retry-mode-${index}`}
                          checked={!isBackoff}
                          onChange={() => {
                            // switch to fixed mode — clear backoffMinutes
                            const updated = [...values.retryConfig]
                            const next = { ...updated[index] } as RetryConfig
                            delete next.backoffMinutes
                            // ensure fixed-mode defaults exist
                            if (typeof next.delayMinutes !== 'number') next.delayMinutes = 5
                            if (typeof next.maxRetries !== 'number') next.maxRetries = 2
                            updated[index] = next
                            onFieldChange('retryConfig', updated)
                          }}
                          className="cursor-pointer"
                        />
                        Fixed delay
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name={`retry-mode-${index}`}
                          checked={isBackoff}
                          onChange={() => {
                            // switch to backoff mode — seed sensible default
                            handleRetryChange(index, 'backoffMinutes', [5, 10, 30])
                          }}
                          className="cursor-pointer"
                        />
                        Backoff schedule
                      </label>
                    </div>

                    {!isBackoff ? (
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                            Delay (minutes)
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            max="1440"
                            value={config.delayMinutes ?? 0}
                            onChange={(e) => handleRetryChange(index, 'delayMinutes', Number.parseInt(e.target.value) || 0)}
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
                            value={config.maxRetries ?? 0}
                            onChange={(e) => handleRetryChange(index, 'maxRetries', Number.parseInt(e.target.value) || 0)}
                            className="h-8 text-xs"
                            placeholder="2"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            0-10 attempts
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-1">
                        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                          Backoff schedule (minutes)
                        </Label>
                        <ChipInput
                          values={config.backoffMinutes || []}
                          onChange={(minutes) => handleRetryChange(index, 'backoffMinutes', minutes)}
                          validate={(raw) => {
                            const n = Number.parseInt(raw, 10)
                            if (!Number.isFinite(n) || String(n) !== raw) {
                              return { value: n, error: 'Enter a whole number' }
                            }
                            if (n < 5 || n > 1440) {
                              return { value: n, error: 'Must be between 5 and 1440 minutes' }
                            }
                            if ((config.backoffMinutes || []).length >= 10) {
                              return { value: n, error: 'Backoff schedule cannot have more than 10 entries' }
                            }
                            return { value: n }
                          }}
                          formatChip={(n) => `${n} min`}
                          placeholder="Type minutes, e.g. 30"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Entries are used in the order you add them. Attempt 1 waits{' '}
                          {(config.backoffMinutes || [])[0] ?? '?'} min,
                          attempt 2 waits {(config.backoffMinutes || [])[1] ?? '?'} min, etc.
                          Total retries = {(config.backoffMinutes || []).length} (max 10).
                          Minimum 5 minutes per entry. Repeated values are allowed.
                        </p>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )
        })}
      </div>
    </div>
  )
}

