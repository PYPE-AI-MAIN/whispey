import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/supabase-server', () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: { id: 'p1' }, error: null }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}))

import { POST } from '@/app/api/campaign/route'

function req() {
  const fd = new FormData()
  fd.set('project_id', 'p1')
  fd.set('start_date', '2026-01-01')
  fd.set('end_date', '2026-01-02')
  fd.set('start_time', '09:00')
  fd.set('end_time', '17:00')
  fd.set('csv_file', new File(['phone\n+1555'], 'c.csv', { type: 'text/csv' }))
  return { formData: async () => fd } as any
}

describe('POST /api/campaign cron schedule URL', () => {
  const realFetch = globalThis.fetch
  const realEnv = process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN
  beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}))
  afterEach(() => {
    globalThis.fetch = realFetch
    if (realEnv === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN
    else process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN = realEnv
    vi.restoreAllMocks()
  })

  it('calls the scheduler from NEXT_PUBLIC_API_BASE_URL_CAMPAIGN', async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN = 'https://sched.test'
    const fetchMock = vi.fn(async () => new Response('{"key":"k"}', { status: 200 }))
    globalThis.fetch = fetchMock as any
    const res = await POST(req())
    expect(res.status).toBe(201)
    const urls = fetchMock.mock.calls.map((c) => (c as any[])[0])
    expect(urls).toContain('https://sched.test/api/v1/cron/create-schedule')
    expect(urls.some((u) => String(u).includes('amazonaws.com'))).toBe(false)
  })

  it('fails closed (no India fallback) when the env var is unset', async () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = vi.fn(async () => new Response('{"key":"k"}', { status: 200 }))
    globalThis.fetch = fetchMock as any
    const res = await POST(req())
    expect(res.status).toBe(500)
    expect(fetchMock.mock.calls.some((c) => String((c as any[])[0]).includes('cron'))).toBe(false)
  })
})
