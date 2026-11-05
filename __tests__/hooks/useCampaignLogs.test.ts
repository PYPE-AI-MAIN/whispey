import { describe, it, expect } from 'vitest'
import { logMatches } from '@/hooks/useCampaignLogs'

const log = {
  name: 'Swapna Gupta',
  phoneNumber: '+919831881404',
  status: 'pending',
  callResult: 'timeout',
  additionalData: JSON.stringify({ Doctor: 'Srikanth V', Date: '18th March', retries: 2 }),
}

describe('logMatches', () => {
  it('empty query matches everything', () => {
    expect(logMatches(log, '   ')).toBe(true)
  })

  it.each([
    ['swapna', 'name, any case'],
    ['9831881', 'part of the phone'],
    ['PENDING', 'status'],
    ['timeout', 'call result'],
    ['srikanth', 'CSV column'],
    ['18th', 'another CSV column'],
    ['2', 'numeric CSV value'],
  ])('finds "%s" (%s)', (q) => {
    expect(logMatches(log, q)).toBe(true)
  })

  it.each([
    ['98318 81404', 'spaces'],
    ['98318-81404', 'dashes'],
    ['+91 98318 81404', 'country code with spaces'],
    ['(983) 188-1404', 'brackets'],
    ['91.9831.881404', 'dots'],
  ])('phone typed as "%s" (%s) still matches', (q) => {
    expect(logMatches(log, q)).toBe(true)
  })

  it('a lead ID in a CSV column matches, also by its digits', () => {
    const lead = { ...log, additionalData: { lead_id: 'LD-10452' } }
    expect(logMatches(lead, 'LD-10452')).toBe(true)
    expect(logMatches(lead, 'ld-104')).toBe(true)
    expect(logMatches(lead, 'LD-99999')).toBe(false)
  })

  it('short or non-phone queries do not use digit matching', () => {
    // "1-2" is phone-like but has only 2 digits: plain text match only.
    expect(logMatches({ ...log, additionalData: {} , callResult: 'x12y' }, '1-2')).toBe(false)
    // Words with digits are matched as text, not digits ("dr 98" ≠ phone).
    expect(logMatches(log, 'dr 98')).toBe(false)
  })

  it('no match', () => {
    expect(logMatches(log, 'cardiology')).toBe(false)
  })

  it('additionalData as an object, or broken JSON, does not throw', () => {
    expect(logMatches({ ...log, additionalData: { Doctor: 'Yashoda Ravi' } }, 'yashoda')).toBe(true)
    expect(logMatches({ ...log, additionalData: '{broken' }, 'swapna')).toBe(true)
    expect(logMatches({ ...log, additionalData: '{broken' }, 'broken')).toBe(false)
  })
})
