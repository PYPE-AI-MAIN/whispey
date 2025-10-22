'use client'

import React from 'react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface InterruptionSettingsProps {
  allowInterruptions: boolean
  minInterruptionDuration: number
  minInterruptionWords: number
  onFieldChange: (field: string, value: any) => void
}

function InterruptionSettings({
  allowInterruptions,
  minInterruptionDuration,
  minInterruptionWords,
  onFieldChange
}: InterruptionSettingsProps) {
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
    </div>
  )
}

export default InterruptionSettings