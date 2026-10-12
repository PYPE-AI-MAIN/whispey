'use client'

import React, { useState } from 'react'
import { Trash2, Star } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useWorkflowStore } from '@/stores/workflowStore'
import type { WorkflowNode, Edge, EdgeKind, Workflow } from '@/lib/workflow/schema'
import { lintWorkflow } from '@/lib/workflow/linter'
import { NODE_REGISTRY } from './nodeRegistry'
import { LogicConditionField } from './LogicConditionField'
import { BranchEditor, StepGuide } from './StepGuide'
import { explainIssue } from '@/lib/workflow/plainIssues'
import ModelSelector from '@/components/agents/AgentConfig/ModelSelector'
import SelectTTS from '@/components/agents/AgentConfig/SelectTTSDialog'

/** Points to where the outbound trunk/number actually lives (Agent settings,
 * transports.telephony.outbound) — this node has no field of its own for it,
 * so without this hint it's not discoverable that one exists at all. */
function OutboundTrunkHint({ workflow }: Readonly<{ workflow: Workflow | null }>) {
  const outbound = workflow?.transports?.telephony?.outbound as { sip_trunk_id?: string; sms_from?: string } | undefined
  return (
    <p className="text-[11px] text-gray-500 dark:text-gray-400">
      {outbound?.sip_trunk_id
        ? `Uses this agent's outbound number (set in Agent settings): ${outbound.sms_from || outbound.sip_trunk_id}.`
        : "No outbound number set for this agent — it's using the deployment's shared default trunk. Set one in Agent settings (top toolbar) → Telephony → Outbound number."}
    </p>
  )
}

/** Caller turns a speaking node may take without finding a way forward before it moves to its catch-all edge. */
function MaxTurnsField({ value, onChange }: Readonly<{ value?: number | null; onChange: (v: number | undefined) => void }>) {
  return (
    <details>
      <summary className="cursor-pointer text-xs text-gray-500 dark:text-gray-400">Advanced</summary>
      <div className="pt-2">
    <Field label="Give up after this many replies (default 8)" hint="If the caller never gives an answer that moves the call on, the agent takes the default next step.">
      <Input
        type="number"
        min={1}
        placeholder="8"
        value={value ?? ''}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10)
          onChange(Number.isFinite(n) && n >= 1 ? n : undefined)
        }}
        className="h-7 text-xs"
      />
    </Field>
      </div>
    </details>
  )
}

/** Textarea backed by a JSON-serialized object; keeps raw text while invalid so typing isn't fought. */
function JsonField({ label, value, onChange }: Readonly<{ label: string; value: unknown; onChange: (v: any) => void }>) {
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
      {error && <p className="text-[11px] text-red-500">Invalid JSON — not saved until fixed</p>}
    </div>
  )
}

function Field({ label, hint, children }: Readonly<{ label: string; hint?: string; children: React.ReactNode }>) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  )
}

function ToolsField({
  workflow,
  functions,
  onChange,
}: Readonly<{ workflow: Workflow | null; functions: string[]; onChange: (fns: string[]) => void }>) {
  const functionNodes = (workflow?.nodes ?? []).filter((n) => n.type === 'function')
  return (
    <Field label="Actions the agent can take here">
      {functionNodes.length === 0 ? (
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          No "Call an API" steps yet. Add one from More nodes, then tick it here so the agent can use it during this step.
        </p>
      ) : (
        <div className="space-y-1.5">
          {functionNodes.map((fn) => (
            <label key={fn.id} className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox
                checked={functions.includes(fn.id)}
                onCheckedChange={(checked) =>
                  onChange(checked ? [...functions, fn.id] : functions.filter((id) => id !== fn.id))
                }
              />
              {fn.name || fn.id}
            </label>
          ))}
        </div>
      )}
    </Field>
  )
}

