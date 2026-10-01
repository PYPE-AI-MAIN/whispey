/**
 * qa_config is saved through the normal agent PATCH route, so a bad value here
 * does not error — it quietly changes what the nightly job flags, and shows up
 * as a hundred wrong findings a week later. Hence the bounds.
 */
import { describe, it, expect } from 'vitest'
import { qaConfigError, QA_DEFAULTS } from '@/lib/qaConfigValidation'

describe('qaConfigError', () => {
  it('accepts the defaults we ship', () => {
    expect(qaConfigError(QA_DEFAULTS)).toBeNull()
  })

  it('allows null — that is how QA gets turned off entirely', () => {
    expect(qaConfigError(null)).toBeNull()
  })

  it('requires an explicit enabled flag', () => {
    expect(qaConfigError({})).toMatch(/enabled/)
    expect(qaConfigError({ enabled: 'yes' })).toMatch(/enabled/)
  })

  it('rejects a non-object', () => {
    expect(qaConfigError([])).toMatch(/object/)
    expect(qaConfigError('on')).toMatch(/object/)
  })

  it('bounds the numbers', () => {
    expect(qaConfigError({ enabled: true, sample_size: 0 })).toMatch(/between/)
    expect(qaConfigError({ enabled: true, sample_size: 99999 })).toMatch(/between/)
    expect(qaConfigError({ enabled: true, latency_ms: 10 })).toMatch(/between/)
    expect(qaConfigError({ enabled: true, sample_size: 200 })).toBeNull()
  })

  it('rejects a non-numeric threshold', () => {
    expect(qaConfigError({ enabled: true, silence_ms: 'soon' })).toMatch(/number/)
  })

  it('catches a success disposition that is not in the allowed list', () => {
    // the subtle one: this rule would simply never fire, silently
    const err = qaConfigError({
      enabled: true,
      disposition_values: ['confirmed', 'rnr'],
      success_dispositions: ['booked'],
    })
    expect(err).toMatch(/never match/)
  })

  it('allows it when the value is present, ignoring case', () => {
    expect(qaConfigError({
      enabled: true,
      disposition_values: ['Confirmed', 'rnr'],
      success_dispositions: ['confirmed'],
    })).toBeNull()
  })

  it('skips that check when no allowed list is given', () => {
    expect(qaConfigError({ enabled: true, success_dispositions: ['anything'] })).toBeNull()
  })

  it('bounds list length and value length', () => {
    expect(qaConfigError({ enabled: true, disposition_values: Array(100).fill('x') })).toMatch(/at most/)
    expect(qaConfigError({ enabled: true, disposition_values: ['x'.repeat(200)] })).toMatch(/short text/)
    expect(qaConfigError({ enabled: true, disposition_values: 'confirmed' })).toMatch(/must be a list/)
  })

  it('validates the send window', () => {
    expect(qaConfigError({ enabled: true, send_window: { start: '25:00' } })).toMatch(/10:00/)
    expect(qaConfigError({ enabled: true, send_window: { start: 'morning' } })).toMatch(/10:00/)
    expect(qaConfigError({ enabled: true, send_window: { start: '10:00', end: '19:00' } })).toBeNull()
  })

  it('rejects a timezone nothing can resolve', () => {
    // an unknown zone makes the delivery window never open, so mail would just
    // silently stop — better to refuse it at save time
    expect(qaConfigError({ enabled: true, send_window: { timezone: 'Mars/Olympus' } })).toMatch(/timezone/)
    expect(qaConfigError({ enabled: true, send_window: { timezone: 'Asia/Kolkata' } })).toBeNull()
  })

  it('bounds the flagged share to a fraction', () => {
    expect(qaConfigError({ enabled: true, flagged_share: 50 })).toMatch(/between 0 and 1/)
    expect(qaConfigError({ enabled: true, flagged_share: 0.5 })).toBeNull()
  })

  it('bounds the flow document', () => {
    expect(qaConfigError({ enabled: true, flow_doc: 'x'.repeat(70_000) })).toMatch(/too long/)
    expect(qaConfigError({ enabled: true, flow_doc: 'Step 1: greet' })).toBeNull()
  })
})
