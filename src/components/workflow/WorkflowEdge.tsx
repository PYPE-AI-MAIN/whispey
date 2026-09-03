'use client'

import React, { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import { useWorkflowStore } from '@/stores/workflowStore'

// react-flow's default label sits exactly on the path midpoint — fine for one
// edge, unreadable once several edges converge on the same node (their
// midpoints land on top of each other). A deterministic per-edge offset (hash
// of the id, not index — index shifts on every edit and the label would jump
// around) spreads them apart without needing real collision detection.
function hashOffset(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  // -2.5..2.5 lane steps, spread over ~46px — enough separation for the ~11px label text.
  return ((Math.abs(h) % 5) - 2) * 11.5
}

function WorkflowEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  label,
  selected,
  animated,
}: EdgeProps) {
  const setSelectedEdge = useWorkflowStore((s) => s.setSelectedEdge)
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })

  const dx = targetX - sourceX
  const dy = targetY - sourceY
  const len = Math.hypot(dx, dy) || 1
  // unit perpendicular to the source->target line
  const px = -dy / len
  const py = dx / len
  const offset = hashOffset(id)

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} className={animated ? 'react-flow__edge-path-animated' : undefined} />
      {label != null && label !== '' && (
        <EdgeLabelRenderer>
          <div
            className={`nodrag nopan absolute text-[10px] font-medium px-1.5 py-0.5 rounded-md border cursor-pointer whitespace-nowrap ${
              selected
                ? 'bg-blue-600 text-white border-blue-600 z-10'
                : 'bg-white/95 dark:bg-gray-900/95 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
            }`}
            style={{
              // was offset away from its own edge path to avoid stacking on other
              // labels, but pointer-events-none let the click fall through to
              // whatever sat underneath that offset spot — usually a different
              // edge. Now the label is its own click target for its own edge.
              pointerEvents: 'auto',
              transform: `translate(-50%, -50%) translate(${labelX + px * offset}px, ${labelY + py * offset}px)`,
            }}
            onClick={(e) => {
              e.stopPropagation()
              setSelectedEdge(id)
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const WorkflowEdge = memo(WorkflowEdgeComponent)
