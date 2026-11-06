import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.hoisted(() => { process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN = 'https://sched.test/dev' }) // read at import by the settings routes
const send = vi.hoisted(() => vi.fn(async (_c: unknown) => ({ Items: [], ScannedCount: 0, Count: 0 })))
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: class {} }))
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: () => ({ send }) },
  ScanCommand: class { constructor(public input: unknown) {} },
  BatchWriteCommand: class { constructor(public input: unknown) {} },
}))
vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: 'u1' }) }))
vi.mock('@/lib/serviceToken', () => ({ mintServiceToken: () => 'svc' }))
const role = vi.fn(async (_p?: string) => ({ role: 'admin' }) as any)
vi.mock('@/lib/getProjectRoleForApi', () => ({ getProjectRoleForApi: (p: string) => role(p) }))
const agentRow = { project_id: 'p-held' as string | null }
vi.mock('@/lib/supabase-server', () => ({
  createServiceRoleClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: agentRow }) }) }) }) }),
}))

import { GET as logsGET, POST as logsPOST, DELETE as logsDELETE } from '@/app/api/campaign-logs/route'
import { POST as legacyCampaign } from '@/app/api/campaign/route'
import { POST as legacyUpload } from '@/app/api/upload/route'
import { POST as pause } from '@/app/api/campaigns/pause/route'
import { POST as create } from '@/app/api/campaigns/create/route'
import { GET as contacts } from '@/app/api/campaigns/contacts/route'
import { GET as location } from '@/app/api/campaigns/location/route'
import { PUT as webhookPUT } from '@/app/api/campaigns/[campaignId]/webhook/route'
import { PUT as projectSettingsPUT } from '@/app/api/projects/[id]/callback-settings/route'
import { PUT as agentSettingsPUT } from '@/app/api/agents/[id]/callback-settings/route'
import { DataPlaneError, DestinationUnavailable } from '@/server/data-plane'
import { setDataPlaneResolverForTests } from '@/server/data-plane/resolver'
import { schedulerErrorMessage } from '@/utils/campaigns/constants'

const SAMUNNATI = '371c4bbb-76db-4c61-9926-bd75726a1cda'
const held = new Set<string>()
let registryDown = false
const plane = () => { throw new Error('plane not used') }

const get = (path: string) => new NextRequest(`http://x${path}`)
const jsonReq = (path: string, method: string, body: unknown) => new NextRequest(`http://x${path}`, { method, body: JSON.stringify(body) })
const formReq = (fields: Record<string, string>) => {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  fd.append('file', new File(['a'], 'a.csv'))
  fd.append('csv_file', new File(['a'], 'a.csv'))
  return { formData: async () => fd } as any
}

