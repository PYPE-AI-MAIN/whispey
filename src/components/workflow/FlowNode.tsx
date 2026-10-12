'use client'

import React, { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Play, Plus } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { createDefaultNode, type NodeType, type WorkflowNode } from '@/lib/workflow/schema'
import { NODE_REGISTRY } from './nodeRegistry'
import { useWorkflowStore } from '@/stores/workflowStore'

type FlowNodeData = WorkflowNode & { isStart?: boolean }

// Terminal (ending) nodes read as an exit, not a step — a distinct pill shape
// says that at a glance, before anyone reads a single label.
const TERMINAL_TYPES = new Set(['ending'])

// What most people add next; everything else is in the left panel under More nodes.
const NEXT_STEPS: NodeType[] = ['conversation', 'extract_variable', 'logic_split', 'function', 'call_transfer', 'ending']

/** The "+" after a step: pick what comes next and it is added and connected for you. */
function AddNextStep({ id, x, y }: Readonly<{ id: string; x: number; y: number }>) {
  const addNode = useWorkflowStore((s) => s.addNode)
  const addEdge = useWorkflowStore((s) => s.addEdge)
  const setSelectedEdge = useWorkflowStore((s) => s.setSelectedEdge)
  const outgoing = useWorkflowStore((s) => s.workflow?.edges.filter((e) => e.source === id).length ?? 0)
  const [open, setOpen] = React.useState(false)

  const add = (type: NodeType) => {
    const newId = `node-${crypto.randomUUID()}`
    const edgeId = `edge-${crypto.randomUUID()}`
    addNode(createDefaultNode(type, newId, { x: x + 320, y: y + outgoing * 140 }))
    // The first way on is simply "next"; a second one needs the user to say when it applies.
    addEdge({ id: edgeId, source: id, target: newId, kind: outgoing === 0 ? 'always' : 'condition' })
    if (outgoing > 0) setSelectedEdge(edgeId)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Add the next step"
          className={`nodrag nopan absolute -right-9 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-opacity hover:text-foreground ${open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="nodrag nopan w-72 p-1.5">
        <p className="px-2 pb-1 pt-0.5 text-xs text-muted-foreground">What happens next?</p>
        {NEXT_STEPS.map((t) => {
          const m = NODE_REGISTRY[t]
          return (
            <button key={t} type="button" onClick={() => add(t)} className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-accent">
              <m.icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: m.color }} />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{m.label}</span>
                <span className="block text-xs text-muted-foreground">{m.useCase}</span>
              </span>
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}

function FlowNodeComponent({ data, id, selected, positionAbsoluteX, positionAbsoluteY }: NodeProps<any>) {
  const nodeData = data as FlowNodeData
  const meta = NODE_REGISTRY[nodeData.type]
  const activeNodeId = useWorkflowStore((s) => s.activeNodeId)
  const lintIssues = useWorkflowStore((s) => s.lintIssues)
  const isActive = activeNodeId === id
  const incoming = useWorkflowStore((s) => s.workflow?.edges.filter((e) => e.target === id).length ?? 0)
  const fromAnywhere = useWorkflowStore((s) => s.workflow?.globalRules?.some((r) => r.target === id) ?? false)

  const nodeIssues = lintIssues.filter((i) => i.nodeId === id)
  const hasError = nodeIssues.some((i) => i.severity === 'error')
  const hasWarning = !hasError && nodeIssues.some((i) => i.severity === 'warning')

  const Icon = meta?.icon
  const color = meta?.color ?? '#6b7280'
  const label = nodeData.name || meta?.label || nodeData.type
  const isTerminal = TERMINAL_TYPES.has(nodeData.type)

  let ringClass = 'ring-1 ring-black/5 dark:ring-white/10'
  if (isActive) ringClass = 'ring-2 ring-emerald-400 animate-pulse'
  else if (hasError) ringClass = 'ring-2 ring-red-400'
  else if (hasWarning) ringClass = 'ring-2 ring-amber-400'
  else if (selected) ringClass = 'ring-2'

  return (
    <div
      className={`group relative flex items-stretch bg-white dark:bg-gray-900 ${isTerminal ? 'rounded-full' : 'rounded-xl'} shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_20px_-8px_rgba(0,0,0,0.15)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_8px_24px_-8px_rgba(0,0,0,0.6)] min-w-[168px] max-w-[220px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_28px_-8px_rgba(0,0,0,0.22)] ${ringClass}`}
      style={selected ? ({ '--tw-ring-color': color } as React.CSSProperties) : undefined}
    >
      {nodeData.isStart && (
        <span className="absolute -top-5 left-0 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          Start
        </span>
      )}
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !border-2 !border-white dark:!border-gray-900" style={{ background: color }} />

      {/* type-color spine — instant recognition even zoomed out, no need to read the icon */}
      <div className="w-1 shrink-0" style={{ backgroundColor: color }} />

      <div className={`flex-1 min-w-0 flex items-center gap-2.5 ${isTerminal ? 'px-3.5 py-2' : 'px-3.5 py-3'}`}>
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}18`, color }}
        >
          {Icon && <Icon className="w-3.5 h-3.5" strokeWidth={2.25} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold leading-tight text-gray-900 dark:text-gray-50 truncate">{label}</div>
          {!isTerminal && (
            <div className="text-[11px] font-medium tracking-wide uppercase text-gray-400 dark:text-gray-500 mt-0.5">
              {nodeData.stage ? `${nodeData.stage} · ${meta?.label}` : meta?.label}
            </div>
          )}
        </div>
        {fromAnywhere && (
          <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400" title="A global rule can send the call here from any step">
            any step
          </span>
        )}
        {isTerminal && incoming >= 3 && (
          <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400" title={`${incoming} steps can end here`}>
            {incoming} steps
          </span>
        )}
        {nodeData.isStart && (
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: color }}
            title="Start node"
          >
            <Play className="w-2.5 h-2.5 text-white fill-white" />
          </div>
        )}
      </div>

      {!isTerminal && nodeData.type !== 'note' && <AddNextStep id={id} x={positionAbsoluteX} y={positionAbsoluteY} />}
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !border-2 !border-white dark:!border-gray-900" style={{ background: color }} />
    </div>
  )
}

export const FlowNode = memo(FlowNodeComponent)
