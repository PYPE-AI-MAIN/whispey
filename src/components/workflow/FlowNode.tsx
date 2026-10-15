'use client'

import React, { memo, useEffect, useState } from 'react'
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react'
import { ArrowRight, CornerDownRight, GitBranch, MessageCircle, Play } from 'lucide-react'
import type { WorkflowNode } from '@/lib/workflow/schema'
import { CARD_WIDTH, DEFAULT_HANDLE, transitionRows, type TransitionRow } from '@/lib/workflow/transitionRows'
import { AddNextStep } from './AddNextStep'
import { NODE_REGISTRY } from './nodeRegistry'
import { useWorkflowStore } from '@/stores/workflowStore'

type FlowNodeData = WorkflowNode & { isStart?: boolean; visits?: number[] }

// Terminal (ending) nodes read as an exit, not a step — a distinct pill shape
// says that at a glance, before anyone reads a single label.
const TERMINAL_TYPES = new Set(['ending'])
const HEADER_MIDDLE = 29

const ROW_ICON: Record<TransitionRow['kind'], React.ComponentType<{ className?: string }>> = {
  condition: MessageCircle,
  logic: GitBranch,
  always: ArrowRight,
  fallback: CornerDownRight,
  else: CornerDownRight,
}

function handleClass(color: string) {
  return { className: '!h-2.5 !w-2.5 !border-2 !border-white dark:!border-gray-900', style: { background: color } }
}

/** One way the call can go on from this step, with the point a connection starts from. */
function Row({ row, color, selected, editing, onSelect, onEdit, onCommit }: Readonly<{
  row: TransitionRow
  color: string
  selected: boolean
  editing: boolean
  onSelect: () => void
  onEdit: () => void
  onCommit: (value: string | null) => void
}>) {
  const Icon = ROW_ICON[row.kind]
  const quiet = row.kind === 'fallback' || row.kind === 'else'
  const [draft, setDraft] = useState(row.text)
  useEffect(() => { if (editing) setDraft(row.edgeId && row.kind === 'condition' && row.text !== 'Describe when…' ? row.text : '') }, [editing, row.edgeId, row.kind, row.text])

  return (
    <div
      className={`relative flex h-7 items-center gap-1.5 rounded-md pl-2 pr-2.5 text-[11px] ${
        selected ? 'bg-primary/10 ring-1 ring-primary/60' : 'bg-muted/60 hover:bg-muted'
      } ${row.kind === 'else' ? 'border border-dashed border-border bg-transparent' : ''}`}
      title={row.text}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
      onDoubleClick={(e) => { if (row.editable) { e.stopPropagation(); onEdit() } }}
    >
      <Icon className={`h-3 w-3 shrink-0 ${quiet ? 'text-muted-foreground/70' : 'text-muted-foreground'}`} />
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => onCommit(draft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommit(draft)
            if (e.key === 'Escape') onCommit(null)
          }}
          placeholder="e.g. they want to cancel"
          className="nodrag nopan min-w-0 flex-1 bg-transparent text-[11px] text-foreground outline-none placeholder:text-muted-foreground"
        />
      ) : (
        <span className={`min-w-0 flex-1 truncate ${quiet ? 'text-muted-foreground' : 'text-foreground'}`}>{row.text}</span>
      )}
      <Handle type="source" position={Position.Right} id={row.id} style={{ ...handleClass(color).style, right: -13 }} className={handleClass(color).className} />
    </div>
  )
}

