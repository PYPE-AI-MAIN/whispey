import dagre from '@dagrejs/dagre'
import type { Workflow } from './schema'

// Matches FlowNode's card footprint closely enough for dagre's spacing math —
// doesn't need to be exact, just consistent so ranks don't overlap.
const NODE_WIDTH = 220
const NODE_HEIGHT = 76

/** Left-to-right layered layout (Sugiyama-style, via dagre) — replaces manual/
 * drag-wherever node positions with one that actually reads as a flow: start
 * at the top, branches fan out below it, terminal nodes settle at the bottom.
 * Hand-rolling this well (rank assignment + crossing minimization) is a solved
 * graph-layout problem; dagre is the standard tool react-flow itself points to. */
export function computeAutoLayout(workflow: Pick<Workflow, 'nodes' | 'edges'>): Record<string, { x: number; y: number }> {
  const stages = stagesToKeepTogether(workflow.nodes)
  const g = new dagre.graphlib.Graph({ compound: stages.size > 0 })
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 130, marginx: 40, marginy: 40 })
  g.setDefaultEdgeLabel(() => ({}))

  // Steps of one stage are laid out as a group, so the stage areas drawn on the canvas do not run into each other.
  for (const stage of stages) g.setNode(`stage:${stage}`, {})
  for (const n of workflow.nodes) g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  for (const n of workflow.nodes) {
    const stage = n.stage?.trim()
    if (stage && stages.has(stage)) g.setParent(n.id, `stage:${stage}`)
  }
  for (const e of workflow.edges) {
    if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target)
  }

  dagre.layout(g)

  const positions: Record<string, { x: number; y: number }> = {}
  for (const n of workflow.nodes) {
    const pos = g.node(n.id)
    if (!pos) continue
    // dagre centers on (x, y); react-flow positions from the top-left corner.
    positions[n.id] = { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 }
  }
  return positions
}

/** Stages worth grouping: two or more of them, each with at least two steps (the same rule the canvas uses to draw them). */
function stagesToKeepTogether(nodes: Pick<Workflow, 'nodes'>['nodes']): Set<string> {
  const counts = new Map<string, number>()
  for (const n of nodes) {
    const stage = n.stage?.trim()
    if (stage) counts.set(stage, (counts.get(stage) ?? 0) + 1)
  }
  const many = [...counts.entries()].filter(([, c]) => c >= 2).map(([stage]) => stage)
  return new Set(many.length >= 2 ? many : [])
}
