import { describe, it, expect, vi } from 'vitest'

// server-only throws in non-React-server environments.
// Mock it before the module under test is imported.
vi.mock('server-only', () => ({}))
vi.mock('js-yaml', () => ({ default: { dump: vi.fn(() => 'yaml-content') } }))

import { enrichSnapshotForGitHub, pushPromptToGitHub } from '@/lib/github-prompts'

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

  describe('pushPromptToGitHub', () => {
    const ENV = { PROMPT_GITHUB_REPO: 'org/repo', PROMPT_GITHUB_TOKEN: 'tok' }

    it('returns null immediately when REPO or TOKEN are not set', async () => {
      const result = await pushPromptToGitHub('proj', 'agent', {}, 'msg', 'user@x.com')
      expect(result).toBeNull()
    })

    it('returns sha on successful PUT when file does not yet exist', async () => {
      // REPO/TOKEN are module-level constants — must resetModules + dynamic import
      process.env.PROMPT_GITHUB_REPO = ENV.PROMPT_GITHUB_REPO
      process.env.PROMPT_GITHUB_TOKEN = ENV.PROMPT_GITHUB_TOKEN
      vi.resetModules()
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ status: 404, ok: false }) // getCurrentSha → file not found
        .mockResolvedValueOnce({ ok: true, json: async () => ({ commit: { sha: 'abc123' } }) }) // PUT
      )
      const { pushPromptToGitHub: push } = await import('@/lib/github-prompts')
      const result = await push('proj', 'agent', { k: 'v' }, 'msg', 'user@x.com')
      expect(result).toEqual({ sha: 'abc123' })
      delete process.env.PROMPT_GITHUB_REPO
      delete process.env.PROMPT_GITHUB_TOKEN
      vi.resetModules()
    })

    it('returns null when the PUT request fails', async () => {
      process.env.PROMPT_GITHUB_REPO = ENV.PROMPT_GITHUB_REPO
      process.env.PROMPT_GITHUB_TOKEN = ENV.PROMPT_GITHUB_TOKEN
      vi.resetModules()
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ status: 404, ok: false }) // getCurrentSha
        .mockResolvedValueOnce({ ok: false, status: 422, text: async () => 'conflict' }) // PUT fails
      )
      const { pushPromptToGitHub: push } = await import('@/lib/github-prompts')
      const result = await push('proj', 'agent', {}, 'msg', 'user@x.com')
      expect(result).toBeNull()
      delete process.env.PROMPT_GITHUB_REPO
      delete process.env.PROMPT_GITHUB_TOKEN
      vi.resetModules()
    })

    it('returns null when fetch throws unexpectedly', async () => {
      process.env.PROMPT_GITHUB_REPO = ENV.PROMPT_GITHUB_REPO
      process.env.PROMPT_GITHUB_TOKEN = ENV.PROMPT_GITHUB_TOKEN
      vi.resetModules()
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
      const { pushPromptToGitHub: push } = await import('@/lib/github-prompts')
      const result = await push('proj', 'agent', {}, 'msg', 'user@x.com')
      expect(result).toBeNull()
      delete process.env.PROMPT_GITHUB_REPO
      delete process.env.PROMPT_GITHUB_TOKEN
      vi.resetModules()
    })
  })

  describe('createMergePR', () => {
    const ENV = { PROMPT_GITHUB_REPO: 'org/repo', PROMPT_GITHUB_TOKEN: 'tok' }

    it('returns null when REPO or TOKEN are not set', async () => {
      const { createMergePR } = await import('@/lib/github-prompts')
      const result = await createMergePR('proj', 'agent', {}, 'title', 'body', 'user@x.com', 'ver-001')
      expect(result).toBeNull()
    })

    it('returns null when getDefaultBranchSha fails (non-ok response)', async () => {
      process.env.PROMPT_GITHUB_REPO = ENV.PROMPT_GITHUB_REPO
      process.env.PROMPT_GITHUB_TOKEN = ENV.PROMPT_GITHUB_TOKEN
      vi.resetModules()
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 404 }) // getDefaultBranchSha → null
      )
      const { createMergePR } = await import('@/lib/github-prompts')
      const result = await createMergePR('proj', 'agent', {}, 'title', 'body', 'user@x.com', 'ver-001')
      expect(result).toBeNull()
      delete process.env.PROMPT_GITHUB_REPO
      delete process.env.PROMPT_GITHUB_TOKEN
      vi.resetModules()
    })

    it('returns null when branch creation fails', async () => {
      process.env.PROMPT_GITHUB_REPO = ENV.PROMPT_GITHUB_REPO
      process.env.PROMPT_GITHUB_TOKEN = ENV.PROMPT_GITHUB_TOKEN
      vi.resetModules()
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ object: { sha: 'main-sha' } }) }) // getDefaultBranchSha
        .mockResolvedValueOnce({ ok: true }) // DELETE existing branch (catch-ignored)
        .mockResolvedValueOnce({ ok: false, status: 422, text: async () => 'error' }) // POST branch creation
      )
      const { createMergePR } = await import('@/lib/github-prompts')
      const result = await createMergePR('proj', 'agent', {}, 'title', 'body', 'user@x.com', 'ver-001')
      expect(result).toBeNull()
      delete process.env.PROMPT_GITHUB_REPO
      delete process.env.PROMPT_GITHUB_TOKEN
      vi.resetModules()
    })

    it('returns null when file push to branch fails', async () => {
      process.env.PROMPT_GITHUB_REPO = ENV.PROMPT_GITHUB_REPO
      process.env.PROMPT_GITHUB_TOKEN = ENV.PROMPT_GITHUB_TOKEN
      vi.resetModules()
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ object: { sha: 'main-sha' } }) }) // getDefaultBranchSha
        .mockResolvedValueOnce({ ok: true }) // DELETE branch
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // POST create branch
        .mockResolvedValueOnce({ ok: false, status: 404 }) // getCurrentSha (file not found)
        .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'err' }) // PUT file fails
      )
      const { createMergePR } = await import('@/lib/github-prompts')
      const result = await createMergePR('proj', 'agent', {}, 'title', 'body', 'user@x.com', 'ver-001')
      expect(result).toBeNull()
      delete process.env.PROMPT_GITHUB_REPO
      delete process.env.PROMPT_GITHUB_TOKEN
      vi.resetModules()
    })

    it('returns pr_number, pr_url, branch on full success', async () => {
      process.env.PROMPT_GITHUB_REPO = ENV.PROMPT_GITHUB_REPO
      process.env.PROMPT_GITHUB_TOKEN = ENV.PROMPT_GITHUB_TOKEN
      vi.resetModules()
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ object: { sha: 'main-sha' } }) }) // getDefaultBranchSha
        .mockResolvedValueOnce({ ok: true }) // DELETE branch
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // POST create branch
        .mockResolvedValueOnce({ ok: false, status: 404 }) // getCurrentSha (file not found)
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // PUT file
        .mockResolvedValueOnce({ ok: true, json: async () => ({ number: 42, html_url: 'https://github.com/org/repo/pull/42' }) }) // POST PR
      )
      const { createMergePR } = await import('@/lib/github-prompts')
      const result = await createMergePR('proj', 'my agent', {}, 'title', 'body', 'user@x.com', 'ver-001')
      expect(result).toEqual({
        pr_number: 42,
        pr_url: 'https://github.com/org/repo/pull/42',
        branch: 'merge/my_agent-ver-001',
      })
      delete process.env.PROMPT_GITHUB_REPO
      delete process.env.PROMPT_GITHUB_TOKEN
      vi.resetModules()
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
