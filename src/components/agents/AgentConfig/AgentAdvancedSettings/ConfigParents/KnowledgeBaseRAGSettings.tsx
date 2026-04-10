'use client'

import React, { useCallback } from 'react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const DEFAULT_TOP_K = 5
const MIN_TOP_K = 1
const MAX_TOP_K = 50

export interface KnowledgeBaseRAGSettingsProps {
  enabled: boolean
  topK: number
  onFieldChange: (field: string, value: unknown) => void
}

function KnowledgeBaseRAGSettings({
  enabled,
  topK,
  onFieldChange,
}: KnowledgeBaseRAGSettingsProps) {
  const safeTopK = typeof topK === 'number' && topK >= MIN_TOP_K && topK <= MAX_TOP_K
    ? topK
    : DEFAULT_TOP_K

  const handleEnabledChange = useCallback(
    (checked: boolean) => {
      onFieldChange('advancedSettings.knowledgeBase.enabled', checked)
    },
    [onFieldChange]
  )

  const handleTopKChange = useCallback(
    (value: number) => {
      const clamped = Math.min(MAX_TOP_K, Math.max(MIN_TOP_K, value))
      onFieldChange('advancedSettings.knowledgeBase.topK', clamped)
    },
    [onFieldChange, topK]
  )

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-600 dark:text-gray-400">
        When enabled, the voice agent will use your Knowledge Base (RAG) with the configured Top K for retrieval.
      </p>

      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Enable Knowledge Base search
        </Label>
        <Switch
          checked={enabled}
          onCheckedChange={handleEnabledChange}
          className="scale-75"
        />
      </div>

      {enabled && (
        <div className="space-y-1.5">
          <Label htmlFor="knowledge-top-k" className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Top K
          </Label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Number of chunks to retrieve from the knowledge base per query (1–{MAX_TOP_K}). Default: {DEFAULT_TOP_K}.
          </p>
          <Input
            id="knowledge-top-k"
            type="number"
            min={MIN_TOP_K}
            max={MAX_TOP_K}
            value={safeTopK}
            onChange={(e) => {
              const raw = e.target.value
              if (raw === '') return
              const num = parseInt(raw, 10)
              if (!Number.isNaN(num)) handleTopKChange(num)
            }}
            onBlur={(e) => {
              const num = parseInt(e.target.value, 10)
              if (Number.isNaN(num) || num < MIN_TOP_K) handleTopKChange(DEFAULT_TOP_K)
              else if (num > MAX_TOP_K) handleTopKChange(MAX_TOP_K)
            }}
            className="h-7 text-xs w-24"
          />
        </div>
      )}
    </div>
  )
}

export default KnowledgeBaseRAGSettings
