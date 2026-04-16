// src/components/agents/AgentConfig/Pipecat/PipecatAdvancedSettings/ConfigParents/KnowledgeBaseSettings.tsx
'use client'

import React from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

interface KnowledgeBaseSettingsProps {
  ragEnabled: boolean
  onRagEnabledChange: (v: boolean) => void
}

export default function KnowledgeBaseSettings({
  ragEnabled,
  onRagEnabledChange,
}: KnowledgeBaseSettingsProps) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        When enabled, relevant documents from the agent's knowledge base are injected into context each turn.
      </p>

      <div className="flex items-center justify-between py-1">
        <div>
          <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
            RAG Enabled
          </Label>
          <p className="text-xs text-gray-400 mt-0.5">
            {ragEnabled ? 'Knowledge base is active' : 'Knowledge base is disabled'}
          </p>
        </div>
        <Switch
          checked={ragEnabled}
          onCheckedChange={onRagEnabledChange}
          className="scale-75"
        />
      </div>
    </div>
  )
}