'use client'

import React, { useState } from 'react'
import { ArrowLeft, ChevronDown, Plus } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { createDefaultNode, type NodeType } from '@/lib/workflow/schema'
import { useWorkflowStore } from '@/stores/workflowStore'
import { NODE_REGISTRY } from './nodeRegistry'
import { FOCUS_NODE_EVENT } from './WorkflowPalette'

// What most people add next; everything else is in the left panel under More nodes.
const NEXT_STEPS: NodeType[] = ['conversation', 'extract_variable', 'logic_split', 'function', 'call_transfer', 'ending']
const MORE_STEPS: NodeType[] = ['subagent', 'knowledge', 'code', 'mcp', 'press_digit', 'sms', 'note']
// One short line per step type for this menu (the full description is in the step's own panel).
const HINT: Record<string, string> = {
  conversation: 'The agent talks with the caller',
  extract_variable: 'Ask for details like a name or date',
  logic_split: 'Pick a path from what you know, silently',
  function: 'Call another system, like a booking tool',
  call_transfer: 'Hand the call to a person',
  ending: 'Say goodbye and hang up',
  subagent: 'A different character with its own voice',
  knowledge: 'Look something up in your documents',
  code: 'Run a few lines of code',
  mcp: 'Use a connected tool server',
  press_digit: 'Press or collect phone keys',
  sms: 'Text the caller',
  note: 'A sticky note for editors',
}
// Steps that listen to the caller can be told "go there only when...".
const LISTENING = new Set(['conversation', 'extract_variable', 'subagent'])

/** The "+" after a step. Pick what comes next, say when the call goes there, and it is added and connected. */
export function AddNextStep({ id, x, y }: Readonly<{ id: string; x: number; y: number }>) {
  const addNode = useWorkflowStore((s) => s.addNode)
  const addEdge = useWorkflowStore((s) => s.addEdge)
  const setSelectedNode = useWorkflowStore((s) => s.setSelectedNode)
  const outgoing = useWorkflowStore((s) => s.workflow?.edges.filter((e) => e.source === id).length ?? 0)
  const sourceType = useWorkflowStore((s) => s.workflow?.nodes.find((n) => n.id === id)?.type)
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<NodeType | null>(null)
  const [always, setAlways] = useState(true)
  const [when, setWhen] = useState('')
  const [more, setMore] = useState(false)

  const canSayWhen = !!sourceType && LISTENING.has(sourceType)
  const close = (v: boolean) => {
    setOpen(v)
    if (!v) {
      setPicked(null)
      setMore(false)
    }
  }

  const add = (type: NodeType, edge: { kind: 'always' | 'condition' | 'logic' | 'fallback'; condition?: string }) => {
    const newId = `node-${crypto.randomUUID()}`
    const edgeId = `edge-${crypto.randomUUID()}`
    addNode(createDefaultNode(type, newId, { x: x + 320, y: y + outgoing * 140 }))
    addEdge({ id: edgeId, source: id, target: newId, ...edge })
    // A branch path still needs its rule, set on the Branch step; otherwise open the new step.
    if (edge.kind === 'logic') setSelectedNode(id)
    else setSelectedNode(newId)
    // The new step can land off screen: bring it into view once the canvas has it.
    setTimeout(() => globalThis.dispatchEvent(new CustomEvent(FOCUS_NODE_EVENT, { detail: newId })), 80)
    close(false)
    setWhen('')
  }

  const choose = (type: NodeType) => {
    if (!canSayWhen) {
      // Branch, API and other non-listening steps cannot judge what the caller says: next step, or a rule to set on the connection.
      // A Branch makes rule paths; another kind of step gets a second path for when it fails.
      add(type, { kind: sourceType === 'logic_split' ? 'logic' : (outgoing === 0 ? 'always' : 'fallback') })
      return
    }
    setPicked(type)
    setAlways(outgoing === 0)
    setWhen('')
  }

  const confirm = () => {
    if (!picked) return
    if (always) add(picked, { kind: 'always' })
    else add(picked, { kind: 'condition', condition: when.trim() })
  }

  return (
    <Popover open={open} onOpenChange={close}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Add the next step"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className={`nodrag nopan absolute -right-9 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-opacity hover:text-foreground ${open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      {/* React events bubble out of a portal to the node, so a click here would also select the node and open its panel. */}
      <PopoverContent side="right" align="start" className="nodrag nopan max-h-[min(70vh,26rem)] w-64 overflow-y-auto p-1.5" collisionPadding={12} onClick={(e) => e.stopPropagation()}>
        {picked ? (
          <div className="space-y-3 p-2">
            <button type="button" onClick={() => setPicked(null)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3 w-3" /> Back
            </button>
            <p className="text-sm font-medium text-foreground">When does the call go to this {NODE_REGISTRY[picked].label.toLowerCase()} step?</p>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setAlways(true)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-xs ${always ? 'border-foreground bg-accent text-foreground' : 'border-border text-muted-foreground'}`}
              >
                Right after this step is done
              </button>
              <button
                type="button"
                onClick={() => setAlways(false)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-xs ${always ? 'border-border text-muted-foreground' : 'border-foreground bg-accent text-foreground'}`}
              >
                Only when the caller says something
              </button>
              {!always && (
                <Textarea
                  autoFocus
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  placeholder="e.g. they want to cancel"
                  className="min-h-[60px] text-xs"
                />
              )}
            </div>
            <Button size="sm" className="w-full" onClick={confirm} disabled={!always && !when.trim()}>
              Add step
            </Button>
          </div>
        ) : (
          <>
            <p className="px-2 pb-1 pt-0.5 text-xs text-muted-foreground">What happens next?</p>
            {[...NEXT_STEPS, ...(more ? MORE_STEPS : [])].map((t) => {
              const m = NODE_REGISTRY[t]
              return (
                <button key={t} type="button" onClick={() => choose(t)} className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-accent">
                  <m.icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: m.color }} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{m.label}</span>
                    <span className="block text-xs text-muted-foreground">{HINT[t]}</span>
                  </span>
                </button>
              )
            })}
            {!more && (
              <button type="button" onClick={() => setMore(true)} className="flex w-full items-center gap-1 px-2 py-2 text-xs text-muted-foreground hover:text-foreground">
                More steps <ChevronDown className="h-3 w-3" />
              </button>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
