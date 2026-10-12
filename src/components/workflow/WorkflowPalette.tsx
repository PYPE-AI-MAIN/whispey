'use client'

import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useWorkflowStore } from '@/stores/workflowStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { NodeType } from '@/lib/workflow/schema'
import { NODE_REGISTRY, type NodeMeta } from './nodeRegistry'

/** Drag payload read by WorkflowCanvas's onDrop. */
export const PALETTE_DND_TYPE = 'application/whispey-node-type'

// The few nodes most flows are built from; the rest sit under "More nodes".
const CORE: NodeType[] = ['conversation', 'extract_variable', 'logic_split', 'function', 'call_transfer', 'ending']
const ALL = Object.entries(NODE_REGISTRY) as [NodeType, NodeMeta][]

function PaletteItem({ type, meta }: Readonly<{ type: NodeType; meta: NodeMeta }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(PALETTE_DND_TYPE, type)
            e.dataTransfer.effectAllowed = 'move'
          }}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 cursor-grab active:cursor-grabbing hover:border-gray-300 dark:hover:border-gray-600 transition-colors text-left"
        >
          <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
            <meta.icon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{meta.label}</span>
        </button>
      </TooltipTrigger>
      {/* side=right so it clears the palette instead of covering the next item */}
      <TooltipContent side="right" sideOffset={8} className="max-w-[260px]">
        <p className="font-semibold">{meta.label}</p>
        <p className="mt-0.5 opacity-90">{meta.useCase}</p>
      </TooltipContent>
    </Tooltip>
  )
}

export const FOCUS_NODE_EVENT = 'whispey-workflow-focus-node'

/** The flow as a list: steps grouped by stage, in call order, click to jump to one on the canvas. */
function Outline() {
  const workflow = useWorkflowStore((s) => s.workflow)
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId)
  const setSelectedNode = useWorkflowStore((s) => s.setSelectedNode)
  if (!workflow) return null

  const steps = workflow.nodes
    .filter((n) => n.type !== 'note')
    .sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0) || (a.position?.y ?? 0) - (b.position?.y ?? 0))
  const groups = new Map<string, typeof steps>()
  for (const n of steps) {
    const key = n.stage?.trim() || (n.type === 'ending' ? 'Endings' : 'Steps')
    groups.set(key, [...(groups.get(key) ?? []), n])
  }

  return (
    <div className="space-y-4 p-3">
      {[...groups.entries()].map(([stage, nodes]) => (
        <div key={stage}>
          <div className="mb-1 px-1 text-xs font-medium text-gray-500 dark:text-gray-400">{stage} ({nodes.length})</div>
          <ul className="space-y-0.5">
            {nodes.map((n) => {
              const meta = NODE_REGISTRY[n.type]
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedNode(n.id)
                      globalThis.dispatchEvent(new CustomEvent(FOCUS_NODE_EVENT, { detail: n.id }))
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent ${
                      selectedNodeId === n.id ? 'bg-accent text-foreground' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <meta.icon className="h-3.5 w-3.5 shrink-0" style={{ color: meta.color }} />
                    <span className="truncate">{n.name || meta.label}</span>
                    {n.id === workflow.start && (
                      <span className="ml-auto rounded-full bg-emerald-500 px-1.5 text-[10px] font-semibold uppercase text-white">Start</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function WorkflowPalette() {
  const [tab, setTab] = useState<'add' | 'outline'>('add')
  const [more, setMore] = useState(false)
  const tabBtn = (id: 'add' | 'outline', label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${tab === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {label}
    </button>
  )
  return (
    <div className="w-56 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto">
      <div className="m-3 mb-0 flex rounded-lg border border-border bg-muted/60 p-0.5">
        {tabBtn('add', 'Add')}
        {tabBtn('outline', 'Outline')}
      </div>
      {tab === 'outline' ? (
        <Outline />
      ) : (
        <div className="p-3 space-y-1">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 px-1">Drag onto the canvas</div>
          {ALL.filter(([t]) => CORE.includes(t)).map(([t, m]) => <PaletteItem key={t} type={t} meta={m} />)}
          <button
            type="button"
            onClick={() => setMore((v) => !v)}
            aria-expanded={more}
            className="flex w-full items-center justify-between px-1 pt-3 pb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-foreground"
          >
            More nodes
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${more ? 'rotate-180' : ''}`} />
          </button>
          {more && ALL.filter(([t]) => !CORE.includes(t)).map(([t, m]) => <PaletteItem key={t} type={t} meta={m} />)}
        </div>
      )}
    </div>
  )
}
