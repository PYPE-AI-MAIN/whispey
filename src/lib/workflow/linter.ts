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

type Node = Workflow['nodes'][number]
type Edge = Workflow['edges'][number]

// `{{var}}` is interpolated into prompt/message/url/etc. text fields, but a
// `code` node's `source` runs as real JS/Python — it's never passed through
// that interpolation (doing so would let a caller's answer break out of a
// string literal into code). "{{user_request}}" inside source is therefore
// always the literal 8-char string, never the captured value: a classifier
// built on `text.includes(...)` silently and permanently takes its "no
// match" branch. Real code already has `variables` in scope.
const TEMPLATE_IN_CODE_RE = /\{\{\s*[a-zA-Z0-9_.]+\s*\}\}/

// Same grammar, capturing the reference so its base name (before any dot) can
// be checked against what's actually declared anywhere in the workflow — see
// lintUnknownVariables. code.source is deliberately never scanned with this:
// {{..}} there is always wrong regardless of the name (TEMPLATE_IN_CODE_RE
// above) and already has its own, more specific error.
const VAR_REF_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g

// Fields verified (pype-voice-agent/workflow/interpreter.py) to actually pass
// through interpolate()/render() at runtime — an include-list, not "every
// string field", so a field nobody templates (an id, an enum, a node name)
// can never false-positive here.
const TEMPLATED_TEXT_FIELDS: Record<string, string[]> = {
  conversation: ['prompt', 'staticText'],
  extract_variable: ['prompt'],
  subagent: ['prompt'],
  function: ['url', 'waitMessage'],
  knowledge: ['query'],
  call_transfer: ['transferTo', 'message'],
  press_digit: ['digits'],
  sms: ['to', 'message'],
  mcp: ['server'],
  ending: ['message'],
}
const TEMPLATED_DICT_FIELDS: Record<string, string[]> = {
  function: ['headers', 'params'],
  mcp: ['args'],
}

// Per-node completeness: type → (has-required-value predicate, warning message).
// A freshly-dropped node is empty by definition, so a miss is a `warning`
// nudge, never an `error` that blocks deploy or turns the canvas red on drop.
const REQUIRED: ReadonlyArray<{ type: string; ok: (n: Node) => unknown; msg: string }> = [
  { type: 'conversation', ok: (n) => (n as { prompt?: string; staticText?: string }).prompt || (n as { staticText?: string }).staticText, msg: 'conversation node needs a prompt or static text' },
  { type: 'function', ok: (n) => (n as { url?: string }).url, msg: 'function node needs a url' },
  { type: 'call_transfer', ok: (n) => (n as { transferTo?: string }).transferTo, msg: 'call_transfer node needs a destination' },
  { type: 'extract_variable', ok: (n) => (n as { extractions?: unknown[] }).extractions?.length, msg: 'extract_variable node has no extractions' },
  { type: 'code', ok: (n) => (n as { source?: string }).source, msg: 'code node needs source' },
  { type: 'mcp', ok: (n) => (n as { server?: string; tool?: string }).server && (n as { tool?: string }).tool, msg: 'mcp node needs a server and tool' },
]

function lintIds(nodes: readonly Node[]): LintIssue[] {
  const issues: LintIssue[] = []
  const seen = new Set<string>()
  for (const n of nodes) {
    if (seen.has(n.id)) issues.push({ severity: 'error', message: `Duplicate node id '${n.id}'`, nodeId: n.id })
    seen.add(n.id)
  }
  return issues
}

function lintStart(wf: Workflow, idSet: Set<string>, nodeMap: Map<string, Node>): LintIssue[] {
  if (!idSet.has(wf.start)) return [{ severity: 'error', message: `start '${wf.start}' is not a node id` }]
  if (NONRUNTIME_NODE_TYPES.has(nodeMap.get(wf.start)!.type))
    return [{ severity: 'error', message: `start '${wf.start}' cannot be a note node`, nodeId: wf.start }]
  return []
}

