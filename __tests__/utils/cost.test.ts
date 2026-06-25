import { describe, it, expect } from 'vitest'
import { telecomCost } from '@/utils/cost'

describe('telecomCost', () => {
  const DEFAULT_RATE = 0.7 * 100 // 70 paise per minute (default)

  it('charges for exactly 1 minute when duration < 60s', () => {
    // 30s rounds up to 1 min
    expect(telecomCost(30, DEFAULT_RATE)).toBeCloseTo((DEFAULT_RATE / 100) * 1)
  })

  it('charges for 1 minute when duration is exactly 60s', () => {
    expect(telecomCost(60, DEFAULT_RATE)).toBeCloseTo((DEFAULT_RATE / 100) * 1)
  })

  it('charges for 2 minutes when duration is 61s', () => {
    expect(telecomCost(61, DEFAULT_RATE)).toBeCloseTo((DEFAULT_RATE / 100) * 2)
  })

  it('charges for 1 minute when duration is 0 (minimum 1 min billing)', () => {
    expect(telecomCost(0, DEFAULT_RATE)).toBeCloseTo((DEFAULT_RATE / 100) * 1)
  })

  it('applies custom rate correctly', () => {
    const rate = 150 // 150 paise = ₹1.50/min
    expect(telecomCost(120, rate)).toBeCloseTo((rate / 100) * 2)
  })

  it('uses default rate when rate is not provided', () => {
    const expected = (DEFAULT_RATE / 100) * 2
    expect(telecomCost(90)).toBeCloseTo(expected)
  })

  it('rounds fractional seconds up to next minute', () => {
    // 121s = ceil(121/60) = 3 minutes
    expect(telecomCost(121, DEFAULT_RATE)).toBeCloseTo((DEFAULT_RATE / 100) * 3)
  })
})
