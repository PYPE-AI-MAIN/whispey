// src/components/agents/AgentConfig/Pipecat/PipecatAdvancedSettings/ConfigParents/KnowledgeBaseSettings.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const DEFAULT_FILLERS = [
  'Sure, let me check that for you.',
  'Of course, let me look that up.',
  'Sure, let me pull that up.',
  'Absolutely, let me check that.',
]

interface KnowledgeBaseSettingsProps {
  ragEnabled: boolean
  onRagEnabledChange: (v: boolean) => void
  ragNResults: number
  onRagNResultsChange: (v: number) => void
  ragFillerEnabled: boolean
  onRagFillerEnabledChange: (v: boolean) => void
  ragFillerPhrases: string[]
  onRagFillerPhrasesChange: (v: string[]) => void
}

function SwitchRow({ label, description, checked, onCheckedChange, tooltip }: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  tooltip?: string
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex-1 pr-3">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</Label>
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
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="scale-75" />
    </div>
  )
}

function NResultsField({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [local, setLocal] = useState(String(value))
  useEffect(() => { setLocal(String(value)) }, [value])
  const commit = (raw: string) => {
    const n = parseInt(raw, 10)
    if (isNaN(n)) { setLocal(String(value)); return }
    const clamped = Math.min(8, Math.max(1, n))
    setLocal(String(clamped))
    onChange(clamped)
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs text-gray-600 dark:text-gray-400">Top-K Chunks</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="w-3 h-3 text-gray-400 cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <p className="text-xs">Number of knowledge base chunks retrieved per query. Lower = faster response, higher = more context. Default: 3.</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <Input
        type="number"
        min={1} max={8} step={1}
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={e => commit(e.target.value)}
        className="h-8 text-xs"
      />
      <p className="text-xs text-gray-500 dark:text-gray-400">Chunks returned per search. Lower = faster, fewer tokens. Range: 1–8.</p>
    </div>
  )
}

function FillerPhrasesEditor({ phrases, onChange }: {
  phrases: string[]
  onChange: (v: string[]) => void
}) {
  const [local, setLocal] = useState(
    (phrases.length > 0 ? phrases : DEFAULT_FILLERS).join('\n')
  )

  useEffect(() => {
    const incoming = (phrases.length > 0 ? phrases : DEFAULT_FILLERS).join('\n')
    setLocal(incoming)
  }, [phrases])

  const commit = (raw: string) => {
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
    onChange(lines.length > 0 ? lines : DEFAULT_FILLERS)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs text-gray-600 dark:text-gray-400">Filler Phrases</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="w-3 h-3 text-gray-400 cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <p className="text-xs">One phrase per line. The bot picks one at random each time it searches the knowledge base. Leave empty to use defaults.</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <Textarea
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={e => commit(e.target.value)}
        rows={4}
        placeholder={DEFAULT_FILLERS.join('\n')}
        className="text-xs resize-none font-mono"
      />
      <p className="text-xs text-gray-500 dark:text-gray-400">One phrase per line. Played while KB search runs.</p>
    </div>
  )
}

export default function KnowledgeBaseSettings({
  ragEnabled,
  onRagEnabledChange,
  ragNResults,
  onRagNResultsChange,
  ragFillerEnabled,
  onRagFillerEnabledChange,
  ragFillerPhrases,
  onRagFillerPhrasesChange,
}: KnowledgeBaseSettingsProps) {
  return (
    <TooltipProvider>
      <div className="space-y-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          When enabled, relevant documents from the agent's knowledge base are injected into context each turn.
        </p>

        <SwitchRow
          label="RAG Enabled"
          description={ragEnabled ? 'Knowledge base is active' : 'Knowledge base is disabled'}
          checked={ragEnabled}
          onCheckedChange={onRagEnabledChange}
        />

        {ragEnabled && (
          <>
            <div className="h-px bg-gray-100 dark:bg-gray-700" />

            <NResultsField value={ragNResults} onChange={onRagNResultsChange} />

            <SwitchRow
              label="Thinking Filler"
              description={ragFillerEnabled ? 'Bot speaks while searching KB' : 'Bot is silent while searching KB'}
              checked={ragFillerEnabled}
              onCheckedChange={onRagFillerEnabledChange}
              tooltip='When enabled, the bot says a short phrase immediately when knowledge_search is called, hiding retrieval + LLM latency from the caller.'
            />

            {ragFillerEnabled && (
              <FillerPhrasesEditor
                phrases={ragFillerPhrases}
                onChange={onRagFillerPhrasesChange}
              />
            )}
          </>
        )}
      </div>
    </TooltipProvider>
  )
}