function lintNode(wf: Workflow, n: Node, telOn: boolean, outEdges: (id: string) => Edge[]): LintIssue[] {
  const issues: LintIssue[] = []
  const req = REQUIRED.find((r) => r.type === n.type)
  if (req && !req.ok(n)) issues.push({ severity: 'warning', message: req.msg, nodeId: n.id })
  // Stall guard: an LLM node advances only via handoff tools built from its
  // edges. If every exit is a `condition` and the conversation matches none, the
  // node hangs. An `always`/`fallback` edge is a catch-all escape tool.
  if (LLM_NODE_TYPES.has(n.type)) {
    const outs = outEdges(n.id)
    if (outs.length > 0 && !outs.some((e) => e.kind === 'always' || e.kind === 'fallback'))
      issues.push({
        severity: 'warning',
        message: `'${n.id}' can stall — every exit is a condition. Add a Fallback (or Always) edge as a catch-all so the call always has a way forward.`,
        nodeId: n.id,
      })
  }
  // Same dead-end shape as the stall guard above, for logic_split: if every
  // logic condition is false at runtime and there's no fallback edge, the
  // node has no target and the call ends abruptly instead of continuing.
  if (n.type === 'logic_split') {
    const outs = outEdges(n.id)
    if (outs.length > 0 && !outs.some((e) => e.kind === 'fallback'))
      issues.push({
        severity: 'warning',
        message: `'${n.id}' can dead-end — if no logic condition matches at runtime there's no fallback edge, so the call ends abruptly instead of continuing. Add a Fallback edge as a catch-all.`,
        nodeId: n.id,
      })
  }
  if (TELEPHONY_NODE_TYPES.has(n.type) && !telOn)
    issues.push({ severity: 'error', message: `${n.type} node requires the telephony transport`, nodeId: n.id })
  if (n.type === 'code') {
    const m = TEMPLATE_IN_CODE_RE.exec((n as { source?: string }).source ?? '')
    if (m)
      issues.push({
        severity: 'error',
        message: `code node source contains '${m[0]}' — this is never substituted here (that syntax only works in prompt/message/url text fields), so it always runs as that literal string. Use \`variables.${m[0].slice(2, -2).trim()}\` instead — \`variables\` already holds every captured value in real JS/Python.`,
        nodeId: n.id,
      })
  }
  return issues
}

function lintSaveAs(nodes: readonly Node[]): LintIssue[] {
  const writers = new Map<string, string[]>()
  for (const n of nodes) {
    const key = (n as { saveAs?: unknown }).saveAs
    if (typeof key === 'string' && key.trim()) writers.set(key, [...(writers.get(key) ?? []), n.id])
  }
  const issues: LintIssue[] = []
  for (const [key, ids] of writers) {
    if (ids.length > 1)
      issues.push({
        severity: 'warning',
        message: `variable '${key}' is written by ${ids.length} nodes (${ids.join(', ')}) — later writes overwrite earlier ones`,
        nodeId: ids.at(-1),
      })
  }
  return issues
}

function lintEdge(e: Edge, idSet: Set<string>, nodeMap: Map<string, Node>): LintIssue[] {
  const issues: LintIssue[] = []
  if (!idSet.has(e.source)) issues.push({ severity: 'error', message: `edge source '${e.source}' is not a node`, edgeId: e.id })
  if (!idSet.has(e.target)) issues.push({ severity: 'error', message: `edge target '${e.target}' is not a node`, edgeId: e.id })
  if (e.kind === 'condition' && !e.condition?.trim())
    issues.push({ severity: 'error', message: 'condition edge needs condition text', edgeId: e.id })
  if (e.kind === 'logic' && !e.expression?.trim())
    issues.push({ severity: 'error', message: 'logic edge needs an expression', edgeId: e.id })
  // A condition edge only becomes an LLM handoff tool for LLM_NODE_TYPES sources
  // (see interpreter._handoff_tools). On any other node type it's never
  // evaluated — the default-target fallback picks it regardless of the text.
  if (e.kind === 'condition' && idSet.has(e.source) && !LLM_NODE_TYPES.has(nodeMap.get(e.source)!.type))
    issues.push({
      severity: 'error',
      message: `condition edges are only meaningful on conversation/extract_variable/subagent nodes (source '${e.source}' is a ${nodeMap.get(e.source)!.type} node and would take this edge unconditionally)`,
      edgeId: e.id,
    })
  return issues
}

// Every name that could plausibly hold a value by the time some node's text
// is interpolated: declared globals, extract_variable captures, and every
// node's saveAs — plus the built-in language-switch state variable (defaults
// to "wlanguage", overridable), written by a runtime tool with no node of its
// own, which would otherwise always look "unknown".
function knownVariableNames(wf: Workflow): Set<string> {
  const names = new Set(wf.variables.map((v) => v.key))
  for (const n of wf.nodes) {
    if (n.type === 'extract_variable') {
      for (const f of (n as { extractions?: { variable: string }[] }).extractions ?? []) names.add(f.variable)
    }
    const saveAs = (n as { saveAs?: unknown }).saveAs
    if (typeof saveAs === 'string' && saveAs.trim()) names.add(saveAs)
  }
  for (const lang of wf.agent?.languages ?? []) names.add(lang.state_variable || 'wlanguage')
  return names
}

