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
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type OnConnectStart,
  type OnConnectEnd,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowLeft, MessageCircle, Phone, Clock, GitBranch, Plus, Save, Trash2, ShieldCheck, Copy, Check } from 'lucide-react'

import { FlowNode } from './flow-node'
import { SmartEdge } from './smart-edge'
import { RetryRuleEditor } from './retry-rule-editor'
import { BranchConditionEditor, emptyBranchCondition } from './branch-condition-editor'
import { WhatsAppTemplateEditor } from './whatsapp-template-editor'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CampaignFlowSummary, ConditionNodeConfig, ConditionRule, DispatchNodeConfig, FlowNodeData, FlowNodeKind, WaitNodeConfig } from '@/lib/campaignFlows/types'
import { defaultConfigFor, isChannelKind } from '@/lib/campaignFlows/types'
import { insertOnEdge, layoutTree, makeRoomBelow, nextId, removeNode } from '@/lib/campaignFlows/graph-ops'
import { useProjectAgents } from '@/hooks/useProjectAgents'
import { useAgentById } from '@/hooks/useAgentById'
import { agentDisplayName } from '@/lib/agentDisplayName'
import { parseExtractorKeys } from '@/lib/flagRulesValidation'

const nodeTypes = { flow: FlowNode }
const edgeTypes = { smart: SmartEdge }

// Dispatch channels a step can actually be. 'video' isn't here — it's
// currently just a WhatsApp message with a video attachment, not its own
// dispatch path, so it isn't its own block.
const paletteItems: { kind: FlowNodeKind; label: string; icon: React.ElementType }[] = [
  { kind: 'whatsapp', label: 'WhatsApp message', icon: MessageCircle },
  { kind: 'call', label: 'Phone call', icon: Phone },
  { kind: 'wait', label: 'Wait', icon: Clock },
]

const conditionPaletteItem: { kind: FlowNodeKind; label: string; icon: React.ElementType } = {
  kind: 'condition',
  label: 'Condition',
  icon: GitBranch,
}

