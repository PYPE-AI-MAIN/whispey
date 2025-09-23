'use client'

import React from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface SessionBehaviourSettingsProps {
  preemptiveGeneration: 'enabled' | 'disabled'
  turn_detection: 'multilingual' | 'english' | 'disabled'
  onFieldChange: (field: string, value: any) => void
}

function SessionBehaviourSettings({
  preemptiveGeneration,
  turn_detection,
  onFieldChange
}: SessionBehaviourSettingsProps) {
  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
        Configure session behavior settings
      </div>
      
      {/* Preemptive Generation */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Preemptive Generation
        </Label>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
          Enable or disable preemptive text generation
        </div>
        <Select 
          value={preemptiveGeneration} 
          onValueChange={(value) => onFieldChange('advancedSettings.session.preemptiveGeneration', value)}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="enabled" className="text-xs">Enabled</SelectItem>
            <SelectItem value="disabled" className="text-xs">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Turn Detection */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Turn Detection
        </Label>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
          Language detection mode for turn-taking
        </div>
        <Select 
          value={turn_detection} 
          onValueChange={(value) => onFieldChange('advancedSettings.session.turn_detection', value)}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="english" className="text-xs">English</SelectItem>
            <SelectItem value="multilingual" className="text-xs">Multilingual</SelectItem>
            <SelectItem value="SmolLM2TurnDetector" className="text-xs">SmolLM2TurnDetector</SelectItem>
            <SelectItem value="llmturndetector" className="text-xs">LLMTurnDetector</SelectItem>
            <SelectItem value="disabled" className="text-xs">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export default SessionBehaviourSettings