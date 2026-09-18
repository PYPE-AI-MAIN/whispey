'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  ConnectionMode,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowLeft, MessageCircle, Phone, Video, Clock, GitBranch, Plus, Save, Trash2, ShieldCheck } from 'lucide-react'

import { FlowNode } from './flow-node'
import { SmartEdge } from './smart-edge'
import { RetryRuleEditor } from './retry-rule-editor'
import { BranchConditionEditor, emptyBranchCondition, summarizeCondition } from './branch-condition-editor'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { BranchNodeConfig, CampaignFlowSummary, DispatchNodeConfig, FlowBranch, FlowNodeData, FlowNodeKind, WaitNodeConfig } from '@/lib/campaignFlows/types'
import { defaultConfigFor, isChannelKind } from '@/lib/campaignFlows/types'
import { appendAfter, insertOnEdge, layoutTree, makeRoomBelow, nextId, outgoing, removeNode } from '@/lib/campaignFlows/graph-ops'
import { useProjectAgents } from '@/hooks/useProjectAgents'
import { useAgentById } from '@/hooks/useAgentById'
import { agentDisplayName } from '@/lib/agentDisplayName'
import { parseExtractorKeys } from '@/lib/flagRulesValidation'

const nodeTypes = { flow: FlowNode }
const edgeTypes = { smart: SmartEdge }

const paletteItems: { kind: FlowNodeKind; label: string; icon: React.ElementType }[] = [
  { kind: 'whatsapp', label: 'WhatsApp message', icon: MessageCircle },
  { kind: 'call', label: 'Phone call', icon: Phone },
  { kind: 'video', label: 'Video call', icon: Video },
  { kind: 'wait', label: 'Wait', icon: Clock },
]

const branchPaletteItem: { kind: FlowNodeKind; label: string; icon: React.ElementType } = {
  kind: 'branch',
  label: 'Branch',
  icon: GitBranch,
}

// Everything a step can be, for the header's "Add step" menu — includes
// Branch, which is its own visible block in the graph rather than something
// hidden inside a dispatch node's settings.
const stepPaletteItems = [...paletteItems, branchPaletteItem]

type FNode = Node<FlowNodeData>

