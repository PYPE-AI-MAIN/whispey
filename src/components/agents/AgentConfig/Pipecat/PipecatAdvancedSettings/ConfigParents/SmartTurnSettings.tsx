// src/components/agents/AgentConfig/Pipecat/PipecatAdvancedSettings/ConfigParents/SmartTurnSettings.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface SmartTurnSettingsProps {
  smartTurnStopSecs: number
  smartTurnPreSpeechMs: number
  smartTurnMaxDurSecs: number
  onSmartTurnChange: (field: string, value: number) => void
}

function NumericField({
  label, value, min, max, step, hint, tooltip,
  onCommit,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  hint?: string
  tooltip?: string
  onCommit: (v: number) => void
}) {
  const [local, setLocal] = useState(String(value))

  useEffect(() => { setLocal(String(value)) }, [value])

  const commit = (raw: string) => {
    const n = parseFloat(raw)
    if (isNaN(n)) { setLocal(String(value)); return }
    const clamped = Math.min(max, Math.max(min, n))
    setLocal(String(clamped))
    onCommit(clamped)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-xs text-gray-600 dark:text-gray-400">{label}</Label>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3 h-3 text-gray-400 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <Input
        type="number"
        step={step}
        min={min}
        max={max}
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={e => commit(e.target.value)}
        className="h-8 text-xs"
      />
      {hint && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  )
}

export default function SmartTurnSettings({
  smartTurnStopSecs,
  smartTurnPreSpeechMs,
  smartTurnMaxDurSecs,
  onSmartTurnChange,
}: SmartTurnSettingsProps) {
  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="text-xs text-gray-600 dark:text-gray-400">
          LocalSmartTurnAnalyzerV3 — analyses prosody and intonation for accurate end-of-turn detection.
        </div>

        <NumericField
          label="Stop Secs"
          value={smartTurnStopSecs}
          min={0.5} max={6} step={0.5}
          hint="Silence before confirming end-of-turn. Range: 0.5–6.0s"
          tooltip="How long silence must persist before the smart turn detector confirms the user has finished their turn."
          onCommit={v => onSmartTurnChange('stopSecs', v)}
        />

        <NumericField
          label="Pre-speech Buffer (ms)"
          value={smartTurnPreSpeechMs}
          min={100} max={1000} step={50}
          hint="Audio captured before speech for analysis context. Range: 100–1000ms"
          tooltip="Amount of audio buffered before detected speech starts, used to improve prosody analysis accuracy."
          onCommit={v => onSmartTurnChange('preSpeechMs', v)}
        />

        <NumericField
          label="Max Segment Secs"
          value={smartTurnMaxDurSecs}
          min={4} max={20} step={1}
          hint="Max segment before rolling window kicks in. Range: 4–20s"
          tooltip="Maximum duration of a single audio segment before the rolling window mechanism activates."
          onCommit={v => onSmartTurnChange('maxDurSecs', v)}
        />
      </div>
    </TooltipProvider>
  )
}