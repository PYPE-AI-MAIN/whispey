/**
 * Working out what a field is, from what the data actually holds — Confluence
 * §11.2. Every case below is a shape that exists in production.
 */
import { describe, it, expect } from 'vitest'
import { inferField, humanise, type FieldStats } from '@/server/analytics/catalog'

const stats = (over: Partial<FieldStats>): FieldStats => ({
  path: ['field'], rows_with_key: 100, rows_sampled: 100,
  n_object: 0, n_array: 0, n_number: 0, n_boolean: 0, n_string: 100,
  n_null: 0, n_sentinel: 0, distinct_values: 2, sample_values: [],
  ...over,
})

describe('field names become something a nurse can read', () => {
  it('turns both naming styles into words', () => {
    expect(humanise('is_task_complete')).toBe('Is task complete')
    expect(humanise('finalDisposition')).toBe('Final disposition')
    expect(humanise('llm_prompt_tokens')).toBe('Llm prompt tokens')
  })

  it('survives a field name with a trailing space', () => {
    expect(humanise('summary ')).toBe('Summary')
  })
})

describe('true and false, written four ways', () => {
  it.each([
    ['1/0', ['1', '0'], 'one_zero'],
    ['true/false', ['true', 'false'], 'true_false'],
    ['yes/no', ['yes', 'no'], 'yes_no'],
    ['y/n', ['y', 'n'], 'y_n'],
  ])('recognises %s', (_label, values, encoding) => {
    const f = inferField(stats({ sample_values: values, distinct_values: 2 }))
    expect(f.value_type).toBe('boolean')
    expect(f.boolean_encoding).toBe(encoding)
  })

  it('ignores case, as is_Conversation_hindi does in production', () => {
    const f = inferField(stats({ sample_values: ['yes', 'no', 'Yes', 'No'], distinct_values: 4 }))
    expect(f.boolean_encoding).toBe('yes_no')
  })

  it('ignores N/A and Unknown-style gaps while deciding', () => {
    const f = inferField(stats({ sample_values: ['true', 'false', 'N/A', '-', ''], distinct_values: 5 }))
    expect(f.value_type).toBe('boolean')
    expect(f.boolean_encoding).toBe('true_false')
  })

  it('does not call a two-value category true/false', () => {
    const f = inferField(stats({ sample_values: ['confirmed', 'cancelled'], distinct_values: 2 }))
    expect(f.value_type).toBe('enum')
  })
})

describe('the other shapes', () => {
  it('reads a real JSON object rather than guessing from its text', () => {
    const f = inferField(stats({ n_object: 100, n_string: 0 }))
    expect(f).toMatchObject({ value_type: 'json', encoding: 'native', json_shape: 'object', is_dimension: false })
  })

  it('spots JSON stored as text, which has to be parsed before expanding', () => {
    const f = inferField(stats({ sample_values: ['[{"a":1}]', '[]'], distinct_values: 2 }))
    expect(f).toMatchObject({ value_type: 'json', encoding: 'json_string', json_shape: 'array' })
  })

  it('does not mistake ordinary text starting with a bracket for JSON', () => {
    const f = inferField(stats({ sample_values: ['[object Object]'], distinct_values: 1 }))
    expect(f.value_type).not.toBe('json')
  })

  it('calls a numeric field a number and keeps it out of the group-by list', () => {
    const f = inferField(stats({ sample_values: ['1', '2.5', '-3', '1e5'], distinct_values: 4 }))
    expect(f.value_type).toBe('number')
    expect(f.is_dimension).toBe(false)
  })

  it('calls a short value list a category, with its values', () => {
    const f = inferField(stats({ sample_values: ['confirmed', 'cancelled', 'rescheduled'], distinct_values: 3 }))
    expect(f.value_type).toBe('enum')
    expect(f.enum_values).toEqual(['cancelled', 'confirmed', 'rescheduled'])
  })

  it('calls a long value list text, not a category with 900 entries', () => {
    const f = inferField(stats({ sample_values: ['a free text summary'], distinct_values: 900 }))
    expect(f.value_type).toBe('text')
  })
})

describe('coverage and identity', () => {
  it('reports how often the field is actually filled in', () => {
    const f = inferField(stats({ rows_with_key: 100, rows_sampled: 1000, n_sentinel: 10 }))
    expect(f.coverage_pct).toBe(9)
  })

  it('counts an absent key as not filled in, not as zero rows', () => {
    const f = inferField(stats({ rows_with_key: 0, rows_sampled: 500, n_string: 0, distinct_values: 0 }))
    expect(f.coverage_pct).toBe(0)
  })

  it('offers a high-cardinality id column as a way to group repeat calls', () => {
    const f = inferField(stats({ path: ['appointment_id'], distinct_values: 95, sample_values: ['a', 'b'] }))
    expect(f.is_identity_candidate).toBe(true)
  })

  it('does not offer a disposition as one', () => {
    const f = inferField(stats({ path: ['final_disposition'], distinct_values: 5, sample_values: ['x', 'y'] }))
    expect(f.is_identity_candidate).toBe(false)
  })
})

/**
 * Both of these were live: the "Split by" list offered `call_id` (one bar per
 * call) and `metrics.is_task_complete.reason`, whose eight "categories" are
 * each a 300-character paragraph of the model's reasoning.
 */
describe('what can actually be an axis', () => {
  const paragraph = (n: number) =>
    `Step ${n}: The agent correctly identified the caller's intent as confirming the appointment attendance and then proceeded appropriately.`

  it('refuses a short list of long values', () => {
    const f = inferField(stats({
      path: ['reason'], rows_with_key: 100, rows_sampled: 100, n_string: 100,
      distinct_values: 8, sample_values: [1, 2, 3, 4, 5, 6, 7, 8].map(paragraph),
    }))
    expect(f.value_type).toBe('text')
    expect(f.is_dimension).toBe(false)
  })

  it('refuses a long list of short values', () => {
    const f = inferField(stats({
      path: ['duration_formatted'], rows_with_key: 100, rows_sampled: 100, n_string: 100,
      distinct_values: 95, sample_values: ['1:20', '2:31', '0:44'],
    }))
    expect(f.is_dimension).toBe(false)
  })

  it('keeps a short list of short values', () => {
    const f = inferField(stats({
      path: ['final_disposition'], rows_with_key: 100, rows_sampled: 100, n_string: 100,
      distinct_values: 4, sample_values: ['confirmed', 'cancelled', 'unassured', 'unconfirmed'],
    }))
    expect(f.value_type).toBe('enum')
    expect(f.is_dimension).toBe(true)
  })

  it('keeps a campaign list, which is long but genuinely categorical', () => {
    const f = inferField(stats({
      path: ['campaignId'], rows_with_key: 100, rows_sampled: 100, n_string: 100,
      distinct_values: 40, sample_values: ['andheri-jan', 'andheri-feb'],
    }))
    expect(f.is_dimension).toBe(true)
  })
})
