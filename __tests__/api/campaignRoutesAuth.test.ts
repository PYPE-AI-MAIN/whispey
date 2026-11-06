import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }))
vi.mock('@/lib/serviceToken', () => ({ mintServiceToken: () => 'service-token' }))

import { auth } from '@clerk/nextjs/server'

const call = (route: string, method: string, body: unknown) =>
  import(`@/app/api/campaigns/${route}/route`).then((m) =>
    (m as any)[method](new Request('http://x/api', { method, body: JSON.stringify(body) })))

describe('campaign routes send the scheduler an authenticated request', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL_CAMPAIGN', 'https://scheduler.test/prod')
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    ;(auth as any).mockResolvedValue({ userId: 'user_1' })
  })
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

  it.each([
    ['create', 'POST', { campaignId: 'c1', projectId: 'p1', campaignName: 'n' }, 'https://scheduler.test/prod/api/v1/campaigns/upload-v2', 'POST'],
    ['pause', 'POST', { campaignId: 'c1' }, 'https://scheduler.test/prod/api/v1/campaigns/c1/pause', 'POST'],
    ['resume', 'POST', { campaignId: 'c1' }, 'https://scheduler.test/prod/api/v1/campaigns/c1/resume', 'POST'],
  ])('%s', async (route, method, body, url, upstreamMethod) => {
    const res = await call(route, method, body)
    expect(res.status).toBe(200)
    const [calledUrl, init] = fetchMock.mock.calls[0]
    expect(calledUrl).toBe(url)
    expect(init.method).toBe(upstreamMethod)
    expect(init.headers.Authorization).toBe('Bearer service-token')
    expect(init.headers['x-pype-user-id']).toBe('user_1')
  })

  it('a signed-out caller never reaches the scheduler', async () => {
    ;(auth as any).mockResolvedValue({ userId: null })
    const res = await call('pause', 'POST', { campaignId: 'c1' })
    expect(res.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
