/**
 * Shared between the AI Chart Builder's chat client and (implicitly, via the
 * same `Spec` import) the query route: turns whatever the model said into
 * either a chart the canvas can actually draw, or a specific reason it can't.
 *
 * Runs client-side, the same way `WorkflowChat` validates a returned workflow
 * with `safeParseWorkflow` in the browser before ever calling `setWorkflow` —
 * a bad AI response is caught before Apply is even clickable, never after.
 */
import { Spec, type Condition, type SpecInput } from '@/server/analytics/spec'
import type { CatalogField, ChartKind } from '@/types/analytics'

export const AI_CHART_KINDS = ['kpi', 'bar', 'line', 'pie', 'table'] as const

export type AiChart = { title: string; kind: ChartKind; spec: SpecInput }

/** The model's most recent fenced ```json block, or null if it hasn't written one (yet, if still streaming). */
export function extractChartJson(text: string): unknown {
  const start = text.lastIndexOf('```json')
  if (start === -1) return null
  const end = text.indexOf('```', start + 7)
  if (end === -1) return null
  const raw = text.slice(start + 7, end).trim()
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * A past assistant turn's chart JSON is already summarized by its own status
 * badge in the UI, and the CURRENT draft is resent separately every request —
 * repeating the raw block in history just makes every later request bigger
 * for no benefit. ponytail: walk fences with indexOf, not a backtracking
 * regex, same trick `WorkflowChat` uses for the identical reason.
 */
export function stripJsonBlocksForHistory(text: string): string {
  const placeholder = '[chart JSON omitted — see the draft above]'
  let result = ''
  let pos = 0
  while (pos < text.length) {
    const start = text.indexOf('```json', pos)
    if (start === -1) {
      result += text.slice(pos)
      break
    }
    const end = text.indexOf('```', start + 7)
    if (end === -1) {
      result += text.slice(pos)
      break
    }
    result += text.slice(pos, start) + placeholder
    pos = end + 3
  }
  return result
}

function fieldRefs(spec: Record<string, unknown>): { col: string; path?: string[] }[] {
  const refs: { col: string; path?: string[] }[] = []
  const agg = spec.agg as { field?: { col: string; path?: string[] } } | undefined
  if (agg?.field) refs.push(agg.field)
  const dimension = spec.dimension as { field?: { col: string; path?: string[] } } | undefined
  if (dimension?.field) refs.push(dimension.field)
  const walk = (nodes: unknown): void => {
    for (const node of Array.isArray(nodes) ? nodes : []) {
      if (node && typeof node === 'object' && 'children' in node) walk((node as { children: unknown }).children)
      else if (node && typeof node === 'object' && 'field' in node) refs.push((node as Condition).field)
    }
  }
  walk(spec.filters)
  walk(spec.having)
  return refs
}

/** Every field the model referenced has to be one this agent's catalog actually has — `Spec` catches an unknown `col`, but a hallucinated JSON `path` under a real column (e.g. `metadata`) would otherwise pass validation and just draw an empty chart. */
function unknownFieldRef(spec: Record<string, unknown>, fields: CatalogField[]): string | null {
  const known = new Set(fields.map((f) => `${f.col}::${f.path.join('.')}`))
  for (const ref of fieldRefs(spec)) {
    const key = `${ref.col}::${(ref.path ?? []).join('.')}`
    if (!known.has(key)) return key
  }
  return null
}

/**
 * Normalizes and validates one candidate chart against `Spec` — the same
 * schema every hand-built chart on the canvas already goes through. `grain`
 * is always forced to 'interaction' and `dedupe`/`element_source` are always
 * stripped here, regardless of what the model wrote: that is the fussiest,
 * most cross-checked corner of the schema, and nothing here needs it.
 */
export function validateAiChart(candidate: unknown, fields: CatalogField[]): { ok: true; chart: AiChart } | { ok: false; error: string } {
  if (typeof candidate !== 'object' || candidate === null) return { ok: false, error: 'not a chart object' }
  const { title, kind, spec } = candidate as Record<string, unknown>

  if (typeof title !== 'string' || !title.trim()) return { ok: false, error: 'missing a title' }
  if (typeof kind !== 'string' || !(AI_CHART_KINDS as readonly string[]).includes(kind)) {
    return { ok: false, error: `unsupported chart type "${kind}"` }
  }
  if (typeof spec !== 'object' || spec === null) return { ok: false, error: 'missing a chart definition' }

  const draft: Record<string, unknown> = {
    spec_version: 1,
    range: { days: 30 },
    display: { round: 1 },
    ...(spec as Record<string, unknown>),
  }
  draft.grain = 'interaction'
  delete draft.dedupe
  delete draft.element_source

  const badRef = unknownFieldRef(draft, fields)
  if (badRef) return { ok: false, error: `referenced a field that doesn't exist on this agent (${badRef})` }

  const validated = Spec.safeParse(draft)
  if (!validated.success) return { ok: false, error: validated.error.issues[0]?.message ?? 'invalid chart definition' }

  return { ok: true, chart: { title: title.trim(), kind: kind as ChartKind, spec: validated.data } }
}
