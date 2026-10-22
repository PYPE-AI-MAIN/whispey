'use client'

import React, { useState } from 'react'
import { useWorkflowStore } from '@/stores/workflowStore'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { NodeType } from '@/lib/workflow/schema'
import { NODE_REGISTRY, type NodeMeta } from './nodeRegistry'

/** Drag payload read by WorkflowCanvas's onDrop. */
export const PALETTE_DND_TYPE = 'application/whispey-node-type'

const ALL = Object.entries(NODE_REGISTRY) as [NodeType, NodeMeta][]

/** One step type, as in Retell's list: a coloured icon and its name. Drag it onto the canvas. */
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
          className="flex w-full cursor-grab items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent active:cursor-grabbing"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}>
            <meta.icon className="h-4 w-4" strokeWidth={2.1} />
          </div>
          <span className="truncate text-[13px] font-medium text-foreground">{meta.label}</span>
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
          <div className="mb-1 px-1 text-xs font-medium text-muted-foreground">{stage} ({nodes.length})</div>
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
                      selectedNodeId === n.id ? 'bg-accent text-foreground' : 'text-foreground'
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
  const tabBtn = (id: 'add' | 'outline', label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${tab === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {label}
    </button>
  )
  return (
    <div className="w-60 shrink-0 overflow-y-auto border-r border-border bg-card">
      <div className="m-3 mb-1 flex rounded-lg bg-muted p-0.5">
        {tabBtn('add', 'Nodes')}
        {tabBtn('outline', 'Outline')}
      </div>
      {tab === 'outline' ? (
        <Outline />
      ) : (
        <div className="space-y-0.5 p-2">
          {ALL.map(([t, m]) => <PaletteItem key={t} type={t} meta={m} />)}
          <p className="px-2.5 pt-3 text-[11px] text-muted-foreground">Drag a node onto the canvas, or use the + next to a step.</p>
        </div>
      )}
    </div>
  )
}
