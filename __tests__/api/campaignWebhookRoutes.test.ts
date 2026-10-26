import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@clerk/nextjs/server', () => ({
  currentUser: vi.fn(async () => ({ id: 'user_1', emailAddresses: [{ emailAddress: 'ops@pype.ai' }] })),
  auth: vi.fn(async () => ({ userId: 'user_1' })),
}))
vi.mock('@/lib/getProjectRoleForApi', () => ({ getProjectRoleForApi: vi.fn() }))
vi.mock('@/lib/serviceToken', () => ({ mintServiceToken: () => 'svc' }))

import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { GET, PUT } from '@/app/api/campaigns/[campaignId]/webhook/route'
import { POST as SEND } from '@/app/api/campaigns/[campaignId]/webhook/send/route'
import { POST as TEST } from '@/app/api/campaigns/webhook/test/route'

const summary = { campaignId: 'c1', projectId: 'p1', campaignStatus: 'running', webhooks: [] }
const params = { params: Promise.resolve({ campaignId: 'c1' }) }
const req = (body?: unknown) => new NextRequest('http://localhost/x', { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })

// Scheduler fake: answers the authorize GET, records every other call.
let calls: { url: string; method: string; body: any }[] = []
beforeEach(() => {
  process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN = 'https://scheduler.example.com/dev'
  calls = []
  vi.mocked(getProjectRoleForApi).mockResolvedValue({ role: 'admin' } as any)
  globalThis.fetch = vi.fn(async (url: any, init: any) => {
    calls.push({ url: String(url), method: init.method, body: init.body ? JSON.parse(init.body) : undefined })
    return new Response(JSON.stringify({ success: true, webhook: summary }), { status: 200 })
  }) as any
})
const forwarded = () => calls.filter((c) => c.method !== 'GET')

describe('campaign webhook proxy routes', () => {
  it('GET returns the summary for a project member', async () => {
    const res = await GET(req(), params)
    expect(res.status).toBe(200)
    expect((await res.json()).webhook).toEqual(summary)
  })

  it('PUT forwards only action, id, url and token', async () => {
    await PUT(req({ action: 'add', url: 'https://a.example.com', token: 't', status: 'sent', sentAt: 'x' }), params)
    expect(forwarded()).toEqual([{ url: 'https://scheduler.example.com/dev/api/v1/campaigns/c1/webhook', method: 'PUT', body: { action: 'add', url: 'https://a.example.com', token: 't' } }])
  })

  it('send forwards id, mode, the claim the user saw, and who clicked (from the session, not the body)', async () => {
    await SEND(req({ id: 'w1', mode: 'force', expectClaimId: 'k1', by: 'spoofed@evil.com' }), params)
    expect(forwarded()[0]).toMatchObject({
      url: 'https://scheduler.example.com/dev/api/v1/campaigns/c1/webhook/send',
      body: { id: 'w1', mode: 'force', expectClaimId: 'k1', by: 'ops@pype.ai' },
    })
  })

  it('send: any mode other than force is a normal send', async () => {
    await SEND(req({ id: 'w1', mode: 'anything' }), params)
    expect(forwarded()[0].body.mode).toBe('send')
  })

  it('viewer cannot add, edit, delete or send; nothing reaches the scheduler', async () => {
    vi.mocked(getProjectRoleForApi).mockResolvedValue({ role: 'viewer' } as any)
    expect((await PUT(req({ action: 'remove', id: 'w1' }), params)).status).toBe(403)
    expect((await SEND(req({ id: 'w1' }), params)).status).toBe(403)
    expect(forwarded()).toHaveLength(0)
  })

  it('non-member gets 404 everywhere', async () => {
    vi.mocked(getProjectRoleForApi).mockResolvedValue(null)
    expect((await GET(req(), params)).status).toBe(404)
    expect((await SEND(req({ id: 'w1' }), params)).status).toBe(404)
    expect(forwarded()).toHaveLength(0)
  })

  it('test: forwards the webhook id so the saved token is used for its saved URL only', async () => {
    await TEST(req({ campaignId: 'c1', webhookId: 'w1', url: 'https://a.example.com' }))
    expect(forwarded()[0]).toMatchObject({ url: 'https://scheduler.example.com/dev/api/v1/campaigns/webhook/test', body: { campaignId: 'c1', webhookId: 'w1', url: 'https://a.example.com' } })
  })

  it('test from the create page (no campaign yet) needs a non-viewer project role', async () => {
    vi.mocked(getProjectRoleForApi).mockResolvedValue({ role: 'viewer' } as any)
    expect((await TEST(req({ projectId: 'p1', url: 'https://a.example.com' }))).status).toBe(403)
    expect((await TEST(req({ url: 'https://a.example.com' }))).status).toBe(403)
    expect(forwarded()).toHaveLength(0)
  })

  it('invalid JSON → 400 and nothing forwarded', async () => {
    const bad = new NextRequest('http://localhost/x', { method: 'PUT', body: '{bad' })
    expect((await PUT(bad, params)).status).toBe(400)
    expect(forwarded()).toHaveLength(0)
  })
})
