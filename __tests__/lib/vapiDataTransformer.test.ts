import { describe, it, expect, beforeEach } from 'vitest'
import { VapiDataTransformer, type VapiWebhookData } from '@/lib/vapi-data-transformer'

const makeWebhook = (overrides: Partial<Record<string, any>> = {}): VapiWebhookData => ({
  message: {
    type: 'end-of-call-report',
    call: {
      id: 'call-abc-123',
      type: 'phoneCall',
      customer: { number: '+919876543210' },
    },
    assistant: { id: 'asst-001' },
    artifact: { recordingUrl: 'https://s3.example.com/recording.mp3', performanceMetrics: null },
    startedAt: '2024-01-15T10:00:00.000Z',
    endedAt: '2024-01-15T10:02:30.000Z',
    endedReason: 'customer-ended-call',
    cost: 0.025,
    costBreakdown: {},
    durationMs: 150000,
    durationSeconds: 150,
    summary: 'Patient booked appointment',
    transcript: 'USER: hello\nASSISTANT: hi there',
    messages: [
      { role: 'user', message: 'Hello', time: 0, secondsFromStart: 0 },
      { role: 'assistant', message: 'Hi, how can I help?', time: 1000, secondsFromStart: 1 },
    ],
    ...overrides,
  },
})

describe('VapiDataTransformer', () => {
  let transformer: VapiDataTransformer

  beforeEach(() => {
    transformer = new VapiDataTransformer('dev')
  })

  describe('transformVapiToDbFormat — happy path', () => {
    it('returns a non-null result for a valid webhook', () => {
      const result = transformer.transformVapiToDbFormat(makeWebhook())
      expect(result).not.toBeNull()
    })

    it('maps call_id from message.call.id', () => {
      const result = transformer.transformVapiToDbFormat(makeWebhook())!
      expect(result.call_id).toBe('call-abc-123')
    })

    it('maps agent_id from message.assistant.id', () => {
      const result = transformer.transformVapiToDbFormat(makeWebhook())!
      expect(result.agent_id).toBe('asst-001')
    })

    it('maps recording_url from artifact', () => {
      const result = transformer.transformVapiToDbFormat(makeWebhook())!
      expect(result.recording_url).toBe('https://s3.example.com/recording.mp3')
    })

    it('sets environment from constructor arg', () => {
      const result = transformer.transformVapiToDbFormat(makeWebhook())!
      expect(result.environment).toBe('dev')
    })

    it('sets environment to prod when constructed with prod', () => {
      const prod = new VapiDataTransformer('prod')
      const result = prod.transformVapiToDbFormat(makeWebhook())!
      expect(result.environment).toBe('prod')
    })

    it('maps total_cost from message.cost', () => {
      const result = transformer.transformVapiToDbFormat(makeWebhook())!
      expect(result.metadata.total_cost).toBe(0.025)
    })

    it('maps summary from message.summary', () => {
      const result = transformer.transformVapiToDbFormat(makeWebhook())!
      expect(result.metadata.summary).toBe('Patient booked appointment')
    })

    it('maps raw_transcript from message.transcript', () => {
      const result = transformer.transformVapiToDbFormat(makeWebhook())!
      expect(result.metadata.raw_transcript).toBe('USER: hello\nASSISTANT: hi there')
    })

    it('extracts phone number from call.customer.number', () => {
      const result = transformer.transformVapiToDbFormat(makeWebhook())!
      expect(result.customer_number).toBe('+919876543210')
    })

    it('uses web-call-<id> for webCall type', () => {
      const webhook = makeWebhook({ call: { id: 'web-abc', type: 'webCall' } })
      const result = transformer.transformVapiToDbFormat(webhook)!
      expect(result.customer_number).toContain('web-call-web-abc')
    })

    it('transcript_with_metrics is an array', () => {
      const result = transformer.transformVapiToDbFormat(makeWebhook())!
      expect(Array.isArray(result.transcript_with_metrics)).toBe(true)
    })
  })

  describe('transformVapiToDbFormat — edge cases', () => {
    it('returns null for empty webhook object', () => {
      const result = transformer.transformVapiToDbFormat({})
      expect(result).toBeNull()
    })

    it('returns null when call_id is missing', () => {
      const webhook = makeWebhook({ call: { id: undefined, type: 'phoneCall' } })
      // call_id will be 'unknown' which fails validation
      const result = transformer.transformVapiToDbFormat(webhook)
      expect(result).toBeNull()
    })

    it('returns null when agent_id is missing', () => {
      const w = makeWebhook()
      ;(w.message as any).assistant = { id: undefined }
      const result = transformer.transformVapiToDbFormat(w)
      expect(result).toBeNull()
    })

    it('handles missing recording URL gracefully', () => {
      const webhook = makeWebhook({ artifact: {} })
      const result = transformer.transformVapiToDbFormat(webhook)
      expect(result?.recording_url).toBe('')
    })

    it('handles empty messages array', () => {
      const webhook = makeWebhook({ messages: [] })
      const result = transformer.transformVapiToDbFormat(webhook)!
      expect(result).not.toBeNull()
      expect(Array.isArray(result.transcript_with_metrics)).toBe(true)
    })

    it('handles missing startedAt/endedAt without throwing', () => {
      const webhook = makeWebhook({ startedAt: undefined, endedAt: undefined })
      expect(() => transformer.transformVapiToDbFormat(webhook)).not.toThrow()
    })
  })

  describe('normalizeCallEndedReason (via transformVapiToDbFormat)', () => {
    it('maps customer-ended-call to "completed" (contains "ended")', () => {
      const result = transformer.transformVapiToDbFormat(makeWebhook())!
      expect(result.call_ended_reason).toBe('completed')
    })

    it('maps timeout reason to "timeout"', () => {
      const result = transformer.transformVapiToDbFormat(makeWebhook({ endedReason: 'max-duration-exceeded' }))!
      expect(result.call_ended_reason).toBe('timeout')
    })

    it('maps error reason to "error"', () => {
      const result = transformer.transformVapiToDbFormat(makeWebhook({ endedReason: 'pipeline-error' }))!
      expect(result.call_ended_reason).toBe('error')
    })

    it('defaults unknown reason to "completed"', () => {
      const result = transformer.transformVapiToDbFormat(makeWebhook({ endedReason: 'unknown-custom-reason' }))!
      expect(result.call_ended_reason).toBe('completed')
    })
  })

  describe('logTransformationDetails', () => {
    it('does not throw when transformedData is null', () => {
      const webhook = makeWebhook()
      expect(() => transformer.logTransformationDetails(webhook, null)).not.toThrow()
    })

    it('does not throw for valid transformed data', () => {
      const webhook = makeWebhook()
      const result = transformer.transformVapiToDbFormat(webhook)!
      expect(() => transformer.logTransformationDetails(webhook, result)).not.toThrow()
    })

    it('does not throw when transcript_with_metrics has more than 2 turns', () => {
      const webhook = makeWebhook({
        messages: [
          { role: 'user', message: 'Hi', time: 0, secondsFromStart: 0 },
          { role: 'assistant', message: 'Hello', time: 1000, secondsFromStart: 1 },
          { role: 'user', message: 'How are you', time: 2000, secondsFromStart: 2 },
          { role: 'assistant', message: 'Good', time: 3000, secondsFromStart: 3 },
          { role: 'user', message: 'Bye', time: 4000, secondsFromStart: 4 },
          { role: 'assistant', message: 'Bye', time: 5000, secondsFromStart: 5 },
        ],
      })
      const result = transformer.transformVapiToDbFormat(webhook)!
      expect(() => transformer.logTransformationDetails(webhook, result)).not.toThrow()
    })
  })
})
