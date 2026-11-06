import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const authMock = vi.fn(async () => ({ userId: 'u1' }) as any)
vi.mock('@clerk/nextjs/server', () => ({ auth: () => authMock() }))
vi.mock('@/lib/serviceToken', () => ({ mintServiceToken: () => 'svc-token' }))
const role = vi.fn(async (_p?: string) => ({ role: 'admin' }) as any)
vi.mock('@/lib/getProjectRoleForApi', () => ({ getProjectRoleForApi: (p: string) => role(p) }))

import { GET as list } from '@/app/api/campaigns/list/route'
import { GET as contacts } from '@/app/api/campaigns/contacts/route'
import { GET as counts } from '@/app/api/campaigns/counts/route'
import { GET as importStatus } from '@/app/api/campaigns/import-status/route'
import { GET as location } from '@/app/api/campaigns/location/route'
import { POST as upload } from '@/app/api/campaigns/upload-file/route'
import { setDataPlaneResolverForTests } from '@/server/data-plane/resolver'

const req = (path: string, init: any = {}) => ({ url: `http://x${path}`, text: async () => init.body ?? '', ...init }) as any
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('campaign scheduler routes', () => {
  const realFetch = globalThis.fetch
  const realBase = process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN
  let fetchMock: ReturnType<typeof vi.fn>
  const lastCall = () => fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit]

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN = 'https://sched.test/dev'
    authMock.mockResolvedValue({ userId: 'u1' })
    role.mockResolvedValue({ role: 'admin' })
    fetchMock = vi.fn(async () => json({ ok: true }))
    globalThis.fetch = fetchMock as any
  })
  afterEach(() => {
    globalThis.fetch = realFetch
    if (realBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN
    else process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN = realBase
    setDataPlaneResolverForTests(null)
  })

  it('forwards the caller identity to the scheduler', async () => {
    await list(req('/api/campaigns/list?projectId=p1&page=2&limit=5'))
    const [url, init] = lastCall()
    expect(url).toBe('https://sched.test/dev/api/v1/projects/p1/campaigns?page=2&limit=5')
    const h = init.headers as Record<string, string>
    expect(h.Authorization).toBe('Bearer svc-token')
    expect(h['x-pype-user-id']).toBe('u1')
    expect(h['x-pype-project-id']).toBe('p1')
  })

  it.each([
    ['list', () => list(req('/api/campaigns/list?projectId=p1'))],
    ['contacts', () => contacts(req('/api/campaigns/contacts?campaignId=c1'))],
    ['counts', () => counts(req('/api/campaigns/counts?projectId=p1&ids=a'))],
    ['upload', () => upload(req('/api/campaigns/upload-file?campaignId=c1', { body: 'phone\n+1' }))],
  ])('%s: signed-out callers never reach the scheduler', async (_n, call) => {
    authMock.mockResolvedValue({ userId: null })
    expect((await call()).status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('list and counts check project access', async () => {
    role.mockResolvedValue(null)
    expect((await list(req('/api/campaigns/list?projectId=p1'))).status).toBe(403)
    expect((await counts(req('/api/campaigns/counts?projectId=p1&ids=a'))).status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('contacts: passes limit, lastKey and a working status filter; "all" sends none', async () => {
    await contacts(req('/api/campaigns/contacts?campaignId=c1&limit=100&lastKey=k%201&status=calling'))
    let u = new URL(lastCall()[0])
    expect(u.pathname).toBe('/dev/api/v1/campaigns/c1/contacts')
    expect(Object.fromEntries(u.searchParams)).toEqual({ limit: '100', lastKey: 'k 1', status: 'calling' })
    await contacts(req('/api/campaigns/contacts?campaignId=c1&status=all'))
    u = new URL(lastCall()[0])
    expect(Object.fromEntries(u.searchParams)).toEqual({ limit: '50' })
  })

  it('contacts: cursor goes through, and { items, nextCursor } is answered in the old shape', async () => {
    fetchMock.mockResolvedValue(json({ items: [{ id: 1 }], nextCursor: 'n1' }))
    const res = await contacts(req('/api/campaigns/contacts?campaignId=c1&cursor=c0'))
    expect(new URL(lastCall()[0]).searchParams.get('cursor')).toBe('c0')
    expect(await res.json()).toMatchObject({ contacts: [{ id: 1 }], pagination: { hasMore: true, nextKey: 'n1' } })
  })

  it('contacts: the existing { contacts, pagination } shape is untouched', async () => {
    const body = { contacts: [{ id: 1 }], pagination: { hasMore: false, nextKey: null } }
    fetchMock.mockResolvedValue(json(body))
    expect(await (await contacts(req('/api/campaigns/contacts?campaignId=c1'))).json()).toEqual(body)
  })

  it('counts: one scheduler call for every id', async () => {
    fetchMock.mockResolvedValue(json({ counts: { a: { total: 3 } } }))
    const res = await counts(req('/api/campaigns/counts?projectId=p1&ids=a,b,c'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(new URL(lastCall()[0]).searchParams.get('ids')).toBe('a,b,c')
    expect(await res.json()).toEqual({ counts: { a: { total: 3 } } })
  })

  it('counts: an unsupported scheduler (404) is passed on so the UI can fall back', async () => {
    fetchMock.mockResolvedValue(json({ error: 'nope' }, 404))
    expect((await counts(req('/api/campaigns/counts?projectId=p1&ids=a'))).status).toBe(404)
  })

  it('upload: sends the CSV with identity and passes rejects through', async () => {
    fetchMock.mockResolvedValue(json({ s3FileKey: 'k', accepted: 1, rejected: 1, rejects: [{ row: 2, reason: 'bad phone' }] }))
    const res = await upload(req('/api/campaigns/upload-file?campaignId=c1', { body: 'phone\n+1' }))
    const [url, init] = lastCall()
    expect(url).toBe('https://sched.test/dev/api/v1/campaigns/upload-file?campaignId=c1')
    expect(init.body).toBe('phone\n+1')
    expect((init.headers as any)['Content-Type']).toBe('text/csv')
    expect((await res.json()).rejects).toEqual([{ row: 2, reason: 'bad phone' }])
  })

  it('import status proxies the scheduler', async () => {
    fetchMock.mockResolvedValue(json({ status: 'processing', processed: 5, total: 10 }))
    const res = await importStatus(req('/api/campaigns/import-status?campaignId=c1'))
    expect(new URL(lastCall()[0]).pathname).toBe('/dev/api/v1/campaigns/c1/import')
    expect((await res.json()).processed).toBe(5)
  })

  it('location: reports the data location and never breaks on a registry error', async () => {
    setDataPlaneResolverForTests({ campaignLocation: async () => 'customer' })
    expect(await (await location(req('/api/campaigns/location?projectId=p1'))).json()).toEqual({ location: 'customer', destination: null })
    setDataPlaneResolverForTests({ campaignLocation: async () => { throw new Error('registry down') } })
    expect(await (await location(req('/api/campaigns/location?projectId=p1'))).json()).toEqual({ location: 'pype' })
  })

  it('refuses to run without the scheduler base URL', async () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN
    expect((await list(req('/api/campaigns/list?projectId=p1'))).status).toBe(500)
  })
})
