'use client'

import React, { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useWorkflowStore } from '@/stores/workflowStore'
import { safeParseWorkflow } from '@/lib/workflow/schema'
import toast from 'react-hot-toast'

// Paste a full workflow JSON and drop it straight onto the canvas — no LLM.
// Same validation the AI-builder apply path uses, incl. the graphless guard.
export function ImportJsonSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const setWorkflow = useWorkflowStore((s) => s.setWorkflow)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleImport = () => {
    setError(null)
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      setError('Not valid JSON — check for a trailing comma or a cut-off paste.')
      return
    }
    const parsed = safeParseWorkflow(raw)
    if (!parsed.success) {
      setError(parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
      return
    }
    if (parsed.data.nodes.length === 0 || !parsed.data.nodes.some((n) => n.id === parsed.data.start)) {
      setError('Workflow has no usable nodes, or "start" does not point to a real node id.')
      return
    }
    setWorkflow(parsed.data)
    toast.success(`Imported workflow (${parsed.data.nodes.length} nodes)`)
    setText('')
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[540px] flex flex-col gap-3">
        <SheetHeader>
          <SheetTitle>Paste Workflow JSON</SheetTitle>
        </SheetHeader>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Paste a complete workflow JSON (schemaVersion 1.0). It replaces the current canvas.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='{ "schemaVersion": "1.0", "start": "greeting", "nodes": [ ... ] }'
          className="flex-1 min-h-[300px] w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 font-mono text-xs outline-none focus:ring-2 focus:ring-violet-500"
        />
        {error && <p className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" onClick={handleImport} disabled={!text.trim()}>Import to canvas</Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
