// src/components/agents/AgentConfig/Pipecat/PipecatAdvancedSettings/ConfigParents/TtsVoiceCharSettings.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface TtsVoiceCharSettingsProps {
  ttsStability: number | null
  ttsSimilarityBoost: number | null
  ttsStyle: number | null
  ttsSpeed: number
  onTtsCharChange: (field: string, value: number | null) => void
}

function NumericField({
  label, value, min, max, step, hint, tooltip, onCommit,
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

// Nullable field — leave empty to use ElevenLabs default
function NullableNumericField({
  label, value, min, max, step, hint, tooltip, placeholder, onCommit,
}: {
  label: string
  value: number | null
  min: number
  max: number
  step: number
  hint?: string
  tooltip?: string
  placeholder?: string
  onCommit: (v: number | null) => void
}) {
  const [local, setLocal] = useState(value !== null ? String(value) : '')

  useEffect(() => {
    setLocal(value !== null ? String(value) : '')
  }, [value])

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
        placeholder={placeholder ?? 'Leave empty for ElevenLabs default'}
        onChange={e => {
          setLocal(e.target.value)
          if (e.target.value === '') {
            onCommit(null)
          } else {
            const n = parseFloat(e.target.value)
            if (!isNaN(n)) onCommit(n)
          }
        }}
        onBlur={e => {
          const val = e.target.value
          if (val === '' || isNaN(parseFloat(val))) {
            setLocal('')
            onCommit(null)
          } else {
            const n = Math.min(max, Math.max(min, parseFloat(val)))
            setLocal(String(n))
            onCommit(n)
          }
        }}
        className="h-8 text-xs"
      />
      {hint && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  )
}

export default function TtsVoiceCharSettings({
  ttsStability,
  ttsSimilarityBoost,
  ttsStyle,
  ttsSpeed,
  onTtsCharChange,
}: TtsVoiceCharSettingsProps) {
  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="text-xs text-gray-600 dark:text-gray-400">
          ElevenLabs voice personality settings. Applied per-call. Leave fields empty to use ElevenLabs defaults.
        </div>

        <NullableNumericField
          label="Stability"
          value={ttsStability}
          min={0} max={1} step={0.05}
          hint="Higher = consistent/monotone. Lower = expressive. Sweet spot: 0.4–0.7."
          tooltip="Controls voice consistency. Higher values make the voice more stable but less expressive."
          onCommit={v => onTtsCharChange('stability', v)}
        />

        <NullableNumericField
          label="Similarity Boost"
          value={ttsSimilarityBoost}
          min={0} max={1} step={0.05}
          hint="How closely output matches cloned voice. Sweet spot: 0.6–0.85."
          tooltip="Boosts similarity to the original cloned voice. Too high may introduce artifacts."
          onCommit={v => onTtsCharChange('similarityBoost', v)}
        />

        <NullableNumericField
          label="Style"
          value={ttsStyle}
          min={0} max={1} step={0.05}
          hint="Style exaggeration. 0 = off (recommended). May increase latency."
          tooltip="Amplifies the speaking style of the voice. Keep at 0 for lowest latency."
          onCommit={v => onTtsCharChange('style', v)}
        />

        <NumericField
          label="Speed"
          value={ttsSpeed}
          min={0.7} max={1.2} step={0.05}
          hint="0.7 = 30% slower, 1.0 = normal, 1.2 = 20% faster."
          tooltip="Controls the speaking speed of the TTS output."
          onCommit={v => onTtsCharChange('speed', v)}
        />
      </div>
    </TooltipProvider>
  )
}