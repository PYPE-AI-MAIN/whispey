/**
 * What a chart should be before anyone configures it — Confluence "Analytics
 * Phase 1 and 2 — Build Spec" §10.4 ("dropping a chart opens settings already
 * filled in with the suggested field") and the rules half of §11.3.
 *
 * Rules first, LLM second. These are the rules: they turn a field's shape into
 * a chart, ordered by how often the field is filled in, and every suggestion can
 * say why. When the model is added it writes the same object this does — and if
 * it is down, this still works.
 */
import type { CatalogField, ChartKind } from '@/types/analytics'
import type { SpecInput } from '@/server/analytics/spec'

/** A field almost nobody fills in makes a chart that looks broken. */
const MIN_COVERAGE = 20

const ref = (f: CatalogField) => ({ col: f.col, ...(f.path.length ? { path: f.path } : {}) })
const byCoverage = (a: CatalogField, b: CatalogField) => (b.coverage_pct ?? 0) - (a.coverage_pct ?? 0)

const usable = (fields: CatalogField[], type: CatalogField['value_type']) =>
  fields.filter((f) => f.value_type === type && (f.coverage_pct ?? 0) >= MIN_COVERAGE).sort(byCoverage)

/**
 * The spec a freshly dropped chart starts with. Never empty: an empty card is a
 * puzzle, a filled one is a thing to adjust.
 */
export function suggestSpec(kind: ChartKind, fields: CatalogField[]): SpecInput {
  const base = { spec_version: 1 as const, range: { days: 30 }, display: { round: 0 } }

  if (kind === 'kpi') {
    // a rate reads better as a single number than a count does
    const boolean = usable(fields, 'boolean')[0]
    return boolean
      ? {
          ...base,
          agg: { fn: 'rate', field: { ...ref(boolean), boolean_encoding: boolean.boolean_encoding ?? 'true_false' }, denominator: 'field_present' },
          display: { round: 1, unit: '%' },
        }
      : { ...base, agg: { fn: 'count' } }
  }

  if (kind === 'line') {
    return { ...base, agg: { fn: 'count' }, bucket: 'day' }
  }

  const category = usable(fields, 'enum')[0]
  return {
    ...base,
    agg: { fn: 'count' },
    ...(category ? { dimension: { field: ref(category), limit: kind === 'pie' ? 8 : 12 } } : {}),
  }
}

/** The title that goes with it, in the words the catalog uses rather than a path. */
export function suggestTitle(kind: ChartKind, fields: CatalogField[]): string {
  if (kind === 'kpi') {
    const boolean = usable(fields, 'boolean')[0]
    return boolean ? boolean.label : 'Total calls'
  }
  if (kind === 'line') return 'Calls over time'
  const category = usable(fields, 'enum')[0]
  return category ? `Calls by ${category.label.toLowerCase()}` : 'Calls'
}

/**
 * Charts worth offering for this agent, best first. Each says why, because a
 * suggestion without a reason is noise.
 */
export function suggestions(fields: CatalogField[]): { title: string; why: string; kind: ChartKind; spec: SpecInput }[] {
  const out: { title: string; why: string; kind: ChartKind; spec: SpecInput }[] = []

  for (const f of usable(fields, 'boolean').slice(0, 5)) {
    out.push({
      title: f.label,
      why: `yes or no, filled in on ${f.coverage_pct}% of calls`,
      kind: 'kpi',
      spec: {
        spec_version: 1,
        agg: { fn: 'rate', field: { ...ref(f), boolean_encoding: f.boolean_encoding ?? 'true_false' }, denominator: 'field_present' },
        range: { days: 30 },
        display: { round: 1, unit: '%' },
      },
    })
  }

  for (const f of usable(fields, 'enum').slice(0, 5)) {
    out.push({
      title: `Calls by ${f.label.toLowerCase()}`,
      why: `${f.cardinality_est ?? 0} different values, filled in on ${f.coverage_pct}% of calls`,
      kind: 'bar',
      spec: {
        spec_version: 1,
        agg: { fn: 'count' },
        dimension: { field: ref(f), limit: 12 },
        range: { days: 30 },
        display: { round: 0 },
      },
    })
  }

  for (const f of usable(fields, 'number').slice(0, 3)) {
    out.push({
      title: `${f.label} over time`,
      why: `a number, filled in on ${f.coverage_pct}% of calls`,
      kind: 'line',
      spec: {
        spec_version: 1,
        agg: { fn: 'avg', field: ref(f) },
        bucket: 'day',
        range: { days: 30 },
        display: { round: 2 },
      },
    })
  }

  return out
}

