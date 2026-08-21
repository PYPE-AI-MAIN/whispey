'use client'

import React, { useState } from 'react'
import { Check, Loader2, Pencil, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AGENT_DISPLAY_NAME_MAX, agentDisplayName } from '@/lib/agentDisplayName'

const ICON_BUTTON = { size: 'icon', variant: 'ghost' } as const

interface AgentNameEditorProps {
  agent: { id: string; name?: string | null; display_name?: string | null }
  /** Hide the pencil for viewers / read-only contexts. */
  canEdit?: boolean
  isMobile?: boolean
  /** Refetch the agent so the new label shows everywhere. */
  onSaved?: () => void
}

/**
 * Renames the *label* only. `agent.name` is the backend identity
 * (`${name}_${id with - as _}` is the agent on the PypeAPI VM) and stays put —
 * the tooltip surfaces it so it's obvious what didn't change.
 */
export default function AgentNameEditor({
  agent,
  canEdit = false,
  isMobile = false,
  onSaved,
}: Readonly<AgentNameEditorProps>) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const shown = agentDisplayName(agent)

  const startEditing = () => {
    setValue(agent.display_name?.trim() || agent.name?.trim() || '')
    setError(null)
    setEditing(true)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // Empty string clears the override and falls back to `name`.
        body: JSON.stringify({ display_name: value.trim() || null }),
      })
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(json.error || res.statusText)
      setEditing(false)
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rename agent')
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-1">
          <Input
            autoFocus
            aria-label="Agent name"
            value={value}
            maxLength={AGENT_DISPLAY_NAME_MAX}
            disabled={saving}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save()
              if (e.key === 'Escape') setEditing(false)
            }}
            placeholder={agent.name ?? 'Agent name'}
            className={`${isMobile ? 'h-8 w-[180px] text-base' : 'h-9 w-[260px] text-lg'} font-semibold`}
          />
          {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
        </div>
        <Button
          {...ICON_BUTTON}
          className="h-8 w-8"
          disabled={saving}
          onClick={() => void save()}
          aria-label="Save name"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </Button>
        <Button
          {...ICON_BUTTON}
          className="h-8 w-8"
          disabled={saving}
          onClick={() => setEditing(false)}
          aria-label="Cancel rename"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <h1
              className={`${isMobile ? 'text-lg max-w-[180px]' : 'text-2xl max-w-[250px]'} font-semibold text-gray-900 dark:text-gray-100 tracking-tight truncate cursor-default`}
            >
              {shown}
            </h1>
          </TooltipTrigger>
          <TooltipContent>
            <p>{shown}</p>
            {agent.display_name?.trim() && agent.name && (
              <p className="text-xs opacity-70 mt-0.5">Backend name: {agent.name}</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {canEdit && (
        <Button
          {...ICON_BUTTON}
          className="h-7 w-7 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
          onClick={startEditing}
          aria-label="Rename agent"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}
