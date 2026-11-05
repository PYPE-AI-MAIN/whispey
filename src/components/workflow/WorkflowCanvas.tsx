'use client'

import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  useReactFlow,
  type NodeChange,
  type EdgeChange,
  type NodeTypes,
  type EdgeTypes,
  type Connection,
  ConnectionLineType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useTheme } from 'next-themes'
import { Sparkles } from 'lucide-react'
import { useWorkflowStore } from '@/stores/workflowStore'
import { createDefaultNode, type NodeType } from '@/lib/workflow/schema'
import { computeAutoLayout } from '@/lib/workflow/autoLayout'
import { planConnection } from '@/lib/workflow/connect'
import { hasOverlappingSteps } from '@/lib/workflow/canvasModel'
import toast from 'react-hot-toast'
import { LoaderFive } from '@/components/ui/loader-five'
import { FlowNode } from './FlowNode'
import { StageNode } from './StageNode'
import { buildCanvasGraph } from './canvasGraph'
import { TraceBanner } from './TraceBanner'
import { CanvasToolbar } from './CanvasToolbar'
import { useDeleteConfirm } from './DeleteConfirm'
import { useUndoShortcuts } from './useUndoShortcuts'
import { WorkflowEdge } from './WorkflowEdge'
import { NODE_REGISTRY } from './nodeRegistry'
import { FOCUS_NODE_EVENT, PALETTE_DND_TYPE } from './WorkflowPalette'

const NODE_TYPES = {
  ...Object.fromEntries(Object.keys(NODE_REGISTRY).map((type) => [type, FlowNode])),
  stage: StageNode,
} as unknown as NodeTypes

const EDGE_TYPES: EdgeTypes = { workflow: WorkflowEdge }

