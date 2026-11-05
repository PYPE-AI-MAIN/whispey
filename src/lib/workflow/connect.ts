import type { Edge, Workflow } from './schema'
import { ELSE_HANDLE } from './transitionRows'

const LISTENING = new Set(['conversation', 'extract_variable', 'subagent'])

export type ConnectionPlan =
  | { action: 'retarget'; edgeId: string; target: string }
  | { action: 'add'; edge: Edge; /** a new "when" that still needs its words */ openForEditing: boolean }

/**
 * What dragging from a point on a step to another step should do.
 * A line already on the card keeps its words and only changes where it goes; the Branch's empty Else becomes its
 * otherwise connection; anything else is a new connection, which needs a "when" if the step already has a way on.
 */
export function planConnection(
  wf: Pick<Workflow, 'nodes' | 'edges'>,
  conn: { source: string; target: string; sourceHandle?: string | null },
  newId: string
): ConnectionPlan {
  const existing = conn.sourceHandle ? wf.edges.find((e) => e.id === conn.sourceHandle && e.source === conn.source) : undefined
  if (existing) return { action: 'retarget', edgeId: existing.id, target: conn.target }
  if (conn.sourceHandle === ELSE_HANDLE) {
    return { action: 'add', edge: { id: newId, source: conn.source, target: conn.target, kind: 'fallback' }, openForEditing: false }
  }
  const source = wf.nodes.find((n) => n.id === conn.source)
  const asking = wf.edges.some((e) => e.source === conn.source) && !!source && LISTENING.has(source.type)
  return { action: 'add', edge: { id: newId, source: conn.source, target: conn.target, kind: asking ? 'condition' : 'always' }, openForEditing: asking }
}
