import { describe, it, expect } from 'vitest'
import { adaptSpecToKind, suggestSpec, suggestTitle, suggestions } from '@/components/analytics/suggest'
import type { CatalogField } from '@/types/analytics'
import type { SpecInput } from '@/server/analytics/spec'

const field = (over: Partial<CatalogField>): CatalogField => ({
  id: 'x', col: 'transcription_metrics', path: ['f'], label: 'Field',
  value_type: 'enum', boolean_encoding: null, encoding: 'native', json_shape: null,
  enum_values: ['a', 'b'], coverage_pct: 90, cardinality_est: 2,
  is_identity_candidate: false, is_dimension: true, type_confirmed: false,
  ...over,
})

const disposition = field({ path: ['final_disposition'], label: 'Final disposition', coverage_pct: 99.7, cardinality_est: 4 })
const confirmed = field({ path: ['is_confirmation'], label: 'Is confirmation', value_type: 'boolean', boolean_encoding: 'one_zero', coverage_pct: 99.7 })
const latency = field({ col: 'avg_latency', path: [], label: 'Response time', value_type: 'number', coverage_pct: 70, is_dimension: false })
const rare = field({ path: ['tag_comments'], label: 'Tag comments', coverage_pct: 0.7 })

describe('a dropped chart arrives already filled in', () => {
  it('gives a bar the best-covered category it can find', () => {
    const spec = suggestSpec('bar', [rare, disposition])
    expect(spec.dimension?.field).toMatchObject({ col: 'transcription_metrics', path: ['final_disposition'] })
    expect(suggestTitle('bar', [disposition])).toBe('Calls by final disposition')
  })

  it('will not suggest a field almost nobody fills in', () => {
    expect(suggestSpec('bar', [rare]).dimension).toBeUndefined()
  })

  it('makes a number out of a yes/no field, carrying its encoding', () => {
    const spec = suggestSpec('kpi', [confirmed])
    expect(spec.agg).toMatchObject({ fn: 'rate', denominator: 'field_present' })
    expect(spec.agg?.field?.boolean_encoding).toBe('one_zero')
  })

  it('falls back to counting calls when there is nothing better', () => {
    expect(suggestSpec('kpi', []).agg).toEqual({ fn: 'count' })
    expect(suggestTitle('kpi', [])).toBe('Total calls')
  })

  it('makes a line a count over days', () => {
    expect(suggestSpec('line', [disposition])).toMatchObject({ bucket: 'day', agg: { fn: 'count' } })
  })

  it('keeps a pie down to a number of slices a pie can carry', () => {
    expect(suggestSpec('pie', [disposition]).dimension?.limit).toBe(8)
  })
})

describe('suggestions say why, or they are noise', () => {
  it('offers the fields this agent actually produces, best covered first', () => {
    const list = suggestions([rare, latency, disposition, confirmed])
    expect(list.length).toBeGreaterThan(0)
    expect(list.every((s) => s.why.length > 0)).toBe(true)
    expect(list[0].why).toContain('99.7%')
  })

  it('leaves out the field on 0.7% of calls', () => {
    expect(suggestions([rare])).toHaveLength(0)
  })

  it('never suggests a chart the query builder would refuse', () => {
    for (const s of suggestions([disposition, confirmed, latency])) {
      if (s.spec.agg?.fn === 'rate') expect(s.spec.agg.field?.boolean_encoding).toBeTruthy()
    }
  })
})

describe('switching chart type gives you a chart, not a puzzle', () => {
  const bar: SpecInput = {
    spec_version: 1,
    agg: { fn: 'count' },
    dimension: { field: { col: 'transcription_metrics', path: ['final_disposition'] }, limit: 12 },
    range: { days: 30 },
  }

  it('gives a line something to run along', () => {
    expect(adaptSpecToKind({ ...bar, bucket: 'none' }, 'line', [disposition]).bucket).toBe('day')
  })

  it('keeps a bucket that is already set', () => {
    expect(adaptSpecToKind({ ...bar, bucket: 'week' }, 'line', [disposition]).bucket).toBe('week')
  })

  it('strips both axes off a single number', () => {
    const spec = adaptSpecToKind({ ...bar, bucket: 'day' }, 'kpi', [disposition])
    expect(spec.dimension).toBeUndefined()
    expect(spec.bucket).toBe('none')
  })

  it('gives a bar something to split by when it has nothing', () => {
    const spec = adaptSpecToKind({ spec_version: 1, agg: { fn: 'count' }, range: { days: 30 } }, 'bar', [disposition])
    expect(spec.dimension?.field).toMatchObject({ path: ['final_disposition'] })
  })

  it('will not let a pie try to be a time series', () => {
    const spec = adaptSpecToKind({ ...bar, bucket: 'day' }, 'pie', [disposition])
    expect(spec.bucket).toBe('none')
    expect(spec.dimension?.limit).toBeLessThanOrEqual(8)
  })
})
