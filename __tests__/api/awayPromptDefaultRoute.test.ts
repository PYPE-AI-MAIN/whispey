import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const authMock = vi.fn(async () => ({ userId: 'u1' }))
vi.mock('@clerk/nextjs/server', () => ({ auth: () => authMock() }))
vi.mock('@/lib/serviceToken', () => ({ serviceAuthHeaders: () => ({ 'x-api-key': 'k', Authorization: 'Bearer t' }) }))

import { GET } from '@/app/api/away-prompt/default/route'

const BACKEND = { prompt: 'You write ONE short spoken line.', max_chars: 6000 }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('GET /api/away-prompt/default', () => {
  const realFetch = globalThis.fetch
  beforeEach(() => {
    authMock.mockResolvedValue({ userId: 'u1' })
    process.env.PYPEAI_API_URL = 'http://backend.test'
  })
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('rejects signed-out callers without touching the backend', async () => {
    authMock.mockResolvedValue({ userId: null } as any)
    globalThis.fetch = vi.fn() as any
    const res = await GET()
    expect(res.status).toBe(401)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('passes the backend default through, with service auth', async () => {
    const fetchMock = vi.fn(async () => json(BACKEND))
    globalThis.fetch = fetchMock as any
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(BACKEND)
    const [url, init] = fetchMock.mock.calls[0] as any[]
    expect(url).toBe('http://backend.test/away_message/default_prompt')
    expect(init.headers.Authorization).toBe('Bearer t')
  })

  it.each([
    ['a backend error', () => json({ detail: 'boom' }, 500)],
    ['a malformed body', () => json({ prompt: 5 })],
    ['a non-JSON body', () => new Response('<html>', { status: 200 })],
  ])('answers 502 for %s', async (_name, make) => {
    globalThis.fetch = vi.fn(async () => make()) as any
    const res = await GET()
    expect(res.status).toBe(502)
    expect((await res.json()).error).toBeTruthy()
  })

  it('answers 502 when the backend is unreachable', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } })
    }) as any
    const res = await GET()
    expect(res.status).toBe(502)
  })
})
