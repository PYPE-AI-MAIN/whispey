'use client'

import React, { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Play } from 'lucide-react'
import type { WorkflowNode } from '@/lib/workflow/schema'
import { AddNextStep } from './AddNextStep'
import { NODE_REGISTRY } from './nodeRegistry'
import { useWorkflowStore } from '@/stores/workflowStore'

type FlowNodeData = WorkflowNode & { isStart?: boolean }

// Terminal (ending) nodes read as an exit, not a step — a distinct pill shape
// says that at a glance, before anyone reads a single label.
const TERMINAL_TYPES = new Set(['ending'])

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
      className={`group relative flex items-stretch bg-card ${isTerminal ? 'rounded-full' : 'rounded-xl'} shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_20px_-8px_rgba(0,0,0,0.15)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_8px_24px_-8px_rgba(0,0,0,0.6)] min-w-[168px] max-w-[220px] cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_28px_-8px_rgba(0,0,0,0.22)] ${ringClass}`}
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
          <div className="text-[13px] font-semibold leading-tight text-foreground truncate">{label}</div>
          {!isTerminal && (
            <div className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground mt-0.5">
              {nodeData.stage ? `${nodeData.stage} · ${meta?.label}` : meta?.label}
            </div>
          )}
        </div>
        {fromAnywhere && (
          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground" title="A global rule can send the call here from any step">
            any step
          </span>
        )}
        {isTerminal && incoming >= 3 && (
          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground" title={`${incoming} steps can end here`}>
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