export function WorkflowCanvas() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, fitView } = useReactFlow()
  const { resolvedTheme } = useTheme()

  const workflow = useWorkflowStore((s) => s.workflow)
  const chatStreaming = useWorkflowStore((s) => s.chatStreaming)
  const replaceCount = useWorkflowStore((s) => s.replaceCount)
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId)
  const selectedEdgeId = useWorkflowStore((s) => s.selectedEdgeId)
  const activeNodeId = useWorkflowStore((s) => s.activeNodeId)
  const tracePath = useWorkflowStore((s) => s.tracePath)
  const addNode = useWorkflowStore((s) => s.addNode)
  const addEdge = useWorkflowStore((s) => s.addEdge)
  const removeNode = useWorkflowStore((s) => s.removeNode)
  const removeEdge = useWorkflowStore((s) => s.removeEdge)
  const updatePositions = useWorkflowStore((s) => s.updatePositions)
  const setSelectedNode = useWorkflowStore((s) => s.setSelectedNode)
  const setSelectedEdge = useWorkflowStore((s) => s.setSelectedEdge)

  const { nodes: flowNodes, edges: flowEdges } = useMemo(
    () => (workflow ? buildCanvasGraph({ workflow, selectedNodeId, selectedEdgeId, trace: tracePath }) : { nodes: [], edges: [] }),
    [workflow, selectedNodeId, selectedEdgeId, tracePath]
  )

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const moved = changes.filter(
        (c): c is Extract<NodeChange, { type: 'position' }> => c.type === 'position' && !!c.position
      )
      if (moved.length) {
        updatePositions(moved.map((c) => ({ id: c.id, position: c.position! })))
      }
      changes.filter((c) => c.type === 'remove').forEach((c) => removeNode(c.id))
    },
    [updatePositions, removeNode]
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      changes
        .filter((c): c is Extract<EdgeChange, { type: 'remove' }> => c.type === 'remove')
        .forEach((c) => removeEdge(c.id))
    },
    [removeEdge]
  )

  const updateEdge = useWorkflowStore((st) => st.updateEdge)
  const snapshot = useWorkflowStore((st) => st.snapshot)
  const [showMap, setShowMap] = useState(() => (workflow?.nodes.length ?? 0) > 12)
  const { onBeforeDelete, dialog: deleteDialog } = useDeleteConfirm()
  useUndoShortcuts()
  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target || !workflow) return
      const plan = planConnection(workflow, { source: conn.source, target: conn.target, sourceHandle: conn.sourceHandle }, `edge-${crypto.randomUUID()}`)
      if (plan.action === 'retarget') {
        updateEdge(plan.edgeId, { target: plan.target })
        return
      }
      addEdge(plan.edge)
      if (plan.openForEditing) setSelectedEdge(plan.edge.id)
    },
    [addEdge, updateEdge, workflow, setSelectedEdge]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const type = e.dataTransfer.getData(PALETTE_DND_TYPE) as NodeType
      if (!type) return
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      addNode(createDefaultNode(type, `node-${crypto.randomUUID()}`, position))
    },
    [addNode, screenToFlowPosition]
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  // Whole-workflow replaces (chat apply, template pick, undo/redo) don't trigger
  // ReactFlow's own `fitView` (that only runs on mount) — re-fit manually so new
  // nodes are actually visible instead of sitting outside the current viewport.
  // A 40-step flow fitted whole is unreadably small: open on the first steps instead,
  // at a readable zoom. "Fit view" still shows everything.
  const nodeCount = workflow?.nodes.length ?? 0
  React.useEffect(() => {
    if (!workflow || nodeCount <= 12) return
    const first = workflow.nodes
      .filter((n) => n.type !== 'ending' && n.type !== 'note')
      .sort((a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0) || (a.position?.x ?? 0) - (b.position?.x ?? 0))
      .slice(0, 8)
      .map((n) => ({ id: n.id }))
    const t = setTimeout(() => fitView({ nodes: first, padding: 0.3, minZoom: 0.6, maxZoom: 1, duration: 300 }), 150)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run on load / whole-workflow replace only, not every edit
  }, [nodeCount > 12, replaceCount, fitView])

  React.useEffect(() => {
    if (replaceCount === 0) return
    const t = setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50)
    return () => clearTimeout(t)
  }, [replaceCount, fitView])

  // During a test call, keep the step the agent is on in view. Moving the canvas yourself stops following; the pill resumes it.
  const [follow, setFollow] = useState(true)
  React.useEffect(() => {
    if (!activeNodeId) setFollow(true)
    else if (follow) fitView({ nodes: [{ id: activeNodeId }], padding: 1.2, minZoom: 0.7, maxZoom: 1, duration: 500 })
  }, [activeNodeId, follow, fitView])

  // Outline clicks ask the canvas to bring that step into view.
  React.useEffect(() => {
    const onFocus = (e: Event) => fitView({ nodes: [{ id: (e as CustomEvent<string>).detail }], padding: 1.5, maxZoom: 1, duration: 300 })
    globalThis.addEventListener(FOCUS_NODE_EVENT, onFocus)
    return () => globalThis.removeEventListener(FOCUS_NODE_EVENT, onFocus)
  }, [fitView])

  // Cards are as tall as their lines now, so a layout drawn for the old, shorter cards can overlap: tidy it once on load.
  const tidiedFor = useRef(-1)
  React.useEffect(() => {
    if (!workflow || tidiedFor.current === replaceCount) return
    tidiedFor.current = replaceCount
    if (!hasOverlappingSteps(workflow.nodes, workflow.edges)) return
    const positions = computeAutoLayout(workflow)
    updatePositions(Object.entries(positions).map(([id, position]) => ({ id, position })))
    toast('Steps overlapped, so the layout was tidied.')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per loaded or replaced workflow
  }, [workflow !== null, replaceCount])

  const handleAutoArrange = useCallback(() => {
    if (!workflow) return
    snapshot()
    const positions = computeAutoLayout(workflow)
    updatePositions(Object.entries(positions).map(([id, position]) => ({ id, position })))
    toast.success('Layout applied')
    setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50)
  }, [workflow, updatePositions, fitView, snapshot])

  if (!workflow) return null

  return (
    <div
      ref={wrapperRef}
      role="application"
      className={`flex-1 h-full transition-shadow ${
        chatStreaming ? 'shadow-[inset_0_0_70px_14px_rgba(167,139,250,0.45)] animate-pulse' : ''
      }`}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <ReactFlow
        proOptions={{ hideAttribution: true }}
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => setSelectedNode(node.id)}
        onEdgeClick={(_, edge) => setSelectedEdge(edge.id)}
        onMoveStart={(event) => {
          if (event) setFollow(false) // a person moved it; programmatic moves have no event
        }}
        onPaneClick={() => {
          setSelectedNode(null)
          setSelectedEdge(null)
        }}
        deleteKeyCode={['Delete', 'Backspace']}
        onBeforeDelete={onBeforeDelete}
        onNodeDragStart={snapshot}
        onSelectionDragStart={snapshot}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        minZoom={0.2}
        // Moving around a big flow: two-finger scroll or wheel pans (shift for sideways), pinch or ctrl-scroll zooms,
        // and any mouse button drags the canvas. A few pixels of wobble while clicking a step no longer moves it.
        panOnScroll
        panOnDrag={[0, 1, 2]}
        nodeDragThreshold={4}
        paneClickDistance={4}
        zoomOnDoubleClick={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        {chatStreaming && (
          <Panel position="top-center">
            <div className="flex items-center gap-2 h-8 px-3 rounded-full bg-violet-600 text-white shadow-lg shadow-violet-600/30">
              <Sparkles className="h-3.5 w-3.5 shrink-0 animate-pulse" />
              <LoaderFive text="Pi is working…" className="text-xs" />
            </div>
          </Panel>
        )}
        <TraceBanner />
        {showMap && (
          <MiniMap
            pannable
            zoomable
            ariaLabel="Overview of the whole flow"
            nodeColor={(n) => (n.type === 'stage' ? 'transparent' : (NODE_REGISTRY[n.type as keyof typeof NODE_REGISTRY]?.color ?? '#9ca3af'))}
            maskColor={resolvedTheme === 'dark' ? 'rgba(14, 11, 22, 0.7)' : 'rgba(250, 248, 252, 0.7)'}
            style={{ width: 160, height: 100, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)' }}
          />
        )}
        {activeNodeId && (
          <Panel position="top-center">
            {follow ? (
              <span className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm">Following the call</span>
            ) : (
              <button type="button" onClick={() => setFollow(true)} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent">
                Follow the call
              </button>
            )}
          </Panel>
        )}
        <CanvasToolbar onAutoArrange={handleAutoArrange} showMap={showMap} onToggleMap={() => setShowMap((v) => !v)} />
      </ReactFlow>
      {deleteDialog}
    </div>
  )
}
