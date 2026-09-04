'use client'

import React, { useEffect, useState } from 'react'
import { X, Lightbulb } from 'lucide-react'
import { useWorkflowStore } from '@/stores/workflowStore'

const STORAGE_KEY = 'whispey-workflow-hint-dismissed'

export function CanvasHintBanner() {
  const [dismissed, setDismissed] = useState(true) // default hidden until we check localStorage, to avoid a flash
  // Both this and the AI Builder's "working" pill sit top-center — showing
  // static "here's how to build" instructions while the AI is actively
  // building is both redundant and a visual collision, so just step aside.
  const chatStreaming = useWorkflowStore((s) => s.chatStreaming)

  useEffect(() => {
    setDismissed(typeof globalThis !== 'undefined' && globalThis.localStorage.getItem(STORAGE_KEY) === '1')
  }, [])

  if (dismissed || chatStreaming) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      globalThis.localStorage.setItem(STORAGE_KEY, '1')
    } catch {}
  }

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-xs rounded-lg px-3 py-2 shadow-sm max-w-md">
      <Lightbulb className="w-3.5 h-3.5 shrink-0" />
      <span>
        Drag node types from the left onto the canvas to add steps, click a node to edit it, connect nodes by dragging
        from their edges, then hit <strong>Deploy</strong> when you're ready to test.
      </span>
      <button onClick={dismiss} className="shrink-0 hover:opacity-70" aria-label="Dismiss">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
