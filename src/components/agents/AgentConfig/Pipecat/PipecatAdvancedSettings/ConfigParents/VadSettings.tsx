// src/components/agents/AgentConfig/Pipecat/PipecatAdvancedSettings/ConfigParents/VadSettings.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface VadSettingsProps {
  vadConfidence: number
  vadStartSecs: number
  vadStopSecs: number
  vadMinVolume: number
  onVadChange: (field: string, value: number) => void
  minAudioDuration: number
  onMinAudioDurationChange: (v: number) => void
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

export default function VadSettings({
  vadConfidence,
  vadStartSecs,
  vadStopSecs,
  vadMinVolume,
  onVadChange,
  minAudioDuration,
  onMinAudioDurationChange,
}: VadSettingsProps) {
  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="text-xs text-gray-600 dark:text-gray-400">
          Controls when the agent detects speech start and stop.
        </div>

        <NumericField
          label="Confidence"
          value={vadConfidence}
          min={0.1} max={1} step={0.05}
          hint="Min score to classify audio as speech. Range: 0.1–1.0"
          tooltip="Minimum confidence score for the VAD model to classify a frame as speech."
          onCommit={v => onVadChange('confidence', v)}
        />

        <NumericField
          label="Start Secs"
          value={vadStartSecs}
          min={0.05} max={1} step={0.05}
          hint="Speech must persist this long before SPEAKING state. Range: 0.05–1.0s"
          tooltip="How long speech must be detected continuously before the agent considers the user to be speaking."
          onCommit={v => onVadChange('startSecs', v)}
        />

        <NumericField
          label="Stop Secs"
          value={vadStopSecs}
          min={0.1} max={2} step={0.05}
          hint="Silence required before exiting SPEAKING state. Range: 0.1–2.0s"
          tooltip="How long silence must persist before the agent considers the user to have stopped speaking."
          onCommit={v => onVadChange('stopSecs', v)}
        />

        <NumericField
          label="Min Volume"
          value={vadMinVolume}
          min={0} max={1} step={0.05}
          hint="Minimum volume to consider audio as speech. Range: 0.0–1.0"
          tooltip="Audio below this volume level is ignored even if VAD confidence is high."
          onCommit={v => onVadChange('minVolume', v)}
        />

        <div className="h-px bg-gray-100 dark:bg-gray-700" />

        <NumericField
          label="Min Utterance Duration (s)"
          value={minAudioDuration}
          min={0.1} max={1.5} step={0.05}
          hint="Transcripts shorter than this are dropped as noise. Default: 0.4s"
          tooltip="Any STT transcript whose audio was shorter than this duration is silently discarded. Prevents phantom noise triggers."
          onCommit={onMinAudioDurationChange}
        />
      </div>
    </TooltipProvider>
  )
}