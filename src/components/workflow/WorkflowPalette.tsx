'use client'

import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
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

export function WorkflowPalette() {
  const [more, setMore] = useState(false)
  return (
    <div className="w-56 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto">
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
    </div>
  )
}
