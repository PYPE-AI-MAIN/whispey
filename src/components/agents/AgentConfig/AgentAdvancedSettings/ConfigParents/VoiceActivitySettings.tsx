'use client'

import React, { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Switch } from '@/components/ui/switch'

interface VoiceActivitySettingsProps {
  vadProvider: string
  minSilenceDuration: number
  minSpeechDuration?: number
  prefixPaddingDuration?: number
  maxBufferedSpeech?: number
  activationThreshold?: number
  sampleRate?: 8000 | 16000
  forceCpu?: boolean
  onFieldChange: (field: string, value: any) => void
}

function VoiceActivitySettings({
  vadProvider,
  minSilenceDuration,
  minSpeechDuration = 0.05,
  prefixPaddingDuration = 0.5,
  maxBufferedSpeech = 60.0,
  activationThreshold = 0.5,
  sampleRate = 16000,
  forceCpu = true,
  onFieldChange
}: VoiceActivitySettingsProps) {
  // Local state for input values to handle intermediate states
  const [minSilenceInput, setMinSilenceInput] = useState(String(minSilenceDuration))
  const [minSpeechInput, setMinSpeechInput] = useState(String(minSpeechDuration))
  const [prefixPaddingInput, setPrefixPaddingInput] = useState(String(prefixPaddingDuration))
  const [maxBufferedInput, setMaxBufferedInput] = useState(String(maxBufferedSpeech))
  const [activationInput, setActivationInput] = useState(String(activationThreshold))

  // Sync with props when they change externally
  useEffect(() => {
    setMinSilenceInput(String(minSilenceDuration))
  }, [minSilenceDuration])

  useEffect(() => {
    setMinSpeechInput(String(minSpeechDuration))
  }, [minSpeechDuration])

  useEffect(() => {
    setPrefixPaddingInput(String(prefixPaddingDuration))
  }, [prefixPaddingDuration])

  useEffect(() => {
    setMaxBufferedInput(String(maxBufferedSpeech))
  }, [maxBufferedSpeech])

  useEffect(() => {
    setActivationInput(String(activationThreshold))
  }, [activationThreshold])

  const handleNumberInput = (
    value: string,
    field: string,
    setter: (val: string) => void,
    min: number = 0,
    max?: number
  ) => {
    if (value === '' || value === '.' || value === '0.') {
      setter(value)
      return
    }

    if (value.endsWith('.') && !isNaN(parseFloat(value.slice(0, -1)))) {
      setter(value)
      return
    }

    const numValue = parseFloat(value)
    if (isNaN(numValue)) {
      return
    }

    setter(value)

    let constrainedValue = numValue
    if (constrainedValue < min) constrainedValue = min
    if (max !== undefined && constrainedValue > max) constrainedValue = max

    onFieldChange(field, constrainedValue)
  }

  const handleBlur = (
    value: string,
    field: string,
    setter: (val: string) => void,
    defaultValue: number,
    min: number = 0,
    max?: number
  ) => {
    if (value === '' || value === '.' || isNaN(parseFloat(value))) {
      setter(String(defaultValue))
      onFieldChange(field, defaultValue)
      return
    }

    if (value.endsWith('.')) {
      const cleanValue = value.slice(0, -1) || String(defaultValue)
      setter(cleanValue)
      onFieldChange(field, parseFloat(cleanValue))
      return
    }

    let numValue = parseFloat(value)
    if (numValue < min) numValue = min
    if (max !== undefined && numValue > max) numValue = max
    
    setter(String(numValue))
    onFieldChange(field, numValue)
  }

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
          Configure voice activity detection settings
        </div>
        
        {/* VAD Provider */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
            VAD Provider
          </Label>
          <Select 
            value={vadProvider} 
            onValueChange={(value) => onFieldChange('advancedSettings.vad.vadProvider', value)}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Select VAD provider..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="silero" className="text-xs">Silero</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Min Silence Duration */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Min Silence Duration (seconds)
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">
                  Duration of silence to wait after speech ends to determine if the user has finished speaking. Default: 0.55
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={minSilenceInput}
            onChange={(e) => handleNumberInput(
              e.target.value,
              'advancedSettings.vad.minSilenceDuration',
              setMinSilenceInput,
              0
            )}
            onBlur={(e) => handleBlur(
              e.target.value,
              'advancedSettings.vad.minSilenceDuration',
              setMinSilenceInput,
              0.55,
              0
            )}
            className="h-7 text-xs"
            placeholder="0.55"
          />
        </div>

        {/* Min Speech Duration */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Min Speech Duration (seconds)
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">
                  Minimum duration of speech required to start a new speech chunk. Default: 0.05
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={minSpeechInput}
            onChange={(e) => handleNumberInput(
              e.target.value,
              'advancedSettings.vad.minSpeechDuration',
              setMinSpeechInput,
              0
            )}
            onBlur={(e) => handleBlur(
              e.target.value,
              'advancedSettings.vad.minSpeechDuration',
              setMinSpeechInput,
              0.05,
              0
            )}
            className="h-7 text-xs"
            placeholder="0.05"
          />
        </div>

        {/* Prefix Padding Duration */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Prefix Padding Duration (seconds)
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">
                  Duration of padding to add to the beginning of each speech chunk. Default: 0.5
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={prefixPaddingInput}
            onChange={(e) => handleNumberInput(
              e.target.value,
              'advancedSettings.vad.prefixPaddingDuration',
              setPrefixPaddingInput,
              0
            )}
            onBlur={(e) => handleBlur(
              e.target.value,
              'advancedSettings.vad.prefixPaddingDuration',
              setPrefixPaddingInput,
              0.5,
              0
            )}
            className="h-7 text-xs"
            placeholder="0.5"
          />
        </div>

        {/* Max Buffered Speech */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Max Buffered Speech (seconds)
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">
                  Maximum duration of speech to keep in the buffer. Default: 60.0
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            type="number"
            step="0.1"
            min="0"
            value={maxBufferedInput}
            onChange={(e) => handleNumberInput(
              e.target.value,
              'advancedSettings.vad.maxBufferedSpeech',
              setMaxBufferedInput,
              0
            )}
            onBlur={(e) => handleBlur(
              e.target.value,
              'advancedSettings.vad.maxBufferedSpeech',
              setMaxBufferedInput,
              60.0,
              0
            )}
            className="h-7 text-xs"
            placeholder="60.0"
          />
        </div>

        {/* Activation Threshold */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Activation Threshold
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">
                  Threshold to consider a frame as speech (0.0-1.0). Higher = more conservative, lower = more sensitive. Default: 0.5
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={activationInput}
            onChange={(e) => handleNumberInput(
              e.target.value,
              'advancedSettings.vad.activationThreshold',
              setActivationInput,
              0,
              1
            )}
            onBlur={(e) => handleBlur(
              e.target.value,
              'advancedSettings.vad.activationThreshold',
              setActivationInput,
              0.5,
              0,
              1
            )}
            className="h-7 text-xs"
            placeholder="0.5"
          />
        </div>

        {/* Sample Rate */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Sample Rate (Hz)
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">
                  Sample rate for inference. Only 8000 or 16000 are supported. Default: 16000
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Select 
            value={String(sampleRate)} 
            onValueChange={(value) => onFieldChange('advancedSettings.vad.sampleRate', parseInt(value) as 8000 | 16000)}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="8000" className="text-xs">8000 Hz</SelectItem>
              <SelectItem value="16000" className="text-xs">16000 Hz</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Force CPU */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Force CPU
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 text-gray-400 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs">
                  <p className="text-xs">
                    Force the use of CPU for inference. Default: true
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Switch
              checked={forceCpu}
              onCheckedChange={(checked) => onFieldChange('advancedSettings.vad.forceCpu', checked)}
            />
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

export default VoiceActivitySettings