import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// PE-408: QA tickets, DNC and audio through the data plane, plus the typed 501.
const state = vi.hoisted(() => ({ superAdmin: true as boolean, canManage: true }))
vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: 'u1' }),
  currentUser: async () => ({ emailAddresses: [{ emailAddress: 'qa@pypeai.com' }] }),
}))
vi.mock('@/lib/getProjectRoleForApi', () => ({ getProjectRoleForApi: async () => ({ role: 'admin', visibility: { org: { visibleAgentIds: null }, agent: { overview: {} } } }) }))
vi.mock('@/lib/dnc', async (orig) => ({
  ...(await orig<typeof import('@/lib/dnc')>()),
  getSuperAdminEmail: async () => (state.superAdmin ? 'admin@x.com' : null),
}))
vi.mock('@/server/qa/notify', () => ({ logQaEvent: vi.fn(), notifyQaStatusChange: vi.fn(), notifyQaTeam: vi.fn() }))
vi.mock('@/lib/supabase-server', () => ({
  // Control plane: agent a1 -> project p1; names for the DNC list.
  createServiceRoleClient: () => ({
    from: (table: string) => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        limit: () => chain,
        order: () => chain,
        maybeSingle: async () => ({ data: table === 'pype_voice_agents' ? { id: 'a1', name: 'Agent', display_name: null, project_id: 'p1' } : { name: 'x', slack_id: null } }),
        then: (res: any) => res({ data: table === 'pype_voice_projects' ? [{ id: 'p1', name: 'Acme' }] : table === 'qa_team_members' ? [{ id: 'm1' }] : [], error: null }),
      }
      return chain
    },
  }),
}))

import { GET as flagsGET } from '@/app/api/qa-audit/flags/route'
import { PATCH as flagPATCH } from '@/app/api/qa-audit/flags/[id]/route'
import { POST as commentPOST } from '@/app/api/qa-audit/flags/[id]/comments/route'
import { POST as dncPOST } from '@/app/api/dnc/route'
import { GET as dncList } from '@/app/api/dnc/list/route'
import { POST as dncCheck } from '@/app/api/dnc/check/route'
import { DELETE as dncDelete } from '@/app/api/dnc/[id]/route'
import { POST as audioPOST } from '@/app/api/audio/route'
import { setDataPlaneResolverForTests } from '@/server/data-plane/resolver'
import { customerHeldResponse } from '@/server/data-plane/customerHeld'
import { createFakePlane, type FakePlane } from '@/server/data-plane/testing/fakePlane'

const req = (body: unknown, url = 'http://x/api') => ({ json: async () => body, url, nextUrl: new URL(url) }) as any
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

