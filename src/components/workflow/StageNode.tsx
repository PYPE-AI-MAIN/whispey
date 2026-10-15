'use client'

import React, { memo } from 'react'
import type { NodeProps } from '@xyflow/react'

/** A quiet area behind the steps of one stage: a label and a barely-there tint, never in the way of the flow itself. */
function StageNodeComponent({ data }: NodeProps) {
  const { label } = data as { label: string }
  return (
    <div className="pointer-events-none h-full w-full rounded-[28px] border border-foreground/[0.07] bg-foreground/[0.025]">
      <span className="absolute left-5 top-3.5 text-[11px] font-semibold tracking-wide text-muted-foreground/80">{label}</span>
    </div>
  )
}

export const StageNode = memo(StageNodeComponent)
