import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Routes converted to the data plane, exercised against the in-memory fake plane.
vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: 'u1' }),
  currentUser: async () => ({ emailAddresses: [{ emailAddress: 'u@x.com' }] }),
}))
const role = vi.fn(async () => ({ role: 'admin' }) as any)
vi.mock('@/lib/getProjectRoleForApi', () => ({ getProjectRoleForApi: (...a: unknown[]) => role(...(a as [])) }))
vi.mock('@/server/promptForge/access', () => ({ requireForgeUser: async () => ({ user: {} }) }))
vi.mock('@/server/qa/notify', () => ({ logQaEvent: vi.fn(), notifyQaTeam: vi.fn() }))
vi.mock('@/lib/supabase-server', () => ({
  // Control plane: agent a1 belongs to project p1.
  createServiceRoleClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { project_id: 'p1', name: 'Agent', display_name: null } }) }) }),
    }),
  }),
}))

import { PATCH as tagsPATCH } from '@/app/api/logs/call-logs/[id]/tags/route'
import { PATCH as flagPATCH } from '@/app/api/logs/call-logs/[id]/flag/route'
import { GET as countGET } from '@/app/api/agents/[id]/call-logs/count/route'
import { GET as turnsGET } from '@/app/api/prompt-forge/turns/route'
import { setDataPlaneResolverForTests } from '@/server/data-plane/resolver'
import { RouteInMaintenance } from '@/server/data-plane/errors'
import { createFakePlane, type FakePlane } from '@/server/data-plane/testing/fakePlane'

const json = (body: unknown) => ({ json: async () => body, url: 'http://x/api' }) as any
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })

let routed: FakePlane
let pype: FakePlane
beforeEach(() => {
  routed = createFakePlane({
    call_logs: [{ id: 'c1', agent_id: 'a1', transcription_metrics: { keep: 1 } }],
    turns: [{ id: 't1', session_id: 'c1', user_transcript: 'hi', agent_response: 'hello' }],
  })
  pype = createFakePlane()
  // p1 is routed to a customer destination; any other project would be Pype.
  setDataPlaneResolverForTests({ forProject: async (p) => (p === 'p1' ? routed : pype) })
  role.mockResolvedValue({ role: 'admin' })
})
afterEach(() => setDataPlaneResolverForTests(null))

describe('tags route', () => {
  it('needs the agent hint', async () => {
    const res = await tagsPATCH(json({ tags: ['a'] }), ctx('c1'))
    expect(res.status).toBe(400)
  })

  it('merges tags into the routed plane and never touches Pype', async () => {
    const res = await tagsPATCH(json({ tags: [' vip ', ''], agent_id: 'a1' }), ctx('c1'))
    expect(res.status).toBe(200)
    expect(routed.rows.get('call_logs')![0].transcription_metrics).toEqual({ keep: 1, tags: ['vip'] })
    expect(pype.calls).toEqual([])
  })

  it('refuses a call that belongs to another agent', async () => {
    const res = await tagsPATCH(json({ tags: ['a'], agent_id: 'a1' }), ctx('c-other'))
    expect(res.status).toBe(404)
  })

  it('refuses a caller without project access', async () => {
    role.mockResolvedValue(null)
    expect((await tagsPATCH(json({ tags: ['a'], agent_id: 'a1' }), ctx('c1'))).status).toBe(403)
  })

  it('answers 503 when the route is paused, with no fallback to Pype', async () => {
    setDataPlaneResolverForTests({ forProject: async () => { throw new RouteInMaintenance('p1', 'call_data') } })
    const res = await tagsPATCH(json({ tags: ['a'], agent_id: 'a1' }), ctx('c1'))
    expect(res.status).toBe(503)
    expect(pype.calls).toEqual([])
  })
})

describe('flag route', () => {
  it('writes the flag and its QA ticket to the routed plane', async () => {
    const res = await flagPATCH(json({ action: 'add', text: 'bad call', agent_id: 'a1' }), ctx('c1'))
    expect(res.status).toBe(200)
    expect(routed.rows.get('call_logs')![0].transcription_metrics.flag).toHaveLength(1)
    expect(routed.rows.get('tickets')).toHaveLength(1)
    expect(pype.calls).toEqual([])
  })

  it('needs the agent hint', async () => {
    expect((await flagPATCH(json({ action: 'add', text: 'x' }), ctx('c1'))).status).toBe(400)
  })
})

describe('count route', () => {
  it('counts in the routed plane', async () => {
    const res = await countGET({ url: 'http://x/api?dateFrom=2026-01-01' } as any, ctx('a1'))
    expect(await res.json()).toEqual({ count: 1 })
    expect(pype.calls).toEqual([])
  })
})

describe('prompt-forge turns route', () => {
  const get = (q: string) => turnsGET({ url: `http://x/api/prompt-forge/turns?${q}` } as any)

  it('needs the agent hint', async () => {
    expect((await get('session_id=c1')).status).toBe(400)
  })

  it('reads turns from the routed plane', async () => {
    const res = await get('session_id=c1&agent_id=a1')
    expect(await res.json()).toEqual([{ id: 't1', session_id: 'c1', user_transcript: 'hi', agent_response: 'hello' }])
  })

  it('404s for a call that is not the hinted agent\'s', async () => {
    expect((await get('session_id=nope&agent_id=a1')).status).toBe(404)
  })
})
