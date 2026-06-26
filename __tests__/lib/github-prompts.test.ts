import { describe, it, expect, vi } from 'vitest'

// server-only throws in non-React-server environments.
// Mock it before the module under test is imported.
vi.mock('server-only', () => ({}))
vi.mock('js-yaml', () => ({ default: { dump: vi.fn(() => '') } }))

import { enrichSnapshotForGitHub } from '@/lib/github-prompts'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE = {
  platform: 'livekit',
  agent: { name: 'test-agent', assistant: [{ prompt: 'Hello' }] },
}

const WEBHOOKS = [
  { webhook_name: 'on_call_end', webhook_url: 'https://example.com/hook', http_method: 'POST', is_active: true },
]

const DROPOFF = {
  enabled: true,
  dropoff_message: 'We will call you back.',
  delay_minutes: 5,
  max_retries: 3,
}

const CALLBACK = {
  enabled: true,
  timeWindow: { start: '09:00', end: '18:00' },
  allowedDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('enrichSnapshotForGitHub', () => {

  describe('base snapshot', () => {
    it('spreads all base snapshot fields into the result', () => {
      const result = enrichSnapshotForGitHub(BASE, null, null, null)
      expect(result.platform).toBe('livekit')
      expect(result.agent).toEqual(BASE.agent)
    })

    it('does not mutate the original base snapshot', () => {
      const original = { ...BASE }
      enrichSnapshotForGitHub(BASE, WEBHOOKS, DROPOFF, CALLBACK)
      expect(BASE).toEqual(original)
    })

    it('returns a new object (not the same reference)', () => {
      const result = enrichSnapshotForGitHub(BASE, null, null, null)
      expect(result).not.toBe(BASE)
    })

    it('handles an empty base snapshot without throwing', () => {
      expect(() => enrichSnapshotForGitHub({}, null, null, null)).not.toThrow()
    })
  })

  describe('webhook_configs', () => {
    it('appends webhook_configs when webhooks array is non-empty', () => {
      const result = enrichSnapshotForGitHub(BASE, WEBHOOKS, null, null)
      expect(result.webhook_configs).toEqual(WEBHOOKS)
    })

    it('does not add webhook_configs for an empty array', () => {
      const result = enrichSnapshotForGitHub(BASE, [], null, null)
      expect(result).not.toHaveProperty('webhook_configs')
    })

    it('does not add webhook_configs when null', () => {
      const result = enrichSnapshotForGitHub(BASE, null, null, null)
      expect(result).not.toHaveProperty('webhook_configs')
    })

    it('does not add webhook_configs when undefined', () => {
      const result = enrichSnapshotForGitHub(BASE, undefined, null, null)
      expect(result).not.toHaveProperty('webhook_configs')
    })
  })

  describe('dropoff_settings', () => {
    it('appends dropoff_settings when dropoff is provided', () => {
      const result = enrichSnapshotForGitHub(BASE, null, DROPOFF, null)
      expect(result.dropoff_settings).toEqual(DROPOFF)
    })

    it('does not add dropoff_settings when null', () => {
      const result = enrichSnapshotForGitHub(BASE, null, null, null)
      expect(result).not.toHaveProperty('dropoff_settings')
    })

    it('does not add dropoff_settings when undefined', () => {
      const result = enrichSnapshotForGitHub(BASE, null, undefined, null)
      expect(result).not.toHaveProperty('dropoff_settings')
    })
  })

  describe('callback_settings', () => {
    it('appends callback_settings when callbackSettings is provided', () => {
      const result = enrichSnapshotForGitHub(BASE, null, null, CALLBACK)
      expect(result.callback_settings).toEqual(CALLBACK)
    })

    it('does not add callback_settings when null', () => {
      const result = enrichSnapshotForGitHub(BASE, null, null, null)
      expect(result).not.toHaveProperty('callback_settings')
    })

    it('does not add callback_settings when undefined', () => {
      const result = enrichSnapshotForGitHub(BASE, null, null, undefined)
      expect(result).not.toHaveProperty('callback_settings')
    })
  })

  describe('all settings together', () => {
    it('appends all three supplemental settings when all are provided', () => {
      const result = enrichSnapshotForGitHub(BASE, WEBHOOKS, DROPOFF, CALLBACK)
      expect(result.webhook_configs).toEqual(WEBHOOKS)
      expect(result.dropoff_settings).toEqual(DROPOFF)
      expect(result.callback_settings).toEqual(CALLBACK)
      expect(result.platform).toBe('livekit')
    })

    it('omits all supplemental settings when none are provided', () => {
      const result = enrichSnapshotForGitHub(BASE, null, null, null)
      expect(result).not.toHaveProperty('webhook_configs')
      expect(result).not.toHaveProperty('dropoff_settings')
      expect(result).not.toHaveProperty('callback_settings')
    })

    it('omits only the absent settings when some are provided', () => {
      const result = enrichSnapshotForGitHub(BASE, WEBHOOKS, null, CALLBACK)
      expect(result.webhook_configs).toEqual(WEBHOOKS)
      expect(result).not.toHaveProperty('dropoff_settings')
      expect(result.callback_settings).toEqual(CALLBACK)
    })
  })
})
