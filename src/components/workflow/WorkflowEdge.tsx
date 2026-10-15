'use client'

import React, { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useStore, type EdgeProps } from '@xyflow/react'
import { useWorkflowStore } from '@/stores/workflowStore'

// react-flow's default label sits exactly on the path midpoint — fine for one
// edge, unreadable once several edges converge on the same node (their
// midpoints land on top of each other). A deterministic per-edge offset (hash
// of the id, not index — index shifts on every edit and the label would jump
// around) spreads them apart without needing real collision detection.
function hashOffset(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = Math.trunc(h * 31 + (id.codePointAt(i) ?? 0))
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
  data,
}: EdgeProps) {
  // Zoomed out, a big flow's labels pile up into noise: show them when close in or selected.
  const zoom = useStore((s) => s.transform[2])
  const setSelectedEdge = useWorkflowStore((s) => s.setSelectedEdge)
  const ghost = !!data?.ghost
  const full = typeof data?.full === 'string' ? data.full : undefined
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
      {label != null && label !== '' && !data?.dim && (selected || data?.focus || ghost || zoom >= 0.6) && (
        <EdgeLabelRenderer>
          <button
            type="button"
            title={full}
            tabIndex={ghost ? -1 : 0}
            className={`nodrag nopan absolute text-[11px] font-medium px-1.5 py-0.5 rounded-md border ${ghost ? 'cursor-default' : 'cursor-pointer'} ${
              selected ? 'max-w-[280px] whitespace-normal text-left' : 'whitespace-nowrap'
            } ${
              selected
                ? 'bg-primary text-primary-foreground border-primary z-10'
                : 'bg-card/95 text-muted-foreground border-border'
            }`}
            style={{
              // was offset away from its own edge path to avoid stacking on other
              // labels, but pointer-events-none let the click fall through to
              // whatever sat underneath that offset spot — usually a different
              // edge. Now the label is its own click target for its own edge.
              pointerEvents: ghost ? 'none' : 'auto',
              transform: `translate(-50%, -50%) translate(${labelX + px * offset}px, ${labelY + py * offset}px)`,
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (!ghost) setSelectedEdge(id)
            }}
          >
            {selected && full ? full : label}
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const WorkflowEdge = memo(WorkflowEdgeComponent)
