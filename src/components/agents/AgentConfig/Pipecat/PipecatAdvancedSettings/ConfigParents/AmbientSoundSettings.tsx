// src/components/agents/AgentConfig/Pipecat/PipecatAdvancedSettings/ConfigParents/AmbientSoundSettings.tsx
'use client'

import React from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'

interface AmbientSoundSettingsProps {
  ambientSoundEnabled: boolean
  ambientSoundVolume: number
  onAmbientSoundEnabledChange: (v: boolean) => void
  onAmbientSoundVolumeChange: (v: number) => void
}

export default function AmbientSoundSettings({
  ambientSoundEnabled,
  ambientSoundVolume,
  onAmbientSoundEnabledChange,
  onAmbientSoundVolumeChange,
}: AmbientSoundSettingsProps) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Plays a continuous office ambient sound in the background during calls to make the bot sound more natural.
      </p>

      <div className="flex items-center justify-between py-1">
        <div>
          <Label className="text-xs font-medium text-foreground">
            Ambient Sound
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ambientSoundEnabled ? 'Office ambient sound is active' : 'Ambient sound is disabled'}
          </p>
        </div>
        <Switch
          checked={ambientSoundEnabled}
          onCheckedChange={onAmbientSoundEnabledChange}
          className="scale-75"
        />
      </div>

      {ambientSoundEnabled && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-foreground">
              Volume
            </Label>
            <span className="text-xs text-muted-foreground font-mono">
              {Math.round(ambientSoundVolume * 100)}%
            </span>
          </div>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={[ambientSoundVolume]}
            onValueChange={([v]) => onAmbientSoundVolumeChange(v)}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>
      )}
    </div>
  )
}
