'use client'

import React, { useEffect, useRef } from 'react'
import { ArrowRightLeft, CircleAlert, Globe, ListTree, PhoneOff, Trash2, Variable } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface WorkflowEvent {
  type: string
  [key: string]: any
  _ts: number
}

const ICONS: Record<string, React.ElementType> = {
  node_enter: ListTree,
  transition: ArrowRightLeft,
  variables_set: Variable,
  function_call: Globe,
  function_result: Globe,
  error: CircleAlert,
  ended: PhoneOff,
}

function summarize(e: WorkflowEvent): string {
  switch (e.type) {
    case 'node_enter':
      return `→ entered "${e.node_name || e.node_id}" (${e.node_type})`
    case 'transition':
      return `${e.from_node} → ${e.to_node}${e.edge_kind ? ` (${e.edge_kind})` : ''}`
    case 'variables_set':
      return `variables set: ${Object.keys(e.variables || {}).join(', ')}`
    case 'function_call':
      return `calling ${e.method} ${e.url}`
    case 'function_result':
      return `function result: ${e.ok ? 'ok' : 'failed'}`
    case 'error':
      return `error in "${e.node_id || '?'}": ${e.message}`
    case 'ended':
      return `call ended (${e.reason})`
    default:
      return e.type
  }
}

export function LiveEventLog({ events, onClear }: { events: WorkflowEvent[]; onClear: () => void }) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events.length])

  return (
    // relative + z-[60]: sits above the Talk to Assistant sheet's dimming overlay
    // (z-50) — otherwise this panel is invisible during the exact call it's showing.
    <div className="relative z-[60] border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 dark:border-gray-800">
        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
          Live workflow events {events.length > 0 && `(${events.length})`}
        </span>
        <Button variant="ghost" size="sm" className="h-5 text-[11px] px-1.5" onClick={onClear} disabled={!events.length}>
          <Trash2 className="h-3 w-3 mr-1" /> Clear
        </Button>
      </div>
      <div className="h-28 overflow-y-auto px-3 py-1.5 font-mono text-[11px] space-y-0.5">
        {!events.length && (
          <p className="text-gray-400 dark:text-gray-500 italic">
            No activity yet — start a Talk to Assistant call to watch node transitions and tool calls live.
          </p>
        )}
        {events.map((e, i) => {
          const Icon = ICONS[e.type] || ListTree
          const isError = e.type === 'error'
          return (
            <div
              key={i}
              className={`flex items-start gap-1.5 ${isError ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}
            >
              <Icon className="h-3 w-3 mt-0.5 shrink-0" />
              <span className="text-gray-400 dark:text-gray-500">{new Date(e._ts).toLocaleTimeString()}</span>
              <span className="truncate">{summarize(e)}</span>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
    </div>
  )
}
