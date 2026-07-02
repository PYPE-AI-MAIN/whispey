'use client'

import React, { useState } from 'react'
import { X, Info, AlertTriangle } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export const DEFAULT_FILLER_DROP_WORDS: string[] = [
  // Greetings
  'hello', 'hi', 'hey',
  'हेलो', 'हैलो', 'हलो', 'नमस्ते',
  // Acks / backchannels
  'hmm', 'mm', 'uh-huh', 'okay', 'ok',
  'हम्म', 'हाँ', 'haan', 'yes',
  'acha', 'अच्छा',
]

interface InterruptionSettingsProps {
  allowInterruptions: boolean
  minInterruptionDuration: number
  minInterruptionWords: number
  dropFillerWords?: boolean
  fillerDropList?: string[]
  interruption_mode?: string | null
  turn_detection?: string | null
  adaptiveMinDuration?: number
  adaptiveMinWords?: number
  adaptiveDiscardAudioIfUninterruptible?: boolean
  adaptiveResumeFalseInterruption?: boolean
  adaptiveFalseInterruptionTimeout?: number
  adaptiveBackchannelBoundaryStart?: number
  adaptiveBackchannelBoundaryEnd?: number
  onFieldChange: (field: string, value: any) => void
}

function InterruptionSettings({
  allowInterruptions,
  minInterruptionDuration,
  minInterruptionWords,
  dropFillerWords = false,
  fillerDropList = [],
  interruption_mode,
  turn_detection,
  adaptiveMinDuration = 0.5,
  adaptiveMinWords = 0,
  adaptiveDiscardAudioIfUninterruptible = true,
  adaptiveResumeFalseInterruption = true,
  adaptiveFalseInterruptionTimeout = 2.0,
  adaptiveBackchannelBoundaryStart = 1.0,
  adaptiveBackchannelBoundaryEnd = 3.5,
  onFieldChange
}: InterruptionSettingsProps) {
  const [newWord, setNewWord] = useState('')

  const isAdaptive = interruption_mode === 'adaptive'

  const handleModeChange = (mode: 'vad' | 'adaptive') => {
    onFieldChange('advancedSettings.session.interruption_mode', mode)
  }

  const addWord = () => {
    const trimmed = newWord.trim()
    if (!trimmed) return
    const normalized = trimmed.toLowerCase()
    if (fillerDropList.some(w => w.toLowerCase() === normalized)) {
      setNewWord('')
      return
    }
    onFieldChange('advancedSettings.interruption.fillerDropList', [...fillerDropList, trimmed])
    setNewWord('')
  }

  const removeWord = (word: string) => {
    onFieldChange(
      'advancedSettings.interruption.fillerDropList',
      fillerDropList.filter(w => w !== word)
    )
  }

  const restoreDefaults = () => {
    onFieldChange('advancedSettings.interruption.fillerDropList', [...DEFAULT_FILLER_DROP_WORDS])
  }

  const handleDropToggle = (checked: boolean) => {
    onFieldChange('advancedSettings.interruption.dropFillerWords', checked)
    if (checked && fillerDropList.length === 0) {
      onFieldChange('advancedSettings.interruption.fillerDropList', [...DEFAULT_FILLER_DROP_WORDS])
    }
  }

  const boundaryInvalid = adaptiveBackchannelBoundaryStart > adaptiveBackchannelBoundaryEnd

  return (
    <TooltipProvider>
    <div className="space-y-3">
      <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
        Configure interruption handling settings for your assistant
      </div>

      {/* Allow Interruptions Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Allow Interruptions
          </Label>
        </div>
        <Switch
          checked={allowInterruptions}
          onCheckedChange={(checked) => onFieldChange('advancedSettings.interruption.allowInterruptions', checked)}
          className="scale-75"
        />
      </div>

      {allowInterruptions && (
        <>
          {/* Interruption Mode — segmented control */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Interruption Mode
            </Label>
            <div className="flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden w-fit">
              <button
                type="button"
                onClick={() => handleModeChange('vad')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  !isAdaptive
                    ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                VAD
              </button>
              <button
                type="button"
                onClick={() => handleModeChange('adaptive')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-200 dark:border-gray-700 ${
                  isAdaptive
                    ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                Adaptive
              </button>
            </div>
          </div>

          {/* Min Interruption Duration & Words — VAD mode only */}
          {!isAdaptive && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Min Interruption Duration (seconds)
                </Label>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Minimum time user must speak to be considered an interruption
                </div>
                <Input
                  type="number"
                  min="0.1"
                  max="10"
                  step="0.01"
                  value={minInterruptionDuration}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value === '') {
                      onFieldChange('advancedSettings.interruption.minInterruptionDuration', 0)
                    } else {
                      onFieldChange('advancedSettings.interruption.minInterruptionDuration', parseFloat(value))
                    }
                  }}
                  onBlur={(e) => {
                    const value = parseFloat(e.target.value)
                    if (isNaN(value) || value < 0.1) {
                      onFieldChange('advancedSettings.interruption.minInterruptionDuration', 0.1)
                    }
                  }}
                  className="h-7 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Min Interruption Words
                </Label>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Minimum number of words required for a valid interruption
                </div>
                <Input
                  type="number"
                  min="0"
                  max="20"
                  step="1"
                  value={minInterruptionWords}
                  onChange={(e) => onFieldChange('advancedSettings.interruption.minInterruptionWords', parseInt(e.target.value) || 0)}
                  className="h-7 text-xs"
                />
              </div>
            </>
          )}

          {/* Adaptive settings panel */}
          {isAdaptive && (
            <div className="space-y-3">
              {turn_detection !== 'multilingual' && (
                <div className="flex items-start gap-2 p-2.5 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800">
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    Adaptive interruption works best with Turn Detection set to "Multilingual" (Session Behaviour section). Current setting may reduce accuracy.
                  </p>
                </div>
              )}
              {/* adaptive_min_duration */}
              <AdaptiveField
                label="Min Interruption Duration"
                unit="seconds"
                tooltip="Minimum speech length in seconds before it counts as a real interruption"
              >
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={adaptiveMinDuration}
                  onChange={(e) => onFieldChange('advancedSettings.interruption.adaptiveMinDuration', parseFloat(e.target.value) || 0)}
                  className="h-7 text-xs"
                />
              </AdaptiveField>

              {/* adaptive_min_words */}
              <AdaptiveField
                label="Min Interruption Words"
                unit="words"
                tooltip="Minimum number of words required to trigger an interruption. 0 lets the ML model decide"
              >
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={adaptiveMinWords}
                  onChange={(e) => onFieldChange('advancedSettings.interruption.adaptiveMinWords', parseInt(e.target.value) || 0)}
                  className="h-7 text-xs"
                />
              </AdaptiveField>

              {/* adaptive_discard_audio_if_uninterruptible */}
              <AdaptiveToggleField
                label="Discard Audio If Uninterruptible"
                tooltip="Drop buffered audio while the agent is speaking and cannot be interrupted"
                checked={adaptiveDiscardAudioIfUninterruptible}
                onCheckedChange={(v) => onFieldChange('advancedSettings.interruption.adaptiveDiscardAudioIfUninterruptible', v)}
              />

              {/* adaptive_resume_false_interruption */}
              <AdaptiveToggleField
                label="Resume After False Interruption"
                tooltip="Agent resumes its speech if the interruption turns out to be a backchannel"
                checked={adaptiveResumeFalseInterruption}
                onCheckedChange={(v) => onFieldChange('advancedSettings.interruption.adaptiveResumeFalseInterruption', v)}
              />

              {/* adaptive_false_interruption_timeout */}
              <AdaptiveField
                label="False Interruption Timeout"
                unit="seconds"
                tooltip="Seconds of silence after an interruption before it is classified as false"
              >
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={adaptiveFalseInterruptionTimeout}
                  onChange={(e) => onFieldChange('advancedSettings.interruption.adaptiveFalseInterruptionTimeout', parseFloat(e.target.value) || 0)}
                  className="h-7 text-xs"
                />
              </AdaptiveField>

              {/* adaptive_backchannel_boundary_start */}
              <AdaptiveField
                label="Backchannel Boundary Start"
                unit="seconds"
                tooltip="Suppress backchannels during the first N seconds of each agent turn"
              >
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={adaptiveBackchannelBoundaryStart}
                  onChange={(e) => onFieldChange('advancedSettings.interruption.adaptiveBackchannelBoundaryStart', parseFloat(e.target.value) || 0)}
                  className="h-7 text-xs"
                />
              </AdaptiveField>

              {/* adaptive_backchannel_boundary_end */}
              <AdaptiveField
                label="Backchannel Boundary End"
                unit="seconds"
                tooltip="Suppress backchannels during the last N seconds of each agent turn. Higher than start to account for STT timestamp inaccuracy"
              >
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={adaptiveBackchannelBoundaryEnd}
                  onChange={(e) => onFieldChange('advancedSettings.interruption.adaptiveBackchannelBoundaryEnd', parseFloat(e.target.value) || 0)}
                  className="h-7 text-xs"
                />
              </AdaptiveField>

              {/* Boundary validation hint */}
              {boundaryInvalid && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  <span>Boundary Start must be ≤ Boundary End</span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Drop Filler Words */}
      <div className="flex items-center justify-between">
        <div className="pr-4">
          <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Drop Filler Words
          </Label>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Silently drop short words (e.g. "hello", "हेलो", "hmm") spoken while the agent is thinking or speaking — prevents wasted LLM calls and mid-response restarts
          </div>
        </div>
        <Switch
          checked={dropFillerWords}
          onCheckedChange={handleDropToggle}
          className="scale-75"
        />
      </div>

      {dropFillerWords && (
        <div className="space-y-2 pl-2 border-l-2 border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Words to Drop
            </Label>
            <button
              type="button"
              onClick={restoreDefaults}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Restore defaults
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {fillerDropList.length === 0 && (
              <div className="text-xs text-gray-400 dark:text-gray-500 italic">
                No words — add one below or restore defaults
              </div>
            )}
            {fillerDropList.map((word) => (
              <span
                key={word}
                className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-200"
              >
                {word}
                <button
                  type="button"
                  onClick={() => removeWord(word)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  aria-label={`Remove ${word}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-1.5">
            <Input
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addWord()
                }
              }}
              placeholder='Add a word (e.g. "wait", "haan")'
              className="h-7 text-xs flex-1"
            />
            <button
              type="button"
              onClick={addWord}
              disabled={!newWord.trim()}
              className="h-7 px-3 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
    </TooltipProvider>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function AdaptiveField({
  label,
  unit,
  tooltip,
  children,
}: {
  label: string
  unit: string
  tooltip: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs text-gray-600 dark:text-gray-400">{label}</Label>
        <span className="text-xs text-gray-400 dark:text-gray-500">({unit})</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="w-3 h-3 text-gray-400 cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <p className="text-xs">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      {children}
    </div>
  )
}

function AdaptiveToggleField({
  label,
  tooltip,
  checked,
  onCheckedChange,
}: {
  label: string
  tooltip: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 pr-4">
        <Label className="text-xs text-gray-600 dark:text-gray-400">{label}</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="w-3 h-3 text-gray-400 cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <p className="text-xs">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="scale-75" />
    </div>
  )
}

export default InterruptionSettings
