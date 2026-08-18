'use client'

import React, { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { WorkflowNode } from '@/lib/workflow/schema'
import { NODE_REGISTRY } from './nodeRegistry'
import { useWorkflowStore } from '@/stores/workflowStore'

type FlowNodeData = WorkflowNode & { isStart?: boolean }

function FlowNodeComponent({ data, id, selected }: NodeProps<any>) {
  const nodeData = data as FlowNodeData
  const meta = NODE_REGISTRY[nodeData.type]
  const activeNodeId = useWorkflowStore((s) => s.activeNodeId)
  const lintIssues = useWorkflowStore((s) => s.lintIssues)
  const isActive = activeNodeId === id

  const nodeIssues = lintIssues.filter((i) => i.nodeId === id)
  const hasError = nodeIssues.some((i) => i.severity === 'error')
  const hasWarning = !hasError && nodeIssues.some((i) => i.severity === 'warning')

  const Icon = meta?.icon
  const color = meta?.color ?? '#6b7280'
  const label = nodeData.name || meta?.label || nodeData.type

  let ringClass = ''
  if (isActive) ringClass = 'ring-2 ring-green-400 animate-pulse'
  else if (hasError) ringClass = 'ring-2 ring-red-400'
  else if (hasWarning) ringClass = 'ring-2 ring-amber-400'
  else if (selected) ringClass = 'ring-2 ring-blue-400'

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm px-4 py-3 min-w-[160px] max-w-[220px] cursor-pointer transition-shadow hover:shadow-md ${ringClass}`}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-gray-400 dark:!bg-gray-500 !border-2 !border-white dark:!border-gray-800" />

      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}20` }}
        >
          {Icon && <Icon className="w-4 h-4" style={{ color }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{label}</div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400">{meta?.label}</div>
        </div>
      </div>

      {nodeData.isStart && (
        <div className="mt-1.5 text-[10px] font-medium text-green-600 dark:text-green-400">Start Node</div>
      )}

      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-gray-400 dark:!bg-gray-500 !border-2 !border-white dark:!border-gray-800" />
    </div>
  )
}

export const FlowNode = memo(FlowNodeComponent)
