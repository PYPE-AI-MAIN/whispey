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

const CALCULATION_WORDS: Record<string, string> = {
  count: 'How many calls',
  count_distinct: 'How many different',
  rate: 'Percentage where',
  sum: 'Total',
  avg: 'Average',
  min: 'Lowest',
  max: 'Highest',
  stddev: 'Spread of',
  p50: 'Middle value of',
  p90: 'Slowest 10% of',
  p95: 'Slowest 5% of',
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
