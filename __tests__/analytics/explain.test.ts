/**
 * "Completed calls · 110" is not a number anyone can check. These assert the
 * card can say what it counted, in words, with no database in them.
 */
import { describe, it, expect } from 'vitest'
import { CALCULATIONS, explainFormula, explainSpec, fieldName, describeCondition } from '@/components/analytics/explain'
import type { CatalogField } from '@/types/analytics'
import type { SpecInput } from '@/server/analytics/spec'

const field = (over: Partial<CatalogField>): CatalogField => ({
  id: 'x', col: 'transcription_metrics', path: ['f'], label: 'Field', value_type: 'enum',
  boolean_encoding: null, encoding: 'native', json_shape: null, enum_values: null,
  coverage_pct: 90, cardinality_est: 2, is_identity_candidate: false, is_dimension: true,
  type_confirmed: false, ...over,
})

const fields = [
  field({ col: 'call_ended_reason', path: [], label: 'Why the call ended' }),
  field({ path: ['final_disposition'], label: 'Final disposition' }),
  field({ path: ['is_confirmation'], label: 'Is confirmation', value_type: 'boolean', boolean_encoding: 'one_zero' }),
  field({ col: 'avg_latency', path: [], label: 'Response time', value_type: 'number' }),
  field({ col: 'billing_duration_seconds', path: [], label: 'Billed length (seconds)', value_type: 'number' }),
]

describe('a card says what it counted', () => {
  it('explains the completed-calls tile, which was just a number before', () => {
    const spec: SpecInput = {
      spec_version: 1,
      agg: { fn: 'count' },
      having: [{ field: { col: 'call_ended_reason' }, op: 'eq', value: 'completed' }],
      range: { days: 30 },
    }
    expect(explainSpec(spec, fields)).toBe('Count of calls · only where why the call ended is completed')
  })

  it('explains the incomplete one, where the operator is a negation', () => {
    const spec: SpecInput = {
      spec_version: 1,
      agg: { fn: 'count' },
      having: [{ field: { col: 'call_ended_reason' }, op: 'not_in', value: ['completed'] }],
      range: { days: 30 },
    }
    expect(explainSpec(spec, fields)).toContain('why the call ended is not completed')
  })

  it('reads a rate as a percentage of something, not as a fraction', () => {
    const spec: SpecInput = {
      spec_version: 1,
      agg: { fn: 'rate', field: { col: 'transcription_metrics', path: ['is_confirmation'], boolean_encoding: 'one_zero' } },
      range: { days: 30 },
    }
    expect(explainSpec(spec, fields)).toBe('Percentage where confirmation is yes')
  })

  it('names the split', () => {
    const spec: SpecInput = {
      spec_version: 1,
      agg: { fn: 'count' },
      dimension: { field: { col: 'transcription_metrics', path: ['final_disposition'] } },
      range: { days: 30 },
    }
    expect(explainSpec(spec, fields)).toBe('Count of calls · split by final disposition')
  })

  it('mentions the hours when the chart is limited to them', () => {
    const spec: SpecInput = {
      spec_version: 1,
      agg: { fn: 'avg', field: { col: 'avg_latency' } },
      time_of_day: { from: '22:00', to: '02:00' },
      range: { days: 30 },
    }
    expect(explainSpec(spec, fields)).toBe('Average of response time · between 22:00 and 02:00')
  })

  it('joins an and/or group so a nested filter is still readable', () => {
    const spec: SpecInput = {
      spec_version: 1,
      agg: { fn: 'count' },
      having: [
        {
          op: 'or',
          children: [
            { field: { col: 'call_ended_reason' }, op: 'eq', value: 'completed' },
            { field: { col: 'call_ended_reason' }, op: 'eq', value: 'transferred' },
          ],
        },
      ],
      range: { days: 30 },
    }
    expect(explainSpec(spec, fields)).toContain('(why the call ended is completed or why the call ended is transferred)')
  })
})

