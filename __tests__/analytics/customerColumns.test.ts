import { describe, it, expect } from 'vitest'
import { FETCHED } from '@/server/analytics/customerQuery'
import { NUMERIC_COLS, TEXT_COLS } from '@/server/analytics/spec'

describe('customer analytics row fetch', () => {
  it('carries every column the spec allows (a missing one silently empties the chart)', () => {
    expect([...TEXT_COLS, ...NUMERIC_COLS].filter((c) => !FETCHED.has(c))).toEqual([])
  })
})
