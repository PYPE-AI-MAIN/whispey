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

export const QUICK_RULES = [
  'they ask for a human or a real person',
  'they describe an emergency',
  'they ask you to stop calling',
  'they are not interested',
  'it is a wrong number',
]

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
  const listening = workflow.nodes.filter((n) => ['conversation', 'extract_variable', 'subagent'].includes(n.type) && !(n as { skipUserResponse?: boolean }).skipUserResponse).length
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
            Things that can happen at any point in the call, like "they ask for a human". Write the rule once here instead of drawing an arrow from every step.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          <div className="space-y-1 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
            <p><strong className="text-foreground">Use a global rule when</strong> the same thing should happen from most steps: a human request, an emergency, "stop calling me", "not interested", wrong number.</p>
            <p><strong className="text-foreground">What it does:</strong> on every step it applies to, the agent gets one more option, "if this happens, go to that step". Keep to a few, because each rule is one more thing the agent weighs on every turn.</p>
            <p><strong className="text-foreground">Do not use it</strong> for a choice that only belongs to one step. Draw that as a normal connection.</p>
          </div>

          <Button variant="outline" size="sm" onClick={tidy}>
            <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Merge repeated connections
          </Button>

          <ul className="space-y-2">
            {rules.map((r) => (
              <li key={r.id} className="flex items-start gap-2 rounded-lg border border-border p-3">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="text-foreground">{r.condition}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Go to {name(r.target)} · from {r.sources.length ? `${r.sources.length} steps` : `all ${listening} steps that listen`}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Delete rule" onClick={() => patchWorkflow({ globalRules: rules.filter((x) => x.id !== r.id) })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
            {!rules.length && <li className="text-sm text-muted-foreground">No global rules yet.</li>}
            {rules.length > 6 && (
              <li className="text-xs text-warning">
                {rules.length} rules is a lot. The agent weighs every one on every step, so merge similar ones.
              </li>
            )}
          </ul>

          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">Add a rule</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_RULES.map((q) => (
                <button key={q} type="button" onClick={() => setCondition(q)} className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground">
                  {q}
                </button>
              ))}
            </div>
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