function FlowNodeComponent({ data, id, selected, positionAbsoluteX, positionAbsoluteY }: NodeProps<any>) {
  const nodeData = data as FlowNodeData
  const meta = NODE_REGISTRY[nodeData.type]
  const activeNodeId = useWorkflowStore((s) => s.activeNodeId)
  const lintIssues = useWorkflowStore((s) => s.lintIssues)
  const workflowEdges = useWorkflowStore((s) => s.workflow?.edges)
  const selectedEdgeId = useWorkflowStore((s) => s.selectedEdgeId)
  const setSelectedEdge = useWorkflowStore((s) => s.setSelectedEdge)
  const updateEdge = useWorkflowStore((s) => s.updateEdge)
  const isActive = activeNodeId === id
  const incoming = useWorkflowStore((s) => s.workflow?.edges.filter((e) => e.target === id).length ?? 0)
  const fromAnywhere = useWorkflowStore((s) => s.workflow?.globalRules?.some((r) => r.target === id) ?? false)
  const [editingRow, setEditingRow] = useState<string | null>(null)

  const rows = React.useMemo(() => transitionRows({ id, type: nodeData.type }, workflowEdges ?? []), [id, nodeData.type, workflowEdges])
  const updateNodeInternals = useUpdateNodeInternals()
  const rowKey = rows.map((r) => r.id).join('|')
  useEffect(() => { updateNodeInternals(id) }, [id, rowKey, updateNodeInternals])

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

  const commit = (row: TransitionRow, value: string | null) => {
    setEditingRow(null)
    if (value !== null && row.edgeId && value.trim() !== row.text) updateEdge(row.edgeId, { condition: value.trim() })
  }

  return (
    <div
      className={`group relative bg-card ${isTerminal ? 'rounded-full' : 'rounded-xl'} shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_20px_-8px_rgba(0,0,0,0.15)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_8px_24px_-8px_rgba(0,0,0,0.6)] cursor-pointer transition-shadow hover:shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_28px_-8px_rgba(0,0,0,0.22)] ${ringClass}`}
      style={{ width: isTerminal ? undefined : CARD_WIDTH, minWidth: isTerminal ? 168 : undefined, ...(selected ? ({ '--tw-ring-color': color } as React.CSSProperties) : {}) }}
    >
      {nodeData.visits && (
        <span
          className="absolute -top-2.5 -right-2.5 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground shadow-sm"
          title={`Step ${nodeData.visits.join(' and ')} of the call`}
        >
          {nodeData.visits.join('·')}
        </span>
      )}
      {nodeData.isStart && (
        <span className="absolute -top-5 left-0 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          Start
        </span>
      )}
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !border-2 !border-white dark:!border-gray-900" style={{ background: color, top: HEADER_MIDDLE }} />

      <div className={`flex items-stretch ${isTerminal ? '' : 'h-[58px]'}`}>
        {/* type-color spine — instant recognition even zoomed out, no need to read the icon */}
        <div className={`w-1 shrink-0 ${isTerminal ? 'rounded-l-full' : 'rounded-tl-xl'} ${rows.length ? '' : 'rounded-bl-xl'}`} style={{ backgroundColor: color }} />
        <div className={`flex min-w-0 flex-1 items-center gap-2.5 ${isTerminal ? 'px-3.5 py-2' : 'px-3.5'}`}>
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: `${color}18`, color }}>
            {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold leading-tight text-foreground">{label}</div>
            {!isTerminal && (
              <div className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
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
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: color }} title="Start node">
              <Play className="h-2.5 w-2.5 fill-white text-white" />
            </div>
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="space-y-1 border-t border-border/60 px-2 pb-2 pt-1.5">
          {rows.map((row) => (
            <Row
              key={row.id}
              row={row}
              color={color}
              selected={!!row.edgeId && selectedEdgeId === row.edgeId}
              editing={editingRow === row.id}
              onSelect={() => { if (row.edgeId) setSelectedEdge(row.edgeId) }}
              onEdit={() => setEditingRow(row.id)}
              onCommit={(value) => commit(row, value)}
            />
          ))}
        </div>
      )}

      {!isTerminal && nodeData.type !== 'note' && <AddNextStep id={id} x={positionAbsoluteX} y={positionAbsoluteY} />}
      {/* Where a first connection starts, and where the path highlights and "from any step" lines attach. Rows carry their own. */}
      {!isTerminal && (
        <Handle
          type="source"
          position={Position.Right}
          id={DEFAULT_HANDLE}
          isConnectable={rows.length === 0}
          className={rows.length === 0 ? '!w-2.5 !h-2.5 !border-2 !border-white dark:!border-gray-900' : '!opacity-0 !pointer-events-none'}
          style={{ background: color, top: HEADER_MIDDLE }}
        />
      )}
    </div>
  )
}

export const FlowNode = memo(FlowNodeComponent)
