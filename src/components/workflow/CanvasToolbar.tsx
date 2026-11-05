'use client'

import React from 'react'
import { Panel, useReactFlow, useStore } from '@xyflow/react'
import { LayoutGrid, Locate, Map as MapIcon, Minus, Play, Plus, Redo2, Undo2 } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useWorkflowStore } from '@/stores/workflowStore'

function Tool({ label, shortcut, onClick, disabled, active, children }: Readonly<{
  label: string
  shortcut?: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  children: React.ReactNode
}>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
          className={`flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-35 ${active ? 'bg-accent text-foreground' : ''}`}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{shortcut ? `${label} (${shortcut})` : label}</TooltipContent>
    </Tooltip>
  )
}

const Divider = () => <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

/** The floating bar at the bottom of the canvas: undo, tidy up, find your way around, zoom. */
export function CanvasToolbar({ onAutoArrange, showMap, onToggleMap }: Readonly<{ onAutoArrange: () => void; showMap: boolean; onToggleMap: () => void }>) {
  const { fitView, zoomIn, zoomOut } = useReactFlow()
  const zoom = useStore((s) => Math.round(s.transform[2] * 100))
  const start = useWorkflowStore((s) => s.workflow?.start)
  const canUndo = useWorkflowStore((s) => s.past.length > 0)
  const canRedo = useWorkflowStore((s) => s.future.length > 0)
  const undo = useWorkflowStore((s) => s.undo)
  const redo = useWorkflowStore((s) => s.redo)
  const setSelectedNode = useWorkflowStore((s) => s.setSelectedNode)

  return (
    <Panel position="bottom-center" className="!mb-5">
      <div className="flex items-center rounded-2xl border border-border bg-card/95 p-1.5 shadow-lg backdrop-blur">
        <Tool label="Undo" shortcut="Ctrl+Z" onClick={undo} disabled={!canUndo}><Undo2 className="h-4 w-4" /></Tool>
        <Tool label="Redo" shortcut="Ctrl+Shift+Z" onClick={redo} disabled={!canRedo}><Redo2 className="h-4 w-4" /></Tool>
        <Divider />
        <Tool label="Auto-arrange" onClick={onAutoArrange}><LayoutGrid className="h-4 w-4" /></Tool>
        <Tool label="Fit view" onClick={() => fitView({ padding: 0.2, duration: 300 })}><Locate className="h-4 w-4" /></Tool>
        <Tool
          label="Go to start"
          disabled={!start}
          onClick={() => {
            if (!start) return
            setSelectedNode(start)
            fitView({ nodes: [{ id: start }], padding: 1.5, maxZoom: 1, duration: 300 })
          }}
        >
          <Play className="h-4 w-4" />
        </Tool>
        <Divider />
        <Tool label="Zoom out" onClick={() => zoomOut({ duration: 150 })}><Minus className="h-4 w-4" /></Tool>
        <span className="w-10 text-center text-xs tabular-nums text-muted-foreground" aria-live="polite">{zoom}%</span>
        <Tool label="Zoom in" onClick={() => zoomIn({ duration: 150 })}><Plus className="h-4 w-4" /></Tool>
        <Divider />
        <Tool label={showMap ? 'Hide the overview map' : 'Show the overview map'} active={showMap} onClick={onToggleMap}><MapIcon className="h-4 w-4" /></Tool>
      </div>
    </Panel>
  )
}
