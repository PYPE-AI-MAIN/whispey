import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/getProjectRoleForApi', () => ({ getProjectRoleForApi: vi.fn() }))
vi.mock('@/lib/serviceToken', () => ({ mintServiceToken: () => 'svc-token' }))

import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { authorizeCampaignWebhook, schedulerWebhookFetch, webhookPath } from '@/lib/campaignWebhook'

const webhook = { campaignId: 'c1', projectId: 'p1', campaignStatus: 'running', webhooks: [] }

const mockScheduler = (status: number, body: unknown) => {
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(body), { status })) as any
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN = 'https://scheduler.example.com/dev'
  vi.mocked(getProjectRoleForApi).mockReset()
})

describe('campaign webhook proxy', () => {
  it('calls the scheduler with the service token under its base path', async () => {
    mockScheduler(200, { webhook })
    await schedulerWebhookFetch(webhookPath('c 1/x', '/send'), { method: 'POST', body: { mode: 'send' } })
    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://scheduler.example.com/dev/api/v1/campaigns/c%201%2Fx/webhook/send')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer svc-token')
  })

  it('member can read', async () => {
    mockScheduler(200, { webhook })
    vi.mocked(getProjectRoleForApi).mockResolvedValue({ role: 'viewer' } as any)
    const res = await authorizeCampaignWebhook('c1', { write: false })
    expect('webhook' in res && res.webhook.projectId).toBe('p1')
  })

  it('viewer cannot change it (403)', async () => {
    mockScheduler(200, { webhook })
    vi.mocked(getProjectRoleForApi).mockResolvedValue({ role: 'viewer' } as any)
    const res = await authorizeCampaignWebhook('c1', { write: true })
    expect('error' in res && res.error.status).toBe(403)
  })

  it('non-member gets 404, not a hint that the campaign exists', async () => {
    mockScheduler(200, { webhook })
    vi.mocked(getProjectRoleForApi).mockResolvedValue(null)
    const res = await authorizeCampaignWebhook('c1', { write: false })
    expect('error' in res && res.error.status).toBe(404)
  })

  it('unknown campaign → scheduler 404 is passed through', async () => {
    mockScheduler(404, { error: 'Campaign not found' })
    const res = await authorizeCampaignWebhook('nope', { write: false })
    expect('error' in res && res.error.status).toBe(404)
    expect(getProjectRoleForApi).not.toHaveBeenCalled()
  })

  it('scheduler without the new endpoint (not deployed yet) fails closed with a clear message', async () => {
    mockScheduler(403, { message: "Invalid key=value pair (missing equal-sign) in Authorization header (hashed with SHA-256 and encoded with Base64): 'x='." })
    const res = await authorizeCampaignWebhook('c1', { write: true })
    expect('error' in res && res.error.status).toBe(503)
    const body = 'error' in res ? await res.error.json() : null
    expect(body.error).toContain('not deployed')
    expect(getProjectRoleForApi).not.toHaveBeenCalled()
  })

  it('API Gateway "Missing Authentication Token" is read the same way', async () => {
    mockScheduler(403, { message: 'Missing Authentication Token' })
    const { status, data } = await schedulerWebhookFetch('/api/v1/campaigns/webhook/test', { method: 'POST', body: {} })
    expect(status).toBe(503)
    expect(data.error).toContain('not deployed')
  })

  it('other gateway messages surface as the error text', async () => {
    mockScheduler(502, { message: 'Internal server error' })
    const { status, data } = await schedulerWebhookFetch('/api/v1/campaigns/webhook/test', { method: 'POST', body: {} })
    expect(status).toBe(502)
    expect(data.error).toBe('Internal server error')
  })
})
