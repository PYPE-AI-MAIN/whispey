import type { Edge, Node } from '@xyflow/react'
import type { FlowNodeData } from './types'

export type FNode = Node<FlowNodeData>

export function outgoing(nodeId: string, edges: Edge[]): Edge[] {
  return edges.filter((e) => e.source === nodeId)
}

export function findRoot(nodes: FNode[], edges: Edge[]): FNode | undefined {
  const trigger = nodes.find((n) => n.data.kind === 'trigger')
  if (trigger) return trigger
  return nodes.find((n) => !edges.some((e) => e.target === n.id))
}

// A module-level counter restarts at the same value every fresh page load,
// so a flow saved in an earlier session (with node ids from a previous
// counter run) could collide with ids generated in a new one — exactly what
// happened here. crypto.randomUUID() can't collide across sessions.
export function nextId() {
  return `step-${crypto.randomUUID()}`
}

// Every node has more than one handle of each type now (top+left are both
// "target", bottom+right are both "source"), so every edge we create in code
// — as opposed to ones the user drags by hand, which already carry the
// correct handle from the drag itself — must say explicitly which handle it
// uses. Default to the vertical ones; that's the normal top-to-bottom flow.
const DEFAULT_HANDLES = { sourceHandle: 'bottom', targetHandle: 'top' }

export function insertOnEdge(edges: Edge[], edgeId: string, newNodeId: string): Edge[] {
  const edge = edges.find((e) => e.id === edgeId)
  if (!edge) return edges
  const rest = edges.filter((e) => e.id !== edgeId)
  return [
    ...rest,
    { id: `e-${edge.source}-${newNodeId}`, source: edge.source, target: newNodeId, ...DEFAULT_HANDLES },
    { id: `e-${newNodeId}-${edge.target}`, source: newNodeId, target: edge.target, label: edge.label, ...DEFAULT_HANDLES },
  ]
}

export function appendAfter(edges: Edge[], nodeId: string, newNodeId: string): Edge[] {
  return [...edges, { id: `e-${nodeId}-${newNodeId}`, source: nodeId, target: newNodeId, ...DEFAULT_HANDLES }]
}

/** Every node reachable forward from (and including) startId, following edges downstream. */
function descendantsOf(startId: string, edges: Edge[]): Set<string> {
  const seen = new Set<string>()
  const stack = [startId]
  while (stack.length) {
    const id = stack.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    for (const e of outgoing(id, edges)) stack.push(e.target)
  }
  return seen
}

/**
 * Pushes a node and everything downstream of it down by `dy`, so inserting a
 * step in the middle of a chain doesn't leave it overlapping the node that
 * used to sit right where it now lands.
 */
export function makeRoomBelow(nodes: FNode[], edges: Edge[], fromNodeId: string, dy: number): FNode[] {
  const toShift = descendantsOf(fromNodeId, edges)
  return nodes.map((n) => (toShift.has(n.id) ? { ...n, position: { ...n.position, y: n.position.y + dy } } : n))
}

export function removeNode(nodes: FNode[], edges: Edge[], nodeId: string): { nodes: FNode[]; edges: Edge[] } {
  const inEdge = edges.find((e) => e.target === nodeId)
  const outEdges = edges.filter((e) => e.source === nodeId)
  let nextEdges = edges.filter((e) => e.source !== nodeId && e.target !== nodeId)
  if (inEdge && outEdges.length === 1) {
    nextEdges = [
      ...nextEdges,
      { id: `e-${inEdge.source}-${outEdges[0].target}`, source: inEdge.source, target: outEdges[0].target, ...DEFAULT_HANDLES },
    ]
  }
  return { nodes: nodes.filter((n) => n.id !== nodeId), edges: nextEdges }
}

/** Simple top-down tree layout: y = depth, x = position within the subtree's leaf spread. */
export function layoutTree(nodes: FNode[], edges: Edge[]): FNode[] {
  const root = findRoot(nodes, edges)
  if (!root) return nodes
  const positions = new Map<string, { x: number; y: number }>()
  const COL = 260
  const ROW = 160
  let nextCol = 0

  function visit(nodeId: string, depth: number, visited: Set<string>): number {
    if (visited.has(nodeId)) return nextCol
    visited.add(nodeId)
    const outs = outgoing(nodeId, edges)
    if (outs.length === 0) {
      const col = nextCol++
      positions.set(nodeId, { x: col * COL, y: depth * ROW })
      return col
    }
    const childCols = outs.map((e) => visit(e.target, depth + 1, visited))
    const center = (Math.min(...childCols) + Math.max(...childCols)) / 2
    positions.set(nodeId, { x: center * COL, y: depth * ROW })
    return center
  }
  visit(root.id, 0, new Set())

  return nodes.map((n) => {
    const pos = positions.get(n.id)
    return pos ? { ...n, position: pos } : n
  })
}