describe('customer-held projects never reach the Pype-only campaign paths', () => {
  const realFetch = globalThis.fetch
  let calls: { url: string; method?: string; body?: any }[]
  let answer: () => Response
  beforeEach(() => {
    held.clear(); registryDown = false; send.mockClear(); calls = []
    process.env.NEXT_PUBLIC_API_BASE_URL_CAMPAIGN = 'https://sched.test/dev'
    answer = () => new Response(JSON.stringify({ ok: true }), { status: 200 })
    globalThis.fetch = vi.fn(async (url: any, init: any) => {
      calls.push({ url: String(url), method: init?.method, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined })
      return answer()
    }) as any
    setDataPlaneResolverForTests({
      forProject: plane as any,
      isCustomerHeld: async (id: string) => { if (registryDown) throw new DestinationUnavailable(undefined, 'registry down'); return held.has(id) },
      campaignLocation: async (id: string) => (held.has(id) ? 'customer' : 'pype'),
      campaignDestinationName: async (id: string) => (held.has(id) ? 'sagitec-azure' : null),
    })
  })
  afterEach(() => { globalThis.fetch = realFetch; setDataPlaneResolverForTests(null) })

  it('/api/campaign-logs: typed 501, no Dynamo scan, for GET, POST and DELETE (even for the Samunnati id)', async () => {
    held.add(SAMUNNATI)
    for (const res of [
      await logsGET(get(`/api/campaign-logs?project_id=${SAMUNNATI}`)),
      await logsPOST(jsonReq('/api/campaign-logs', 'POST', { projectId: SAMUNNATI })),
      await logsDELETE(get(`/api/campaign-logs?project_id=${SAMUNNATI}&confirm=DELETE_ALL_CAMPAIGN_LOGS`)),
    ]) {
      expect(res.status).toBe(501)
      expect(await res.json()).toMatchObject({ code: 'not_available_for_customer_held_project' })
    }
    expect(send).not.toHaveBeenCalled()
  })

  it('/api/campaign-logs: an unreadable registry is a 503, not a Pype read', async () => {
    registryDown = true
    const res = await logsGET(get(`/api/campaign-logs?project_id=${SAMUNNATI}`))
    expect(res.status).toBe(503)
    expect(send).not.toHaveBeenCalled()
  })

  it('/api/campaign-logs: a Pype project behaves as before (scan for the enhanced project, 403 for others, 400 without id)', async () => {
    expect((await logsGET(get(`/api/campaign-logs?project_id=${SAMUNNATI}`))).status).toBe(200)
    expect(send).toHaveBeenCalled()
    send.mockClear()
    expect((await logsGET(get('/api/campaign-logs?project_id=other'))).status).toBe(403)
    expect((await logsPOST(jsonReq('/api/campaign-logs', 'POST', { projectId: 'other' }))).status).toBe(403)
    expect((await logsGET(get('/api/campaign-logs'))).status).toBe(400)
    expect(send).not.toHaveBeenCalled()
  })

  it('the legacy CSV paths refuse a customer-held project before touching S3', async () => {
    held.add('p-held')
    expect((await legacyCampaign(formReq({ project_id: 'p-held', start_date: 'a', end_date: 'b', retry_config: '{}' }))).status).toBe(501)
    expect((await legacyUpload(formReq({ project_id: 'p-held' }))).status).toBe(501)
    expect(calls).toEqual([])
    expect((await legacyUpload(formReq({ project_id: 'p-pype' }))).status).toBe(403) // unchanged for Pype
  })

  it('forwards the scheduler error code and a readable message', async () => {
    answer = () => new Response(JSON.stringify({ error: 'x', code: 'secret_not_storable' }), { status: 400 })
    const res = await create(jsonReq('/api/campaigns/create', 'POST', { campaignId: 'c', projectId: 'p-held', acefoneApiKey: 'k' }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.code).toBe('secret_not_storable')
    expect(body.error).toMatch(/Acefone/)

    answer = () => new Response(JSON.stringify({ error: 'Customer data store unavailable', code: 'destination_unavailable', retryable: true }), { status: 503 })
    const p = await pause(jsonReq('/api/campaigns/pause', 'POST', { campaignId: 'c1' }))
    expect(p.status).toBe(503)
    expect((await p.json()).error).toMatch(/Try again/)

    const c = await contacts(get('/api/campaigns/contacts?campaignId=c1'))
    expect(c.status).toBe(503)
    expect((await c.json()).code).toBe('destination_unavailable')
  })

  it('Pype errors keep their own text and have no code field', async () => {
    answer = () => new Response(JSON.stringify({ error: 'Campaign not found' }), { status: 404 })
    const p = await pause(jsonReq('/api/campaigns/pause', 'POST', { campaignId: 'c1' }))
    expect(await p.json()).toEqual({ error: 'Campaign not found' })
    expect(schedulerErrorMessage({ error: 'boom' }, 'fallback')).toBe('boom')
    expect(schedulerErrorMessage({}, 'fallback')).toBe('fallback')
  })

  it('webhook PUT forwards tokenRef and surfaces token_not_storable', async () => {
    const summary = { campaignId: 'c1', projectId: 'p-held', campaignStatus: 'running', webhooks: [] }
    answer = () => new Response(JSON.stringify({ success: true, webhook: summary }), { status: 200 })
    await webhookPUT(jsonReq('/x', 'PUT', { action: 'add', url: 'https://h.test', tokenRef: 'env:HOOK' }), { params: Promise.resolve({ campaignId: 'c1' }) })
    expect(calls.at(-1)?.body).toMatchObject({ action: 'add', tokenRef: 'env:HOOK' })
    let n = 0
    answer = () => (n++ === 0
      ? new Response(JSON.stringify({ success: true, webhook: summary }), { status: 200 })
      : new Response(JSON.stringify({ error: 'x', code: 'token_not_storable' }), { status: 400 }))
    const res = await webhookPUT(jsonReq('/x', 'PUT', { action: 'add', url: 'https://h.test', token: 't' }), { params: Promise.resolve({ campaignId: 'c1' }) })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/token reference/i)
  })

  it('callback settings carry the project id only for a customer-held project', async () => {
    const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
    await projectSettingsPUT(jsonReq('/x', 'PUT', { maxFutureDays: 5 }), ctx('p-pype'))
    expect(calls.at(-1)?.body).toEqual({ maxFutureDays: 5 })
    held.add('p-held')
    await projectSettingsPUT(jsonReq('/x', 'PUT', { maxFutureDays: 5 }), ctx('p-held'))
    expect(calls.at(-1)?.body).toEqual({ projectId: 'p-held', maxFutureDays: 5 })
    calls.length = 0
    await agentSettingsPUT(jsonReq('/x', 'PUT', { maxFutureDays: 5 }), ctx('a1'))
    expect(calls).toHaveLength(1)
    expect(calls[0].body).toEqual({ maxFutureDays: 5, projectId: 'p-held' })
    held.clear()
    calls.length = 0
    await agentSettingsPUT(jsonReq('/x', 'PUT', { maxFutureDays: 5 }), ctx('a1'))
    expect(calls).toHaveLength(1)
    expect(calls[0].body).toEqual({ maxFutureDays: 5 })
  })

  it('the location route names the destination for a customer-held project only', async () => {
    held.add('p-held')
    expect(await (await location(get('/api/campaigns/location?projectId=p-held'))).json()).toEqual({ location: 'customer', destination: 'sagitec-azure' })
    expect(await (await location(get('/api/campaigns/location?projectId=p-pype'))).json()).toEqual({ location: 'pype', destination: null })
  })
})

describe('DataPlaneError type', () => {
  it('is what the gate converts to 503', () => { expect(new DestinationUnavailable(undefined)).toBeInstanceOf(DataPlaneError) })
})
