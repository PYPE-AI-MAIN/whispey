import { describe, expect, it } from 'vitest'
import { formatIstTimestamp } from '@/lib/istTime'

describe('formatIstTimestamp', () => {
  const now = new Date('2026-10-22T06:00:00Z')
  it('shows the time in IST, without the year when it is this year', () => {
    expect(formatIstTimestamp('2026-10-13T05:02:00Z', now)).toBe('13 Oct, 10:32 am IST')
  })
  it('adds the year for another year', () => {
    expect(formatIstTimestamp('2025-06-01T05:00:00Z', now)).toBe('1 Jun 2025, 10:30 am IST')
  })
  it('is empty for a bad date', () => {
    expect(formatIstTimestamp('nope', now)).toBe('')
  })
})
