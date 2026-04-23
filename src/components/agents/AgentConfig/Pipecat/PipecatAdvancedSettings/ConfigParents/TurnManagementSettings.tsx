// src/components/agents/AgentConfig/Pipecat/PipecatAdvancedSettings/ConfigParents/TurnManagementSettings.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Info, PlusIcon, TrashIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface TurnManagementSettingsProps {
  turnStopTimeout: number
  userIdleTimeout: number | null
  idleNudges: string[]
  onTurnChange: (field: string, value: number | null) => void
  onIdleNudgesChange: (v: string[]) => void
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

export default function TurnManagementSettings({
  turnStopTimeout,
  userIdleTimeout,
  idleNudges,
  onTurnChange,
  onIdleNudgesChange,
}: TurnManagementSettingsProps) {
  const [idleLocal, setIdleLocal] = useState(
    userIdleTimeout !== null ? String(userIdleTimeout) : ''
  )

  useEffect(() => {
    setIdleLocal(userIdleTimeout !== null ? String(userIdleTimeout) : '')
  }, [userIdleTimeout])

  const idleDisabled = userIdleTimeout === null
  const updateNudge = (i: number, v: string) => {
    const next = [...idleNudges]
    next[i] = v
    onIdleNudgesChange(next)
  }
  const addNudge = () => onIdleNudgesChange([...idleNudges, ''])
  const removeNudge = (i: number) =>
    onIdleNudgesChange(idleNudges.filter((_, idx) => idx !== i))

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="text-xs text-gray-600 dark:text-gray-400">
          Controls LLM user aggregator timing and idle behaviour.
        </div>

        <NumericField
          label="Turn Stop Timeout (seconds)"
          value={turnStopTimeout}
          min={1} max={15} step={0.5}
          hint="Max seconds to wait for turn completion before forcing it through."
          tooltip="If the user aggregator hasn't received a complete turn within this time, it forces the current buffer through to the LLM."
          onCommit={v => onTurnChange('turnStopTimeout', v)}
        />

        {/* Idle Timeout — nullable, leave empty to disable */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-gray-600 dark:text-gray-400">
              Idle Timeout (seconds)
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">
                  Seconds of silence before the agent proactively speaks. Leave empty to disable.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            type="number"
            step={1}
            min={0}
            max={30}
            value={idleLocal}
            placeholder="Leave empty to disable"
            onChange={e => {
              setIdleLocal(e.target.value)
              if (e.target.value === '') {
                onTurnChange('userIdleTimeout', null)
              } else {
                const n = parseFloat(e.target.value)
                if (!isNaN(n) && n >= 0) onTurnChange('userIdleTimeout', n)
              }
            }}
            onBlur={e => {
              const val = e.target.value
              if (val === '' || isNaN(parseFloat(val))) {
                setIdleLocal('')
                onTurnChange('userIdleTimeout', null)
              } else {
                const n = Math.max(0, Math.min(30, parseFloat(val)))
                setIdleLocal(String(n))
                onTurnChange('userIdleTimeout', n)
              }
            }}
            className="h-8 text-xs"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Seconds of silence before agent proactively speaks. Leave empty to disable.
          </p>
        </div>

        {/* Idle Nudge Messages — spoken one-per-idle, call ends after the list runs out */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-gray-600 dark:text-gray-400">
              Idle Nudge Messages
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">
                  Phrases the agent says when the caller goes silent — one per idle
                  period. After the last phrase, the next idle ends the call. Leave
                  the list empty to use the built-in default ("Are you still there?").
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="space-y-2">
            {idleNudges.map((msg, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400 w-4 text-right">{i + 1}.</span>
                <Input
                  type="text"
                  value={msg}
                  placeholder="e.g. Are you still there?"
                  onChange={e => updateNudge(i, e.target.value)}
                  className="h-8 text-xs flex-1"
                  disabled={idleDisabled}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeNudge(i)}
                  disabled={idleDisabled}
                  className="h-8 w-8 p-0"
                >
                  <TrashIcon className="w-3.5 h-3.5 text-gray-500" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addNudge}
              disabled={idleDisabled}
              className="h-7 text-xs"
            >
              <PlusIcon className="w-3 h-3 mr-1" /> Add nudge
            </Button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {idleDisabled
              ? 'Set an Idle Timeout above to enable nudge messages.'
              : 'After the last nudge, the next idle period ends the call.'}
          </p>
        </div>
      </div>
    </TooltipProvider>
  )
}