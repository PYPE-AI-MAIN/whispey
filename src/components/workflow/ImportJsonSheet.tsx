'use client'

import React, { useState } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
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
      {/* sm:max-w-lg, not a w-[…]: SheetContent defaults to sm:max-w-sm, which
          silently clamps any wider width. Matches VariablesPanel. */}
      <SheetContent side="right" className="w-full sm:max-w-lg">
        {/* pr-10 keeps the description clear of the absolutely-positioned close X */}
        <SheetHeader className="pr-10">
          <SheetTitle>Paste Workflow JSON</SheetTitle>
          <SheetDescription>
            Paste a complete workflow JSON (schemaVersion 1.0). It replaces the current canvas.
          </SheetDescription>
        </SheetHeader>
        {/* SheetContent itself has no padding — it lives on the header/footer, so
            the body needs its own px-4. min-h-0 lets the textarea flex-shrink. */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='{ "schemaVersion": "1.0", "start": "greeting", "nodes": [ ... ] }'
            className="min-h-[240px] w-full flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-xs outline-none focus:ring-2 focus:ring-violet-500 dark:border-gray-700 dark:bg-gray-900"
          />
          {error && <p className="text-xs whitespace-pre-wrap text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" onClick={handleImport} disabled={!text.trim()}>Import to canvas</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
