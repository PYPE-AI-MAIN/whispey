import type { Edge as FlowEdge, Node } from '@xyflow/react'
import type { Workflow } from '@/lib/workflow/schema'
import { ghostEdges, sharedEndingIds, stageBoxes, traceSteps, visitNumbers } from '@/lib/workflow/canvasModel'

const EDGE_STYLE: Record<string, { stroke: string; dashed?: boolean }> = {
  always: { stroke: '#9ca3af' },
  condition: { stroke: '#f59e0b' },
  logic: { stroke: '#8b5cf6' },
  fallback: { stroke: '#ef4444', dashed: true },
}

const TRACE_STROKE = '#ff6b6b'

function truncateLabel(text: string, max = 28): string {
  const trimmed = text.trim()
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed
}

/** The actual condition/expression text is what tells two "condition" edges apart on the canvas. */
function edgeLabels(kind: string, explicit: string | null | undefined, detail: string | null | undefined): { short?: string; full?: string } {
  if (explicit) return { short: explicit, full: explicit }
  if (detail) return { short: truncateLabel(detail), full: detail }
  if (kind === 'always') return {}
  return { short: kind, full: kind }
}

export interface GraphInput {
  workflow: Workflow
  selectedNodeId: string | null
  selectedEdgeId: string | null
  trace: { ids: string[]; missing: number } | null
}

function buildNodes({ workflow, selectedNodeId, trace }: GraphInput): Node[] {
  const visits = trace ? visitNumbers(trace.ids) : null
  const steps: Node[] = workflow.nodes.map((n, i) => ({
    id: n.id,
    type: n.type,
    position: n.position ?? { x: 80 + (i % 4) * 220, y: 80 + Math.floor(i / 4) * 160 },
    data: { ...n, isStart: n.id === workflow.start, visits: visits?.get(n.id) },
    selected: n.id === selectedNodeId,
    // so the overview map can draw a step before the canvas has measured it
    initialWidth: 220,
    initialHeight: 76,
    style: visits && !visits.has(n.id) ? { opacity: 0.35 } : undefined,
  }))
  const stages: Node[] = stageBoxes(workflow.nodes).map((b) => ({
    id: `stage:${b.stage}`,
    type: 'stage',
    position: { x: b.x, y: b.y },
    data: { label: b.stage },
    width: b.width,
    height: b.height,
    zIndex: -1,
    selectable: false,
    draggable: false,
    focusable: false,
    deletable: false,
  }))
  return [...stages, ...steps]
}

function opacityFor(dim: boolean, quiet: boolean): number {
  if (dim) return 0.2
  return quiet ? 0.5 : 1
}

function buildEdges(input: GraphInput): FlowEdge[] {
  const { workflow, selectedNodeId, selectedEdgeId, trace } = input
  const busy = workflow.edges.length > 12
  const quietTargets = sharedEndingIds(workflow)
  const traced = trace ? traceSteps(workflow.edges, trace.ids) : null
  const onPath = new Set(traced?.map((t) => t.id))

  const edges = workflow.edges.map((e): FlowEdge => {
    const style = EDGE_STYLE[e.kind] ?? EDGE_STYLE.always
    const { short, full } = edgeLabels(e.kind, e.label, e.condition || e.expression)
    const mine = e.id === selectedEdgeId || (!!selectedNodeId && (e.source === selectedNodeId || e.target === selectedNodeId))
    const tracedHere = onPath.has(e.id)
    const dim = traced ? !tracedHere : busy && !mine && !!selectedNodeId
    const quiet = !dim && !mine && !tracedHere && quietTargets.has(e.target)
    return {
      id: e.id,
      type: 'workflow',
      source: e.source,
      target: e.target,
      selected: e.id === selectedEdgeId,
      label: short,
      animated: (e.kind === 'condition' || e.kind === 'logic') && !dim && !traced,
      data: { focus: (busy && mine) || tracedHere, dim, full },
      style: {
        stroke: tracedHere ? TRACE_STROKE : style.stroke,
        strokeWidth: tracedHere ? 2.5 : undefined,
        strokeDasharray: style.dashed ? '5 5' : undefined,
        opacity: opacityFor(dim, quiet),
      },
    }
  })

  const ghosts = traced ? [] : ghostEdges(workflow, selectedNodeId)
  const ghostFlow = ghosts.map((g): FlowEdge => ({
    id: g.id,
    type: 'workflow',
    source: g.source,
    target: g.target,
    label: g.label ? truncateLabel(g.label) : undefined,
    selectable: false,
    focusable: false,
    data: { ghost: true, full: g.label },
    style: { stroke: '#9ca3af', strokeDasharray: '2 5', strokeWidth: 1.5, opacity: 0.8 },
  }))

  const jumps = (traced ?? []).filter((t) => t.synthetic).map((t): FlowEdge => ({
    id: t.id,
    type: 'workflow',
    source: t.source,
    target: t.target,
    selectable: false,
    focusable: false,
    data: { ghost: true, focus: true },
    style: { stroke: TRACE_STROKE, strokeWidth: 2.5, strokeDasharray: '2 5' },
  }))

  return [...edges, ...ghostFlow, ...jumps]
}

/** Everything the canvas draws: steps, stage areas, connections, the "from any step" hints, and a call's path. */
export function buildCanvasGraph(input: GraphInput): { nodes: Node[]; edges: FlowEdge[] } {
  return { nodes: buildNodes(input), edges: buildEdges(input) }
}
