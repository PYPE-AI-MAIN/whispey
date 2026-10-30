import { describe, expect, it } from 'vitest'
import { askedNotToCall, checkResult, finalDisposition, splitTranscriptionMetrics } from '@/components/calls/v2/split/callData'
import type { CallLog } from '@/types/logs'

const call = (tm: Record<string, unknown>) => ({ transcription_metrics: tm }) as unknown as CallLog

describe('checkResult', () => {
  it.each([
    [true, true], [false, false], ['1', true], ['0', false], ['yes', true], ['No', false], ['TRUE', true], [1, true], [0, false],
  ])('%p → %p', (value, expected) => {
    expect(checkResult(value)).toBe(expected)
  })
  it.each([null, undefined, '-', 'n/a', ''])('%p did not apply', (value) => {
    expect(checkResult(value)).toBeNull()
  })
  it.each(['maybe', 'Mumbai', 5, { a: 1 }])('%p is not a yes/no', (value) => {
    expect(checkResult(value)).toBeUndefined()
  })
})

describe('splitTranscriptionMetrics', () => {
  const { outcome, dispositions, checks } = splitTranscriptionMetrics(call({
    dnc_requested: 'yes',
    final_disposition: 'not_interested',
    is_user_in_call: '1',
    is_task_complete: '0',
    is_guardrail_respected: '-',
    is_language: 'hindi',
    notes: 'Asked to stop calling',
    tags: ['vip'],
    flag: { text: 'x' },
  }))

  it('puts the final disposition first in the outcome', () => {
    expect(outcome).toEqual([['final_disposition', 'not_interested'], ['dnc_requested', 'yes']])
  })
  it('reads text yes/no values as checks', () => {
    expect(checks).toEqual([['is_user_in_call', true], ['is_task_complete', false], ['is_guardrail_respected', null]])
  })
  it('keeps everything else as dispositions, without tags and flags', () => {
    expect(dispositions).toEqual([['is_language', 'hindi'], ['notes', 'Asked to stop calling']])
  })
})

describe('finalDisposition', () => {
  it('reads it, with underscores as spaces', () => {
    expect(finalDisposition(call({ final_disposition: 'callback_requested' }))).toBe('callback requested')
  })
  it('is null when missing or empty', () => {
    expect(finalDisposition(call({}))).toBeNull()
    expect(finalDisposition(call({ final_disposition: 'n/a' }))).toBeNull()
  })
})

describe('askedNotToCall', () => {
  it.each([['yes', true], ['1', true], [true, true], ['no', false], ['-', false], [undefined, false]])('%p → %p', (value, expected) => {
    expect(askedNotToCall(call({ dnc_requested: value }))).toBe(expected)
  })
})

