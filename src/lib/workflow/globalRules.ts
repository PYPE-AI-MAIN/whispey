import type { Edge, GlobalRule, Workflow } from './schema'

// Steps that listen to the caller, so a condition can fire from them.
const LISTENING = new Set(['conversation', 'extract_variable', 'subagent'])

type Flow = Pick<Workflow, 'nodes' | 'edges' | 'globalRules'>

// A step that speaks and moves on (skipUserResponse) never listens, so a condition could not fire from it.
const listeningIds = (wf: Pick<Workflow, 'nodes'>) =>
  wf.nodes.filter((n) => LISTENING.has(n.type) && !(n as { skipUserResponse?: boolean }).skipUserResponse).map((n) => n.id)

/** Global rules as the plain edges the backend turns them into (same rule as the interpreter's load step). */
export function expandGlobalRules<T extends Flow>(wf: T): T {
  if (!wf.globalRules?.length) return wf
  const have = new Set(wf.edges.map((e) => `${e.source}|${e.target}|${e.condition ?? ''}`))
  const listening = listeningIds(wf)
  const added: Edge[] = []
  for (const rule of wf.globalRules) {
    for (const id of rule.sources.length ? rule.sources.filter((s) => listening.includes(s)) : listening) {
      if (id === rule.target || have.has(`${id}|${rule.target}|${rule.condition}`)) continue
      added.push({ id: `${rule.id}@${id}`, source: id, target: rule.target, kind: 'condition', condition: rule.condition, label: rule.label })
    }
  }
  return { ...wf, edges: [...wf.edges, ...added], globalRules: [] }
}

/**
 * What gets sent to the voice backend: the rules AND the plain edges they stand for. A backend that does not know
 * about global rules yet (older deployment) then still follows them; a current one drops the duplicates itself.
 */
export function deployable<T extends Flow>(wf: T): T {
  if (!wf.globalRules?.length) return wf
  const expanded = expandGlobalRules(wf)
  return { ...wf, edges: expanded.edges }
}

/** The reverse, for a workflow loaded back from the backend: rule-made edges are shown as the rules they came from. */
export function stripExpandedEdges<T extends Flow>(wf: T): T {
  const ruleIds = new Set((wf.globalRules ?? []).map((r) => r.id))
  if (!ruleIds.size) return wf
  return { ...wf, edges: wf.edges.filter((e) => !ruleIds.has(e.id.split('@')[0]) || !e.id.includes('@')) }
}

// An id no existing rule uses, so a second merge never reuses "global-1" (rule edge ids are built from it).
function nextRuleId(existing: GlobalRule[], added: GlobalRule[]): string {
  const taken = new Set([...existing, ...added].map((r) => r.id))
  let n = taken.size + 1
  while (taken.has(`global-${n}`)) n++
  return `global-${n}`
}

const norm = (s: string) => s.trim().toLowerCase().replaceAll(/\s+/g, ' ')

/**
 * Collapse the same condition edge repeated from 3+ steps into one global rule.
 * Behaviour is kept exactly: a rule lists only the steps that had the edge, unless
 * that is every listening step (then it applies to all).
 */
export function extractGlobalRules(wf: Flow, minCopies = 3): { edges: Edge[]; globalRules: GlobalRule[] } {
  const groups = new Map<string, Edge[]>()
  for (const e of wf.edges) {
    if (e.kind !== 'condition' || !e.condition) continue
    const key = `${e.target}|${norm(e.condition)}`
    groups.set(key, [...(groups.get(key) ?? []), e])
  }
  const listening = listeningIds(wf)
  const drop = new Set<string>()
  const rules: GlobalRule[] = []
  const existing = (wf.globalRules ?? []).map((r) => ({ ...r, sources: [...r.sources] }))
  for (const group of groups.values()) {
    if (group.length < minCopies) continue
    group.forEach((e) => drop.add(e.id))
    const sources = group.map((e) => e.source)
    const same = existing.find((r) => r.target === group[0].target && norm(r.condition) === norm(group[0].condition!))
    if (same) {
      // Already a rule for this: widen it (an empty list already means every step).
      if (same.sources.length) same.sources = [...new Set([...same.sources, ...sources])]
      continue
    }
    const covers = listening.filter((id) => id !== group[0].target).every((id) => sources.includes(id))
    rules.push({ id: nextRuleId(existing, rules), target: group[0].target, condition: group[0].condition!, label: group[0].label, sources: covers ? [] : sources })
  }
  return { edges: wf.edges.filter((e) => !drop.has(e.id)), globalRules: [...existing, ...rules] }
}
