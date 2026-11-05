import { describe, it, expect } from 'vitest'
import { textRows } from '@/components/analytics/gridLayout'

describe('textRows', () => {
  it('gives a heading, a description and two short lines three rows, not a tall empty box', () => {
    const text = '# Triage: volume & reach\nHow many patients we reached.\n\nfirst line\nsecond line'
    expect(textRows(text, 12)).toBe(3)
  })

  it('never goes below one row, even when empty', () => {
    expect(textRows('', 12)).toBeGreaterThanOrEqual(1)
  })

  it('needs more rows when the card is narrow and a long line wraps', () => {
    const long = 'word '.repeat(60)
    expect(textRows(long, 3)).toBeGreaterThan(textRows(long, 12))
  })
})
