// Validation for pype_voice_agents.flag_rules — the shape and rules here mirror
// utils/flagRulesEngine.mjs in the analytics lambda exactly. Keep both in sync.

import { EXCLUDED_METADATA_COLUMNS } from '@/lib/metadataColumnDenylist'

export const FLAG_SOURCES = new Set(['field_extractor', 'call_log'])
export const FLAG_MATCH_TYPES = new Set(['exact', 'starts_with', 'ends_with', 'contains'])
export const FLAG_OPERATORS = new Set([
  'equals', 'not_equals', 'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal',
  'in', 'not_in', 'is_empty', 'is_not_empty', 'invalid_phone_format',
])
// Operators that don't compare against `value` at all — value may be omitted for these.
export const FLAG_OPERATORS_NO_VALUE = new Set(['is_empty', 'is_not_empty', 'invalid_phone_format'])
// Numeric operators work on field_extractor values too (e.g. pain_score >= 8), not just
// call_log columns — the value must be numeric regardless of which source it targets.
export const FLAG_NUMERIC_OPERATORS = new Set(['greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal'])
// call_log columns a condition may reference. Tiered, not one flat allowlist — mirrors
// utils/flagRulesEngine.mjs's isAllowedCallLogField() in the lambda exactly:
//   1. Raw call_log columns — small, fixed, exact allowlist (real internal DB columns).
//   2. metadata.<key> — any key except EXCLUDED_METADATA_COLUMNS (metadata is already
//      fully user-visible product-wide via the Columns picker; same trust boundary).
//   3. metrics.<metric_id>.score — a configured metric's score only, not .reason (free
//      text) or .threshold. Exact metric-id selection only, no name-pattern matching.
export const CALL_LOG_FIELD_ALLOWLIST = new Set([
  'duration_seconds',
  'customer_number',
  'call_ended_reason',
  'metadata.transfer_call_initiated',
])
const METRIC_SCORE_PATH = /^metrics\.[^.]+\.score$/
export function isAllowedCallLogField(field: string): boolean {
  if (CALL_LOG_FIELD_ALLOWLIST.has(field)) return true
  if (field.startsWith('metadata.')) {
    const key = field.slice('metadata.'.length)
    return key.length > 0 && !EXCLUDED_METADATA_COLUMNS.includes(key)
  }
  return METRIC_SCORE_PATH.test(field)
}
export const MAX_RULES = 50
export const MAX_CONDITIONS_PER_RULE = 20

export function parseExtractorKeys(raw: unknown): Set<string> {
  if (typeof raw !== 'string' || !raw) return new Set()
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(
      parsed.map((f: any) => f?.key).filter((k: unknown): k is string => typeof k === 'string' && k.length > 0)
    )
  } catch {
    return new Set()
  }
}

/**
 * Returns an error message, or null if valid. `extractorKeys` cross-checks exact
 * field_extractor references so a typo'd field name is rejected at save time.
 * Pattern-style matchTypes (starts_with/ends_with/contains) are deliberately NOT
 * cross-checked — they exist precisely for naming conventions across fields not
 * yet known (e.g. any is_*_correctly field), so requiring an exact match would
 * defeat their purpose.
 */
export function validateFlagRules(flagRules: unknown, extractorKeys: Set<string>): string | null {
  if (flagRules === null) return null // clearing the config is allowed
  if (typeof flagRules !== 'object' || Array.isArray(flagRules)) return 'flag_rules must be an object'
  const cfg = flagRules as Record<string, unknown>

  if (typeof cfg.enabled !== 'boolean') return 'flag_rules.enabled must be a boolean'
  if (!Array.isArray(cfg.rules)) return 'flag_rules.rules must be an array'
  if (cfg.rules.length > MAX_RULES) return `flag_rules.rules cannot exceed ${MAX_RULES} rules`

  for (const [i, rule] of cfg.rules.entries()) {
    if (typeof rule !== 'object' || rule === null) return `rule ${i + 1} must be an object`
    const r = rule as Record<string, unknown>
    if (typeof r.id !== 'string' || !r.id) return `rule ${i + 1} is missing an id`
    if (r.reason !== undefined && r.reason !== null && typeof r.reason !== 'string') {
      return `rule ${i + 1} has an invalid reason`
    }
    if (!Array.isArray(r.conditions) || r.conditions.length === 0) {
      return `rule ${i + 1} must have at least one condition`
    }
    if (r.conditions.length > MAX_CONDITIONS_PER_RULE) {
      return `rule ${i + 1} cannot exceed ${MAX_CONDITIONS_PER_RULE} conditions`
    }

    for (const [j, condition] of r.conditions.entries()) {
      if (typeof condition !== 'object' || condition === null) return `rule ${i + 1}, condition ${j + 1} must be an object`
      const c = condition as Record<string, unknown>
      const source = (c.source as string) ?? 'field_extractor'
      const matchType = (c.matchType as string) ?? 'exact'
      const operator = (c.operator as string) ?? 'equals'

      if (!FLAG_SOURCES.has(source)) return `rule ${i + 1}, condition ${j + 1} has an invalid source`
      if (!FLAG_MATCH_TYPES.has(matchType)) return `rule ${i + 1}, condition ${j + 1} has an invalid matchType`
      if (!FLAG_OPERATORS.has(operator)) return `rule ${i + 1}, condition ${j + 1} has an invalid operator`
      if (typeof c.field !== 'string' || !c.field) return `rule ${i + 1}, condition ${j + 1} is missing a field`
      if (!FLAG_OPERATORS_NO_VALUE.has(operator) && (c.value === undefined || c.value === null || c.value === '')) {
        return `rule ${i + 1}, condition ${j + 1} is missing a value`
      }
      if (FLAG_NUMERIC_OPERATORS.has(operator) && Number.isNaN(Number(c.value))) {
        return `rule ${i + 1}, condition ${j + 1}: value must be numeric for ${operator}`
      }

      if (source === 'call_log') {
        if (matchType !== 'exact') return `rule ${i + 1}, condition ${j + 1}: call_log fields only support exact matching`
        if (!isAllowedCallLogField(c.field)) {
          return `rule ${i + 1}, condition ${j + 1}: "${c.field}" is not an allowed call log field`
        }
      } else if (matchType === 'exact' && extractorKeys.size > 0 && !extractorKeys.has(c.field)) {
        return `rule ${i + 1}, condition ${j + 1}: "${c.field}" is not a defined field extractor key`
      }
    }
  }
  return null
}
