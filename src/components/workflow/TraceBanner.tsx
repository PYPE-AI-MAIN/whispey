'use client'

import React, { useEffect } from 'react'
import { Panel, useReactFlow } from '@xyflow/react'
import { Route, X } from 'lucide-react'
import { useWorkflowStore } from '@/stores/workflowStore'

/** The call being shown on the canvas: what it is, and one clear way out. */
export function TraceBanner() {
  const trace = useWorkflowStore((s) => s.tracePath)
  const setTracePath = useWorkflowStore((s) => s.setTracePath)
  const { fitView } = useReactFlow()

  const first = trace?.ids[0]
  const last = trace?.ids.at(-1)
  const key = trace ? trace.ids.join('>') : ''
  useEffect(() => {
    if (!trace?.ids.length) return
    const t = setTimeout(() => fitView({ nodes: [...new Set(trace.ids)].map((id) => ({ id })), padding: 0.25, maxZoom: 1, duration: 500 }), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fit once per path, not on every render
  }, [key, first, last, fitView])

  if (!trace) return null
  const steps = trace.ids.length
  return (
    <Panel position="top-center">
      <div className="flex items-center gap-2.5 rounded-full border border-border bg-card/95 py-1.5 pl-3.5 pr-1.5 text-xs shadow-sm backdrop-blur">
        <Route className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium text-foreground">The path of this call · {steps} {steps === 1 ? 'step' : 'steps'}</span>
        {trace.missing > 0 && <span className="text-muted-foreground">{trace.missing} no longer in this flow</span>}
        <button
          type="button"
          onClick={() => setTracePath(null)}
          className="flex h-6 items-center gap-1 rounded-full bg-muted px-2.5 font-medium text-foreground transition-colors hover:bg-accent"
        >
          <X className="h-3 w-3" /> Clear
        </button>
      </div>
    </Panel>
  )
}