function NodeFields({
  node,
  patch,
  workflow,
}: Readonly<{ node: WorkflowNode; patch: (p: Partial<WorkflowNode>) => void; workflow: Workflow | null }>) {
  switch (node.type) {
    case 'conversation':
      return (
        <>
          <Field label="What the agent should do here" hint="Write it like instructions to a new colleague: what to say, what to find out, when to move on.">
            <Textarea value={node.prompt ?? ''} onChange={(e) => patch({ prompt: e.target.value } as any)} className="min-h-[120px]" />
          </Field>
          <Field label="Exact words to say (optional)" hint="If you fill this in, the agent says exactly this and does not improvise.">
            <Textarea value={node.staticText ?? ''} onChange={(e) => patch({ staticText: e.target.value } as any)} />
          </Field>
          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs">Move on without waiting for a reply</Label>
            <Switch checked={!!node.skipUserResponse} onCheckedChange={(v) => patch({ skipUserResponse: v } as any)} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs">Do not let the caller interrupt</Label>
            <Switch checked={!!node.blockInterruptions} onCheckedChange={(v) => patch({ blockInterruptions: v } as any)} />
          </div>
          <MaxTurnsField value={node.maxTurns} onChange={(v) => patch({ maxTurns: v } as any)} />
          <ToolsField workflow={workflow} functions={node.functions ?? []} onChange={(fns) => patch({ functions: fns } as any)} />
          <details className="space-y-2 border-t border-gray-100 pt-2 dark:border-gray-800">
            <summary className="cursor-pointer text-xs text-gray-500 dark:text-gray-400">Different voice or model for this step only (optional)</summary>
            <Field label="Model">
              <ModelSelector
                selectedProvider={node.model?.name ?? ''}
                selectedModel={node.model?.model ?? ''}
                temperature={node.model?.temperature ?? undefined}
                onProviderChange={(provider) => patch({ model: { ...node.model, name: provider } } as any)}
                onModelChange={(model) => patch({ model: { ...node.model, name: node.model?.name || 'openai', model } } as any)}
                onTemperatureChange={(temperature) => patch({ model: { ...node.model, name: node.model?.name || 'openai', temperature } } as any)}
              />
            </Field>
            <Field label="Voice">
              <SelectTTS
                selectedVoice={node.voice?.voice_id ?? ''}
                initialProvider={node.voice?.name ?? undefined}
                initialModel={node.voice?.model ?? undefined}
                initialConfig={node.voice?.voice_settings ?? undefined}
                onVoiceSelect={(voiceId, provider, model, config) =>
                  patch({ voice: { name: provider, voice_id: voiceId, model: model ?? node.voice?.model, voice_settings: config } } as any)
                }
              />
            </Field>
          </details>
        </>
      )
    case 'extract_variable': {
      const extractions = node.extractions ?? []
      return (
        <>
          <Field label="What to ask" hint="The agent asks for these details, then moves on once it has all of them.">
            <Textarea value={node.prompt ?? ''} onChange={(e) => patch({ prompt: e.target.value } as any)} />
          </Field>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Details to collect</Label>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={() => patch({ extractions: [...extractions, { variable: '', type: 'string' }] } as any)}
              >
                + Add detail
              </Button>
            </div>
            {extractions.map((ex, i) => (
              <div key={`${ex.variable}-${i}`} className="flex gap-1 items-start">
                <Input
                  placeholder="name, e.g. phone_number"
                  value={ex.variable}
                  onChange={(e) => {
                    const next = [...extractions]
                    next[i] = { ...ex, variable: e.target.value }
                    patch({ extractions: next } as any)
                  }}
                  className="h-7 text-xs"
                />
                <Input
                  placeholder="what to listen for"
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
          <MaxTurnsField value={node.maxTurns} onChange={(v) => patch({ maxTurns: v } as any)} />
        </>
      )
    }
    case 'logic_split':
      return workflow ? <BranchEditor node={node} workflow={workflow} /> : null
    case 'function':
      return (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Request type">
              <Select value={node.method} onValueChange={(v) => patch({ method: v as typeof node.method })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="col-span-2">
              <Field label="Web address (URL)">
                <Input value={node.url} onChange={(e) => patch({ url: e.target.value } as any)} placeholder="https://... or ${ENV_NAME}" />
              </Field>
            </div>
          </div>
          <JsonField label="Headers (advanced, JSON)" value={node.headers} onChange={(v) => patch({ headers: v } as any)} />
          <JsonField label="Data to send (JSON)" value={node.body} onChange={(v) => patch({ body: v } as any)} />
          <Field label="Say this while waiting (optional)">
            <Input value={node.waitMessage ?? ''} onChange={(e) => patch({ waitMessage: e.target.value } as any)} />
          </Field>
          <Field label="Remember the result as (optional)" hint="Give it a name, then use {{name}} in later steps.">
            <Input value={node.saveAs ?? ''} onChange={(e) => patch({ saveAs: e.target.value } as any)} />
          </Field>
        </>
      )
    case 'knowledge':
      return (
        <>
          <p className="text-xs text-muted-foreground">Looks things up in the documents you uploaded (Setup menu, Knowledge base). Most flows do not need this step: turn on &quot;Answer from the knowledge base&quot; in Voice, model and language instead.</p>
          <Field label="What to search for" hint="Leave blank to search for what the caller just said."><Input value={node.query ?? ''} onChange={(e) => patch({ query: e.target.value } as any)} placeholder="{{var}} or blank = last user message" /></Field>
          <Field label="Use another agent's documents (leave blank for this agent)"><Input value={node.knowledgeBase ?? ''} onChange={(e) => patch({ knowledgeBase: e.target.value } as any)} placeholder="this agent" /></Field>
          <Field label="How many results to use"><Input type="number" value={node.topK} onChange={(e) => patch({ topK: Number(e.target.value) } as any)} /></Field>
          <Field label="Remember the result as (optional)" hint="Give it a name, then use {{name}} in later steps."><Input value={node.saveAs ?? ''} onChange={(e) => patch({ saveAs: e.target.value } as any)} /></Field>
        </>
      )
    case 'call_transfer':
      return (
        <>
          <Field label="Phone number to hand the call to"><Input value={node.transferTo} onChange={(e) => patch({ transferTo: e.target.value } as any)} placeholder="e.g. +91 98765 43210" /></Field>
          <Field label="How to hand over">
            <Select value={node.mode} onValueChange={(v) => patch({ mode: v as typeof node.mode })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cold">Hand over and leave the call</SelectItem>
                <SelectItem value="warm">Stay on the line until they answer</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Say this before handing over"><Textarea value={node.message ?? ''} onChange={(e) => patch({ message: e.target.value } as any)} /></Field>
          <OutboundTrunkHint workflow={workflow} />
        </>
      )
    case 'press_digit':
      return (
        <>
          <Field label="What to do">
            <Select value={node.mode} onValueChange={(v) => patch({ mode: v as typeof node.mode })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="send">Press keys for the caller</SelectItem>
                <SelectItem value="collect">Collect keys the caller types</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {node.mode === 'send' ? (
            <Field label="Keys to press"><Input value={node.digits ?? ''} onChange={(e) => patch({ digits: e.target.value } as any)} /></Field>
          ) : (
            <>
              <Field label="How many keys to collect"><Input type="number" value={node.numDigits ?? ''} onChange={(e) => patch({ numDigits: Number(e.target.value) } as any)} /></Field>
              <Field label="Timeout (seconds)"><Input type="number" value={node.timeout ?? 15} onChange={(e) => patch({ timeout: Number(e.target.value) } as any)} /></Field>
            </>
          )}
          <Field label="Remember the result as (optional)" hint="Give it a name, then use {{name}} in later steps."><Input value={node.saveAs ?? ''} onChange={(e) => patch({ saveAs: e.target.value } as any)} /></Field>
        </>
      )
    case 'sms':
      return (
        <>
          <Field label="To"><Input value={node.to ?? ''} onChange={(e) => patch({ to: e.target.value } as any)} placeholder="{{phone_number}}" /></Field>
          <Field label="Message"><Textarea value={node.message} onChange={(e) => patch({ message: e.target.value } as any)} /></Field>
          <Field label="Provider">
            <Select value={node.provider ?? ''} onValueChange={(v) => patch({ provider: v } as any)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select provider" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="plivo">Plivo</SelectItem>
                <SelectItem value="twilio">Twilio</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <OutboundTrunkHint workflow={workflow} />
        </>
      )
    case 'subagent':
      return (
        <>
          <Field label="Who this is and what to do" hint="Same as a conversation step, but with its own personality, voice and instructions.">
            <Textarea value={node.prompt} onChange={(e) => patch({ prompt: e.target.value } as any)} className="min-h-[140px]" />
          </Field>
          <MaxTurnsField value={node.maxTurns} onChange={(v) => patch({ maxTurns: v } as any)} />
          <ToolsField workflow={workflow} functions={node.functions ?? []} onChange={(fns) => patch({ functions: fns } as any)} />
          <details className="space-y-2 border-t border-gray-100 pt-2 dark:border-gray-800">
            <summary className="cursor-pointer text-xs text-gray-500 dark:text-gray-400">Different voice or model for this step only (optional)</summary>
            <Field label="Model">
              <ModelSelector
                selectedProvider={node.model?.name ?? ''}
                selectedModel={node.model?.model ?? ''}
                temperature={node.model?.temperature ?? undefined}
                onProviderChange={(provider) => patch({ model: { ...node.model, name: provider } } as any)}
                onModelChange={(model) => patch({ model: { ...node.model, name: node.model?.name || 'openai', model } } as any)}
                onTemperatureChange={(temperature) => patch({ model: { ...node.model, name: node.model?.name || 'openai', temperature } } as any)}
              />
            </Field>
            <Field label="Voice">
              <SelectTTS
                selectedVoice={node.voice?.voice_id ?? ''}
                initialProvider={node.voice?.name ?? undefined}
                initialModel={node.voice?.model ?? undefined}
                initialConfig={node.voice?.voice_settings ?? undefined}
                onVoiceSelect={(voiceId, provider, model, config) =>
                  patch({ voice: { name: provider, voice_id: voiceId, model: model ?? node.voice?.model, voice_settings: config } } as any)
                }
              />
            </Field>
          </details>
        </>
      )
    case 'mcp':
      return (
        <>
          <Field label="Tool server"><Input value={node.server} onChange={(e) => patch({ server: e.target.value } as any)} /></Field>
          <Field label="Tool"><Input value={node.tool} onChange={(e) => patch({ tool: e.target.value } as any)} /></Field>
          <JsonField label="Inputs for the tool (JSON)" value={node.args} onChange={(v) => patch({ args: v } as any)} />
          <Field label="Remember the result as (optional)" hint="Give it a name, then use {{name}} in later steps."><Input value={node.saveAs ?? ''} onChange={(e) => patch({ saveAs: e.target.value } as any)} /></Field>
        </>
      )
    case 'code':
      return (
        <>
          <Field label="Language">
            <Select value={node.language} onValueChange={(v) => patch({ language: v as typeof node.language })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="python">Python</SelectItem>
                <SelectItem value="javascript">JavaScript</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Code" hint="Collected details are available as variables.name.">
            <Textarea value={node.source} onChange={(e) => patch({ source: e.target.value } as any)} className="font-mono text-xs min-h-[160px]" />
          </Field>
          <Field label="Remember the result as (optional)" hint="Give it a name, then use {{name}} in later steps."><Input value={node.saveAs ?? ''} onChange={(e) => patch({ saveAs: e.target.value } as any)} /></Field>
        </>
      )
    case 'ending':
      return (
        <Field label="Last thing to say (optional)">
          <Textarea value={node.message ?? ''} onChange={(e) => patch({ message: e.target.value } as any)} />
        </Field>
      )
    case 'note':
      return (
        <Field label="Note (only people editing see this)">
          <Textarea value={node.text} onChange={(e) => patch({ text: e.target.value } as any)} />
        </Field>
      )
    default:
      return null
  }
}

const EDGE_KINDS: Record<EdgeKind, { label: string; help: string }> = {
  always: { label: 'Next step', help: 'Go here as soon as this step is done.' },
  condition: { label: 'When the caller says something', help: 'Go here when what the caller says matches the description below.' },
  logic: { label: 'When a saved value matches', help: 'Go here when a variable matches a rule, like age > 18. No AI involved.' },
  fallback: { label: 'Otherwise (automatic)', help: 'Used when none of the other connections apply. The system handles this for you, so you rarely need to touch it.' },
}

function EdgeFields({ edge, workflow, patch }: Readonly<{ edge: Edge; workflow: Workflow; patch: (p: Partial<Edge>) => void }>) {
  const nameOf = (id: string) => workflow.nodes.find((n) => n.id === id)?.name || id
  return (
    <>
      <p className="text-sm text-foreground">
        From <strong>{nameOf(edge.source)}</strong> to <strong>{nameOf(edge.target)}</strong>
      </p>
      <Field label="When does the call go here?">
        <Select value={edge.kind} onValueChange={(v) => patch({ kind: v as EdgeKind })}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(EDGE_KINDS) as EdgeKind[]).filter((k) => k !== 'fallback' || edge.kind === 'fallback').map((k) => (
              <SelectItem key={k} value={k}>{EDGE_KINDS[k].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1 text-xs text-muted-foreground">{EDGE_KINDS[edge.kind].help}</p>
      </Field>
      {(edge.kind === 'condition' || edge.kind === 'fallback') && (
        <Field label={edge.kind === 'condition' ? 'Describe when' : 'Describe when (optional)'}>
          <Textarea value={edge.condition ?? ''} onChange={(e) => patch({ condition: e.target.value })} placeholder="e.g. the caller wants to cancel" />
        </Field>
      )}
      {edge.kind === 'logic' && (
        <LogicConditionField key={edge.id} workflow={workflow} value={edge.expression ?? ''} onChange={(expression) => patch({ expression })} />
      )}
      <Field label="Short name on the canvas (optional)">
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
  // Issues for the selected node, shown inline so the fix is obvious without
  // hunting the lint popover. Lint is cheap and workflows are small.
  const nodeIssues = node && workflow ? lintWorkflow(workflow).filter((i) => i.nodeId === node.id) : []

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
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-white/10 p-0"
      >
        {node && (
          <>
            <SheetHeader className="border-b border-gray-100 dark:border-white/10 bg-gray-50/60 dark:bg-white/[0.02] gap-0.5">
              <SheetTitle className="flex items-center gap-2 text-base">
                {NODE_REGISTRY[node.type]?.label}
                {node.id === workflow?.start && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
              </SheetTitle>
              <p className="text-xs text-gray-500 dark:text-gray-400">{NODE_REGISTRY[node.type]?.useCase}</p>
            </SheetHeader>
            <div className="p-4">
              <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.03] p-4 space-y-4">
                {workflow && <StepGuide node={node} workflow={workflow} />}
                {nodeIssues.length > 0 && (
                  <div className="space-y-1">
                    {nodeIssues.map((iss) => (
                      <p
                        key={`${iss.severity}-${iss.message}`}
                        className={`text-[11px] rounded-md px-2 py-1.5 ${
                          iss.severity === 'error'
                            ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                        }`}
                      >
                        {iss.severity === 'error' ? 'Fix: ' : 'Check: '}
                        {explainIssue(iss, workflow)}
                      </p>
                    ))}
                  </div>
                )}
                <Field label="Name">
                  <Input value={node.name ?? ''} onChange={(e) => updateNode(node.id, { name: e.target.value })} placeholder={node.type} />
                </Field>
                <Field label="Stage (optional, groups steps in the Outline)">
                  <Input value={node.stage ?? ''} onChange={(e) => updateNode(node.id, { stage: e.target.value })} placeholder="e.g. Greeting, Pitch, Close" />
                </Field>
                {/* key=node.id: JsonField's internal text state must reset when
                    switching selected nodes, or it shows the previous node's JSON. */}
                <NodeFields key={node.id} node={node} patch={(p) => updateNode(node.id, p)} workflow={workflow} />
              </div>
            </div>
            <SheetFooter className="flex-row justify-between border-t border-gray-100 dark:border-white/10 bg-gray-50/60 dark:bg-white/[0.02]">
              {node.id !== workflow?.start && (
                <Button variant="outline" size="sm" onClick={() => setStart(node.id)}>
                  Make this the first step
                </Button>
              )}
              <Button variant="destructive" size="sm" onClick={() => removeNode(node.id)}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete step
              </Button>
            </SheetFooter>
          </>
        )}
        {edge && workflow && (
          <>
            <SheetHeader className="border-b border-gray-100 dark:border-white/10 bg-gray-50/60 dark:bg-white/[0.02] gap-0.5">
              <SheetTitle className="text-base">Connection</SheetTitle>
              <p className="text-xs text-gray-500 dark:text-gray-400">Decides when the call moves from one step to the next.</p>
            </SheetHeader>
            <div className="p-4">
              <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.03] p-4 space-y-4">
                <EdgeFields edge={edge} workflow={workflow} patch={(p) => updateEdge(edge.id, p)} />
              </div>
            </div>
            <SheetFooter className="border-t border-gray-100 dark:border-white/10 bg-gray-50/60 dark:bg-white/[0.02]">
              <Button variant="destructive" size="sm" onClick={() => removeEdge(edge.id)}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete connection
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
