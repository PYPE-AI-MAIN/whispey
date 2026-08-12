'use client'

import React, { useCallback, useMemo, useRef } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  type Node,
  type Edge as FlowEdge,
  type NodeChange,
  type NodeTypes,
  type Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useWorkflowStore } from '@/stores/workflowStore'
import { createDefaultNode, type NodeType } from '@/lib/workflow/schema'
import { FlowNode } from './FlowNode'
import { NODE_REGISTRY } from './nodeRegistry'
import { PALETTE_DND_TYPE } from './WorkflowPalette'

const NODE_TYPES = Object.fromEntries(
  Object.keys(NODE_REGISTRY).map((type) => [type, FlowNode])
) as unknown as NodeTypes

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
  const replaceCount = useWorkflowStore((s) => s.replaceCount)
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId)
  const selectedEdgeId = useWorkflowStore((s) => s.selectedEdgeId)
  const addNode = useWorkflowStore((s) => s.addNode)
  const addEdge = useWorkflowStore((s) => s.addEdge)
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
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        selected: e.id === selectedEdgeId,
        label: e.label || (e.kind === 'always' ? undefined : e.kind),
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
    },
    [updatePositions]
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

  if (!workflow) return null

  return (
    <div ref={wrapperRef} role="application" className="flex-1 h-full" onDrop={onDrop} onDragOver={onDragOver}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => setSelectedNode(node.id)}
        onEdgeClick={(_, edge) => setSelectedEdge(edge.id)}
        onPaneClick={() => {
          setSelectedNode(null)
          setSelectedEdge(null)
        }}
        fitView
        minZoom={0.2}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
        <MiniMap pannable zoomable className="!bg-gray-50 dark:!bg-gray-800" />
      </ReactFlow>
    </div>
  )
}