describe('no database words get through', () => {
  it('uses the catalog label, never the path', () => {
    expect(fieldName({ col: 'transcription_metrics', path: ['final_disposition'] }, fields)).toBe('final disposition')
  })

  it('still reads tolerably for a field the catalog has not seen yet', () => {
    expect(fieldName({ col: 'metadata', path: ['appointment_id'] }, fields)).toBe('appointment id')
    expect(fieldName({ col: 'metadata', path: ['appointment_id'] }, fields)).not.toContain('metadata')
  })

  it('writes the value-less operators without a dangling value', () => {
    const c = { field: { col: 'call_ended_reason' }, op: 'is_not_empty' as const }
    expect(describeCondition(c, fields)).toBe('why the call ended has any value')
  })
})

describe('fields already named as questions', () => {
  const hindi = [field({ path: ['is_Conversation_hindi'], label: 'Is conversation hindi', value_type: 'boolean', boolean_encoding: 'yes_no' })]

  it('does not write "is conversation hindi is yes"', () => {
    expect(describeCondition({ field: { col: 'transcription_metrics', path: ['is_Conversation_hindi'] }, op: 'is_true' }, hindi))
      .toBe('is conversation hindi: yes')
  })

  it('reads the negative the same way', () => {
    expect(describeCondition({ field: { col: 'transcription_metrics', path: ['is_Conversation_hindi'] }, op: 'is_false' }, hindi))
      .toBe('is conversation hindi: no')
  })
})

/**
 * The panel said "Average of" while the card said "Average", and "Slowest 5%"
 * was only true when the field happened to be a latency. Both now read one
 * table; this is the test that keeps them there.
 */
describe('the calculation vocabulary', () => {
  it('gives every calculation a name, a phrase and an explanation', () => {
    for (const c of CALCULATIONS) {
      expect(c.label.length, c.fn).toBeGreaterThan(0)
      expect(c.phrase.length, c.fn).toBeGreaterThan(0)
      expect(c.help.endsWith('.'), c.fn).toBe(true)
    }
  })

  it('never calls a calculation slow — a total cost is not slow', () => {
    for (const c of CALCULATIONS) {
      expect(`${c.label} ${c.phrase}`.toLowerCase()).not.toContain('slow')
    }
  })

  it('shows the dropdown and the card the same words', () => {
    for (const c of CALCULATIONS) {
      if (c.fn === 'rate') continue // the card writes a whole sentence for a rate
      expect(c.label, c.fn).toBe(c.phrase)
    }
  })

  it('uses the same words on the card as in the panel', () => {
    const fields: CatalogField[] = []
    for (const c of CALCULATIONS) {
      if (c.needs !== 'number') continue
      const spec = { spec_version: 1 as const, agg: { fn: c.fn, field: { col: 'avg_latency' } }, range: { days: 30 } }
      expect(explainSpec(spec as never, fields)).toBe(`${c.phrase} avg latency`)
    }
  })
})

describe('a percentage card says what it divided', () => {
  it('names both sides, so 78.1% is a number someone can check', () => {
    expect(
      explainFormula(
        {
          a: { spec_version: 1, agg: { fn: 'count' }, having: [{ field: { col: 'call_ended_reason' }, op: 'eq', value: 'completed' }], range: { days: 30 } },
          b: { spec_version: 1, agg: { fn: 'count' }, range: { days: 30 } },
          op: 'percent',
        },
        fields
      )
    ).toBe('Count of calls · only where why the call ended is completed \u00f7 Count of calls')
  })
})

describe('a card\'s definition matches what the number is actually shown in', () => {
  it('says minutes when the Seconds/Minutes toggle is set to minutes', () => {
    const spec: SpecInput = {
      spec_version: 1,
      agg: { fn: 'sum', field: { col: 'billing_duration_seconds' } },
      range: { days: 30 },
      display: { unit: 'm', round: 2, scale: 1 / 60 },
    }
    expect(explainSpec(spec, fields)).toBe('Sum of billed length (minutes)')
  })

  it('leaves it as seconds when no minutes override is set', () => {
    const spec: SpecInput = {
      spec_version: 1,
      agg: { fn: 'sum', field: { col: 'billing_duration_seconds' } },
      range: { days: 30 },
    }
    expect(explainSpec(spec, fields)).toBe('Sum of billed length (seconds)')
  })
})
