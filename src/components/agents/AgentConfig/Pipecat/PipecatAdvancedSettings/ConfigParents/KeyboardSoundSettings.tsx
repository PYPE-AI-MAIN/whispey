// src/components/agents/AgentConfig/Pipecat/PipecatAdvancedSettings/ConfigParents/KeyboardSoundSettings.tsx
'use client'

import React from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'

interface KeyboardSoundSettingsProps {
  keyboardSoundEnabled: boolean
  keyboardSoundVolume: number
  keyboardSoundProbability: number
  keyboardSoundOnToolCalls: boolean
  onKeyboardSoundEnabledChange: (v: boolean) => void
  onKeyboardSoundVolumeChange: (v: number) => void
  onKeyboardSoundProbabilityChange: (v: number) => void
  onKeyboardSoundOnToolCallsChange: (v: boolean) => void
}

export default function KeyboardSoundSettings({
  keyboardSoundEnabled,
  keyboardSoundVolume,
  keyboardSoundProbability,
  keyboardSoundOnToolCalls,
  onKeyboardSoundEnabledChange,
  onKeyboardSoundVolumeChange,
  onKeyboardSoundProbabilityChange,
  onKeyboardSoundOnToolCallsChange,
}: KeyboardSoundSettingsProps) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Plays a keyboard typing sound after the user stops speaking to simulate a human agent looking up information.
      </p>

      <div className="flex items-center justify-between py-1">
        <div>
          <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Keyboard Sound
          </Label>
          <p className="text-xs text-gray-400 mt-0.5">
            {keyboardSoundEnabled ? 'Typing sound is active' : 'Typing sound is disabled'}
          </p>
        </div>
        <Switch
          checked={keyboardSoundEnabled}
          onCheckedChange={onKeyboardSoundEnabledChange}
          className="scale-75"
        />
      </div>

      {keyboardSoundEnabled && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Volume
              </Label>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {Math.round(keyboardSoundVolume * 100)}%
              </span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[keyboardSoundVolume]}
              onValueChange={([v]) => onKeyboardSoundVolumeChange(v)}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Probability
              </Label>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {Math.round(keyboardSoundProbability * 100)}%
              </span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[keyboardSoundProbability]}
              onValueChange={([v]) => onKeyboardSoundProbabilityChange(v)}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>Never</span>
              <span>Always</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Play on Tool Calls
              </Label>
              <p className="text-xs text-gray-400 mt-0.5">
                Loop sound while the agent is running a tool
              </p>
            </div>
            <Switch
              checked={keyboardSoundOnToolCalls}
              onCheckedChange={onKeyboardSoundOnToolCallsChange}
              className="scale-75"
            />
          </div>
        </div>
      )}
    </div>
  )
}
