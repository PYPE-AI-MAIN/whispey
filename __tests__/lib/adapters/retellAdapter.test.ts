import { describe, it, expect } from 'vitest'
import { RetellAdapter, retellAdapter, type RetellWebhookPayload } from '@/lib/adapters/retell.adapter'

const makePayload = (overrides: Partial<RetellWebhookPayload> = {}): RetellWebhookPayload => ({
  event: 'call_ended',
  call: {
    call_id: 'call-retell-001',
    agent_id: 'agent-retell-001',
    call_type: 'phone_call',
    call_status: 'ended',
    from_number: '+12025550100',
    to_number: '+919876543210',
    direction: 'outbound',
    start_timestamp: 1705312800000, // 2024-01-15 10:00:00 UTC
    end_timestamp: 1705312950000,   // 2024-01-15 10:02:30 UTC
    duration_ms: 150000,
    disconnection_reason: 'call_ended',
    transcript: 'User: hello\nAgent: hi',
    transcript_object: [
      { role: 'user', content: 'Hello there', words: [{ word: 'Hello', start: 0.5, end: 1.0 }, { word: 'there', start: 1.0, end: 1.5 }] },
      { role: 'agent', content: 'Hi, how can I help you today?' },
    ],
    recording_url: 'https://storage.retell.ai/rec.mp3',
  },
  ...overrides,
})

describe('RetellAdapter', () => {
  describe('canHandle', () => {
    it('returns true for a valid Retell payload', () => {
      expect(retellAdapter.canHandle(makePayload())).toBe(true)
    })

    it('returns false for null', () => {
      expect(retellAdapter.canHandle(null as any)).toBe(false)
    })

    it('returns false when event field is missing', () => {
      const p = makePayload()
      const { event, ...rest } = p as any
      expect(retellAdapter.canHandle(rest as any)).toBe(false)
    })

    it('returns false when call.call_id is not a string', () => {
      const p = makePayload()
      ;(p.call as any).call_id = 123
      expect(retellAdapter.canHandle(p)).toBe(false)
    })
  })

  describe('transform — happy path', () => {
    it('returns non-null for call_ended event', () => {
      expect(retellAdapter.transform(makePayload(), 'dev')).not.toBeNull()
    })

    it('maps call_id correctly', () => {
      const r = retellAdapter.transform(makePayload(), 'dev')!
      expect(r.call_id).toBe('call-retell-001')
    })

    it('maps agent_id correctly', () => {
      const r = retellAdapter.transform(makePayload(), 'dev')!
      expect(r.agent_id).toBe('agent-retell-001')
    })

    it('maps recording_url', () => {
      const r = retellAdapter.transform(makePayload(), 'dev')!
      expect(r.recording_url).toBe('https://storage.retell.ai/rec.mp3')
    })

    it('maps environment correctly', () => {
      const r = retellAdapter.transform(makePayload(), 'prod')!
      expect(r.environment).toBe('prod')
    })

    it('extracts to_number as customer_number for outbound call', () => {
      const r = retellAdapter.transform(makePayload(), 'dev')!
      expect(r.customer_number).toBe('+919876543210')
    })

    it('extracts from_number as customer_number for inbound call', () => {
      const p = makePayload()
      p.call.direction = 'inbound'
      const r = retellAdapter.transform(p, 'dev')!
      expect(r.customer_number).toBe('+12025550100')
    })

    it('uses web-call-<id> for web_call type', () => {
      const p = makePayload()
      p.call.call_type = 'web_call'
      const r = retellAdapter.transform(p, 'dev')!
      expect(r.customer_number).toBe('web-call-call-retell-001')
    })

    it('calculates duration from duration_ms', () => {
      const r = retellAdapter.transform(makePayload(), 'dev')!
      expect(r.metadata.total_duration_seconds).toBe(150)
    })

    it('falls back to timestamp diff when duration_ms is absent', () => {
      const p = makePayload()
      delete p.call.duration_ms
      const r = retellAdapter.transform(p, 'dev')!
      expect(r.metadata.total_duration_seconds).toBe(150) // (end - start) / 1000
    })

    it('creates conversation turns from transcript_object', () => {
      const r = retellAdapter.transform(makePayload(), 'dev')!
      expect(r.transcript_with_metrics.length).toBeGreaterThan(0)
    })

    it('maps user/agent content to turns', () => {
      const r = retellAdapter.transform(makePayload(), 'dev')!
      const turn = r.transcript_with_metrics[0]
      expect(turn.user_transcript).toBe('Hello there')
      expect(turn.agent_response).toBe('Hi, how can I help you today?')
    })

    it('uses word timings for turn timestamp', () => {
      const r = retellAdapter.transform(makePayload(), 'dev')!
      const turn = r.transcript_with_metrics[0]
      // First word starts at 0.5s after call start
      expect(turn.timestamp).toBeGreaterThan(0)
    })

    it('metadata contains retell-specific extras', () => {
      const r = retellAdapter.transform(makePayload(), 'dev')!
      expect(r.metadata.retell_call_type).toBe('phone_call')
      expect(r.metadata.retell_direction).toBe('outbound')
    })

    it('parses ISO start/end timestamps', () => {
      const r = retellAdapter.transform(makePayload(), 'dev')!
      expect(r.metadata.call_started_at).toContain('2024-01-15')
      expect(r.metadata.call_ended_at).toContain('2024-01-15')
    })
  })

  describe('transform — edge cases', () => {
    it('returns null for non-call_ended events', () => {
      const p = makePayload({ event: 'call_started' })
      expect(retellAdapter.transform(p, 'dev')).toBeNull()
    })

    it('returns null when call_id is missing', () => {
      const p = makePayload()
      ;(p.call as any).call_id = ''
      expect(retellAdapter.transform(p, 'dev')).toBeNull()
    })

    it('handles empty transcript_object gracefully', () => {
      const p = makePayload()
      p.call.transcript_object = []
      const r = retellAdapter.transform(p, 'dev')!
      expect(r.transcript_with_metrics).toHaveLength(0)
    })

    it('handles missing transcript_object', () => {
      const p = makePayload()
      delete p.call.transcript_object
      const r = retellAdapter.transform(p, 'dev')!
      expect(r.transcript_with_metrics).toHaveLength(0)
    })
  })

  describe('normalizeEndedReason (via transform)', () => {
    const cases: [string | undefined, string][] = [
      ['call_ended', 'completed'],
      ['user_hangup', 'completed'],
      ['agent_transfer', 'transferred'],
      ['max_duration_exceeded', 'timeout'],
      ['connection_error', 'error'],
      [undefined, 'completed'],
    ]

    cases.forEach(([reason, expected]) => {
      it(`maps "${reason ?? 'undefined'}" → "${expected}"`, () => {
        const p = makePayload()
        p.call.disconnection_reason = reason
        const r = retellAdapter.transform(p, 'dev')!
        expect(r.call_ended_reason).toBe(expected)
      })
    })
  })

  describe('singleton export', () => {
    it('retellAdapter is an instance of RetellAdapter', () => {
      expect(retellAdapter).toBeInstanceOf(RetellAdapter)
    })
  })
})
