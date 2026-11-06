import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Parity phase 3 step 1: drill, export, field catalog and the campaign call-log routes read a customer-held project through its plane only.
const PROJECT = '99999999-9999-4999-8999-999999999999'
const AGENT = '11111111-1111-4111-8111-111111111111'
const state = vi.hoisted(() => ({ held: true }))
const pypeTouched = vi.hoisted(() => ({ n: 0 }))

vi.mock('server-only', () => ({}))
vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: 'u1' }) }))
vi.mock('@/lib/getProjectRoleForApi', () => ({ getProjectRoleForApi: async () => ({ role: 'admin' }) }))
vi.mock('@/server/analytics/db', () => ({ runQuery: async () => { pypeTouched.n++; throw new Error('Pype SQL must not run') }, isTimeout: () => false }))
vi.mock('@/lib/supabase-server', () => ({
  createServiceRoleClient: () => ({
    from: (t: string) => {
      if (t === 'pype_analytics_fields') pypeTouched.n++
      const chain: any = { select: () => chain, eq: () => chain, in: () => chain, order: () => chain, maybeSingle: async () => ({ data: { project_id: PROJECT } }), then: (r: any) => r({ data: [], error: null }) }
      return chain
    },
  }),
}))
vi.mock('@/server/analytics/context', async (orig) => ({
  ...(await orig<typeof import('@/server/analytics/context')>()),
  resolveScope: async () => ({ ctx: { projectId: PROJECT, agentIds: [AGENT], deniedFields: new Set(), tz: 'Asia/Kolkata', maxDays: 400, now: new Date('2026-11-06T06:00:00Z') }, customerHeld: state.held, downloadDisabled: false, role: 'admin', projectId: PROJECT }),
  resolveAnalyticsContext: async () => ({ ctx: { projectId: PROJECT, agentIds: [AGENT], deniedFields: new Set(), tz: 'Asia/Kolkata', maxDays: 400 }, agent: { id: AGENT, name: 'A', projectId: PROJECT, outcomeRanking: null, extractorPrompt: null }, role: 'admin', downloadDisabled: false, customerHeld: state.held }),
}))

import { POST as drillPOST } from '@/app/api/analytics/drill/route'
import { POST as exportPOST } from '@/app/api/analytics/export/route'
import { GET as fieldsGET } from '@/app/api/analytics/fields/route'
import { GET as countsGET } from '@/app/api/agents/[id]/call-logs/campaign/counts/route'
import { GET as contactGET } from '@/app/api/agents/[id]/call-logs/campaign/contact/route'
import { DestinationUnavailable } from '@/server/data-plane'
import { setDataPlaneResolverForTests } from '@/server/data-plane/resolver'
import { createFakePlane, type FakePlane } from '@/server/data-plane/testing/fakePlane'
import { clearCustomerRowsCache } from '@/server/analytics/customerQuery'

const call = (n: number, over: Record<string, unknown> = {}) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`, call_id: `c${n}`, agent_id: AGENT, customer_number: `+9199000000${n}`,
  call_started_at: `2026-11-0${n}T03:00:00`, call_ended_at: `2026-11-0${n}T03:01:00`, call_ended_reason: 'completed', wcall_event: 'call_ended', environment: 'prod',
  metadata: { campaignId: 'camp1', disposition: n % 2 ? 'Booked' : 'Other' }, ...over,
})
const post = (body: unknown) => ({ json: async () => body, url: 'http://x/api' }) as any

let customer: FakePlane
let planeError: Error | null
beforeEach(() => {
  state.held = true
  planeError = null
  pypeTouched.n = 0
  clearCustomerRowsCache()
  customer = createFakePlane({ call_logs: [call(1), call(2), call(3), call(4, { call_ended_reason: 'error' })] })
  setDataPlaneResolverForTests({ forProject: async () => { if (planeError) throw planeError; return customer }, isCustomerHeld: async () => true })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => setDataPlaneResolverForTests(null))

const SPEC = { spec_version: 1, agg: { fn: 'count' }, range: { days: 30 } }

describe('drill and export of a customer-held project', () => {
  it('drill filters on a JSON path from the plane, never Pype SQL', async () => {
    const res = await drillPOST(post({ agentId: AGENT, spec: SPEC, filters: [{ field: { col: 'metadata', path: ['disposition'] }, op: 'eq', value: 'Booked' }] }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.rows.map((r: any) => r.call_id)).toEqual(['c3', 'c1'])
    expect(pypeTouched.n).toBe(0)
  })

  it('export is a CSV page from the plane and follows the cursor', async () => {
    const res = await exportPOST(post({ agentId: AGENT, spec: SPEC, limit: 2 }))
    expect(res.status).toBe(200)
    expect(res.headers.get('X-Next-Cursor')).toBeTruthy()
    expect(await res.text()).toContain('c4')
  })

  it('a plane that cannot be used is a 503', async () => {
    planeError = new DestinationUnavailable('acme')
    expect((await drillPOST(post({ agentId: AGENT, spec: SPEC }))).status).toBe(503)
    expect(pypeTouched.n).toBe(0)
  })
})

describe('field catalog of a customer-held project', () => {
  it('is worked out from the plane and nothing is stored in Pype', async () => {
    const res = await fieldsGET({ nextUrl: new URL(`http://x/api/analytics/fields?agentId=${AGENT}&refresh=1`) } as any)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.fields.some((f: any) => f.col === 'metadata' && f.path.join('.') === 'disposition')).toBe(true)
    expect(pypeTouched.n).toBe(0)
  })
})

describe('campaign call-log routes', () => {
  const ctx = { params: Promise.resolve({ id: AGENT }) }
  it('counts and contact calls come from the project plane', async () => {
    const counts = await (await countsGET({ url: 'http://x/?campaignId=camp1' } as any, ctx as any)).json()
    expect(counts.counts['+91990000001']).toBe(1)
    const contact = await (await contactGET({ url: 'http://x/?campaignId=camp1&customerNumber=%2B91990000002' } as any, ctx as any)).json()
    expect(contact.data).toHaveLength(1)
    expect(customer.calls).toEqual(expect.arrayContaining(['campaignCallCounts', 'campaignContactCalls']))
  })
  it('an unusable route is a 503', async () => {
    planeError = new DestinationUnavailable('acme')
    expect((await countsGET({ url: 'http://x/?campaignId=camp1' } as any, ctx as any)).status).toBe(503)
  })
})
