'use client'

import React, { useEffect, useState } from 'react'
import { X, Lightbulb } from 'lucide-react'

const STORAGE_KEY = 'whispey-workflow-hint-dismissed'

export function CanvasHintBanner() {
  const [dismissed, setDismissed] = useState(true) // default hidden until we check localStorage, to avoid a flash

  useEffect(() => {
    setDismissed(typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === '1')
  }, [])

  if (dismissed) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
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
