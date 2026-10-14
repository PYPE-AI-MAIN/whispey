'use client'

import React, { useState } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useWorkflowStore } from '@/stores/workflowStore'
import { safeParseWorkflow } from '@/lib/workflow/schema'
import { Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import { WORKFLOW_AI_PROMPT } from '@/lib/workflow/aiPrompt'

// Paste a full workflow JSON and drop it straight onto the canvas — no LLM.
// Same validation the AI-builder apply path uses, incl. the graphless guard.
// Copies a prompt that teaches any AI the workflow format, so people can have it write a flow to paste here.
async function copyAiPrompt() {
  try {
    await navigator.clipboard.writeText(WORKFLOW_AI_PROMPT)
    toast.success('Prompt copied. Paste it into any AI, describe your agent, then paste its answer here.')
  } catch {
    toast.error('Could not copy. Select the text in the docs instead.')
  }
}

export function ImportJsonSheet({ open, onOpenChange }: Readonly<{ open: boolean; onOpenChange: (v: boolean) => void }>) {
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
          <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={copyAiPrompt}>
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy a prompt for any AI
          </Button>
        </SheetHeader>
        {/* SheetContent itself has no padding — it lives on the header/footer, so
            the body needs its own px-4. min-h-0 lets the textarea flex-shrink. */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='{ "schemaVersion": "1.0", "start": "greeting", "nodes": [ ... ] }'
            className="min-h-[240px] w-full flex-1 resize-none rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs outline-none focus:ring-2 focus:ring-violet-500"
          />
          {error && <p className="text-xs whitespace-pre-wrap text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" onClick={handleImport} disabled={!text.trim()}>Import to canvas</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