let customer: FakePlane
let pype: FakePlane
let held: boolean
beforeEach(() => {
  state.superAdmin = true
  held = true
  customer = createFakePlane({
    tickets: [{ id: 't1', agent_id: 'a1', call_log_id: 'c1', status: 'pending', reason: 'bad', flagged_by_email: 'c@x.com', assignee_email: null }],
  })
  pype = createFakePlane()
  setDataPlaneResolverForTests({
    forProject: async () => customer,
    isCustomerHeld: async () => held,
    pype: () => pype,
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => setDataPlaneResolverForTests(null))

describe('qa-audit tickets come from the project plane', () => {
  it('lists tickets and counts from the customer destination', async () => {
    const res = await flagsGET(req({}, 'http://x/api/qa-audit/flags?agentId=a1'))
    const json = await res.json()
    expect(json.tickets).toHaveLength(1)
    expect(json.counts).toEqual({ pending: 1, in_review: 0, resolved: 0 })
    expect(pype.calls).toEqual([])
  })

  it('needs the agent hint for a ticket id, and the ticket must be that agent\'s', async () => {
    expect((await commentPOST(req({ body: 'hi' }), ctx('t1'))).status).toBe(400)
    customer.rows.get('tickets')![0].agent_id = 'other'
    expect((await commentPOST(req({ body: 'hi', agentId: 'a1' }), ctx('t1'))).status).toBe(404)
  })

  it('updates the ticket in the routed plane', async () => {
    const res = await flagPATCH(req({ agentId: 'a1', status: 'resolved', resolution_note: 'fixed' }), ctx('t1'))
    expect(res.status).toBe(200)
    expect(customer.rows.get('tickets')![0].status).toBe('resolved')
  })
})

describe('DNC: global in Pype, project and agent entries at the destination', () => {
  const add = (b: object) => dncPOST(req({ numbers: '9876543210', ...b }))

  it('a project entry goes to the customer plane, a global entry to Pype', async () => {
    expect((await add({ scope: 'project', project_id: 'p1' })).status).toBe(200)
    expect(customer.rows.get('dnc')).toHaveLength(1)
    expect(pype.calls).not.toContain('addEntries')
    expect((await add({ scope: 'global' })).status).toBe(200)
    expect(pype.rows.get('dnc')).toHaveLength(1)
  })

  it('an agent entry belongs to the agent\'s project plane', async () => {
    await add({ scope: 'agent', agent_id: 'a1' })
    expect(customer.rows.get('dnc')![0]).toMatchObject({ scope: 'agent', project_id: 'p1' })
  })

  it('a Pype-held project keeps everything in Pype', async () => {
    held = false
    setDataPlaneResolverForTests({ forProject: async () => customer, isCustomerHeld: async () => false, pype: () => pype })
    await add({ scope: 'project', project_id: 'p1' })
    expect(pype.rows.get('dnc')).toHaveLength(1)
    expect(customer.calls).toEqual([])
  })

  it('check blocks on a global entry (Pype) or a project entry (customer)', async () => {
    pype.rows.set('dnc', [{ id: 'g', is_active: true, phone_e164: '+919876543210', scope: 'global' }])
    customer.rows.set('dnc', [{ id: 'p', is_active: true, phone_e164: '+919111111111', scope: 'project', project_id: 'p1' }])
    const res = await dncCheck(req({ numbers: ['9876543210', '9111111111', '9222222222'], project_id: 'p1' }))
    expect(res.status).toBe(406)
    expect((await res.json()).blocked_numbers).toEqual(['+919876543210', '+919111111111'])
  })

  it('lists both, with project names, and removes by hint', async () => {
    pype.rows.set('dnc', [{ id: 'g', is_active: true, phone_e164: '+91', scope: 'global', created_at: '2026-01-01' }])
    customer.rows.set('dnc', [{ id: 'p', is_active: true, phone_e164: '+92', scope: 'project', project_id: 'p1', created_at: '2026-01-02' }])
    const json = await (await dncList(req({}, 'http://x/api/dnc/list?project_id=p1'))).json()
    expect(json.entries.map((e: any) => e.id)).toEqual(['p', 'g'])
    expect(json.entries[0].project_name).toBe('Acme')
    expect(json.customer_held).toBe(true)

    await dncDelete(req({}, 'http://x/api/dnc/p?project_id=p1'), ctx('p'))
    expect(customer.rows.get('dnc')![0].is_active).toBe(false)
    await dncDelete(req({}, 'http://x/api/dnc/g'), ctx('g'))
    expect(pype.rows.get('dnc')![0].is_active).toBe(false)
  })

  it('is superadmin only', async () => {
    state.superAdmin = false
    expect((await dncList(req({}))).status).toBe(403)
  })
})

describe('audio', () => {
  it('signs a customer-held recording through the storage port', async () => {
    const res = await audioPOST(req({ s3Key: 'rec/a1/c1.ogg', agentId: 'a1' }))
    expect(await res.json()).toEqual({ url: 'https://fake.test/rec/a1/c1.ogg', routed: true })
    expect(customer.calls).toContain('signRecordingUrl')
  })

  it('keeps the S3 path for a Pype-held project (no signer call)', async () => {
    held = false
    setDataPlaneResolverForTests({ forProject: async () => customer, isCustomerHeld: async () => false })
    const res = await audioPOST(req({ agentId: 'a1' }))
    expect(res.status).toBe(400) // no key: it fell through to today's S3 handler
    expect(customer.calls).toEqual([])
  })
})

describe('typed 501 for customer-held projects', () => {
  it('answers 501 not_available for a customer-held project', async () => {
    const res = await customerHeldResponse('p1')
    expect(res!.status).toBe(501)
    expect(await res!.json()).toMatchObject({ error: 'not_available', code: 'not_available_for_customer_held_project' })
  })

  it('is null for a Pype project, and 503 when the registry cannot be read', async () => {
    held = false
    expect(await customerHeldResponse('p1')).toBeNull()
    const { DestinationUnavailable } = await import('@/server/data-plane/errors')
    setDataPlaneResolverForTests({ forProject: async () => customer, isCustomerHeld: async () => { throw new DestinationUnavailable(undefined) } })
    expect((await customerHeldResponse('p1'))!.status).toBe(503)
  })
})
