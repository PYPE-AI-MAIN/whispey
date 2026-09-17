/**
 * What a card is actually counting, in words — Confluence "Analytics Phase 1
 * and 2 — Build Spec" §10.5 and §10.8.
 *
 * "Completed calls · 110" is not a number anyone can check. Completed according
 * to what? The definition lives in the saved object, so the card can simply say
 * it: "How many calls · only where why the call ended is completed".
 *
 * No database words, ever. Fields are named the way the catalog names them, and
 * a JSON path never appears.
 */
import type { CatalogField, Widget } from '@/types/analytics'
import type { Condition, FilterNode } from '@/server/analytics/spec'

const OPERATOR_WORDS: Record<Condition['op'], string> = {
  eq: 'is',
  neq: 'is not',
  in: 'is one of',
  not_in: 'is not',
  gt: 'is more than',
  gte: 'is at least',
  lt: 'is less than',
  lte: 'is at most',
  contains: 'contains',
  starts_with: 'starts with',
  is_empty: 'is blank',
  is_not_empty: 'has any value',
  is_true: 'is yes',
  is_false: 'is no',
}

const NEEDS_VALUE = new Set<Condition['op']>([
  'eq', 'neq', 'in', 'not_in', 'gt', 'gte', 'lt', 'lte', 'contains', 'starts_with',
])

/**
 * Every calculation, in one table — the dropdown and the card's definition line
 * read the same row, so they cannot drift apart. They had: the panel said
 * "Average of" while the card said "Average", and "Slowest 5%" was only true if
 * the field happened to be a latency. The total cost of a call is not slow.
 *
 * `label` is what the dropdown shows on its own, `phrase` is how it reads in
 * front of a field name, and `help` is the line underneath — because a
 * calculation you cannot explain is a number nobody can check.
 */
export type CalculationFn =
  | 'count' | 'count_distinct' | 'rate' | 'sum' | 'avg' | 'p50' | 'p95' | 'min' | 'max'

export const CALCULATIONS: {
  fn: CalculationFn
  label: string
  /** How it reads in front of a field name on the card. The same words. */
  phrase: string
  /** What kind of field it needs, which is what the field list is filtered by. */
  needs: 'none' | 'any' | 'number' | 'boolean'
  help: string
}[] = [
  {
    fn: 'count', label: 'Count of calls', phrase: 'Count of calls', needs: 'none',
    help: 'Every call that matches, counted once.',
  },
  {
    fn: 'count_distinct', label: 'Unique count of', phrase: 'Unique count of', needs: 'any',
    help: 'Each value counted once — ten calls from four numbers is four.',
  },
  {
    fn: 'rate', label: 'Percentage yes', phrase: 'Percentage where', needs: 'boolean',
    help: 'Out of the calls where this field has an answer, not out of every call.',
  },
  {
    fn: 'sum', label: 'Sum of', phrase: 'Sum of', needs: 'number',
    help: 'Every value added together.',
  },
  {
    fn: 'avg', label: 'Average of', phrase: 'Average of', needs: 'number',
    help: 'The mean. One extreme call moves it a long way.',
  },
  {
    fn: 'p50', label: 'Median of', phrase: 'Median of', needs: 'number',
    help: 'Half the calls are below this and half above. Extremes do not move it.',
  },
  {
    fn: 'p95', label: '95th percentile of', phrase: '95th percentile of', needs: 'number',
    help: '95 calls in every 100 stay below this. The bad tail, not the average.',
  },
  {
    fn: 'min', label: 'Minimum of', phrase: 'Minimum of', needs: 'number',
    help: 'The smallest value recorded.',
  },
  {
    fn: 'max', label: 'Maximum of', phrase: 'Maximum of', needs: 'number',
    help: 'The largest value recorded.',
  },
]

const CALCULATION_WORDS: Record<string, string> = {
  ...Object.fromEntries(CALCULATIONS.map((c) => [c.fn, c.phrase])),
  // allowed by the spec but not offered in the panel, so they only need words
  stddev: 'Spread of',
  p90: '90th percentile of',
}

export function fieldName(
  ref: { col: string; path?: string[] } | undefined,
  fields: CatalogField[]
): string {
  if (!ref) return ''
  const match = fields.find((f) => f.col === ref.col && f.path.join('.') === (ref.path ?? []).join('.'))
  if (match) return match.label.toLowerCase()
  // the catalog has not caught up with this field yet; the leaf name still
  // reads better than the whole path
  return (ref.path?.[ref.path.length - 1] ?? ref.col).replace(/[_.]+/g, ' ').toLowerCase()
}

export function describeCondition(condition: Condition, fields: CatalogField[]): string {
  const name = fieldName(condition.field, fields)
  // "is conversation hindi is yes" is not a sentence; these fields are already
  // named as questions
  if (condition.op === 'is_true') return `${name}: yes`
  if (condition.op === 'is_false') return `${name}: no`
  const words = OPERATOR_WORDS[condition.op] ?? condition.op
  if (!NEEDS_VALUE.has(condition.op)) return `${name} ${words}`
  const value = Array.isArray(condition.value) ? condition.value.join(' or ') : condition.value
  return `${name} ${words} ${value}`
}

function describeNode(node: FilterNode, fields: CatalogField[]): string {
  if ('children' in node) {
    return `(${node.children.map((c) => describeNode(c, fields)).join(node.op === 'and' ? ' and ' : ' or ')})`
  }
  return describeCondition(node, fields)
}

/** The one-line definition under a card's title. Empty when there is nothing to explain. */
export function explainSpec(spec: Widget['spec'], fields: CatalogField[]): string {
  const parts: string[] = []

  const fn = spec.agg?.fn ?? 'count'
  const field = spec.agg?.field
  if (fn === 'count') parts.push(CALCULATION_WORDS.count)
  else if (fn === 'rate') parts.push(`Percentage where ${fieldName(field, fields)} is ${spec.agg?.match === false ? 'no' : 'yes'}`)
  else parts.push(`${CALCULATION_WORDS[fn] ?? fn} ${fieldName(field, fields)}`.trim())

  if (spec.dimension?.field) parts.push(`split by ${fieldName(spec.dimension.field, fields)}`)

  const conditions = [...(spec.having ?? []), ...(spec.filters ?? [])] as FilterNode[]
  if (conditions.length) parts.push(`only where ${conditions.map((c) => describeNode(c, fields)).join(' and ')}`)

  // a rate over the rows that actually carry the field is the default, and the
  // card's coverage line already says how many those were
  if (fn === 'rate' && spec.agg?.denominator === 'all_rows') parts.push('out of every call')

  if (spec.time_of_day) parts.push(`between ${spec.time_of_day.from} and ${spec.time_of_day.to}`)
  if (spec.exclude_environments?.length) parts.push(`not counting ${spec.exclude_environments.join(', ')}`)

  return parts.join(' · ')
}
