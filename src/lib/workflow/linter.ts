/**
 * Semantic linter — TypeScript mirror of `pype-voice-agent/workflow/linter.py`.
 * Same rule list, same messages, so the editor and the runtime agree on what
 * "valid" means. Structural validation is Zod's job (schema.ts); this catches
 * semantic problems (dangling edges, bad start, unreachable nodes, ...).
 */
import type { Workflow } from './schema'
import { LLM_NODE_TYPES, NONRUNTIME_NODE_TYPES, TELEPHONY_NODE_TYPES } from './schema'

export type Severity = 'error' | 'warning'
export interface LintIssue {
  severity: Severity
  message: string
  nodeId?: string
  edgeId?: string
}

export function lintWorkflow(wf: Workflow): LintIssue[] {
  const issues: LintIssue[] = []
  const nodeIds = wf.nodes.map((n) => n.id)
  const idSet = new Set(nodeIds)
  const nodeMap = new Map(wf.nodes.map((n) => [n.id, n]))
  const outEdges = (id: string) => wf.edges.filter((e) => e.source === id)

  // 1. duplicate ids
  const seen = new Set<string>()
  for (const id of nodeIds) {
    if (seen.has(id)) issues.push({ severity: 'error', message: `Duplicate node id '${id}'`, nodeId: id })
    seen.add(id)
  }

  // 2. transport enabled
  const webOn = !!wf.transports.web?.enabled
  const telOn = !!wf.transports.telephony?.enabled
  if (!webOn && !telOn)
    issues.push({ severity: 'error', message: 'No transport enabled (enable web and/or telephony)' })

  // 3. valid start
  if (!idSet.has(wf.start)) {
    issues.push({ severity: 'error', message: `start '${wf.start}' is not a node id` })
  } else if (NONRUNTIME_NODE_TYPES.has(nodeMap.get(wf.start)!.type)) {
    issues.push({ severity: 'error', message: `start '${wf.start}' cannot be a note node`, nodeId: wf.start })
  }

  // 4/5. per-node
  for (const n of wf.nodes) {
    if (n.type === 'conversation' && !n.prompt && !n.staticText)
      issues.push({ severity: 'error', message: 'conversation node needs a prompt or static text', nodeId: n.id })
    if (n.type === 'function' && !n.url)
      issues.push({ severity: 'error', message: 'function node needs a url', nodeId: n.id })
    if (n.type === 'call_transfer' && !n.transferTo)
      issues.push({ severity: 'error', message: 'call_transfer node needs a destination', nodeId: n.id })
    if (n.type === 'extract_variable' && (!n.extractions || n.extractions.length === 0))
      issues.push({ severity: 'warning', message: 'extract_variable node has no extractions', nodeId: n.id })
    if (n.type === 'code' && !n.source)
      issues.push({ severity: 'error', message: 'code node needs source', nodeId: n.id })
    if (n.type === 'mcp' && (!n.server || !n.tool))
      issues.push({ severity: 'error', message: 'mcp node needs a server and tool', nodeId: n.id })
    if (TELEPHONY_NODE_TYPES.has(n.type) && !telOn)
      issues.push({ severity: 'error', message: `${n.type} node requires the telephony transport`, nodeId: n.id })
  }

  // 6. edges
  for (const e of wf.edges) {
    if (!idSet.has(e.source)) issues.push({ severity: 'error', message: `edge source '${e.source}' is not a node`, edgeId: e.id })
    if (!idSet.has(e.target)) issues.push({ severity: 'error', message: `edge target '${e.target}' is not a node`, edgeId: e.id })
    if (e.kind === 'condition' && !e.condition?.trim())
      issues.push({ severity: 'error', message: 'condition edge needs condition text', edgeId: e.id })
    if (e.kind === 'logic' && !e.expression?.trim())
      issues.push({ severity: 'error', message: 'logic edge needs an expression', edgeId: e.id })
    // A condition edge only becomes an LLM handoff tool for LLM_NODE_TYPES
    // sources (see interpreter.py's _handoff_tools). On any other node type
    // it's never evaluated — the interpreter's default-target fallback picks
    // it as the deterministic next hop regardless of the condition text.
    if (e.kind === 'condition' && idSet.has(e.source) && !LLM_NODE_TYPES.has(nodeMap.get(e.source)!.type)) {
      issues.push({
        severity: 'error',
        message: `condition edges are only meaningful on conversation/extract_variable/subagent nodes (source '${e.source}' is a ${nodeMap.get(e.source)!.type} node and would take this edge unconditionally)`,
        edgeId: e.id,
      })
    }
  }

  // 7. reachability + dead-ends
  const reachable = reachableSet(wf)
  for (const n of wf.nodes) {
    if (NONRUNTIME_NODE_TYPES.has(n.type)) continue
    if (!reachable.has(n.id))
      issues.push({ severity: 'warning', message: `node '${n.id}' is unreachable from start`, nodeId: n.id })
    if (n.type !== 'ending' && !TELEPHONY_NODE_TYPES.has(n.type) && outEdges(n.id).length === 0)
      issues.push({ severity: 'warning', message: `node '${n.id}' is a dead-end (no outgoing edges)`, nodeId: n.id })
  }

  return issues
}

function reachableSet(wf: Workflow): Set<string> {
  const idSet = new Set(wf.nodes.map((n) => n.id))
  if (!idSet.has(wf.start)) return new Set()
  const adj = new Map<string, string[]>()
  wf.nodes.forEach((n) => adj.set(n.id, []))
  wf.edges.forEach((e) => adj.get(e.source)?.push(e.target))
  const seen = new Set<string>()
  const stack = [wf.start]
  while (stack.length) {
    const cur = stack.pop()!
    if (seen.has(cur)) continue
    seen.add(cur)
    ;(adj.get(cur) || []).forEach((t) => stack.push(t))
  }
  return seen
}

export function hasErrors(issues: LintIssue[]): boolean {
  return issues.some((i) => i.severity === 'error')
}