function collectRefs(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    for (const m of value.matchAll(VAR_REF_RE)) out.push(m[1].split('.', 1)[0])
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectRefs(v, out))
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => collectRefs(v, out))
  }
}

// {{typo_name}} silently renders as an empty string at runtime — same failure
// shape as the dead {{..}} in a code node, just spread across every templated
// field instead of one. A warning, not an error: this can't see every way a
// name might become valid, so it flags rather than blocks.
function lintUnknownVariables(wf: Workflow): LintIssue[] {
  const known = knownVariableNames(wf)
  const issues: LintIssue[] = []
  for (const n of wf.nodes) {
    const refs: string[] = []
    for (const field of TEMPLATED_TEXT_FIELDS[n.type] ?? []) collectRefs((n as Record<string, unknown>)[field], refs)
    for (const field of TEMPLATED_DICT_FIELDS[n.type] ?? []) collectRefs((n as Record<string, unknown>)[field], refs)
    if (n.type === 'function') collectRefs((n as { body?: unknown }).body, refs)
    const unknown = [...new Set(refs.filter((r) => !known.has(r)))].sort((a, b) => a.localeCompare(b))
    if (unknown.length)
      issues.push({
        severity: 'warning',
        message: `references undeclared variable(s) ${unknown.map((u) => `{{${u}}}`).join(', ')} — these render as an empty string at runtime, not an error, so a typo here is invisible until someone notices blank text. Check spelling against Variables / this workflow's extractions and saveAs fields.`,
        nodeId: n.id,
      })
  }
  if (wf.agent?.globalPrompt) {
    const refs: string[] = []
    collectRefs(wf.agent.globalPrompt, refs)
    const unknown = [...new Set(refs.filter((r) => !known.has(r)))].sort((a, b) => a.localeCompare(b))
    if (unknown.length)
      issues.push({
        severity: 'warning',
        message: `agent.globalPrompt references undeclared variable(s) ${unknown.map((u) => `{{${u}}}`).join(', ')}`,
      })
  }
  return issues
}

function lintReachability(wf: Workflow, toolNodeIds: Set<string>, outEdges: (id: string) => Edge[]): LintIssue[] {
  const issues: LintIssue[] = []
  const reachable = reachableSet(wf)
  for (const n of wf.nodes) {
    if (NONRUNTIME_NODE_TYPES.has(n.type)) continue
    if (!reachable.has(n.id) && !toolNodeIds.has(n.id))
      issues.push({ severity: 'warning', message: `node '${n.id}' is unreachable from start`, nodeId: n.id })
    if (n.type !== 'ending' && !TELEPHONY_NODE_TYPES.has(n.type) && !toolNodeIds.has(n.id) && outEdges(n.id).length === 0)
      issues.push({ severity: 'warning', message: `node '${n.id}' is a dead-end (no outgoing edges)`, nodeId: n.id })
  }
  return issues
}

function collectToolNodeIds(wf: Workflow, nodeMap: Map<string, Node>): Set<string> {
  // Function nodes attached to a conversation/subagent via its `functions` array
  // are callable actions, not flow steps — reached by tool call, not by edge — so
  // they're exempt from reachability/dead-end checks. Only `function` nodes qualify.
  const toolNodeIds = new Set<string>()
  for (const n of wf.nodes) {
    const fns = (n as { functions?: unknown }).functions
    if (Array.isArray(fns)) {
      for (const fid of fns as string[]) {
        if (nodeMap.get(fid)?.type === 'function') toolNodeIds.add(fid)
      }
    }
  }
  return toolNodeIds
}

export function lintWorkflow(wf: Workflow): LintIssue[] {
  const idSet = new Set(wf.nodes.map((n) => n.id))
  const nodeMap = new Map(wf.nodes.map((n) => [n.id, n]))
  const outEdges = (id: string) => wf.edges.filter((e) => e.source === id)
  const webOn = !!wf.transports.web?.enabled
  const telOn = !!wf.transports.telephony?.enabled
  const toolNodeIds = collectToolNodeIds(wf, nodeMap)

  const issues: LintIssue[] = [...lintIds(wf.nodes)]
  if (!webOn && !telOn) issues.push({ severity: 'error', message: 'No transport enabled (enable web and/or telephony)' })
  issues.push(...lintStart(wf, idSet, nodeMap))
  for (const n of wf.nodes) issues.push(...lintNode(wf, n, telOn, outEdges))
  issues.push(...lintSaveAs(wf.nodes))
  for (const e of wf.edges) issues.push(...lintEdge(e, idSet, nodeMap))
  issues.push(...lintReachability(wf, toolNodeIds, outEdges))
  issues.push(...lintUnknownVariables(wf))
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
