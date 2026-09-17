/**
 * One result shape, several chart types — Confluence §7.1. If a chart type ever
 * needs its own query, it has failed here first.
 */
import { describe, it, expect } from 'vitest'
import { shape, coverage, displayNumber, formatValue, shortLabel, formatBucket } from '@/components/analytics/chartData'
import type { ResultRow } from '@/types/analytics'
import type { SpecInput } from '@/server/analytics/spec'

const count: SpecInput = { spec_version: 1, agg: { fn: 'count' }, range: { days: 30 } }
const rate: SpecInput = {
  spec_version: 1,
  agg: { fn: 'rate', field: { col: 'transcription_metrics', path: ['ok'], boolean_encoding: 'yes_no' } },
  range: { days: 30 },
}
const minutes: SpecInput = {
  spec_version: 1,
  agg: { fn: 'sum', field: { col: 'duration_seconds' } },
  range: { days: 30 },
  display: { round: 0, unit: 'm', scale: 1 / 60 },
}

const row = (over: Partial<ResultRow>): ResultRow => ({ value: '1', n_rows: '1', n_nonnull: '1', ...over })

describe('one shape feeds every chart type', () => {
  it('reads a plain total as a single number', () => {
    expect(shape([row({ value: '42' })], count).axis).toBe('none')
  })

  it('reads a time bucket as a series over time', () => {
    const s = shape([row({ bucket: '2026-09-01T00:00:00Z', value: '5' })], count)
    expect(s.axis).toBe('time')
    expect(s.seriesKeys).toEqual(['value'])
    expect(s.points[0]).toEqual({ x: '2026-09-01T00:00:00Z', value: 5 })
  })

  it('reads a breakdown as categories', () => {
    const s = shape([row({ series: 'confirmed', value: '76' }), row({ series: 'cancelled', value: '17' })], count)
    expect(s.axis).toBe('category')
    expect(s.points.map((p) => p.x)).toEqual(['confirmed', 'cancelled'])
  })

  it('pivots a breakdown over time into one row per bucket', () => {
    const s = shape(
      [
        row({ bucket: '2026-09-01T00:00:00Z', series: 'confirmed', value: '3' }),
        row({ bucket: '2026-09-01T00:00:00Z', series: 'cancelled', value: '1' }),
        row({ bucket: '2026-09-02T00:00:00Z', series: 'confirmed', value: '4' }),
      ],
      count
    )
    expect(s.points).toHaveLength(2)
    expect(s.seriesKeys.sort()).toEqual(['cancelled', 'confirmed'])
    expect(s.points[0]).toMatchObject({ x: '2026-09-01T00:00:00Z', confirmed: 3, cancelled: 1 })
  })

  it('names the empty bucket rather than leaving a blank axis label', () => {
    expect(shape([row({ series: null, value: '9' })], count).points[0].x).toBe('(empty)')
  })
})

describe('the number on screen', () => {
  it('reads a rate as a percentage, because that is what people call it', () => {
    expect(displayNumber(row({ value: '0.131' }), rate)).toBeCloseTo(13.1)
  })

  it('draws seconds as minutes without changing what was queried', () => {
    expect(displayNumber(row({ value: '3600' }), minutes)).toBe(60)
  })

  it('shows a dash for no answer, never a zero', () => {
    expect(displayNumber(row({ value: null }), count)).toBeNull()
    expect(formatValue(null, count)).toBe('—')
  })

  it('puts the rupee sign in front and everything else behind', () => {
    expect(formatValue(12.5, { ...count, display: { round: 2, unit: '₹' } })).toBe('₹12.50')
    expect(formatValue(2.85, { ...count, display: { round: 2, unit: 's' } })).toBe('2.85s')
  })
})

describe('coverage, so an average is never unexplained', () => {
  it('adds up the rows used and the rows looked at', () => {
    const c = coverage([row({ n_rows: '1000', n_nonnull: '400' }), row({ n_rows: '847', n_nonnull: '0' })])
    expect(c).toEqual({ used: 400, total: 1847, pct: 21.7 })
  })

  it('says nothing rather than dividing by zero', () => {
    expect(coverage([])).toBeNull()
    expect(coverage([row({ n_rows: '0', n_nonnull: '0' })])).toBeNull()
  })
})

describe('labels stay readable', () => {
  it('truncates a 200-character value instead of destroying the axis', () => {
    expect(shortLabel('x'.repeat(200))).toHaveLength(24)
  })

  it('leaves a short one alone', () => {
    expect(shortLabel('confirmed')).toBe('confirmed')
  })

  it('shows a day bucket as a date and an hour bucket as a time', () => {
    expect(formatBucket('2026-09-01T00:00:00Z', 'day')).toMatch(/\d/)
    expect(formatBucket('not a date', 'day')).toBe('not a date')
  })
})
