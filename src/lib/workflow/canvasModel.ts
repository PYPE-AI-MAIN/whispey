import type { Edge, GlobalRule, Workflow } from './schema'
import { CARD_WIDTH, cardHeights } from './transitionRows'

type Flow = Pick<Workflow, 'nodes' | 'edges' | 'globalRules'>

const NODE_W = CARD_WIDTH
const NODE_H = 76
const PAD = 28
const LABEL_ROOM = 30

// Steps that listen to the caller, so a global rule can fire from them (same set as globalRules.ts).
const LISTENING = new Set(['conversation', 'extract_variable', 'subagent'])

export interface StageBox {
  stage: string
  x: number
  y: number
  width: number
  height: number
}

/**
 * A soft box behind each stage's steps, so a long flow reads as sections.
 * Only drawn when the flow really has stages: two or more of them, each with at least two steps.
 */
export function stageBoxes(nodes: Flow['nodes'], edges: Edge[] = []): StageBox[] {
  const heights = cardHeights(nodes, edges)
  const byStage = new Map<string, { x: number; y: number; h: number }[]>()
  for (const n of nodes) {
    const stage = n.stage?.trim()
    if (!stage || !n.position) continue
    byStage.set(stage, [...(byStage.get(stage) ?? []), { ...n.position, h: heights.get(n.id) ?? NODE_H }])
  }
  const groups = [...byStage.entries()].filter(([, points]) => points.length >= 2)
  if (groups.length < 2) return []
  const boxes = groups.map(([stage, points]) => {
    const minX = Math.min(...points.map((p) => p.x))
    const minY = Math.min(...points.map((p) => p.y))
    const maxX = Math.max(...points.map((p) => p.x)) + NODE_W
    const maxY = Math.max(...points.map((p) => p.y + p.h))
    return { stage, x: minX - PAD, y: minY - PAD - LABEL_ROOM, width: maxX - minX + PAD * 2, height: maxY - minY + PAD * 2 + LABEL_ROOM }
  })
  return withoutOverlaps(boxes)
}

const overlaps = (a: StageBox, b: StageBox) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

/**
 * A stage whose steps are scattered across the canvas would cover other stages, and tinted areas on top of each other
 * are noise. Compact stages are kept first; a stage that would overlap one already kept is left out.
 */
function withoutOverlaps(boxes: StageBox[]): StageBox[] {
  const kept: StageBox[] = []
  for (const box of [...boxes].sort((a, b) => a.width * a.height - b.width * b.height)) {
    if (!kept.some((k) => overlaps(box, k))) kept.push(box)
  }
  return boxes.filter((b) => kept.includes(b))
}

export interface GhostEdge {
  id: string
  source: string
  target: string
  /** The rule's condition, shown only when a step is selected (never when a rule's target is). */
  label?: string
}

function listeningIds(wf: Pick<Workflow, 'nodes'>): string[] {
  return wf.nodes.filter((n) => LISTENING.has(n.type) && !(n as { skipUserResponse?: boolean }).skipUserResponse).map((n) => n.id)
}

function ruleSources(rule: GlobalRule, listening: string[]): string[] {
  return (rule.sources.length ? rule.sources.filter((s) => listening.includes(s)) : listening).filter((id) => id !== rule.target)
}

/**
 * Global rules have no arrows of their own ("from any step"). When a step is selected, show where the rules can send
 * the call from it; when a rule's target is selected, show every step that can send the call there.
 */
export function ghostEdges(wf: Flow, selectedNodeId: string | null): GhostEdge[] {
  if (!selectedNodeId || !wf.globalRules?.length) return []
  const listening = listeningIds(wf)
  const out: GhostEdge[] = []
  for (const rule of wf.globalRules) {
    const sources = ruleSources(rule, listening)
    if (rule.target === selectedNodeId) {
      for (const source of sources) out.push({ id: `ghost:${rule.id}:${source}`, source, target: rule.target })
    } else if (sources.includes(selectedNodeId)) {
      out.push({ id: `ghost:${rule.id}:${selectedNodeId}`, source: selectedNodeId, target: rule.target, label: rule.label || rule.condition })
    }
  }
  return out
}

/** The step ids a call went through, from the step names saved with the call. Names that no longer exist are skipped. */
export function tracePathIds(wf: Pick<Workflow, 'nodes'>, names: string[]): { ids: string[]; missing: number } {
  const byName = new Map<string, string>()
  for (const n of wf.nodes) {
    byName.set(n.name || n.id, n.id)
    if (!byName.has(n.id)) byName.set(n.id, n.id)
  }
  const ids: string[] = []
  let missing = 0
  for (const name of names) {
    const id = byName.get(name)
    if (id) ids.push(id)
    else missing++
  }
  return { ids, missing }
}

export interface TraceStep {
  id: string
  source: string
  target: string
  /** True when no drawn connection links the two steps (a global rule or a code jump), so one is added for the trace. */
  synthetic: boolean
}

/** One connection per hop of the path. */
export function traceSteps(edges: Edge[], ids: string[]): TraceStep[] {
  const steps: TraceStep[] = []
  for (let i = 1; i < ids.length; i++) {
    const [source, target] = [ids[i - 1], ids[i]]
    if (source === target) continue
    const real = edges.find((e) => e.source === source && e.target === target)
    steps.push({ id: real?.id ?? `trace:${i}`, source, target, synthetic: !real })
  }
  return steps
}

/** For each step on the path, the visit numbers: [1] for a step visited once, [2, 5] for one visited twice. */
export function visitNumbers(ids: string[]): Map<string, number[]> {
  const visits = new Map<string, number[]>()
  ids.forEach((id, i) => visits.set(id, [...(visits.get(id) ?? []), i + 1]))
  return visits
}

/** Endings many steps lead to: their incoming connections are drawn quieter so the picture stays readable. */
export function sharedEndingIds(wf: Pick<Workflow, 'nodes' | 'edges'>, minIncoming = 3): Set<string> {
  const incoming = new Map<string, number>()
  for (const e of wf.edges) incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1)
  return new Set(wf.nodes.filter((n) => n.type === 'ending' && (incoming.get(n.id) ?? 0) >= minIncoming).map((n) => n.id))
}

/** True when two steps sit on top of each other (a card is as tall as its lines, so older layouts can overlap now). */
export function hasOverlappingSteps(nodes: Flow['nodes'], edges: Edge[]): boolean {
  const heights = cardHeights(nodes, edges)
  const placed = nodes.filter((n) => n.position).map((n) => ({ x: n.position!.x, y: n.position!.y, w: NODE_W, h: heights.get(n.id) ?? NODE_H }))
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i]
      const b = placed[j]
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) return true
    }
  }
  return false
}
