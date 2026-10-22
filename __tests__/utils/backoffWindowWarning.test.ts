import { describe, it, expect } from 'vitest'
import { backoffWindowWarning } from '@/components/campaigns/RetryConfiguration'
import { VALID_SIP_ERROR_CODE_VALUES } from '@/utils/campaigns/constants'

// The scheduler only dials inside [startTime, endTime], so a retry due after
// endTime waits for tomorrow. A leg being shorter than the window is NOT
// enough: a leg of L minutes only lands the same day if the call happened
// before endTime - L. Two live campaigns had a 480m leg in a 10:00-18:30
// window (480 < 510, so a naive length check passes) and looked stuck.
describe('backoffWindowWarning', () => {
  it('catches the real case a naive leg-vs-window check misses', () => {
    const w = backoffWindowWarning([15, 480, 300], '10:00', '18:30')
    expect(w).toContain('8h')
    expect(w).toContain('10:30')   // endTime 18:30 minus 8h
    expect(w).toContain('slip to the next day')
  })

  it('reports the cutoff for a wider window too', () => {
    // 09:00-21:00: an 8h leg still works, but only for calls before 13:00
    expect(backoffWindowWarning([15, 480, 300], '09:00', '21:00')).toContain('13:00')
  })

  it('says "always slip" when a leg is at least the whole window', () => {
    const w = backoffWindowWarning([600], '09:00', '18:00') // 600m leg, 9h window
    expect(w).toContain('always slip to the next day')
    expect(w).toContain('9h')
  })

  it('stays silent for short legs that comfortably fit', () => {
    expect(backoffWindowWarning([15, 60, 240], '09:00', '21:00')).toBeNull()
    expect(backoffWindowWarning([15, 15, 15], '10:00', '18:30')).toBeNull()
  })

  it('counts every offending leg and reports the worst', () => {
    const w = backoffWindowWarning([15, 600, 700], '09:00', '18:00')
    expect(w).toContain('2')
    expect(w).toContain('700m')  // worst, and not a round hour
    expect(w).toContain('delays')
  })

  it('uses singular wording for a single offending leg', () => {
    expect(backoffWindowWarning([15, 600], '09:00', '18:00')).toContain('delay')
  })

  it('is silent for fixed-delay rules (no backoff schedule)', () => {
    expect(backoffWindowWarning(undefined, '10:00', '18:30')).toBeNull()
    expect(backoffWindowWarning([], '10:00', '18:30')).toBeNull()
  })

  it('is silent rather than wrong when the window is unusable', () => {
    expect(backoffWindowWarning([480], undefined, '18:30')).toBeNull()
    expect(backoffWindowWarning([480], 'garbage', '18:30')).toBeNull()
    expect(backoffWindowWarning([480], '25:00', '18:30')).toBeNull()
    expect(backoffWindowWarning([480], '10:00', '09:00')).toBeNull() // end before start
  })

  it('does not warn for the default all-day window', () => {
    expect(backoffWindowWarning([15, 480, 300], '00:00', '23:59')).toBeNull()
  })
})

// 408 was gated in the picker pending an RCA that has since completed. Gating
// it was what guaranteed every campaign omitted 408 and silently inherited the
// backend's injected default instead of the user's own rule.
describe('SIP code allow-list', () => {
  it('accepts 408, so a campaign can cover it explicitly', () => {
    expect(VALID_SIP_ERROR_CODE_VALUES).toContain('408')
  })

  it('still accepts the other transient codes', () => {
    for (const code of ['480', '486', '487', '500', '503', '504', '600', '603']) {
      expect(VALID_SIP_ERROR_CODE_VALUES).toContain(code)
    }
  })

  it('does not accept permanent-failure codes', () => {
    for (const code of ['401', '403', '404']) {
      expect(VALID_SIP_ERROR_CODE_VALUES).not.toContain(code)
    }
  })
})