/**
 * Which field identifies the same patient across calls, best first.
 *
 * A real column beats a copy of it inside metadata. This agent writes the
 * caller's number into both `customer_number` and `metadata.wcalling_number` —
 * 165 and 167 distinct values over the same 481 calls — and the JSON copy won
 * simply by sorting first. The column is the one that is always there, always
 * spelled the same way, and readable by somebody who does not know the agent.
 */
export function identityFields(fields: CatalogField[]): CatalogField[] {
  return fields
    .filter((f) => f.is_identity_candidate)
    .sort((a, b) => Number(a.path.length > 0) - Number(b.path.length > 0) || byCoverage(a, b))
}

/** Which field carries the outcome to rank attempts by (§10.6). */
export function outcomeField(fields: CatalogField[], saved?: { col: string; path?: string[] } | null): CatalogField | undefined {
  if (saved) {
    const match = fields.find((f) => f.col === saved.col && f.path.join('.') === (saved.path ?? []).join('.'))
    if (match) return match
  }
  // a short list of named results is what an outcome looks like
  return usable(fields, 'enum').find((f) => f.path.length > 0) ?? usable(fields, 'enum')[0]
}

/**
 * Switching chart type has to give you a chart, not a puzzle.
 *
 * Chart type stays presentational — it never reaches the compiler — but each
 * type needs a particular *shape* to draw: a line needs something on the time
 * axis, a pie and a bar need categories, a number needs neither. Changing the
 * type without changing the shape leaves an empty rectangle and no explanation,
 * which is the opposite of self-serve. So the shape is adjusted to match, using
 * the same rules a freshly dropped chart uses.
 */
export function adaptSpecToKind(spec: SpecInput, kind: ChartKind, fields: CatalogField[]): SpecInput {
  const next: SpecInput = { ...spec }

  if (kind === 'kpi') {
    // one number: no axis of any sort
    delete next.dimension
    next.bucket = 'none'
    return next
  }

  if (kind === 'line') {
    // a line is a shape over time; without a bucket it has nothing to run along
    if (!next.bucket || next.bucket === 'none') next.bucket = 'day'
    return next
  }

  // bar, pie and table read categories. Keep a time bucket if one is already
  // set — a stacked bar over time is a real chart — but a pie cannot hold both.
  if (!next.dimension) {
    const suggested = suggestSpec(kind, fields).dimension
    if (suggested) next.dimension = suggested
  }
  if (kind === 'pie') {
    next.bucket = 'none'
    if (next.dimension) next.dimension = { ...next.dimension, limit: Math.min(next.dimension.limit ?? 8, 8) }
  }
  return next
}

/**
 * What a chart is "about", so the same field is never suggested twice.
 *
 * A dashboard already showing "Calls by why the call ended" does not need that
 * offered again, and a suggestion strip that repeats the canvas is noise — the
 * thing §11.3 says a suggestion must never be.
 */
export function chartSubject(spec: SpecInput): string {
  const f = spec.dimension?.field ?? spec.agg?.field
  return f ? `${spec.agg?.fn}::${f.col}::${(f.path ?? []).join('.')}` : `${spec.agg?.fn}::count`
}