// Everything a step can be, for the header's "Add step" menu — includes
// Condition, which is its own visible block in the graph (a single yes/no
// question) rather than something hidden inside a dispatch node's settings.
const stepPaletteItems = [...paletteItems, conditionPaletteItem]

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
  const [idCopied, setIdCopied] = React.useState(false)

  // n8n-style: a step is added by dragging a connection out from a node's
  // handle, not by a button. Dropping on empty canvas (rather than another
  // node) opens a small step-type picker right there, then creates and
  // wires the new node in one motion.
  const connectStartRef = React.useRef<{ nodeId: string; handleId: string | null } | null>(null)
  const [pendingConnection, setPendingConnection] = React.useState<{
    sourceNodeId: string
    sourceHandle: string | null
    flowPosition: { x: number; y: number }
    screenPosition: { x: number; y: number }
  } | null>(null)
  const screenToFlowPositionRef = React.useRef<((pos: { x: number; y: number }) => { x: number; y: number }) | null>(null)
  const canvasWrapperRef = React.useRef<HTMLDivElement>(null)

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

  // A condition block's rules are freeform and user-defined, built from the
  // same real signals a client already understands from campaign retry rules
  // (sipCode / metric / fieldExtractor / metadata) — e.g. "disconnected 3+
  // times" is just a metric condition (metricName: disconnect_count, >=, 3).
  // Whatever rules exist, they combine (AND/OR) into exactly one yes/no —
  // the block always has exactly two outputs, never more.
  const addConditionRule = () => {
    if (!conditionConfig) return
    pushHistory()
    const rule: ConditionRule = { id: nextId(), condition: emptyBranchCondition('sipCode') }
    updateSelectedConfig({ rules: [...conditionConfig.rules, rule] })
  }

  const updateConditionRule = (ruleId: string, patch: Partial<ConditionRule>) => {
    if (!conditionConfig) return
    updateSelectedConfig({
      rules: conditionConfig.rules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)),
    })
  }

  const removeConditionRule = (ruleId: string) => {
    if (!conditionConfig) return
    pushHistory()
    updateSelectedConfig({ rules: conditionConfig.rules.filter((r) => r.id !== ruleId) })
  }

  const unlinkOutcome = (sourceHandle: string) => {
    if (!selectedNodeId) return
    pushHistory()
    setEdges((eds) => eds.filter((e) => !(e.source === selectedNodeId && e.sourceHandle === sourceHandle)))
  }

  // Finishes a connection dragged out to empty canvas: creates the picked
  // step at the drop position and wires it to whichever handle the drag
  // started from.
  const createNodeFromConnection = (kind: FlowNodeKind) => {
    if (!pendingConnection) return
    pushHistory()
    const { sourceNodeId, sourceHandle, flowPosition } = pendingConnection
    const newNode: FNode = {
      id: nextId(),
      type: 'flow',
      position: flowPosition,
      data: { kind, title: stepPaletteItems.find((p) => p.kind === kind)?.label ?? kind, config: defaultConfigFor(kind) },
    }
    const label = sourceHandle === 'yes' ? 'Yes' : sourceHandle === 'no' ? 'No' : undefined
    setEdges((eds) => [
      ...eds,
      { id: `e-${sourceNodeId}-${sourceHandle ?? 'bottom'}-${newNode.id}`, source: sourceNodeId, target: newNode.id, sourceHandle: sourceHandle ?? undefined, targetHandle: 'top', label },
    ])
    setNodes((nds) => [...nds, newNode])
    setPendingConnection(null)
  }

  const onConnectStart: OnConnectStart = React.useCallback((_event, { nodeId, handleId }) => {
    connectStartRef.current = nodeId ? { nodeId, handleId } : null
  }, [])

  const onConnectEnd: OnConnectEnd = React.useCallback((event, connectionState) => {
    const start = connectStartRef.current
    connectStartRef.current = null
    // A connection that landed on a real target handle is a normal connect,
    // already handled by onConnect — only an invalid drop (empty canvas)
    // should offer to create a new step here.
    if (!start || connectionState.isValid) return
    const point = 'changedTouches' in event ? event.changedTouches[0] : event
    if (!point || !screenToFlowPositionRef.current || !canvasWrapperRef.current) return
    const flowPosition = screenToFlowPositionRef.current({ x: point.clientX, y: point.clientY })
    const wrapperRect = canvasWrapperRef.current.getBoundingClientRect()
    setPendingConnection({
      sourceNodeId: start.nodeId,
      sourceHandle: start.handleId,
      flowPosition,
      screenPosition: { x: point.clientX - wrapperRect.left, y: point.clientY - wrapperRect.top },
    })
  }, [])

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
  const conditionConfig = selectedNode?.data.kind === 'condition' ? (selectedNode.data.config as ConditionNodeConfig) : null

  const yesEdge = edges.find((e) => e.source === selectedNodeId && e.sourceHandle === 'yes')
  const noEdge = edges.find((e) => e.source === selectedNodeId && e.sourceHandle === 'no')
  const yesTarget = yesEdge ? nodes.find((n) => n.id === yesEdge.target) : undefined
  const noTarget = noEdge ? nodes.find((n) => n.id === noEdge.target) : undefined

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-900">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/${projectId}/campaigns/flows`)}
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
              {flowId && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(flowId)
                    setIdCopied(true)
                    setTimeout(() => setIdCopied(false), 1200)
                  }}
                  title={idCopied ? 'Copied!' : `${flowId} — click to copy. This is what ties this flow to its n8n workflow once compiled.`}
                  className="shrink-0 flex items-center gap-1 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  {idCopied ? <Check className="size-2.5" /> : <Copy className="size-2.5" />}
                  {flowId.slice(0, 8)}
                </button>
              )}
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
        <div ref={canvasWrapperRef} className="campaign-flow-canvas relative min-w-0 flex-1">
          {/* React Flow's own stylesheet puts `cursor: grab` directly on the
              draggable node wrapper. A class on our node's own inner content
              can't reliably out-specificity that rule, but a scoped override
              here — same specificity, later in the cascade — does. */}
          <style>{`.campaign-flow-canvas .react-flow__node { cursor: pointer; }`}</style>
          <ReactFlowProvider>
            <ScreenToFlowPositionBridge targetRef={screenToFlowPositionRef} />
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
              onConnectStart={onConnectStart}
              onConnectEnd={onConnectEnd}
              connectionMode={ConnectionMode.Loose}
              nodeTypes={nodeTypes}
              onNodeDoubleClick={(_, node) => setSelectedNodeId(node.id)}
              onPaneClick={() => {
                setSelectedNodeId(null)
                setPendingConnection(null)
              }}
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

          {pendingConnection && (
            <div
              className="absolute z-10 w-48 -translate-x-1/2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1"
              style={{ left: pendingConnection.screenPosition.x, top: pendingConnection.screenPosition.y }}
            >
              {stepPaletteItems.map((item) => (
                <button
                  key={item.kind}
                  onClick={() => createNodeFromConnection(item.kind)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <item.icon className="size-3.5 text-gray-400" />
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <Dialog open={!!selectedNode} onOpenChange={(open) => !open && setSelectedNodeId(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <DialogTitle>Step settings</DialogTitle>
                {selectedNode && selectedNode.data.kind !== 'trigger' && (
                  <button onClick={deleteSelected} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            </DialogHeader>
            {selectedNode && (
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
                                whatsappTemplate: p.kind === 'whatsapp' ? dispatchConfig.whatsappTemplate ?? (defaultConfigFor('whatsapp') as DispatchNodeConfig).whatsappTemplate : undefined,
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
                  {dispatchConfig.channel === 'whatsapp' && dispatchConfig.whatsappTemplate ? (
                    <div>
                      <Label className="text-xs mb-2 block">WhatsApp template</Label>
                      <WhatsAppTemplateEditor
                        config={dispatchConfig.whatsappTemplate}
                        onChange={(whatsappTemplate) => updateSelectedConfig({ whatsappTemplate })}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs">Message</Label>
                      <Textarea rows={3} value={dispatchConfig.message} onChange={(e) => updateSelectedConfig({ message: e.target.value })} placeholder="What gets said" />
                    </div>
                  )}
                  <div className="flex items-center gap-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-3 py-2">
                    <ShieldCheck className="size-3.5 shrink-0 text-gray-400" />
                    <span className="flex-1 text-[11.5px] text-gray-500 dark:text-gray-400">Checked against opt-outs first</span>
                    <input type="checkbox" checked={dispatchConfig.guardEnabled} onChange={(e) => updateSelectedConfig({ guardEnabled: e.target.checked })} className="size-3.5" />
                  </div>

                  <div>
                    <Label className="text-xs mb-2 block">Retry when…</Label>
                    <p className="mb-2 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                      These rules control retrying <em>this same step</em> — e.g. call again if it rings out. To route
                      to different next steps based on how it went, add a <strong>Condition</strong> block after this one.
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

              {conditionConfig ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Condition</div>
                    <p className="mt-0.5 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                      One yes/no question, built from what actually happened — a metric like{' '}
                      <code className="text-[10.5px]">transcription_metrics</code>, a call failure reason, or something
                      the agent extracted. Need more than one check (e.g. opt-out guard AND no 500 failure)? Add more
                      rules below — they combine into a single Yes/No. For multi-way logic, chain another Condition
                      block after this one, same as n8n's own <code className="text-[10.5px]">if</code> node.
                    </p>
                  </div>

                  {conditionConfig.rules.length > 1 && (
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                      Match
                      <div className="inline-flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                        {(['and', 'or'] as const).map((c) => (
                          <button
                            key={c}
                            onClick={() => updateSelectedConfig({ combinator: c })}
                            className={`px-2 py-0.5 text-[11px] font-medium uppercase ${
                              conditionConfig.combinator === c
                                ? 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400'
                                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                      of the rules below
                    </div>
                  )}

                  {conditionConfig.rules.map((rule) => (
                    <div key={rule.id} className="rounded-md border border-gray-200 dark:border-gray-700 p-2.5">
                      <BranchConditionEditor
                        condition={rule.condition}
                        onChange={(condition) => updateConditionRule(rule.id, { condition })}
                        onRemove={() => removeConditionRule(rule.id)}
                        fieldExtractorKeys={fieldExtractorKeys}
                      />
                    </div>
                  ))}

                  <Button variant="outline" size="sm" onClick={addConditionRule} className="h-7 justify-start gap-1.5 text-[12px]">
                    <Plus className="size-3" />
                    Add {conditionConfig.rules.length > 0 ? 'another rule' : 'a condition'}
                  </Button>

                  <Separator />

                  <div>
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300">What happens next</div>
                    <p className="mt-0.5 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                      Drag from the Yes/No handle below the block on the canvas to add or change a step.
                    </p>
                  </div>
                  <OutcomeSlot label="Yes" dotClassName="bg-emerald-400 dark:bg-emerald-500" targetTitle={yesTarget?.data.title} onUnlink={() => unlinkOutcome('yes')} />
                  <OutcomeSlot label="No" dotClassName="bg-red-400 dark:bg-red-500" targetTitle={noTarget?.data.title} onUnlink={() => unlinkOutcome('no')} />
                </div>
              ) : (
                <p className="text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                  Drag from the handle below this block on the canvas to add the next step.
                </p>
              )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

function ScreenToFlowPositionBridge({
  targetRef,
}: {
  targetRef: React.MutableRefObject<((pos: { x: number; y: number }) => { x: number; y: number }) | null>
}) {
  const { screenToFlowPosition } = useReactFlow()
  React.useEffect(() => {
    targetRef.current = screenToFlowPosition
    return () => {
      targetRef.current = null
    }
  }, [screenToFlowPosition, targetRef])
  return null
}

function OutcomeSlot({
  label,
  dotClassName,
  targetTitle,
  onUnlink,
}: {
  label: string
  dotClassName: string
  targetTitle?: string
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
        <span className="text-[11px] text-gray-400 dark:text-gray-500">Not connected</span>
      )}
    </div>
  )
}
