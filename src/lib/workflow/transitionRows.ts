import type { Edge, WorkflowNode } from './schema'

/** One line on a step's card: when the call goes on, and the connection it uses. */
export interface TransitionRow {
  /** Doubles as the connection point's id on the card. */
  id: string
  /** The connection this row stands for; null for the Else row of a Branch that has no connection yet. */
  edgeId: string | null
  kind: 'always' | 'condition' | 'logic' | 'fallback' | 'else'
  text: string
  /** Only "when the caller says…" rows can be edited in place. */
  editable: boolean
}

export const ELSE_HANDLE = 'else'
export const DEFAULT_HANDLE = 'out'

export const CARD_WIDTH = 240
const HEADER_HEIGHT = 58
const ROW_HEIGHT = 28
const ROWS_PADDING = 10

const LISTENING = new Set(['conversation', 'extract_variable', 'subagent'])
const CAN_FAIL = new Set(['function', 'code', 'mcp', 'sms'])
const NO_ROWS = new Set(['ending', 'note'])

type Labels = { always: string; fallback: string }

function labelsFor(type: string): Labels {
  if (type === 'logic_split') return { always: 'Next step', fallback: 'Else' }
  if (CAN_FAIL.has(type)) return { always: 'If it works', fallback: 'If it fails' }
  if (LISTENING.has(type)) return { always: 'Next step', fallback: 'Otherwise' }
  return { always: 'Next step', fallback: 'Otherwise' }
}

function textFor(e: Edge, labels: Labels): string {
  if (e.kind === 'condition') return e.condition || e.label || 'Describe when…'
  if (e.kind === 'logic') return e.expression || e.label || 'Set the rule…'
  return e.kind === 'fallback' ? labels.fallback : labels.always
}

// Rules the caller or the data decide come first, in the order they were drawn; the default way on is last.
const ORDER: Record<Edge['kind'], number> = { condition: 0, logic: 0, always: 1, fallback: 2 }

/** The lines shown on a step's card, from its outgoing connections. A Branch always shows its Else. */
export function transitionRows(node: Pick<WorkflowNode, 'id' | 'type'>, edges: Edge[]): TransitionRow[] {
  if (NO_ROWS.has(node.type)) return []
  const labels = labelsFor(node.type)
  const out = edges.filter((e) => e.source === node.id).map((e, i) => ({ e, i }))
  out.sort((a, b) => ORDER[a.e.kind] - ORDER[b.e.kind] || a.i - b.i)
  const rows: TransitionRow[] = out.map(({ e }) => ({
    id: e.id,
    edgeId: e.id,
    kind: e.kind,
    text: textFor(e, labels),
    editable: e.kind === 'condition',
  }))
  const needsElse = node.type === 'logic_split' && !out.some(({ e }) => e.kind === 'fallback')
  if (needsElse) rows.push({ id: ELSE_HANDLE, edgeId: null, kind: 'else', text: labels.fallback, editable: false })
  return rows
}

/** How tall a step's card is, so layout and stage areas leave the right room. */
export function cardHeight(rowCount: number): number {
  return HEADER_HEIGHT + (rowCount ? rowCount * ROW_HEIGHT + ROWS_PADDING : 0)
}

/** Card heights for a whole flow, by step id. */
export function cardHeights(nodes: Pick<WorkflowNode, 'id' | 'type'>[], edges: Edge[]): Map<string, number> {
  return new Map(nodes.map((n) => [n.id, cardHeight(transitionRows(n, edges).length)]))
}
