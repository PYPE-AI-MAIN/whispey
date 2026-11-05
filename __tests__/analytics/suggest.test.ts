import { describe, it, expect } from 'vitest'
import { chartSubject, adaptSpecToKind, identityFields, outcomeField, suggestSpec, suggestTitle, suggestions } from '@/components/analytics/suggest'
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

describe('which field identifies the same patient across calls', () => {
  const column = field({ col: 'customer_number', path: [], label: 'Phone number', value_type: 'text', is_identity_candidate: true, coverage_pct: 100 })
  const jsonCopy = field({ col: 'metadata', path: ['wcalling_number'], label: 'Wcalling number', value_type: 'text', is_identity_candidate: true, coverage_pct: 100 })

  it('prefers the real column over a copy of it inside metadata', () => {
    // this agent writes the caller's number into both, and the JSON copy was
    // winning purely by sorting first
    expect(identityFields([jsonCopy, column])[0].col).toBe('customer_number')
  })

  it('leaves out anything that cannot identify anybody', () => {
    expect(identityFields([disposition])).toHaveLength(0)
  })
})

describe('which field carries the outcome', () => {
  it('uses the one the agent’s saved order names', () => {
    const other = field({ path: ['status'], label: 'Status', value_type: 'enum' })
    const chosen = outcomeField([other, disposition], { col: 'transcription_metrics', path: ['final_disposition'] })
    expect(chosen?.path).toEqual(['final_disposition'])
  })

  it('falls back to a short list of named results', () => {
    expect(outcomeField([latency, disposition])?.path).toEqual(['final_disposition'])
  })

  it('says so rather than guessing when there is nothing to rank', () => {
    expect(outcomeField([latency])).toBeUndefined()
  })
})

/**
 * The strip has to know what the canvas already shows, or it offers a chart
 * somebody is looking at — which §11.3 calls noise, and noise is what stops
 * people reading suggestions at all.
 */
describe('chartSubject', () => {
  const ended = { col: 'call_ended_reason' }

  it('matches a suggestion to the chart already on the canvas', () => {
    expect(chartSubject({ spec_version: 1, agg: { fn: 'count' }, dimension: { field: ended }, range: { days: 30 } } as never))
      .toBe(chartSubject({ spec_version: 1, agg: { fn: 'count' }, dimension: { field: ended }, range: { days: 7 } } as never))
  })

  it('keeps the same field apart when it is counted differently', () => {
    const a = chartSubject({ spec_version: 1, agg: { fn: 'avg', field: { col: 'avg_latency' } }, range: { days: 30 } } as never)
    const b = chartSubject({ spec_version: 1, agg: { fn: 'p95', field: { col: 'avg_latency' } }, range: { days: 30 } } as never)
    expect(a).not.toBe(b)
  })

  it('keeps two JSON fields apart when only their path differs', () => {
    const a = chartSubject({ spec_version: 1, agg: { fn: 'count' }, dimension: { field: { col: 'metadata', path: ['a'] } }, range: { days: 30 } } as never)
    const b = chartSubject({ spec_version: 1, agg: { fn: 'count' }, dimension: { field: { col: 'metadata', path: ['b'] } }, range: { days: 30 } } as never)
    expect(a).not.toBe(b)
  })

  it('never offers a second plain call count', () => {
    expect(chartSubject({ spec_version: 1, agg: { fn: 'count' }, range: { days: 30 } } as never)).toBe('count::count')
  })
})

/**
 * Everything here was visible in one screenshot of the SUGGESTED strip: four
 * cards, all of them boolean KPIs, all carrying the identical sentence "yes or
 * no, filled in on 100% of calls", and none of them the one field anybody would
 * actually want.
 */
describe('a suggestion strip that is not four of the same thing', () => {
  const bool = (path: string, label: string, over: Partial<CatalogField> = {}) =>
    field({ path: [path], label, value_type: 'boolean', boolean_encoding: 'one_zero',
      enum_values: null, coverage_pct: 100, cardinality_est: 2, ...over })

  it('never offers a field that only ever holds one value', () => {
    // is_reschedule_transfer: on 100% of calls, and 0 on every one of them
    const list = suggestions([bool('is_reschedule_transfer', 'Is reschedule transfer', { cardinality_est: 1 })])
    expect(list).toEqual([])
  })

  it('puts a field the extractor declared ahead of one it did not', () => {
    const list = suggestions([
      bool('guessed', 'Guessed'),
      bool('declared', 'Declared', { declared: true, description: 'Determine if the patient CONFIRMED.' }),
    ])
    expect(list[0].title).toBe('Declared rate')
  })

  it('quotes the extractor instead of repeating the same sentence', () => {
    const [s] = suggestions([bool('is_confirmation', 'Is confirmation',
      { declared: true, description: 'Determine if the patient CONFIRMED they will attend.' })])
    expect(s.why).toBe('Determine if the patient CONFIRMED they will attend.')
  })

  it('still says something useful when there is no definition to quote', () => {
    const [s] = suggestions([bool('x', 'X', { coverage_pct: 99.7 })])
    expect(s.why).toBe('yes or no, on 99.7% of calls')
  })

  it('offers a rate, a breakdown and a trend before offering a second rate', () => {
    const list = suggestions([
      bool('a', 'A'), bool('b', 'B'),
      field({ path: ['disposition'], label: 'Disposition', value_type: 'enum', enum_values: ['x', 'y'], cardinality_est: 2 }),
      field({ path: ['latency'], label: 'Latency', value_type: 'number', enum_values: null, cardinality_est: 40, is_dimension: false }),
    ])
    expect(list.slice(0, 3).map((s) => s.kind)).toEqual(['kpi', 'bar', 'line'])
  })

  it('names the chart, not the column', () => {
    expect(suggestions([bool('is_wrong_number', 'Is wrong number')])[0].title).toBe('Wrong number rate')
  })
})
