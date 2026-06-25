import { describe, it, expect, vi } from 'vitest'
import crypto from 'crypto'
import { verifySignature, mapToPypePayload, mapAudioToPypePayload, type ElevenLabsWebhookData } from '@/lib/elevenlabs-webhook'

const SECRET = 'test-webhook-secret'

function makeHmac(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex')
}

describe('elevenlabs-webhook', () => {
  describe('verifySignature — plain HMAC hex format', () => {
    it('accepts a valid HMAC hex signature', () => {
      const body = '{"event":"call_ended"}'
      const sig = makeHmac(body, SECRET)
      expect(verifySignature(body, sig, SECRET)).toBe(true)
    })

    it('rejects a tampered body', () => {
      const body = '{"event":"call_ended"}'
      const sig = makeHmac(body, SECRET)
      expect(verifySignature(body + ' ', sig, SECRET)).toBe(false)
    })

    it('rejects a wrong secret', () => {
      const body = '{"event":"call_ended"}'
      const sig = makeHmac(body, SECRET)
      expect(verifySignature(body, sig, 'wrong-secret')).toBe(false)
    })
  })

  describe('verifySignature — v1, prefix format (ElevenLabs style)', () => {
    it('accepts v1,<hex> format', () => {
      const body = '{"type":"post_call_transcription"}'
      const sig = `v1,${makeHmac(body, SECRET)}`
      expect(verifySignature(body, sig, SECRET)).toBe(true)
    })

    it('rejects v1,<wrong_hex>', () => {
      const body = '{"type":"post_call_transcription"}'
      const sig = `v1,${makeHmac(body + 'x', SECRET)}`
      expect(verifySignature(body, sig, SECRET)).toBe(false)
    })
  })

  describe('verifySignature — t=timestamp,v1=hash format (Stripe-style)', () => {
    it('accepts t=<ts>,v1=<hash> format', () => {
      const body = '{"data":"value"}'
      const ts = '1700000000'
      const signedPayload = `${ts}.${body}`
      const hash = makeHmac(signedPayload, SECRET)
      const sig = `t=${ts},v1=${hash}`
      expect(verifySignature(body, sig, SECRET)).toBe(true)
    })

    it('rejects when hash does not match', () => {
      const body = '{"data":"value"}'
      const ts = '1700000000'
      const sig = `t=${ts},v1=${'0'.repeat(64)}`
      expect(verifySignature(body, sig, SECRET)).toBe(false)
    })
  })

  describe('verifySignature — guard conditions', () => {
    it('returns false when signatureHeader is null', () => {
      expect(verifySignature('body', null, SECRET)).toBe(false)
    })

    it('returns false when secret is empty', () => {
      const body = 'some body'
      const sig = makeHmac(body, SECRET)
      expect(verifySignature(body, sig, '')).toBe(false)
    })

    it('returns false for completely invalid signature', () => {
      expect(verifySignature('body', 'not-a-valid-signature', SECRET)).toBe(false)
    })
  })

  describe('mapToPypePayload', () => {
    const makeData = (overrides: Partial<ElevenLabsWebhookData> = {}): ElevenLabsWebhookData => ({
      type: 'post_call_transcription',
      event_timestamp: 1705312950,
      data: {
        conversation_id: 'conv-001',
        user_id: '+919876543210',
        agent_id: 'agent-el-001',
        metadata: {
          start_time_unix_secs: 1705312800,
          call_duration_secs: 150,
          termination_reason: 'completed',
        },
        transcript: [
          { role: 'user', message: 'Hi', conversation_turn_metrics: undefined },
          { role: 'agent', message: 'Hello!', conversation_turn_metrics: undefined },
        ],
        conversation_initiation_client_data: { dynamic_variables: { name: 'John' } },
      },
      ...overrides,
    })

    it('maps conversation_id to call_id', () => {
      const result = mapToPypePayload(makeData())
      expect(result.call_id).toBe('conv-001')
    })

    it('maps user_id to customer_number', () => {
      const result = mapToPypePayload(makeData())
      expect(result.customer_number).toBe('+919876543210')
    })

    it('maps agent_id from data', () => {
      const result = mapToPypePayload(makeData())
      expect(result.agent_id).toBe('agent-el-001')
    })

    it('computes call_started_at from start_time_unix_secs', () => {
      const result = mapToPypePayload(makeData())
      expect(result.call_started_at).toContain('2024-01-15')
    })

    it('maps duration_seconds from metadata', () => {
      const result = mapToPypePayload(makeData())
      expect(result.duration_seconds).toBe(150)
    })

    it('maps termination_reason to call_ended_reason', () => {
      const result = mapToPypePayload(makeData())
      expect(result.call_ended_reason).toBe('completed')
    })

    it('maps dynamic_variables from conversation_initiation_client_data', () => {
      const result = mapToPypePayload(makeData())
      expect((result.dynamic_variables as any).name).toBe('John')
    })

    it('handles missing metadata gracefully', () => {
      const data = makeData()
      data.data!.metadata = {}
      const result = mapToPypePayload(data)
      expect(result.duration_seconds).toBe(0)
    })

    it('handles empty transcript gracefully', () => {
      const data = makeData()
      data.data!.transcript = []
      const result = mapToPypePayload(data)
      expect(result.transcript_with_metrics).toHaveLength(0)
    })

    it('builds transcript_with_metrics from user/agent pairs', () => {
      const result = mapToPypePayload(makeData())
      expect(Array.isArray(result.transcript_with_metrics)).toBe(true)
    })

    it('maps transcript_json with role/message only', () => {
      const result = mapToPypePayload(makeData())
      const tj = result.transcript_json as any[]
      expect(tj[0]).toEqual({ role: 'user', message: 'Hi' })
      expect(tj[1]).toEqual({ role: 'agent', message: 'Hello!' })
    })
  })

  describe('mapAudioToPypePayload', () => {
    it('maps basic fields correctly', () => {
      const result = mapAudioToPypePayload(
        'conv-001', '+910000000000', 'agent-001',
        'https://s3.example.com/audio.mp3',
        'my-bucket', 'ap-south-1',
        '2024-01-15T10:00:00Z', '2024-01-15T10:02:30Z'
      )
      expect(result.call_id).toBe('conv-001')
      expect(result.customer_number).toBe('+910000000000')
      expect(result.recording_url).toBe('https://s3.example.com/audio.mp3')
      expect(result.s3_bucket).toBe('my-bucket')
      expect(result.call_started_at).toBe('2024-01-15T10:00:00Z')
      expect(result.call_ended_at).toBe('2024-01-15T10:02:30Z')
    })

    it('sets transcript arrays to empty', () => {
      const result = mapAudioToPypePayload('c', null, undefined, 'url', null, null, null, null)
      expect(result.transcript_json).toHaveLength(0)
      expect(result.transcript_with_metrics).toHaveLength(0)
    })

    it('handles null userId', () => {
      const result = mapAudioToPypePayload('c', null, 'agent', 'url', null, null, null, null)
      expect(result.customer_number).toBeNull()
    })
  })
})
