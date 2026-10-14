/**
 * The org view's "Agents: All ▾" header filter — Confluence "Analytics Phase
 * 3 and 4 — Build Spec" §3.5's wireframe. Shared across Overview, Explore and
 * Journeys' own agent-scoped totals, since it narrows the same
 * `Ctx.agentIds` every one of them reads from (§3.6.3).
 *
 * `null` means "all agents" — the default — represented as null rather than
 * an explicit list of every id so a newly added agent is included without
 * anyone having to re-select it.
 */
'use client'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export type Agent = { id: string; name: string }

function selectionLabel(agents: Agent[], selectedSet: Set<string>): string {
  if (selectedSet.size === 0) return 'Agents: None'
  if (selectedSet.size === 1) return `Agent: ${agents.find((a) => selectedSet.has(a.id))?.name ?? '1 selected'}`
  return `Agents: ${selectedSet.size} selected`
}

export function AgentMultiSelect({
  agents,
  selected,
  onChange,
}: Readonly<{ agents: Agent[]; selected: string[] | null; onChange: (ids: string[] | null) => void }>) {
  const [open, setOpen] = useState(false)
  const allSelected = selected === null
  const selectedSet = new Set(selected ?? agents.map((a) => a.id))

  const toggle = (id: string) => {
    const next = new Set(selectedSet)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    // every agent checked again is just "all" — collapse back to null so a
    // newly created agent is included without the person re-opening this
    onChange(next.size === agents.length ? null : [...next])
  }

  const label = allSelected ? 'Agents: All' : selectionLabel(agents, selectedSet)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          {label}
          <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <div className="flex items-center justify-between px-1 pb-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Agents</span>
          <button
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            onClick={() => onChange(null)}
          >
            Select all
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {agents.map((a) => (
            <label
              key={a.id}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Checkbox checked={selectedSet.has(a.id)} onCheckedChange={() => toggle(a.id)} />
              <span className="truncate text-gray-900 dark:text-gray-100">{a.name}</span>
            </label>
          ))}
          {agents.length === 0 && <p className="px-2 py-3 text-sm text-gray-500 dark:text-gray-400">No agents in this project yet.</p>}
        </div>
      </PopoverContent>
    </Popover>
  )
}
