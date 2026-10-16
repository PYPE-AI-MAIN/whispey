'use client'

import React, { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react'

/**
 * A thin, quiet line. What a connection means is written on the step it leaves (one line per way on), so the line
 * itself carries no label. Only the dotted "from any step" lines name their rule, and only while a step is selected.
 */
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
  data,
}: EdgeProps) {
  const ghost = !!data?.ghost
  const [edgePath, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 14, offset: 26 })
  const full = typeof data?.full === 'string' ? data.full : undefined

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={ghost ? { ...style, strokeDasharray: '2 5' } : style} markerEnd={markerEnd} interactionWidth={ghost ? 0 : 18} />
      {ghost && label != null && label !== '' && (
        <EdgeLabelRenderer>
          <span
            title={full}
            className="nodrag nopan pointer-events-none absolute whitespace-nowrap rounded-md border border-border bg-card/95 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {label}
          </span>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const WorkflowEdge = memo(WorkflowEdgeComponent)
