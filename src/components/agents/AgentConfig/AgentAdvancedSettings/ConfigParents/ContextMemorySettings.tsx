'use client'

import React from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

interface ContextMemorySettingsProps {
  enabled: boolean
  onFieldChange: (field: string, value: any) => void
}

function ContextMemorySettings({ enabled, onFieldChange }: ContextMemorySettingsProps) {
  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-600 dark:text-gray-400">
        When enabled, the agent builds a rolling summary of confirmed user information and
        injects it into every LLM call. The agent will not re-ask for details the user
        has already provided in this conversation.
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Enable Context Memory
        </Label>
        <Switch
          checked={enabled}
          onCheckedChange={(checked) =>
            onFieldChange('advancedSettings.contextMemory.enabled', checked)
          }
          className="scale-75"
        />
      </div>

      {enabled && (
        <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            A background LLM call (Azure GPT-4.1-mini) runs after each agent response to
            extract and store user-provided facts. This adds no latency to the voice
            pipeline and is isolated per active call.
          </p>
        </div>
      )}
    </div>
  )
}

export default ContextMemorySettings
