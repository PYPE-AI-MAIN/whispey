'use client'

import React, { useState } from 'react'
import { Trash2, Wand2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useWorkflowStore } from '@/stores/workflowStore'
import { extractGlobalRules } from '@/lib/workflow/globalRules'
import { computeAutoLayout } from '@/lib/workflow/autoLayout'

/** Rules that apply from many steps (asks for a human, emergency, ...), written once instead of an arrow from every step. */
export function GlobalRulesPanel({ open, onOpenChange }: Readonly<{ open: boolean; onOpenChange: (v: boolean) => void }>) {
  const workflow = useWorkflowStore((s) => s.workflow)
  const patchWorkflow = useWorkflowStore((s) => s.patchWorkflow)
  const updatePositions = useWorkflowStore((s) => s.updatePositions)
  const [condition, setCondition] = useState('')
  const [target, setTarget] = useState('')
  if (!workflow) return null

  const rules = workflow.globalRules ?? []
  const name = (id: string) => workflow.nodes.find((n) => n.id === id)?.name || id
  const endings = workflow.nodes.filter((n) => n.type === 'ending' || n.type === 'call_transfer')

  const add = () => {
    if (!condition.trim() || !target) return
    patchWorkflow({ globalRules: [...rules, { id: `global-${crypto.randomUUID().slice(0, 8)}`, target, condition: condition.trim(), sources: [] }] })
    setCondition('')
  }

  const tidy = () => {
    const { edges, globalRules } = extractGlobalRules(workflow)
    const moved = workflow.edges.length - edges.length
    if (!moved) {
      toast('No repeated rules found')
      return
    }
    patchWorkflow({ edges, globalRules })
    // Lay out the simplified flow left to right.
    const positions = computeAutoLayout({ nodes: workflow.nodes, edges })
    updatePositions(Object.entries(positions).map(([id, position]) => ({ id, position })))
    toast.success(`Merged ${moved} repeated connections into ${globalRules.length - rules.length} global rules`)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Global rules</SheetTitle>
          <SheetDescription>
            A rule that can fire from any step, such as "they ask for a human". Written once here instead of drawn from every step.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          <Button variant="outline" size="sm" onClick={tidy}>
            <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Merge repeated connections
          </Button>

          <ul className="space-y-2">
            {rules.map((r) => (
              <li key={r.id} className="flex items-start gap-2 rounded-lg border border-border p-3">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="text-foreground">{r.condition}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Go to {name(r.target)} · {r.sources.length ? `${r.sources.length} steps` : 'any step'}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Delete rule" onClick={() => patchWorkflow({ globalRules: rules.filter((x) => x.id !== r.id) })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
            {!rules.length && <li className="text-sm text-muted-foreground">No global rules yet.</li>}
          </ul>

          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">Add a rule</p>
            <Textarea value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="If the caller asks for a human" className="min-h-[70px]" />
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue placeholder="Then go to…" /></SelectTrigger>
              <SelectContent>
                {endings.map((n) => <SelectItem key={n.id} value={n.id}>{n.name || n.id}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={add} disabled={!condition.trim() || !target}>Add rule</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
