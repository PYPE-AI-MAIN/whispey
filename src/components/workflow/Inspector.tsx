'use client'

import React, { useState } from 'react'
import { Trash2, Star } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useWorkflowStore } from '@/stores/workflowStore'
import type { WorkflowNode, Edge, EdgeKind, Workflow } from '@/lib/workflow/schema'
import { NODE_REGISTRY } from './nodeRegistry'
import { LogicConditionField } from './LogicConditionField'

/** Textarea backed by a JSON-serialized object; keeps raw text while invalid so typing isn't fought. */
function JsonField({ label, value, onChange }: { label: string; value: unknown; onChange: (v: any) => void }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? {}, null, 2))
  const [error, setError] = useState(false)
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Textarea
        className="font-mono text-xs min-h-[80px]"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          try {
            onChange(JSON.parse(e.target.value || '{}'))
            setError(false)
          } catch {
            setError(true)
          }
        }}
      />
      {error && <p className="text-[10px] text-red-500">Invalid JSON — not saved until fixed</p>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}

function NodeFields({ node, patch }: { node: WorkflowNode; patch: (p: Partial<WorkflowNode>) => void }) {
  switch (node.type) {
    case 'conversation':
      return (
        <>
          <Field label="Prompt">
            <Textarea value={node.prompt ?? ''} onChange={(e) => patch({ prompt: e.target.value } as any)} className="min-h-[120px]" />
          </Field>
          <Field label="Static text (optional — skips the LLM)">
            <Textarea value={node.staticText ?? ''} onChange={(e) => patch({ staticText: e.target.value } as any)} />
          </Field>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Skip user response</Label>
            <Switch checked={!!node.skipUserResponse} onCheckedChange={(v) => patch({ skipUserResponse: v } as any)} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Block interruptions</Label>
            <Switch checked={!!node.blockInterruptions} onCheckedChange={(v) => patch({ blockInterruptions: v } as any)} />
          </div>
        </>
      )
    case 'extract_variable': {
      const extractions = node.extractions ?? []
      return (
        <>
          <Field label="Prompt">
            <Textarea value={node.prompt ?? ''} onChange={(e) => patch({ prompt: e.target.value } as any)} />
          </Field>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Extractions</Label>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[11px]"
                onClick={() => patch({ extractions: [...extractions, { variable: '', type: 'string' }] } as any)}
              >
                + Add
              </Button>
            </div>
            {extractions.map((ex, i) => (
              <div key={i} className="flex gap-1 items-start">
                <Input
                  placeholder="variable"
                  value={ex.variable}
                  onChange={(e) => {
                    const next = [...extractions]
                    next[i] = { ...ex, variable: e.target.value }
                    patch({ extractions: next } as any)
                  }}
                  className="h-7 text-xs"
                />
                <Input
                  placeholder="description"
                  value={ex.description ?? ''}
                  onChange={(e) => {
                    const next = [...extractions]
                    next[i] = { ...ex, description: e.target.value }
                    patch({ extractions: next } as any)
                  }}
                  className="h-7 text-xs"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={() => patch({ extractions: extractions.filter((_, j) => j !== i) } as any)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </>
      )
    }
    case 'logic_split':
      return (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          No fields here — add outgoing edges of kind &quot;condition&quot; or &quot;logic&quot; from the edge inspector to define branches.
        </p>
      )
    case 'function':
      return (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Method">
              <Select value={node.method} onValueChange={(v) => patch({ method: v as any })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="col-span-2">
              <Field label="URL">
                <Input value={node.url} onChange={(e) => patch({ url: e.target.value } as any)} placeholder="https://... or ${ENV_NAME}" />
              </Field>
            </div>
          </div>
          <JsonField label="Headers (JSON)" value={node.headers} onChange={(v) => patch({ headers: v } as any)} />
          <JsonField label="Body (JSON)" value={node.body} onChange={(v) => patch({ body: v } as any)} />
          <Field label="Wait message (spoken while the call runs)">
            <Input value={node.waitMessage ?? ''} onChange={(e) => patch({ waitMessage: e.target.value } as any)} />
          </Field>
          <Field label="Save result to variable">
            <Input value={node.saveAs ?? ''} onChange={(e) => patch({ saveAs: e.target.value } as any)} />
          </Field>
        </>
      )
    case 'knowledge':
      return (
        <>
          <Field label="Query"><Input value={node.query ?? ''} onChange={(e) => patch({ query: e.target.value } as any)} /></Field>
          <Field label="Knowledge base"><Input value={node.knowledgeBase ?? ''} onChange={(e) => patch({ knowledgeBase: e.target.value } as any)} /></Field>
          <Field label="Top K"><Input type="number" value={node.topK} onChange={(e) => patch({ topK: Number(e.target.value) } as any)} /></Field>
          <Field label="Save result to variable"><Input value={node.saveAs ?? ''} onChange={(e) => patch({ saveAs: e.target.value } as any)} /></Field>
        </>
      )
    case 'call_transfer':
      return (
        <>
          <Field label="Transfer to"><Input value={node.transferTo} onChange={(e) => patch({ transferTo: e.target.value } as any)} placeholder="+1..." /></Field>
          <Field label="Mode">
            <Select value={node.mode} onValueChange={(v) => patch({ mode: v as any })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cold">Cold (ends call)</SelectItem>
                <SelectItem value="warm">Warm (stays connected)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Message before transfer"><Textarea value={node.message ?? ''} onChange={(e) => patch({ message: e.target.value } as any)} /></Field>
        </>
      )
    case 'press_digit':
      return (
        <>
          <Field label="Mode">
            <Select value={node.mode} onValueChange={(v) => patch({ mode: v as any })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="send">Send digits</SelectItem>
                <SelectItem value="collect">Collect digits</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {node.mode === 'send' ? (
            <Field label="Digits to send"><Input value={node.digits ?? ''} onChange={(e) => patch({ digits: e.target.value } as any)} /></Field>
          ) : (
            <Field label="Number of digits to collect"><Input type="number" value={node.numDigits ?? ''} onChange={(e) => patch({ numDigits: Number(e.target.value) } as any)} /></Field>
          )}
          <Field label="Save result to variable"><Input value={node.saveAs ?? ''} onChange={(e) => patch({ saveAs: e.target.value } as any)} /></Field>
        </>
      )
    case 'sms':
      return (
        <>
          <Field label="To"><Input value={node.to ?? ''} onChange={(e) => patch({ to: e.target.value } as any)} placeholder="{{phone_number}}" /></Field>
          <Field label="Message"><Textarea value={node.message} onChange={(e) => patch({ message: e.target.value } as any)} /></Field>
          <Field label="Provider"><Input value={node.provider ?? ''} onChange={(e) => patch({ provider: e.target.value } as any)} placeholder="plivo / twilio / webhook" /></Field>
        </>
      )
    case 'subagent':
      return (
        <Field label="Prompt">
          <Textarea value={node.prompt} onChange={(e) => patch({ prompt: e.target.value } as any)} className="min-h-[140px]" />
        </Field>
      )
    case 'mcp':
      return (
        <>
          <Field label="Server"><Input value={node.server} onChange={(e) => patch({ server: e.target.value } as any)} /></Field>
          <Field label="Tool"><Input value={node.tool} onChange={(e) => patch({ tool: e.target.value } as any)} /></Field>
          <JsonField label="Args (JSON)" value={node.args} onChange={(v) => patch({ args: v } as any)} />
          <Field label="Save result to variable"><Input value={node.saveAs ?? ''} onChange={(e) => patch({ saveAs: e.target.value } as any)} /></Field>
        </>
      )
    case 'code':
      return (
        <>
          <Field label="Language">
            <Select value={node.language} onValueChange={(v) => patch({ language: v as any })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="python">Python</SelectItem>
                <SelectItem value="javascript">JavaScript</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Source">
            <Textarea value={node.source} onChange={(e) => patch({ source: e.target.value } as any)} className="font-mono text-xs min-h-[160px]" />
          </Field>
          <Field label="Save result to variable"><Input value={node.saveAs ?? ''} onChange={(e) => patch({ saveAs: e.target.value } as any)} /></Field>
        </>
      )
    case 'ending':
      return (
        <Field label="Farewell message">
          <Textarea value={node.message ?? ''} onChange={(e) => patch({ message: e.target.value } as any)} />
        </Field>
      )
    case 'note':
      return (
        <Field label="Note text">
          <Textarea value={node.text} onChange={(e) => patch({ text: e.target.value } as any)} />
        </Field>
      )
    default:
      return null
  }
}

function EdgeFields({ edge, workflow, patch }: { edge: Edge; workflow: Workflow; patch: (p: Partial<Edge>) => void }) {
  return (
    <>
      <Field label="Kind">
        <Select value={edge.kind} onValueChange={(v) => patch({ kind: v as EdgeKind })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="always">Always</SelectItem>
            <SelectItem value="condition">Condition (LLM-judged)</SelectItem>
            <SelectItem value="logic">Logic (expression)</SelectItem>
            <SelectItem value="fallback">Fallback (on error)</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      {edge.kind === 'condition' && (
        <Field label="Condition">
          <Textarea value={edge.condition ?? ''} onChange={(e) => patch({ condition: e.target.value })} placeholder="e.g. the caller wants to cancel" />
        </Field>
      )}
      {edge.kind === 'logic' && (
        <LogicConditionField key={edge.id} workflow={workflow} value={edge.expression ?? ''} onChange={(expression) => patch({ expression })} />
      )}
      <Field label="Label (optional)">
        <Input value={edge.label ?? ''} onChange={(e) => patch({ label: e.target.value })} />
      </Field>
    </>
  )
}

export function Inspector() {
  const workflow = useWorkflowStore((s) => s.workflow)
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId)
  const selectedEdgeId = useWorkflowStore((s) => s.selectedEdgeId)
  const updateNode = useWorkflowStore((s) => s.updateNode)
  const removeNode = useWorkflowStore((s) => s.removeNode)
  const updateEdge = useWorkflowStore((s) => s.updateEdge)
  const removeEdge = useWorkflowStore((s) => s.removeEdge)
  const setStart = useWorkflowStore((s) => s.setStart)
  const setSelectedNode = useWorkflowStore((s) => s.setSelectedNode)
  const setSelectedEdge = useWorkflowStore((s) => s.setSelectedEdge)

  const node = workflow?.nodes.find((n) => n.id === selectedNodeId)
  const edge = workflow?.edges.find((e) => e.id === selectedEdgeId)
  const open = !!node || !!edge

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setSelectedNode(null)
          setSelectedEdge(null)
        }
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        {node && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {NODE_REGISTRY[node.type]?.label}
                {node.id === workflow?.start && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
              </SheetTitle>
            </SheetHeader>
            <div className="px-4 space-y-4">
              <Field label="Name">
                <Input value={node.name ?? ''} onChange={(e) => updateNode(node.id, { name: e.target.value })} placeholder={node.type} />
              </Field>
              {/* key=node.id: JsonField's internal text state must reset when
                  switching selected nodes, or it shows the previous node's JSON. */}
              <NodeFields key={node.id} node={node} patch={(p) => updateNode(node.id, p)} />
            </div>
            <SheetFooter className="flex-row justify-between">
              {node.id !== workflow?.start && (
                <Button variant="outline" size="sm" onClick={() => setStart(node.id)}>
                  Set as start
                </Button>
              )}
              <Button variant="destructive" size="sm" onClick={() => removeNode(node.id)}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete node
              </Button>
            </SheetFooter>
          </>
        )}
        {edge && (
          <>
            <SheetHeader>
              <SheetTitle>Edge</SheetTitle>
            </SheetHeader>
            <div className="px-4 space-y-4">
              <EdgeFields edge={edge} workflow={workflow!} patch={(p) => updateEdge(edge.id, p)} />
            </div>
            <SheetFooter>
              <Button variant="destructive" size="sm" onClick={() => removeEdge(edge.id)}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete edge
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
