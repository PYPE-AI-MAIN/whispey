/**
 * The math behind a "Percentage" card — Confluence "Analytics Phase 1 and 2 —
 * Build Spec" §7.1's "chart type is presentational" rule extended one step
 * further: a formula card is two ordinary chart specs, each run through the
 * exact same pipeline as any other widget, divided once both are back.
 * buildQuery never sees the division — this is the only place it happens.
 *
 * Kept out of the query route's own file (rather than a local function there)
 * because that file imports `@/server/analytics/db`, which is `server-only`
 * and cannot be pulled into a plain unit test. This module has no such
 * import, so the arithmetic — the part actually worth testing — can be.
 */

export type WidgetResult = {
  widget_id: string
  status: 'ok' | 'error' | 'timeout' | 'skipped'
  data?: unknown[]
  meta?: unknown
  error?: string
}

/** A formula card's spec: two ordinary specs and how to combine them. Never reaches buildQuery. */
export function asFormulaSpec(spec: unknown): { a: unknown; b: unknown; op: 'percent' | 'ratio' } | null {
  if (!spec || typeof spec !== 'object') return null
  const s = spec as { a?: unknown; b?: unknown; op?: unknown }
  return s.a && s.b && (s.op === 'percent' || s.op === 'ratio') ? { a: s.a, b: s.b, op: s.op } : null
}

/** A ÷ B (or A ÷ B × 100), once both sides are back — one bad or missing side fails the whole card. */
export function combineFormula(
  f: { id: string; op: 'percent' | 'ratio'; aId: string; bId: string },
  results: Map<string, WidgetResult>
): WidgetResult {
  const a = results.get(f.aId)
  const b = results.get(f.bId)
  if (a?.status !== 'ok') return { widget_id: f.id, status: a?.status ?? 'error', error: a?.error ?? 'Could not compute this' }
  if (b?.status !== 'ok') return { widget_id: f.id, status: b?.status ?? 'error', error: b?.error ?? 'Could not compute this' }

  const aVal = firstValue(a.data)
  const bVal = firstValue(b.data)
  if (aVal === null || bVal === null || bVal === 0) return { widget_id: f.id, status: 'ok', data: [{ value: null }] }

  const value = f.op === 'percent' ? (aVal / bVal) * 100 : aVal / bVal
  return { widget_id: f.id, status: 'ok', data: [{ value }] }
}

function firstValue(rows: unknown[] | undefined): number | null {
  const raw = (rows?.[0] as { value?: unknown } | undefined)?.value
  const n = raw === null || raw === undefined ? Number.NaN : Number(raw)
  return Number.isFinite(n) ? n : null
}