export function CampaignFlowBuilder({
  flow,
  initialNodes,
  initialEdges,
}: {
  flow: CampaignFlowSummary
  initialNodes: FNode[]
  initialEdges: Edge[]
}) {
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectid as string

  // Only auto-layout truly fresh nodes (a brand-new flow's single trigger node
  // at the origin). A flow loaded back from a save already has real,
  // user-arranged positions — re-running layoutTree on every load would
  // silently discard them, which is exactly the "resets to center" bug this
  // builder used to have.
  const isUnpositioned = initialNodes.every((n) => n.position.x === 0 && n.position.y === 0)
  const [nodes, setNodes] = React.useState<FNode[]>(() =>
    isUnpositioned ? layoutTree(initialNodes, initialEdges) : initialNodes
  )
  const [edges, setEdges] = React.useState<Edge[]>(initialEdges)
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null)
  const [saveState, setSaveState] = React.useState<'idle' | 'saving' | 'saved'>('idle')
  const [agentId, setAgentId] = React.useState<string>(flow.agentId ?? '')
  const [name, setName] = React.useState(flow.name)
  const [description, setDescription] = React.useState(flow.description)

  // The flow's attached agent is what supplies real field-extractor field
  // names for branch/retry conditions — without one, those fall back to a
  // free-text field name since we have nothing to validate against.
  const { data: projectAgents = [] } = useProjectAgents(projectId)
  const { data: agentDetail } = useAgentById(agentId || undefined)
  const fieldExtractorKeys = React.useMemo(
    () => Array.from(parseExtractorKeys(agentDetail?.field_extractor_prompt)),
    [agentDetail]
  )

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null

  // Undo/redo: a snapshot is pushed right before any structural change (add,
  // delete, connect, or the start of a drag) — not on every intermediate drag
  // frame, so one Ctrl+Z undoes "that drag" or "that add", not one pixel of it.
  const undoStack = React.useRef<{ nodes: FNode[]; edges: Edge[] }[]>([])
  const redoStack = React.useRef<{ nodes: FNode[]; edges: Edge[] }[]>([])
  const draggingRef = React.useRef(false)

  // Mirrors of the latest nodes/edges, read by callbacks below instead of
  // closing over the `nodes`/`edges` state directly. Closing over state would
  // give pushHistory (and everything built on it) a new identity on every
  // render — including every single drag frame, since dragging updates
  // `nodes` continuously. That churn was propagating into edgesWithHandlers'
  // memo further down, forcing React Flow to treat the edges array as
  // "changed" on every frame of any node drag: the actual cause of the subtle
  // jitter/lag while dragging, not a rendering illusion.
  const nodesRef = React.useRef(nodes)
  const edgesRef = React.useRef(edges)
  React.useEffect(() => { nodesRef.current = nodes }, [nodes])
  React.useEffect(() => { edgesRef.current = edges }, [edges])

  const pushHistory = React.useCallback(() => {
    undoStack.current.push({ nodes: nodesRef.current, edges: edgesRef.current })
    redoStack.current = []
  }, [])

  const undo = React.useCallback(() => {
    const prev = undoStack.current.pop()
    if (!prev) return
    redoStack.current.push({ nodes: nodesRef.current, edges: edgesRef.current })
    setNodes(prev.nodes)
    setEdges(prev.edges)
    setSelectedNodeId(null)
  }, [])

  const redo = React.useCallback(() => {
    const next = redoStack.current.pop()
    if (!next) return
    undoStack.current.push({ nodes: nodesRef.current, edges: edgesRef.current })
    setNodes(next.nodes)
    setEdges(next.edges)
    setSelectedNodeId(null)
  }, [])

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return // let native undo work in text fields
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
      e.preventDefault()
      if (e.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

  const onConnect = React.useCallback(
    (connection: Connection) => {
      pushHistory()
      setEdges((eds) => addEdge(connection, eds))
    },
    [pushHistory]
  )

  // New nodes are placed relative to their source's CURRENT position, never by
  // re-running layout on the whole graph — that would silently move every node
  // you've already dragged, which is exactly the "resets to center" bug.
  const makeNode = (kind: FlowNodeKind, near?: { x: number; y: number }): FNode => ({
    id: nextId(),
    type: 'flow',
    position: near ? { x: near.x, y: near.y + 160 } : { x: 0, y: 0 },
    data: { kind, title: stepPaletteItems.find((p) => p.kind === kind)?.label ?? kind, config: defaultConfigFor(kind) },
  })

  const addUnattachedNode = (kind: FlowNodeKind) => {
    pushHistory()
    setNodes((nds) => [...nds, makeNode(kind)])
  }

  // Non-dispatch nodes (trigger, wait) only ever have one path forward.
  const addNextStep = (kind: FlowNodeKind) => {
    if (!selectedNodeId || !selectedNode) return
    pushHistory()
    const newNode = makeNode(kind, selectedNode.position)
    const outs = outgoing(selectedNodeId, edges)
    if (outs.length > 0) {
      const oldTarget = outs[0].target
      setEdges(insertOnEdge(edges, outs[0].id, newNode.id))
      setNodes((nds) => [...makeRoomBelow(nds, edges, oldTarget, 170), newNode])
    } else {
      setEdges(appendAfter(edges, selectedNodeId, newNode.id))
      setNodes((nds) => [...nds, newNode])
    }
  }

  // A branch block's branches are freeform and user-defined, built from the
  // same real signals a client already understands from campaign retry rules
  // (sipCode / metric / fieldExtractor / metadata) — e.g. "disconnected 3+
  // times" is just a metric condition (metricName: disconnect_count, >=, 3).
  // There's always exactly one extra fixed "Otherwise" fallback path besides
  // whatever branches are added, for anything no branch condition catches.
  const addBranch = () => {
    if (!selectedNodeId || !branchConfig) return
    pushHistory()
    const branch: FlowBranch = { id: nextId(), label: '', condition: emptyBranchCondition('sipCode') }
    updateSelectedConfig({ branches: [...branchConfig.branches, branch] })
  }

  const updateBranch = (branchId: string, patch: Partial<FlowBranch>) => {
    if (!branchConfig) return
    updateSelectedConfig({
      branches: branchConfig.branches.map((b) => (b.id === branchId ? { ...b, ...patch } : b)),
    })
  }

  const removeBranch = (branchId: string) => {
    if (!selectedNodeId || !branchConfig) return
    pushHistory()
    updateSelectedConfig({ branches: branchConfig.branches.filter((b) => b.id !== branchId) })
    setEdges((eds) => eds.filter((e) => !(e.source === selectedNodeId && e.sourceHandle === `branch-${branchId}`)))
  }

  // handle 'default' below is the fixed "Otherwise" fallback every branch
  // block has in addition to its user-defined branches.
  const addOutcomeStep = (sourceHandle: string, kind: FlowNodeKind, label: string) => {
    if (!selectedNodeId || !selectedNode) return
    pushHistory()
    const existingCount = outgoing(selectedNodeId, edges).length
    const newNode = makeNode(kind, { x: selectedNode.position.x + existingCount * 90 - 45, y: selectedNode.position.y })
    setEdges((eds) => [
      ...eds,
      { id: `e-${selectedNodeId}-${sourceHandle}-${newNode.id}`, source: selectedNodeId, target: newNode.id, sourceHandle, targetHandle: 'top', label },
    ])
    setNodes((nds) => [...nds, newNode])
  }

  const unlinkOutcome = (sourceHandle: string) => {
    if (!selectedNodeId) return
    pushHistory()
    setEdges((eds) => eds.filter((e) => !(e.source === selectedNodeId && e.sourceHandle === sourceHandle)))
  }

  const deleteSelected = () => {
    if (!selectedNodeId) return
    pushHistory()
    const result = removeNode(nodes, edges, selectedNodeId)
    setEdges(result.edges)
    setNodes(result.nodes)
    setSelectedNodeId(null)
  }

  const autoArrange = () => {
    pushHistory()
    setNodes((nds) => layoutTree(nds, edges))
  }

  // Insert a plain WhatsApp step right in the middle of an existing
  // connection — the "+" that appears on hovering a line, same idea as
  // n8n's own edge toolbar.
  const insertOnEdgeId = React.useCallback(
    (edgeId: string) => {
      const currentEdges = edgesRef.current
      const edge = currentEdges.find((e) => e.id === edgeId)
      if (!edge) return
      pushHistory()
      const sourceNode = nodesRef.current.find((n) => n.id === edge.source)
      const targetNode = nodesRef.current.find((n) => n.id === edge.target)
      const midpoint =
        sourceNode && targetNode
          ? { x: (sourceNode.position.x + targetNode.position.x) / 2, y: (sourceNode.position.y + targetNode.position.y) / 2 }
          : undefined
      const newNode = makeNode('whatsapp', midpoint)
      setEdges((eds) => insertOnEdge(eds, edgeId, newNode.id))
      // Push the old target (and everything after it) down so the new step
      // doesn't just land on top of what was already there.
      setNodes((nds) => [...makeRoomBelow(nds, currentEdges, edge.target, 170), newNode])
    },
    [pushHistory]
  )

  const deleteEdgeId = React.useCallback(
    (edgeId: string) => {
      pushHistory()
      setEdges((eds) => eds.filter((e) => e.id !== edgeId))
    },
    [pushHistory]
  )

  const edgesWithHandlers = React.useMemo(
    () => edges.map((e) => ({ ...e, data: { ...e.data, onInsert: insertOnEdgeId, onDelete: deleteEdgeId } })),
    [edges, insertOnEdgeId, deleteEdgeId]
  )

  const updateSelectedData = (patch: Partial<FlowNodeData>) => {
    if (!selectedNodeId) return
    setNodes((nds) => nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, ...patch } } : n)))
  }

  const updateSelectedConfig = (patch: Record<string, unknown>) => {
    if (!selectedNodeId) return
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNodeId
          ? { ...n, data: { ...n.data, config: { ...n.data.config, ...patch } as FlowNodeData['config'] } }
          : n
      )
    )
  }

  // Undefined/'new' means this flow has never been saved yet — first Save
  // creates the row and switches the URL to its real id, so every Save after
  // that PATCHes the same row instead of creating duplicates.
  const [flowId, setFlowId] = React.useState<string | undefined>(flow.flowId !== 'new' ? flow.flowId : undefined)
  const [saveError, setSaveError] = React.useState<string | null>(null)

  const handleSave = async () => {
    setSaveState('saving')
    setSaveError(null)
    const graph = { nodes, edges }
    try {
      if (!flowId) {
        const res = await fetch('/api/campaign-flows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, name, description, agentId: agentId || null, graph }),
        })
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Failed to save')
        const { flow: created } = await res.json()
        setFlowId(created.flow_id)
        router.replace(`/${projectId}/campaigns/flows/${created.flow_id}`)
      } else {
        const res = await fetch(`/api/campaign-flows/${flowId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description, agentId: agentId || null, graph }),
        })
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Failed to save')
      }
      setSaveState('saved')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
      setSaveState('idle')
      return
    }
    setTimeout(() => setSaveState('idle'), 2000)
  }

  const dispatchConfig = selectedNode && isChannelKind(selectedNode.data.kind) ? (selectedNode.data.config as DispatchNodeConfig) : null
  const waitConfig = selectedNode?.data.kind === 'wait' ? (selectedNode.data.config as WaitNodeConfig) : null
  const branchConfig = selectedNode?.data.kind === 'branch' ? (selectedNode.data.config as BranchNodeConfig) : null

  const defaultEdge = edges.find((e) => e.source === selectedNodeId && e.sourceHandle === 'default')
  const defaultTarget = defaultEdge ? nodes.find((n) => n.id === defaultEdge.target) : undefined
  const branchTarget = (branchId: string) => {
    const edge = edges.find((e) => e.source === selectedNodeId && e.sourceHandle === `branch-${branchId}`)
    return edge ? nodes.find((n) => n.id === edge.target) : undefined
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-900">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/${projectId}/campaigns?tab=flows`)}
            className="h-7 w-7 p-0 shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Untitled campaign flow"
                className="min-w-0 truncate rounded border border-transparent bg-transparent text-base font-semibold text-gray-900 dark:text-gray-100 hover:border-gray-200 dark:hover:border-gray-700 focus:border-gray-300 dark:focus:border-gray-600 focus:outline-none px-1 -mx-1"
              />
              <Badge variant="outline" className="text-[10px] shrink-0">{flow.status === 'live' ? 'Live' : 'Draft'}</Badge>
            </div>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a short description…"
              className="w-full truncate rounded border border-transparent bg-transparent text-xs text-gray-500 dark:text-gray-400 hover:border-gray-200 dark:hover:border-gray-700 focus:border-gray-300 dark:focus:border-gray-600 focus:outline-none px-1 -mx-1"
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Select value={agentId || undefined} onValueChange={setAgentId}>
            <SelectTrigger className="h-7 w-44 text-xs">
              <SelectValue placeholder="Attach an agent…" />
            </SelectTrigger>
            <SelectContent>
              {projectAgents.map((a) => (
                <SelectItem key={a.id} value={a.id}>{agentDisplayName(a) || a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={autoArrange}>
            Auto-arrange
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                <Plus className="w-3 h-3" />
                Add step
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {stepPaletteItems.map((item) => (
                <DropdownMenuItem key={item.kind} onClick={() => addUnattachedNode(item.kind)}>
                  <item.icon className="size-3.5 mr-2" />
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="h-7 text-xs gap-1.5" onClick={handleSave} disabled={saveState === 'saving'}>
            <Save className="w-3 h-3" />
            {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
      {saveError && (
        <div className="shrink-0 border-b border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-4 py-1.5 text-xs text-red-700 dark:text-red-400">
          {saveError}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="campaign-flow-canvas min-w-0 flex-1">
          {/* React Flow's own stylesheet puts `cursor: grab` directly on the
              draggable node wrapper. A class on our node's own inner content
              can't reliably out-specificity that rule, but a scoped override
              here — same specificity, later in the cascade — does. */}
          <style>{`.campaign-flow-canvas .react-flow__node { cursor: pointer; }`}</style>
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edgesWithHandlers}
              onNodesChange={(changes) => {
                const dragging = changes.some((c) => c.type === 'position' && c.dragging)
                if (dragging && !draggingRef.current) {
                  draggingRef.current = true
                  pushHistory()
                } else if (!dragging) {
                  draggingRef.current = false
                }
                setNodes((nds) => applyNodeChanges(changes, nds))
              }}
              onEdgesChange={(changes) => setEdges((eds) => applyEdgeChanges(changes, eds))}
              onConnect={onConnect}
              connectionMode={ConnectionMode.Loose}
              nodeTypes={nodeTypes}
              onNodeDoubleClick={(_, node) => setSelectedNodeId(node.id)}
              onPaneClick={() => setSelectedNodeId(null)}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              edgeTypes={edgeTypes}
              defaultEdgeOptions={{
                type: 'smart',
                style: { strokeWidth: 1.75 },
              }}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} className="opacity-40" />
              <Controls
                showInteractive={false}
                className="!rounded-xl !border !border-gray-200 dark:!border-gray-700 !bg-white/90 dark:!bg-gray-800/90 !shadow-lg [&>button]:!border-b-gray-200 dark:[&>button]:!border-b-gray-700 [&>button]:!bg-transparent [&>button:hover]:!bg-gray-100 dark:[&>button:hover]:!bg-gray-700 [&>button]:!fill-gray-600 dark:[&>button]:!fill-gray-300 [&>button]:!stroke-gray-600 dark:[&>button]:!stroke-gray-300"
              />
              <MiniMap
                pannable
                zoomable
                className="!overflow-hidden !rounded-xl !border !border-gray-200 dark:!border-gray-700 !bg-white/90 dark:!bg-gray-800/90 !shadow-lg"
                maskColor="rgba(0,0,0,0.15)"
                nodeColor="#9ca3af"
                nodeStrokeWidth={0}
              />
            </ReactFlow>
          </ReactFlowProvider>
        </div>

        {selectedNode && (
          <div className="w-80 shrink-0 overflow-y-auto border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Step settings</div>
              {selectedNode.data.kind !== 'trigger' && (
                <button onClick={deleteSelected} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400">
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
            <Separator className="my-3" />
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Title</Label>
                <Input value={selectedNode.data.title ?? ''} onChange={(e) => updateSelectedData({ title: e.target.value })} />
              </div>

              {dispatchConfig && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Channel</Label>
                    <div className="flex gap-1.5">
                      {paletteItems.filter((p) => p.kind !== 'wait').map((p) => (
                        <button
                          key={p.kind}
                          onClick={() =>
                            updateSelectedData({
                              kind: p.kind,
                              config: {
                                ...(defaultConfigFor(p.kind) as DispatchNodeConfig),
                                message: dispatchConfig.message,
                                retryRules: dispatchConfig.retryRules,
                              },
                            })
                          }
                          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[11.5px] font-medium ${
                            selectedNode.data.kind === p.kind
                              ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                              : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <p.icon className="size-3.5" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Message</Label>
                    <Textarea rows={3} value={dispatchConfig.message} onChange={(e) => updateSelectedConfig({ message: e.target.value })} placeholder="What gets sent or said" />
                  </div>
                  <div className="flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2">
                    <ShieldCheck className="size-3.5 shrink-0 text-gray-400" />
                    <span className="flex-1 text-[11.5px] text-gray-500 dark:text-gray-400">Checked against opt-outs first</span>
                    <input type="checkbox" checked={dispatchConfig.guardEnabled} onChange={(e) => updateSelectedConfig({ guardEnabled: e.target.checked })} className="size-3.5" />
                  </div>

                  <div>
                    <Label className="text-xs mb-2 block">Retry when…</Label>
                    <p className="mb-2 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                      These rules control retrying <em>this same step</em> — e.g. call again if it rings out. To route
                      to different next steps based on how it went, add a <strong>Branch</strong> block after this one.
                      {!agentId && ' Attach an agent above to pick field-extractor fields by name instead of typing them.'}
                    </p>
                    <RetryRuleEditor
                      rules={dispatchConfig.retryRules}
                      onChange={(rules) => updateSelectedConfig({ retryRules: rules })}
                      fieldExtractorKeys={fieldExtractorKeys}
                    />
                  </div>
                </>
              )}

              {waitConfig && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Wait for</Label>
                  <div className="flex gap-2">
                    <Input type="number" value={waitConfig.durationValue} onChange={(e) => updateSelectedConfig({ durationValue: Number(e.target.value) })} className="w-24" />
                    <select value={waitConfig.durationUnit} onChange={(e) => updateSelectedConfig({ durationUnit: e.target.value })} className="flex-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 text-sm">
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                    </select>
                  </div>
                </div>
              )}

              <Separator />

              {branchConfig ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Branches</div>
                    <p className="mt-0.5 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                      Send different contacts down different paths based on what actually happened on the call —
                      a metric like <code className="text-[10.5px]">transcription_metrics</code>, a call failure reason, or
                      something the agent extracted. The first matching branch wins; anything that matches none of
                      them falls to "Otherwise".
                    </p>
                  </div>

                  {branchConfig.branches.map((branch) => {
                    const target = branchTarget(branch.id)
                    return (
                      <div key={branch.id} className="rounded-md border border-gray-200 dark:border-gray-700 p-2.5">
                        <BranchConditionEditor
                          condition={branch.condition}
                          onChange={(condition) => updateBranch(branch.id, { condition })}
                          onRemove={() => removeBranch(branch.id)}
                          fieldExtractorKeys={fieldExtractorKeys}
                        />
                        <Input
                          className="mt-2 h-7 text-[12px]"
                          placeholder={summarizeCondition(branch.condition)}
                          value={branch.label}
                          onChange={(e) => updateBranch(branch.id, { label: e.target.value })}
                        />
                        <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-100 dark:border-gray-800 pt-2">
                          {target ? (
                            <>
                              <span className="text-xs text-gray-900 dark:text-gray-100 truncate">→ {target.data.title}</span>
                              <button
                                onClick={() => unlinkOutcome(`branch-${branch.id}`)}
                                className="shrink-0 text-[11px] text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                              >
                                Remove
                              </button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 justify-start text-xs -ml-2"
                              onClick={() => addOutcomeStep(`branch-${branch.id}`, 'whatsapp', branch.label || summarizeCondition(branch.condition))}
                            >
                              <Plus className="size-3.5" />
                              Add step
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  <Button variant="outline" size="sm" onClick={addBranch} className="h-7 justify-start gap-1.5 text-[12px]">
                    <Plus className="size-3" />
                    Add branch
                  </Button>

                  <OutcomeSlot
                    label="Otherwise"
                    dotClassName="bg-gray-300 dark:bg-gray-600"
                    targetTitle={defaultTarget?.data.title}
                    onAdd={() => addOutcomeStep('default', 'whatsapp', 'Otherwise')}
                    onUnlink={() => unlinkOutcome('default')}
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button variant="outline" size="sm" className="justify-start h-8 text-xs" onClick={() => addNextStep('whatsapp')}>
                    <Plus className="size-3.5" />
                    Add next step
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start h-8 text-xs" onClick={() => addNextStep('branch')}>
                    <GitBranch className="size-3.5" />
                    Add branch
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function OutcomeSlot({
  label,
  dotClassName,
  targetTitle,
  onAdd,
  onUnlink,
}: {
  label: string
  dotClassName: string
  targetTitle?: string
  onAdd: () => void
  onUnlink: () => void
}) {
  return (
    <div className="rounded-md border border-gray-200 dark:border-gray-700 p-2.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={`size-1.5 rounded-full ${dotClassName}`} />
        <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">{label}</span>
      </div>
      {targetTitle ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-900 dark:text-gray-100 truncate">→ {targetTitle}</span>
          <button onClick={onUnlink} className="shrink-0 text-[11px] text-gray-400 hover:text-red-600 dark:hover:text-red-400">
            Remove
          </button>
        </div>
      ) : (
        <Button variant="ghost" size="sm" className="h-7 justify-start text-xs -ml-2" onClick={onAdd}>
          <Plus className="size-3.5" />
          Add step
        </Button>
      )}
    </div>
  )
}
