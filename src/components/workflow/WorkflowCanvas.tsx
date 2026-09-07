'use client'

import React, { useCallback, useMemo, useRef } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
  type Node,
  type Edge as FlowEdge,
  type NodeChange,
  type EdgeChange,
  type NodeTypes,
  type EdgeTypes,
  type Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { LayoutGrid, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWorkflowStore } from '@/stores/workflowStore'
import { createDefaultNode, type NodeType } from '@/lib/workflow/schema'
import { computeAutoLayout } from '@/lib/workflow/autoLayout'
import { LoaderFive } from '@/components/ui/loader-five'
import { FlowNode } from './FlowNode'
import { WorkflowEdge } from './WorkflowEdge'
import { NODE_REGISTRY } from './nodeRegistry'
import { PALETTE_DND_TYPE } from './WorkflowPalette'

const NODE_TYPES = Object.fromEntries(
  Object.keys(NODE_REGISTRY).map((type) => [type, FlowNode])
) as unknown as NodeTypes

const EDGE_TYPES: EdgeTypes = { workflow: WorkflowEdge }

function truncateLabel(text: string, max = 28): string {
  const trimmed = text.trim()
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed
}

/** The actual condition/expression text is what tells two "condition" edges
 * apart on the canvas — falling back to the edge KIND ("condition") made
 * every branch off a node look identical and unreadable. */
function edgeCanvasLabel(kind: string, explicitLabel: string | null | undefined, detail: string | null | undefined): string | undefined {
  if (explicitLabel) return explicitLabel
  if (detail) return truncateLabel(detail)
  if (kind === 'always') return undefined
  return kind
}

const EDGE_STYLE: Record<string, { stroke: string; dashed?: boolean }> = {
  always: { stroke: '#9ca3af' },
  condition: { stroke: '#f59e0b' },
  logic: { stroke: '#8b5cf6' },
  fallback: { stroke: '#ef4444', dashed: true },
}

export function WorkflowCanvas() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, fitView } = useReactFlow()

  const workflow = useWorkflowStore((s) => s.workflow)
  const chatStreaming = useWorkflowStore((s) => s.chatStreaming)
  const replaceCount = useWorkflowStore((s) => s.replaceCount)
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId)
  const selectedEdgeId = useWorkflowStore((s) => s.selectedEdgeId)
  const addNode = useWorkflowStore((s) => s.addNode)
  const addEdge = useWorkflowStore((s) => s.addEdge)
  const removeNode = useWorkflowStore((s) => s.removeNode)
  const removeEdge = useWorkflowStore((s) => s.removeEdge)
  const updatePositions = useWorkflowStore((s) => s.updatePositions)
  const setSelectedNode = useWorkflowStore((s) => s.setSelectedNode)
  const setSelectedEdge = useWorkflowStore((s) => s.setSelectedEdge)

  const flowNodes: Node[] = useMemo(() => {
    if (!workflow) return []
    return workflow.nodes.map((n, i) => ({
      id: n.id,
      type: n.type,
      position: n.position ?? { x: 80 + (i % 4) * 220, y: 80 + Math.floor(i / 4) * 160 },
      data: { ...n, isStart: n.id === workflow.start },
      selected: n.id === selectedNodeId,
    }))
  }, [workflow, selectedNodeId])

  const flowEdges: FlowEdge[] = useMemo(() => {
    if (!workflow) return []
    return workflow.edges.map((e) => {
      const style = EDGE_STYLE[e.kind] ?? EDGE_STYLE.always
      const detail = e.condition || e.expression
      const label = edgeCanvasLabel(e.kind, e.label, detail)
      return {
        id: e.id,
        type: 'workflow',
        source: e.source,
        target: e.target,
        selected: e.id === selectedEdgeId,
        label,
        animated: e.kind === 'condition' || e.kind === 'logic',
        style: { stroke: style.stroke, strokeDasharray: style.dashed ? '5 5' : undefined },
      }
    })
  }, [workflow, selectedEdgeId])

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

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!conn.source || !conn.target) return
      addEdge({ id: `edge-${crypto.randomUUID()}`, source: conn.source, target: conn.target, kind: 'always' })
    },
    [addEdge]
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
  React.useEffect(() => {
    if (replaceCount === 0) return
    const t = setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50)
    return () => clearTimeout(t)
  }, [replaceCount, fitView])

  const handleAutoArrange = useCallback(() => {
    if (!workflow) return
    const positions = computeAutoLayout(workflow)
    updatePositions(Object.entries(positions).map(([id, position]) => ({ id, position })))
    setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50)
  }, [workflow, updatePositions, fitView])

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
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => setSelectedNode(node.id)}
        onEdgeClick={(_, edge) => setSelectedEdge(edge.id)}
        onPaneClick={() => {
          setSelectedNode(null)
          setSelectedEdge(null)
        }}
        deleteKeyCode={['Delete', 'Backspace']}
        fitView
        minZoom={0.2}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
        <MiniMap pannable zoomable className="!bg-gray-50 dark:!bg-gray-800" />
        {chatStreaming && (
          <Panel position="top-center">
            <div className="flex items-center gap-2 h-8 px-3 rounded-full bg-violet-600 text-white shadow-lg shadow-violet-600/30">
              <Sparkles className="h-3.5 w-3.5 shrink-0 animate-pulse" />
              <LoaderFive text="AI Builder is working…" className="text-xs" />
            </div>
          </Panel>
        )}
        <Panel position="top-right">
          <Button variant="outline" size="sm" className="h-8 bg-white/90 dark:bg-gray-900/90 backdrop-blur shadow-sm" onClick={handleAutoArrange}>
            <LayoutGrid className="h-3.5 w-3.5 mr-1.5" /> Auto-arrange
          </Button>
        </Panel>
      </ReactFlow>
    </div>
  )
}
