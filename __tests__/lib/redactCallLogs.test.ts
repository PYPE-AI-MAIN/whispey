import { describe, it, expect } from 'vitest'
import { redactTagsFromCallLogsForViewer } from '@/lib/redactCallLogsTagsForViewer'

const makeRow = (overrides: Partial<Record<string, any>> = {}): any => ({
  id: 'log-1',
  call_id: 'call-abc',
  agent_id: 'agent-1',
  transcription_metrics: {
    tags: ['follow-up', 'urgent'],
    tagComments: { 'follow-up': 'needs callback' },
    sentiment: 'positive',
    intent: 'booking',
  },
  ...overrides,
})

describe('redactTagsFromCallLogsForViewer', () => {
  it('removes tags from transcription_metrics', () => {
    const result = redactTagsFromCallLogsForViewer([makeRow()])
    expect((result[0].transcription_metrics as any).tags).toBeUndefined()
  })

  it('removes tagComments from transcription_metrics', () => {
    const result = redactTagsFromCallLogsForViewer([makeRow()])
    expect((result[0].transcription_metrics as any).tagComments).toBeUndefined()
  })

  it('preserves other transcription_metrics fields', () => {
    const result = redactTagsFromCallLogsForViewer([makeRow()])
    const tm = result[0].transcription_metrics as any
    expect(tm.sentiment).toBe('positive')
    expect(tm.intent).toBe('booking')
  })

  it('preserves top-level call fields', () => {
    const result = redactTagsFromCallLogsForViewer([makeRow()])
    expect(result[0].id).toBe('log-1')
    expect(result[0].call_id).toBe('call-abc')
  })

  it('does not mutate the original rows', () => {
    const original = makeRow()
    const originalTm = original.transcription_metrics
    redactTagsFromCallLogsForViewer([original])
    expect(originalTm.tags).toBeDefined() // original unchanged
  })

  it('returns empty array for empty input', () => {
    expect(redactTagsFromCallLogsForViewer([])).toHaveLength(0)
  })

  it('handles row with null transcription_metrics gracefully', () => {
    const row = makeRow({ transcription_metrics: null })
    const result = redactTagsFromCallLogsForViewer([row])
    expect(result[0].transcription_metrics).toBeNull()
  })

  it('handles row with array transcription_metrics gracefully', () => {
    const row = makeRow({ transcription_metrics: [] })
    const result = redactTagsFromCallLogsForViewer([row])
    expect(Array.isArray(result[0].transcription_metrics)).toBe(true)
  })

  it('handles multiple rows, redacting each', () => {
    const rows = [makeRow(), makeRow({ id: 'log-2', call_id: 'call-def' })]
    const result = redactTagsFromCallLogsForViewer(rows)
    expect(result).toHaveLength(2)
    result.forEach(r => {
      expect((r.transcription_metrics as any).tags).toBeUndefined()
    })
  })

  it('handles row with no tags key in transcription_metrics', () => {
    const row = makeRow({ transcription_metrics: { sentiment: 'neutral' } })
    const result = redactTagsFromCallLogsForViewer([row])
    expect((result[0].transcription_metrics as any).sentiment).toBe('neutral')
  })
})
