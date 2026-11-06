import { describe, it, expect } from 'vitest'
import { FETCHED, columnsFor } from '@/server/analytics/customerQuery'
import { Spec, NUMERIC_COLS, TEXT_COLS } from '@/server/analytics/spec'

describe('customer analytics row fetch', () => {
  it('carries every column the spec allows (a missing one silently empties the chart)', () => {
    expect([...TEXT_COLS, ...NUMERIC_COLS].filter((c) => !FETCHED.has(c))).toEqual([])
  })
  it('adds the JSON documents a spec opens, and created_at for dedupe', () => {
    const spec = Spec.parse({
      spec_version: 1, range: { days: 7 }, grain: 'entity', agg: { fn: 'count' },
      dedupe: { key: { field: { col: 'metadata', path: ['id'] } }, winner: 'most_recent' },
      dimension: { field: { col: 'transcription_metrics', path: ['d'] } },
    })
    const cols = columnsFor([spec]).split(',')
    expect(cols).toEqual(expect.arrayContaining(['metadata', 'transcription_metrics', 'created_at']))
    expect(cols).not.toContain('metrics')
  })
})
