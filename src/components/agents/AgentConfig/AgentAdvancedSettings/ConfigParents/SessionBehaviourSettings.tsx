import React, { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface SessionBehaviourSettingsProps {
  preemptiveGeneration: 'enabled' | 'disabled'
  turn_detection: 'multilingual' | 'english' | 'smollm2turndetector' | 'llmturndetector' | 'smollm360m' | 'disabled'
  unlikely_threshold?: number
  min_endpointing_delay?: number
  max_endpointing_delay?: number
  user_away_timeout?: number
  user_away_timeout_message?: string
  onFieldChange: (field: string, value: any) => void
}

export default function SessionBehaviourSettings({
  preemptiveGeneration,
  turn_detection,
  unlikely_threshold = 0.6,
  min_endpointing_delay = 0.7,
  max_endpointing_delay = 0.7,
  user_away_timeout,
  user_away_timeout_message,
  onFieldChange
}: SessionBehaviourSettingsProps) {
  // Local state for input values to handle intermediate states
  const [thresholdInput, setThresholdInput] = useState(String(unlikely_threshold))
  const [minDelayInput, setMinDelayInput] = useState(String(min_endpointing_delay))
  const [maxDelayInput, setMaxDelayInput] = useState(String(max_endpointing_delay))
  const [userAwayTimeoutInput, setUserAwayTimeoutInput] = useState(user_away_timeout !== undefined && user_away_timeout !== null ? String(user_away_timeout) : '')
  const [userAwayTimeoutMessageInput, setUserAwayTimeoutMessageInput] = useState(user_away_timeout_message || '')

  // Sync with props when they change externally
  React.useEffect(() => {
    setThresholdInput(String(unlikely_threshold))
  }, [unlikely_threshold])

  React.useEffect(() => {
    setMinDelayInput(String(min_endpointing_delay))
  }, [min_endpointing_delay])

  React.useEffect(() => {
    setMaxDelayInput(String(max_endpointing_delay))
  }, [max_endpointing_delay])

  React.useEffect(() => {
    setUserAwayTimeoutInput(user_away_timeout !== undefined && user_away_timeout !== null ? String(user_away_timeout) : '')
  }, [user_away_timeout])

  React.useEffect(() => {
    setUserAwayTimeoutMessageInput(user_away_timeout_message || '')
  }, [user_away_timeout_message])

  const handleNumberInput = (
    value: string,
    field: string,
    setter: (val: string) => void,
    min: number = 0,
    max?: number
  ) => {
    // Allow empty string, single decimal point, or partial numbers
    if (value === '' || value === '.' || value === '0.') {
      setter(value)
      return
    }

    // Allow partial decimals like "0." or "1."
    if (value.endsWith('.') && !isNaN(parseFloat(value.slice(0, -1)))) {
      setter(value)
      return
    }

    // Validate it's a number
    const numValue = parseFloat(value)
    if (isNaN(numValue)) {
      return // Don't update if invalid
    }

    // Update local state
    setter(value)

    // Apply constraints and update parent
    let constrainedValue = numValue
    if (constrainedValue < min) constrainedValue = min
    if (max !== undefined && constrainedValue > max) constrainedValue = max

    onFieldChange(field, constrainedValue)
  }

  const handleBlur = (
    value: string,
    field: string,
    setter: (val: string) => void,
    min: number = 0,
    max?: number
  ) => {
    // If empty, default to 0 (not the original default value)
    if (value === '' || value === '.' || isNaN(parseFloat(value))) {
      setter('0')
      onFieldChange(field, 0)
      return
    }

    // Clean up trailing decimal point
    if (value.endsWith('.')) {
      const cleanValue = value.slice(0, -1) || '0'
      setter(cleanValue)
      onFieldChange(field, parseFloat(cleanValue))
      return
    }

    // Apply final constraints
    let numValue = parseFloat(value)
    if (numValue < min) numValue = min
    if (max !== undefined && numValue > max) numValue = max
    
    setter(String(numValue))
    onFieldChange(field, numValue)
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Preemptive Generation */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-gray-600 dark:text-gray-400">
              Preemptive Generation
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">
                  When enabled, the agent starts generating responses before the user finishes speaking, reducing latency.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Select
            value={preemptiveGeneration}
            onValueChange={(value) => 
              onFieldChange('advancedSettings.session.preemptiveGeneration', value)
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="enabled" className="text-xs">Enabled</SelectItem>
              <SelectItem value="disabled" className="text-xs">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Turn Detection */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-gray-600 dark:text-gray-400">
              Turn Detection
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">
                  Controls how the agent detects when the user has finished speaking.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Select
            value={turn_detection}
            onValueChange={(value) => 
              onFieldChange('advancedSettings.session.turn_detection', value)
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="multilingual" className="text-xs">Multilingual</SelectItem>
              <SelectItem value="english" className="text-xs">English</SelectItem>
              <SelectItem value="smollm2turndetector" className="text-xs">SmolLM2 Turn Detector</SelectItem>
              <SelectItem value="llmturndetector" className="text-xs">LLM Turn Detector</SelectItem>
              <SelectItem value="smollm360m" className="text-xs">SmolLM360M</SelectItem>
              <SelectItem value="disabled" className="text-xs">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Unlikely Threshold - Only show for English and Multilingual */}
        {(turn_detection === 'english' || turn_detection === 'multilingual') && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-gray-600 dark:text-gray-400">
                Unlikely Threshold
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 text-gray-400 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-xs">
                    Confidence threshold for detecting incomplete utterances. Range: 0.0 to 1.0. Lower values are more sensitive.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={thresholdInput}
              onChange={(e) => handleNumberInput(
                e.target.value,
                'advancedSettings.session.unlikely_threshold',
                setThresholdInput,
                0,
                1
              )}
              onBlur={(e) => handleBlur(
                e.target.value,
                'advancedSettings.session.unlikely_threshold',
                setThresholdInput,
                0,
                1
              )}
              className="h-8 text-xs"
              placeholder="0.6"
            />
          </div>
        )}

        {/* Min Endpointing Delay */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-gray-600 dark:text-gray-400">
              Min Endpointing Delay (seconds)
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">
                  Minimum silence duration (in seconds) before detecting end of user turn. Set to 0 for instant detection.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={minDelayInput}
            onChange={(e) => handleNumberInput(
              e.target.value,
              'advancedSettings.session.min_endpointing_delay',
              setMinDelayInput,
              0
            )}
            onBlur={(e) => handleBlur(
              e.target.value,
              'advancedSettings.session.min_endpointing_delay',
              setMinDelayInput,
              0
            )}
            className="h-8 text-xs"
            placeholder="0.5"
          />
        </div>

        {/* Max Endpointing Delay */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-gray-600 dark:text-gray-400">
              Max Endpointing Delay (seconds)
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">
                  Maximum silence duration (in seconds) before forcing end of user turn.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={maxDelayInput}
            onChange={(e) => handleNumberInput(
              e.target.value,
              'advancedSettings.session.max_endpointing_delay',
              setMaxDelayInput,
              0
            )}
            onBlur={(e) => handleBlur(
              e.target.value,
              'advancedSettings.session.max_endpointing_delay',
              setMaxDelayInput,
              0
            )}
            className="h-8 text-xs"
            placeholder="3"
          />
        </div>

        {/* User Away Timeout */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-gray-600 dark:text-gray-400">
              User Away Timeout (seconds)
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">
                  Time in seconds before detecting user is away. Leave empty to disable, or set to 0 to use config default.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            type="number"
            step="0.1"
            min="0"
            value={userAwayTimeoutInput}
            onChange={(e) => {
              const value = e.target.value
              setUserAwayTimeoutInput(value)
              if (value === '') {
                onFieldChange('advancedSettings.session.user_away_timeout', undefined)
              } else {
                const numValue = parseFloat(value)
                if (!isNaN(numValue) && numValue >= 0) {
                  onFieldChange('advancedSettings.session.user_away_timeout', numValue)
                }
              }
            }}
            onBlur={(e) => {
              const value = e.target.value
              if (value === '' || isNaN(parseFloat(value))) {
                setUserAwayTimeoutInput('')
                onFieldChange('advancedSettings.session.user_away_timeout', undefined)
              } else {
                const numValue = parseFloat(value)
                if (numValue < 0) {
                  setUserAwayTimeoutInput('0')
                  onFieldChange('advancedSettings.session.user_away_timeout', 0)
                } else {
                  setUserAwayTimeoutInput(String(numValue))
                  onFieldChange('advancedSettings.session.user_away_timeout', numValue)
                }
              }
            }}
            className="h-8 text-xs"
            placeholder="Leave empty to disable"
          />
        </div>

        {/* User Away Timeout Message */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-gray-600 dark:text-gray-400">
              User Away Timeout Message
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">
                  Message to speak when user goes away. Leave empty to use default message.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            type="text"
            value={userAwayTimeoutMessageInput}
            onChange={(e) => {
              const value = e.target.value
              setUserAwayTimeoutMessageInput(value)
              onFieldChange('advancedSettings.session.user_away_timeout_message', value || undefined)
            }}
            className="h-8 text-xs"
            placeholder="Are you still on the line?"
          />
        </div>
      </div>
    </TooltipProvider>
  )
}