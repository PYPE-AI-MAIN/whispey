import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

// Use hoisted so the chain is defined before vi.mock factories run
const mockChain = vi.hoisted(() => {
  const chain: any = {}
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.maybeSingle = vi.fn().mockResolvedValue({ data: { enabled: true }, error: null })
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve({ data: [{ webhook_name: 'hook' }], error: null }).then(resolve, reject)
  return chain
})

vi.mock('@/lib/supabase-server', () => ({
  createServiceRoleClient: vi.fn(() => ({ from: vi.fn().mockReturnValue(mockChain) })),
}))

vi.mock('@/lib/github-prompts', () => ({
  enrichSnapshotForGitHub: vi.fn((base: any) => ({ ...base, _enriched: true })),
  pushPromptToGitHub: vi.fn().mockResolvedValue({ sha: 'test-sha' }),
}))

import { fetchSchedulerCallbackSettings, pushEnrichedConfigToGitHub } from '@/lib/agentVersionHelpers'

// ── fetchSchedulerCallbackSettings ────────────────────────────────────────────

describe('fetchSchedulerCallbackSettings', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN
    delete process.env.SCHEDULER_API_URL
  })

  it('returns null when no scheduler URL is configured', async () => {
    expect(await fetchSchedulerCallbackSettings('agent-1')).toBeNull()
  })

  it('returns data when the scheduler responds ok with non-empty body', async () => {
    process.env.SCHEDULER_API_URL = 'https://scheduler.example.com'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true, allowedDays: ['monday'] }),
    }))
    const result = await fetchSchedulerCallbackSettings('agent-1')
    expect(result).toEqual({ enabled: true, allowedDays: ['monday'] })
  })

  it('returns null when the scheduler responds with an empty object', async () => {
    process.env.SCHEDULER_API_URL = 'https://scheduler.example.com'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }))
    expect(await fetchSchedulerCallbackSettings('agent-1')).toBeNull()
  })

  it('returns null when the scheduler returns a non-ok status', async () => {
    process.env.SCHEDULER_API_URL = 'https://scheduler.example.com'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    expect(await fetchSchedulerCallbackSettings('agent-1')).toBeNull()
  })

  it('returns null when fetch throws', async () => {
    process.env.SCHEDULER_API_URL = 'https://scheduler.example.com'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    expect(await fetchSchedulerCallbackSettings('agent-1')).toBeNull()
  })
})

// ── pushEnrichedConfigToGitHub ────────────────────────────────────────────────

describe('pushEnrichedConfigToGitHub', () => {
  it('returns the sha from pushPromptToGitHub on success', async () => {
    const result = await pushEnrichedConfigToGitHub(
      'agent-1', { platform: 'livekit' }, 'my-project', 'my-agent', 'commit msg', 'dev@x.com'
    )
    expect(result).toEqual({ sha: 'test-sha' })
  })
})
