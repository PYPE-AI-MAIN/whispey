import dagre from '@dagrejs/dagre'
import type { Workflow } from './schema'

// Matches FlowNode's card footprint closely enough for dagre's spacing math —
// doesn't need to be exact, just consistent so ranks don't overlap.
const NODE_WIDTH = 220
const NODE_HEIGHT = 76

/** Top-to-bottom layered layout (Sugiyama-style, via dagre) — replaces manual/
 * drag-wherever node positions with one that actually reads as a flow: start
 * at the top, branches fan out below it, terminal nodes settle at the bottom.
 * Hand-rolling this well (rank assignment + crossing minimization) is a solved
 * graph-layout problem; dagre is the standard tool react-flow itself points to. */
export function computeAutoLayout(workflow: Pick<Workflow, 'nodes' | 'edges'>): Record<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 90, marginx: 40, marginy: 40 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const n of workflow.nodes) g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
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
