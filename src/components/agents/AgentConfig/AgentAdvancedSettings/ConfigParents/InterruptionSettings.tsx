'use client'

import React, { useState } from 'react'
import { X } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
  onFieldChange: (field: string, value: any) => void
}

function InterruptionSettings({
  allowInterruptions,
  minInterruptionDuration,
  minInterruptionWords,
  dropFillerWords = false,
  fillerDropList = [],
  onFieldChange
}: InterruptionSettingsProps) {
  const [newWord, setNewWord] = useState('')

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

  return (
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

      {/* Min Interruption Duration */}
      {allowInterruptions && <div className="space-y-1.5">
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
            // Allow any value during typing, including empty string
            const value = e.target.value;
            if (value === '') {
              onFieldChange('advancedSettings.interruption.minInterruptionDuration', 0);
            } else {
              onFieldChange('advancedSettings.interruption.minInterruptionDuration', parseFloat(value));
            }
          }}
          onBlur={(e) => {
            // Enforce minimum value when user clicks outside
            const value = parseFloat(e.target.value);
            if (isNaN(value) || value < 0.1) {
              onFieldChange('advancedSettings.interruption.minInterruptionDuration', 0.1);
            }
          }}
          className="h-7 text-xs"
          disabled={!allowInterruptions}
        />
      </div>}

      {/* Min Interruption Words */}
      {allowInterruptions && <div className="space-y-1.5">
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
          disabled={!allowInterruptions}
        />
      </div>}

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
  )
}

export default InterruptionSettings