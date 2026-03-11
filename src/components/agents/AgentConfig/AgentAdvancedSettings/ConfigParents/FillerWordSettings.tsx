'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { InfoIcon } from 'lucide-react'

interface FillerWordsSettingsProps {
  enableFillerWords: boolean
  questionKeywords: string[]
  questionFillers: string[]
  ambiguousKeywords: string[]
  ambiguousFillers: string[]
  generalFillers: string[]
  fillerCooldownSec: number
  latencyThreshold: number
  onFieldChange: (field: string, value: any) => void
}

function CommaInput({
  items,
  field,
  placeholder,
  onFieldChange,
  disabled = false,
}: {
  items: string[]
  field: string
  placeholder: string
  onFieldChange: (field: string, value: any) => void
  disabled?: boolean
}) {
  const [text, setText] = useState(items.join(', '))
  const isFocused = useRef(false)

  // Only sync from parent when the input is not being edited
  useEffect(() => {
    if (!isFocused.current) {
      setText(items.join(', '))
    }
  }, [items.join(', ')])

  const commit = (val: string) => {
    const arr = val.split(',').map((s) => s.trim()).filter(Boolean)
    onFieldChange(field, arr)
  }

  // When the input becomes disabled (keywords cleared), reset any stored text
  useEffect(() => {
    if (disabled) {
      setText('')
    }
  }, [disabled])

  return (
    <Input
      value={text}
      disabled={disabled}
      onFocus={() => { isFocused.current = true }}
      onChange={(e) => { setText(e.target.value); commit(e.target.value) }}
      onBlur={(e) => { isFocused.current = false; commit(e.target.value) }}
      placeholder={disabled ? 'Add trigger words above first' : placeholder}
      className="h-7 text-xs"
    />
  )
}

function FillerWordsSettings({
  enableFillerWords,
  questionKeywords,
  questionFillers,
  ambiguousKeywords,
  ambiguousFillers,
  generalFillers,
  fillerCooldownSec,
  latencyThreshold,
  onFieldChange,
}: FillerWordsSettingsProps) {
  // When question keywords are cleared, also clear question fillers
  const handleQuestionKeywordsChange = (field: string, value: string[]) => {
    onFieldChange(field, value)
    if (value.length === 0) {
      onFieldChange('advancedSettings.fillers.questionFillers', [])
    }
  }

  // When ambiguous keywords are cleared, also clear ambiguous fillers
  const handleAmbiguousKeywordsChange = (field: string, value: string[]) => {
    onFieldChange(field, value)
    if (value.length === 0) {
      onFieldChange('advancedSettings.fillers.ambiguousFillers', [])
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-600 dark:text-gray-400">
        Short phrases played before the agent replies to fill the silence gap
      </div>

      {/* ── Master On/Off Toggle ── */}
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Enable Filler Words
        </Label>
        <Switch
          checked={enableFillerWords}
          onCheckedChange={(checked) =>
            onFieldChange('advancedSettings.fillers.enableFillerWords', checked)
          }
          className="scale-75"
        />
      </div>

      {enableFillerWords && (
        <>
          {/* ── Question ── */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Question
            </Label>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Trigger words (comma-separated)
            </div>
            <CommaInput
              items={questionKeywords}
              field="advancedSettings.fillers.questionKeywords"
              placeholder="what, who, how, why, has, have, was, were"
              onFieldChange={handleQuestionKeywordsChange}
            />
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Filler phrases (comma-separated)
            </div>
            <CommaInput
              items={questionFillers}
              field="advancedSettings.fillers.questionFillers"
              placeholder="Let me check., One moment., Right."
              onFieldChange={onFieldChange}
              disabled={questionKeywords.length === 0}
            />
            {questionKeywords.length === 0 && (
              <div className="text-xs text-amber-600 dark:text-amber-400">
                Add at least one trigger word to enable question filler phrases
              </div>
            )}
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-700" />

          {/* ── Ambiguous ── */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Ambiguous
            </Label>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Trigger words (comma-separated)
            </div>
            <CommaInput
              items={ambiguousKeywords}
              field="advancedSettings.fillers.ambiguousKeywords"
              placeholder="is, are, can, could, do"
              onFieldChange={handleAmbiguousKeywordsChange}
            />
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Filler phrases (comma-separated)
            </div>
            <CommaInput
              items={ambiguousFillers}
              field="advancedSettings.fillers.ambiguousFillers"
              placeholder="One moment., Right., I see."
              onFieldChange={onFieldChange}
              disabled={ambiguousKeywords.length === 0}
            />
            {ambiguousKeywords.length === 0 && (
              <div className="text-xs text-amber-600 dark:text-amber-400">
                Add at least one trigger word to enable ambiguous filler phrases
              </div>
            )}
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-700" />

          {/* ── General ── */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              General
            </Label>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Fallback filler phrases (comma-separated)
            </div>
            <CommaInput
              items={generalFillers}
              field="advancedSettings.fillers.generalFillers"
              placeholder="Got it., Right., One moment."
              onFieldChange={onFieldChange}
            />
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-700" />

          {/* ── Cooldown ── */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Filler Cooldown (seconds)
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InfoIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="text-xs">Prevents back-to-back fillers — if a filler played within this many seconds, the next turn stays silent instead.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Minimum gap between two fillers (2–8s)
            </div>
            <Input
              type="number"
              min={2} max={8} step={0.5}
              value={fillerCooldownSec}
              onChange={(e) => {
                const n = parseFloat(e.target.value)
                if (!isNaN(n)) onFieldChange('advancedSettings.fillers.fillerCooldownSec', n)
              }}
              onBlur={(e) => {
                const n = parseFloat(e.target.value)
                onFieldChange('advancedSettings.fillers.fillerCooldownSec', isNaN(n) ? 4 : Math.min(8, Math.max(2, n)))
              }}
              className="h-7 text-xs"
            />
          </div>

          {/* ── Latency Threshold ── */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Latency Threshold (seconds)
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <InfoIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="text-xs">Filler only plays when estimated LLM reply time exceeds this — below it the agent is fast enough that a filler would add delay, not remove it.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Only play a filler when estimated LLM latency exceeds this (0.8–2.0s)
            </div>
            <Input
              type="number"
              min={0.8} max={2.0} step={0.1}
              value={latencyThreshold}
              onChange={(e) => {
                const n = parseFloat(e.target.value)
                if (!isNaN(n)) onFieldChange('advancedSettings.fillers.latencyThreshold', n)
              }}
              onBlur={(e) => {
                const n = parseFloat(e.target.value)
                onFieldChange('advancedSettings.fillers.latencyThreshold', isNaN(n) ? 1.2 : Math.min(2.0, Math.max(0.8, n)))
              }}
              className="h-7 text-xs"
            />
          </div>
        </>
      )}
    </div>
  )
}

export default FillerWordsSettings
