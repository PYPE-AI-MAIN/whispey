import { describe, expect, test } from 'vitest'
import { validateFlagRules, parseExtractorKeys } from '@/lib/flagRulesValidation'

const EXTRACTOR_KEYS = new Set(['is_task_complete', 'is_user_in_call', 'is_guardrail_respected'])

function simpleRule(overrides: Record<string, unknown> = {}) {
  return {
    enabled: true,
    rules: [{ id: 'r1', reason: 'x', conditions: [{ field: 'is_guardrail_respected', value: '0' }] }],
    ...overrides,
  }
}

describe('validateFlagRules', () => {
  test('null clears the config — always valid', () => {
    expect(validateFlagRules(null, EXTRACTOR_KEYS)).toBeNull()
  })

  test('a well-formed single-condition rule is valid', () => {
    expect(validateFlagRules(simpleRule(), EXTRACTOR_KEYS)).toBeNull()
  })

  test('rejects non-object / array config', () => {
    expect(validateFlagRules('nope', EXTRACTOR_KEYS)).toMatch(/must be an object/)
    expect(validateFlagRules([], EXTRACTOR_KEYS)).toMatch(/must be an object/)
    expect(validateFlagRules(undefined, EXTRACTOR_KEYS)).toMatch(/must be an object/)
  })

  test('enabled must be boolean', () => {
    expect(validateFlagRules({ enabled: 'true', rules: [] }, EXTRACTOR_KEYS)).toMatch(/enabled must be a boolean/)
  })

  test('rules must be an array', () => {
    expect(validateFlagRules({ enabled: true, rules: 'nope' }, EXTRACTOR_KEYS)).toMatch(/rules must be an array/)
  })

  test('rejects more than MAX_RULES rules', () => {
    const rules = Array.from({ length: 51 }, (_, i) => ({ id: `r${i}`, conditions: [{ field: 'is_guardrail_respected', value: '0' }] }))
    expect(validateFlagRules({ enabled: true, rules }, EXTRACTOR_KEYS)).toMatch(/cannot exceed 50 rules/)
  })

  test('rule must be an object with a non-empty id', () => {
    expect(validateFlagRules({ enabled: true, rules: [null] }, EXTRACTOR_KEYS)).toMatch(/must be an object/)
    expect(validateFlagRules({ enabled: true, rules: [{ conditions: [] }] }, EXTRACTOR_KEYS)).toMatch(/missing an id/)
  })

  test('reason must be a string when present', () => {
    expect(validateFlagRules({ enabled: true, rules: [{ id: 'r1', reason: 42, conditions: [{ field: 'is_guardrail_respected', value: '0' }] }] }, EXTRACTOR_KEYS))
      .toMatch(/invalid reason/)
  })

  test('rule must have at least one condition', () => {
    expect(validateFlagRules({ enabled: true, rules: [{ id: 'r1', conditions: [] }] }, EXTRACTOR_KEYS)).toMatch(/at least one condition/)
    expect(validateFlagRules({ enabled: true, rules: [{ id: 'r1', conditions: 'nope' }] }, EXTRACTOR_KEYS)).toMatch(/at least one condition/)
  })

  test('rejects more than MAX_CONDITIONS_PER_RULE conditions', () => {
    const conditions = Array.from({ length: 21 }, () => ({ field: 'is_guardrail_respected', value: '0' }))
    expect(validateFlagRules({ enabled: true, rules: [{ id: 'r1', conditions }] }, EXTRACTOR_KEYS)).toMatch(/cannot exceed 20 conditions/)
  })

  test('rejects an invalid source/matchType/operator', () => {
    expect(validateFlagRules({ enabled: true, rules: [{ id: 'r1', conditions: [{ source: 'nope', field: 'x', value: '0' }] }] }, EXTRACTOR_KEYS)).toMatch(/invalid source/)
    expect(validateFlagRules({ enabled: true, rules: [{ id: 'r1', conditions: [{ matchType: 'nope', field: 'x', value: '0' }] }] }, EXTRACTOR_KEYS)).toMatch(/invalid matchType/)
    expect(validateFlagRules({ enabled: true, rules: [{ id: 'r1', conditions: [{ operator: 'nope', field: 'x', value: '0' }] }] }, EXTRACTOR_KEYS)).toMatch(/invalid operator/)
  })

  test('condition must have a non-empty field', () => {
    expect(validateFlagRules({ enabled: true, rules: [{ id: 'r1', conditions: [{ value: '0' }] }] }, EXTRACTOR_KEYS)).toMatch(/missing a field/)
    expect(validateFlagRules({ enabled: true, rules: [{ id: 'r1', conditions: [{ field: '', value: '0' }] }] }, EXTRACTOR_KEYS)).toMatch(/missing a field/)
  })

  test('value is required for equals/not_equals/greater_than/less_than/in/not_in', () => {
    for (const operator of ['equals', 'not_equals', 'greater_than', 'less_than', 'in', 'not_in']) {
      const cfg = { enabled: true, rules: [{ id: 'r1', conditions: [{ field: 'is_guardrail_respected', operator }] }] }
      expect(validateFlagRules(cfg, EXTRACTOR_KEYS)).toMatch(/missing a value/)
    }
  })

  test('value is NOT required for is_empty/is_not_empty/invalid_phone_format (real Felix requirement: field IS NULL)', () => {
    for (const operator of ['is_empty', 'is_not_empty', 'invalid_phone_format']) {
      const cfg = { enabled: true, rules: [{ id: 'r1', conditions: [{ field: 'is_guardrail_respected', operator }] }] }
      expect(validateFlagRules(cfg, EXTRACTOR_KEYS)).toBeNull()
    }
  })

  test('call_log source only supports exact matchType', () => {
    const cfg = { enabled: true, rules: [{ id: 'r1', conditions: [{ source: 'call_log', matchType: 'ends_with', field: 'duration_seconds', operator: 'greater_than', value: 900 }] }] }
    expect(validateFlagRules(cfg, EXTRACTOR_KEYS)).toMatch(/only support exact matching/)
  })

  test('call_log field must be on the allowlist', () => {
    const cfg = { enabled: true, rules: [{ id: 'r1', conditions: [{ source: 'call_log', field: 'recording_url', value: 'x' }] }] }
    expect(validateFlagRules(cfg, EXTRACTOR_KEYS)).toMatch(/not an allowed call log field/)
  })

  test('any non-denylisted metadata.<key> is accepted (tiered access, not a flat allowlist)', () => {
    const cfg = { enabled: true, rules: [{ id: 'r1', conditions: [{ source: 'call_log', field: 'metadata.urgent', value: 'true' }] }] }
    expect(validateFlagRules(cfg, EXTRACTOR_KEYS)).toBeNull()
  })

  test('denylisted metadata keys are rejected even though they start with "metadata."', () => {
    for (const key of ['apikey', 'api_url', 'complete_configuration', 'usage', 'sip_trunk_id', 'campaignId', 'contactId', 'agent_name', 'retry_config', 'metadata']) {
      const cfg = { enabled: true, rules: [{ id: 'r1', conditions: [{ source: 'call_log', field: `metadata.${key}`, value: 'x' }] }] }
      expect(validateFlagRules(cfg, EXTRACTOR_KEYS)).toMatch(/not an allowed call log field/)
    }
  })

  test('"metadata." with no key segment is rejected', () => {
    const cfg = { enabled: true, rules: [{ id: 'r1', conditions: [{ source: 'call_log', field: 'metadata.', value: 'x' }] }] }
    expect(validateFlagRules(cfg, EXTRACTOR_KEYS)).toMatch(/not an allowed call log field/)
  })

  test('metrics.<id>.score is accepted (real Metrics Configuration feature)', () => {
    const cfg = { enabled: true, rules: [{ id: 'r1', conditions: [{ source: 'call_log', field: 'metrics.escalation_appropriateness.score', operator: 'less_than', value: 0.5 }] }] }
    expect(validateFlagRules(cfg, EXTRACTOR_KEYS)).toBeNull()
  })

  test('metrics.<id>.reason is rejected — only .score is accessible', () => {
    const cfg = { enabled: true, rules: [{ id: 'r1', conditions: [{ source: 'call_log', field: 'metrics.escalation_appropriateness.reason', value: 'x' }] }] }
    expect(validateFlagRules(cfg, EXTRACTOR_KEYS)).toMatch(/not an allowed call log field/)
  })

  test('a bare metric id with no .score suffix is rejected', () => {
    const cfg = { enabled: true, rules: [{ id: 'r1', conditions: [{ source: 'call_log', field: 'metrics.escalation_appropriateness', value: 'x' }] }] }
    expect(validateFlagRules(cfg, EXTRACTOR_KEYS)).toMatch(/not an allowed call log field/)
  })

  test('call_log greater_than/less_than requires a numeric value', () => {
    const cfg = { enabled: true, rules: [{ id: 'r1', conditions: [{ source: 'call_log', field: 'duration_seconds', operator: 'greater_than', value: 'not-a-number' }] }] }
    expect(validateFlagRules(cfg, EXTRACTOR_KEYS)).toMatch(/value must be numeric/)
  })

  test('numeric operators require a numeric value on field_extractor source too (real requirement: pain_score >= 8, Triage agent)', () => {
    const badCfg = { enabled: true, rules: [{ id: 'r1', conditions: [{ field: 'is_guardrail_respected', operator: 'greater_than_or_equal', value: 'not-a-number' }] }] }
    expect(validateFlagRules(badCfg, EXTRACTOR_KEYS)).toMatch(/value must be numeric/)

    const goodCfg = { enabled: true, rules: [{ id: 'r1', conditions: [{ field: 'is_guardrail_respected', operator: 'greater_than_or_equal', value: 8 }] }] }
    expect(validateFlagRules(goodCfg, EXTRACTOR_KEYS)).toBeNull()
  })

  test('less_than_or_equal is accepted as a valid operator', () => {
    const cfg = { enabled: true, rules: [{ id: 'r1', conditions: [{ field: 'is_guardrail_respected', operator: 'less_than_or_equal', value: 3 }] }] }
    expect(validateFlagRules(cfg, EXTRACTOR_KEYS)).toBeNull()
  })

  test('field_extractor exact match rejects a field not in extractorKeys (typo guard)', () => {
    const cfg = { enabled: true, rules: [{ id: 'r1', conditions: [{ field: 'is_gaurdrail_respectd', value: '0' }] }] }
    expect(validateFlagRules(cfg, EXTRACTOR_KEYS)).toMatch(/not a defined field extractor key/)
  })

  test('field_extractor exact match is not cross-checked when extractorKeys is empty (agent has no extractor fields yet)', () => {
    const cfg = { enabled: true, rules: [{ id: 'r1', conditions: [{ field: 'anything', value: '0' }] }] }
    expect(validateFlagRules(cfg, new Set())).toBeNull()
  })

  test('pattern matchTypes (starts_with/ends_with/contains) are NOT cross-checked against extractorKeys — by design', () => {
    const cfg = { enabled: true, rules: [{ id: 'r1', conditions: [{ matchType: 'ends_with', field: '_correctly', value: '0' }] }] }
    expect(validateFlagRules(cfg, EXTRACTOR_KEYS)).toBeNull()
  })

  test('a rule with a valid multi-condition AND (real requirement: task_incomplete)', () => {
    const cfg = {
      enabled: true,
      rules: [{ id: 'r1', reason: 'task_incomplete', conditions: [
        { field: 'is_task_complete', value: '0' },
        { field: 'is_user_in_call', value: '1' },
      ] }],
    }
    expect(validateFlagRules(cfg, EXTRACTOR_KEYS)).toBeNull()
  })
})

describe('parseExtractorKeys', () => {
  test('parses a well-formed field extractor prompt JSON string', () => {
    const raw = JSON.stringify([{ key: 'is_task_complete', description: 'x' }, { key: 'is_user_in_call', description: 'y' }])
    expect(parseExtractorKeys(raw)).toEqual(new Set(['is_task_complete', 'is_user_in_call']))
  })

  test('non-string, empty string, malformed JSON, and non-array all return an empty set without throwing', () => {
    expect(parseExtractorKeys(undefined)).toEqual(new Set())
    expect(parseExtractorKeys(null)).toEqual(new Set())
    expect(parseExtractorKeys('')).toEqual(new Set())
    expect(parseExtractorKeys('not json')).toEqual(new Set())
    expect(parseExtractorKeys(JSON.stringify({ not: 'an array' }))).toEqual(new Set())
  })

  test('drops entries with a missing or non-string key', () => {
    const raw = JSON.stringify([{ key: 'valid_key' }, { description: 'no key here' }, { key: 42 }, null])
    expect(parseExtractorKeys(raw)).toEqual(new Set(['valid_key']))
  })
})
