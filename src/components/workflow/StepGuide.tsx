'use client'

import React from 'react'
import { Trash2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { createDefaultNode, type Workflow, type WorkflowNode } from '@/lib/workflow/schema'
import { useWorkflowStore } from '@/stores/workflowStore'
import { LogicConditionField } from './LogicConditionField'

const LISTENING = new Set(['conversation', 'extract_variable', 'subagent'])
// These can finish a call or hand it over, so having nothing after them is normal.
const FINISHING = new Set(['ending', 'note', 'call_transfer'])

const stepName = (wf: Workflow, id: string) => wf.nodes.find((n) => n.id === id)?.name || id

/**
 * What to do next on this step, in plain words, with the button to do it. Shown only when something is missing:
 * nothing leads here yet, or nothing follows it.
 */
export function StepGuide({ node, workflow }: Readonly<{ node: WorkflowNode; workflow: Workflow }>) {
  const addEdge = useWorkflowStore((s) => s.addEdge)
  const addNode = useWorkflowStore((s) => s.addNode)
  const setSelectedEdge = useWorkflowStore((s) => s.setSelectedEdge)

  if (node.type === 'note') return null
  const isStart = workflow.start === node.id
  const incoming = workflow.edges.some((e) => e.target === node.id) || (workflow.globalRules ?? []).some((r) => r.target === node.id)
  const outgoing = workflow.edges.some((e) => e.source === node.id)
  const unreachable = !isStart && !incoming
  const deadEnd = !FINISHING.has(node.type) && !outgoing
  if (!unreachable && !deadEnd) return null

  const others = workflow.nodes.filter((n) => n.id !== node.id && n.type !== 'note')

  // A second way out of a step that listens needs a "when": make it one and open it.
  const connect = (source: WorkflowNode, targetId: string) => {
    const has = workflow.edges.some((e) => e.source === source.id)
    const asking = has && LISTENING.has(source.type)
    const id = `edge-${crypto.randomUUID()}`
    addEdge({ id, source: source.id, target: targetId, kind: asking ? 'condition' : 'always' })
    if (asking) setSelectedEdge(id)
  }

  const endAfter = () => {
    const endId = `node-${crypto.randomUUID()}`
    addNode(createDefaultNode('ending', endId, { x: (node.position?.x ?? 0) + 320, y: node.position?.y ?? 0 }))
    addEdge({ id: `edge-${crypto.randomUUID()}`, source: node.id, target: endId, kind: 'always' })
  }

  return (
    <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      {unreachable && (
        <div className="space-y-1.5">
          <p className="font-medium">Nothing leads to this step yet.</p>
          <p>The call can only reach it if another step connects here.</p>
          <Select
            onValueChange={(sid) => {
              const src = workflow.nodes.find((n) => n.id === sid)
              if (src) connect(src, node.id)
            }}
          >
            <SelectTrigger className="h-8 bg-background text-xs"><SelectValue placeholder="Connect it from…" /></SelectTrigger>
            <SelectContent>
              {others.filter((n) => n.type !== 'ending').map((n) => (
                <SelectItem key={n.id} value={n.id}>{stepName(workflow, n.id)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {deadEnd && (
        <div className="space-y-1.5">
          <p className="font-medium">This step has no way forward yet.</p>
          <p>Say where the call goes after it, or end the call here.</p>
          <Select onValueChange={(tid) => connect(node, tid)}>
            <SelectTrigger className="h-8 bg-background text-xs"><SelectValue placeholder="Then go to…" /></SelectTrigger>
            <SelectContent>
              {others.map((n) => (
                <SelectItem key={n.id} value={n.id}>{stepName(workflow, n.id)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 bg-background text-xs" onClick={endAfter}>
            End the call after this step
          </Button>
        </div>
      )}
    </div>
  )
}

/** A Branch step's paths, one row each: "if [rule] go to [step]", plus what happens otherwise. */
export function BranchEditor({ node, workflow }: Readonly<{ node: WorkflowNode; workflow: Workflow }>) {
  const updateEdge = useWorkflowStore((s) => s.updateEdge)
  const removeEdge = useWorkflowStore((s) => s.removeEdge)
  const paths = workflow.edges.filter((e) => e.source === node.id)

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        A Branch says nothing. It looks at what you already know and picks a path. Add each path with the + on this step, then set its rule here.
      </p>
      {paths.length === 0 && <p className="text-xs text-foreground">No paths yet. Hover the step on the canvas and click +.</p>}
      {paths.map((e, i) => (
        <div key={e.id} className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground">Path {i + 1}: go to {stepName(workflow, e.target)}</p>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Remove this path" onClick={() => removeEdge(e.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Select value={e.kind === 'fallback' ? 'otherwise' : 'rule'} onValueChange={(v) => updateEdge(e.id, { kind: v === 'otherwise' ? 'fallback' : 'logic' })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="rule">When a rule matches</SelectItem>
              <SelectItem value="otherwise">Otherwise (nothing else matched)</SelectItem>
            </SelectContent>
          </Select>
          {e.kind !== 'fallback' && (
            <LogicConditionField key={e.id} workflow={workflow} value={e.expression ?? ''} onChange={(expression) => updateEdge(e.id, { expression, kind: 'logic' })} />
          )}
        </div>
      ))}
      {paths.length > 0 && !paths.some((e) => e.kind === 'fallback') && (
        <p className="text-xs text-muted-foreground">Tip: make the last path "Otherwise" so the call always has somewhere to go.</p>
      )}
    </div>
  )
}
