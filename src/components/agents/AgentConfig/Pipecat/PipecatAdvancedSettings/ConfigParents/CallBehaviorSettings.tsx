// src/components/agents/AgentConfig/Pipecat/PipecatAdvancedSettings/ConfigParents/CallBehaviorSettings.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Switch } from '@/components/ui/switch'

interface CallBehaviorSettingsProps {
  noiseCancellation: string
  onNoiseCancellationChange: (v: string) => void
  enableMetrics: boolean
  onEnableMetricsChange: (v: boolean) => void
  allowInterruptions: boolean
  onAllowInterruptionsChange: (v: boolean) => void
  minInterruptionDurationMs: number
  onMinInterruptionDurationMsChange: (v: number) => void
  answerDelaySecs: number | null
  onAnswerDelaySecsChange: (v: number | null) => void
  maxCallDurationSecs: number | null
  onMaxCallDurationSecsChange: (v: number | null) => void
  dtmfEnabled?: boolean
  onDtmfEnabledChange?: (v: boolean) => void
}

function NullableNumberField({
  label, value, placeholder, hint, tooltip, step, min, max, onCommit,
}: {
  label: string
  value: number | null
  placeholder: string
  hint?: string
  tooltip?: string
  step?: number
  min?: number
  max?: number
  onCommit: (v: number | null) => void
}) {
  const [local, setLocal] = useState(value === null || value === undefined ? '' : String(value))
  useEffect(() => { setLocal(value === null || value === undefined ? '' : String(value)) }, [value])

  const commit = (raw: string) => {
    const trimmed = raw.trim()
    if (trimmed === '') { onCommit(null); setLocal(''); return }
    const n = parseFloat(trimmed)
    if (isNaN(n)) { setLocal(value === null ? '' : String(value)); return }
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n))
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
        step={step ?? 0.1}
        value={local}
        placeholder={placeholder}
        onChange={e => setLocal(e.target.value)}
        onBlur={e => commit(e.target.value)}
        className="h-8 text-xs"
      />
      {hint && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  )
}

function NumberField({
  label, value, hint, tooltip, step, min, max, onCommit,
}: {
  label: string
  value: number
  hint?: string
  tooltip?: string
  step?: number
  min?: number
  max?: number
  onCommit: (v: number) => void
}) {
  const [local, setLocal] = useState(String(value))
  useEffect(() => { setLocal(String(value)) }, [value])
  const commit = (raw: string) => {
    const n = parseFloat(raw)
    if (isNaN(n)) { setLocal(String(value)); return }
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n))
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
        step={step ?? 1}
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={e => commit(e.target.value)}
        className="h-8 text-xs"
      />
      {hint && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  )
}

export default function CallBehaviorSettings({
  noiseCancellation, onNoiseCancellationChange,
  enableMetrics, onEnableMetricsChange,
  allowInterruptions, onAllowInterruptionsChange,
  minInterruptionDurationMs, onMinInterruptionDurationMsChange,
  answerDelaySecs, onAnswerDelaySecsChange,
  maxCallDurationSecs, onMaxCallDurationSecsChange,
  dtmfEnabled = false, onDtmfEnabledChange,
}: CallBehaviorSettingsProps) {
  return (
    <TooltipProvider>
      <div className="space-y-4">

        {/* Noise cancellation */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-gray-600 dark:text-gray-400">Noise Cancellation</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">
                  RNNoise (default) is free and decent. Krisp Viva is higher quality but requires
                  pipecat[krisp] installed on the bot. None disables filtering.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <select
            value={noiseCancellation}
            onChange={e => onNoiseCancellationChange(e.target.value)}
            className="w-full h-8 px-2 text-xs rounded-md border border-gray-200 dark:border-gray-700
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="rnnoise">RNNoise (default)</option>
            <option value="krisp_viva">Krisp Viva</option>
            <option value="none">None</option>
          </select>
        </div>

        {/* Metrics */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Enable Metrics</Label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Emits STT/LLM/TTS TTFB and usage metrics via PipelineParams.
            </p>
          </div>
          <Switch checked={enableMetrics} onCheckedChange={onEnableMetricsChange} />
        </div>

        {/* Interruptions */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Allow Interruptions</Label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              When off, the caller cannot cut off the bot mid-sentence.
            </p>
          </div>
          <Switch checked={allowInterruptions} onCheckedChange={onAllowInterruptionsChange} />
        </div>

        {allowInterruptions && (
          <NumberField
            label="Min Interruption Duration (ms)"
            value={minInterruptionDurationMs}
            step={50}
            min={0}
            max={3000}
            hint="Caller must keep speaking this long before bot TTS is cut off. 0 = interrupt immediately."
            tooltip="Guards against coughs, sneezes, and tiny noise bursts triggering false interruptions."
            onCommit={onMinInterruptionDurationMsChange}
          />
        )}

        {/* DTMF (keypad) input */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Accept Keypad Input (DTMF)</Label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              When on, digits the caller presses (0-9, *, #) are forwarded to the agent
              as &quot;[The caller pressed 123 on the keypad.]&quot;. Useful for IVR menus or OTP capture.
            </p>
          </div>
          <Switch
            checked={dtmfEnabled}
            onCheckedChange={(v) => onDtmfEnabledChange?.(v)}
            disabled={!onDtmfEnabledChange}
          />
        </div>

        {/* Answer delay */}
        <NullableNumberField
          label="Answer Delay (seconds)"
          value={answerDelaySecs}
          placeholder="auto"
          step={0.1}
          min={0}
          max={30}
          hint="Override post-answer pause before greeting. Leave empty to use defaults (Acefone outbound ≈ 12s)."
          tooltip="Useful if your telephony provider needs more or less settle time before the bot speaks."
          onCommit={onAnswerDelaySecsChange}
        />

        {/* Max call duration */}
        <NullableNumberField
          label="Max Call Duration (seconds)"
          value={maxCallDurationSecs}
          placeholder="unlimited"
          step={30}
          min={30}
          max={7200}
          hint="Hard cap — the pipeline is cancelled after this many seconds. Empty = unlimited."
          tooltip="Safety net against stuck calls burning minutes. Recommended: 600–1800s for phone use."
          onCommit={onMaxCallDurationSecsChange}
        />

      </div>
    </TooltipProvider>
  )
}
