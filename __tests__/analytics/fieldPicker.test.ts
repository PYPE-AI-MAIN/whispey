/**
 * This agent's catalog contains five fields all labelled "Reason" and five all
 * labelled "Score" — `metrics.hi.reason`, `metrics.is_task_complete.reason` and
 * so on — because the label is built from the last segment of the path alone.
 * Five identical rows in a picker is a picker you cannot use.
 */
import { describe, it, expect } from 'vitest'
import { disambiguate, fieldKey } from '@/components/analytics/FieldPicker'
import type { CatalogField } from '@/types/analytics'

const f = (col: string, path: string[], label: string): CatalogField => ({
  id: path.join('.'), col, path, label, value_type: 'text', boolean_encoding: null,
  encoding: 'native', json_shape: null, enum_values: null, coverage_pct: 50,
  cardinality_est: 2, is_identity_candidate: false, is_dimension: true, type_confirmed: false,
})

describe('telling two fields with the same name apart', () => {
  const fields = [
    f('metrics', ['hi', 'reason'], 'Reason'),
    f('metrics', ['is_task_complete', 'reason'], 'Reason'),
    f('call_ended_reason', [], 'Why the call ended'),
  ]

  it('qualifies a label that appears more than once', () => {
    const names = disambiguate(fields)
    expect(names.get(fieldKey(fields[0]))).toBe('Reason (hi)')
    expect(names.get(fieldKey(fields[1]))).toBe('Reason (is task complete)')
  })

  it('leaves a label that is already unique alone', () => {
    expect(disambiguate(fields).get(fieldKey(fields[2]))).toBe('Why the call ended')
  })

  it('gives every field a name, including one with nothing to qualify it with', () => {
    const shallow = [f('metadata', ['status'], 'Status'), f('metadata', ['x', 'status'], 'Status')]
    const names = disambiguate(shallow)
    expect(names.get(fieldKey(shallow[0]))).toBe('Status')
    expect(names.get(fieldKey(shallow[1]))).toBe('Status (x)')
  })
})
