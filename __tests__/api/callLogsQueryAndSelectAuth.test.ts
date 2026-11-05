import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: 'u1' }),
  currentUser: async () => ({ emailAddresses: [{ emailAddress: 'u@x.com' }] }),
}))
const role = vi.fn(async (_p?: string) => ({ role: 'admin', downloadDisabled: false }) as any)
vi.mock('@/lib/getProjectRoleForApi', () => ({ getProjectRoleForApi: (p: string) => role(p) }))
vi.mock('@/lib/agentCallLogSettingsStore', () => ({
  resolveColumnAccessForRequest: async () => ({ isSuperAdmin: false, disallowedColumns: new Set(['customer_number']) }),
}))
vi.mock('@/lib/supabase-server', () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      select: () => ({
        eq: (_c: string, id: string) => ({
          maybeSingle: async () => ({ data: id === 'a1' || id === '11111111-1111-4111-8111-111111111111' ? { project_id: 'p1', call_log_settings: null } : null, error: null }),
        }),
      }),
    }),
  }),
}))

import { POST as agentQuery } from '@/app/api/agents/[id]/call-logs/query/route'
import { POST as projectQuery } from '@/app/api/projects/[id]/call-logs/query/route'
import { authorizeTableSelect, isAllowedTable } from '@/lib/supabase-select-auth'
import { setDataPlaneResolverForTests } from '@/server/data-plane/resolver'
import { createFakePlane } from '@/server/data-plane/testing/fakePlane'

const A1 = '11111111-1111-4111-8111-111111111111'
const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const body = (b: unknown) => ({ json: async () => b }) as any

describe('call-logs/query (agent and project routes share one handler)', () => {
  beforeEach(() => {
    const plane = createFakePlane({ call_logs: [{ id: 'c1', agent_id: 'a1', customer_number: '+1555' }] })
    setDataPlaneResolverForTests({ forProject: async () => plane })
    role.mockResolvedValue({ role: 'admin', downloadDisabled: false })
  })
  afterEach(() => setDataPlaneResolverForTests(null))

  it.each([
    ['agent route', () => agentQuery(body({ p_agent_id: 'a1' }), ctx('a1'))],
    ['project route', () => projectQuery(body({ p_agent_id: 'a1' }), ctx('p1'))],
  ])('%s returns rows with hidden columns stripped', async (_n, call) => {
    const res = await call()
    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual([{ id: 'c1', agent_id: 'a1' }])
  })

  it('agent route: p_agent_id must match the URL', async () => {
    expect((await agentQuery(body({ p_agent_id: 'other' }), ctx('a1'))).status).toBe(400)
  })

  it('project route: access first, then p_agent_id, then the agent must be in the project', async () => {
    role.mockResolvedValueOnce(null)
    expect((await projectQuery(body({ p_agent_id: 'a1' }), ctx('p1'))).status).toBe(403)
    expect((await projectQuery(body({}), ctx('p1'))).status).toBe(400)
    expect((await projectQuery(body({ p_agent_id: 'a1' }), ctx('p-other'))).status).toBe(403)
  })

  it('viewer rows go through tag redaction and downloads can be disabled per project', async () => {
    role.mockResolvedValue({ role: 'viewer', downloadDisabled: true })
    expect((await agentQuery(body({ p_agent_id: 'a1', p_purpose: 'download' }), ctx('a1'))).status).toBe(403)
  })
})

describe('supabase-select auth: call data needs an agent or project hint', () => {
  beforeEach(() => role.mockResolvedValue({ role: 'admin' }))

  it('allows call-data and control-plane tables only', () => {
    expect(isAllowedTable('pype_voice_call_logs')).toBe(true)
    expect(isAllowedTable('pype_voice_agents')).toBe(true)
    expect(isAllowedTable('pype_voice_dnc_list')).toBe(false)
  })

  it('refuses a call lookup by row id alone (the row lives in the data plane)', async () => {
    const res = await authorizeTableSelect('pype_voice_call_logs', [{ column: 'id', operator: 'eq', value: A1 }])
    expect(res.ok).toBe(false)
    if (!res.ok) expect(await res.response.json()).toEqual({ error: 'Call data needs an agent or project hint' })
  })

  it('accepts an agent hint and reports its project', async () => {
    const res = await authorizeTableSelect('pype_voice_call_logs', [], { agentId: A1 })
    expect(res).toMatchObject({ ok: true, agentId: A1, projectId: 'p1' })
  })

  it('accepts an agent_id equality filter', async () => {
    const res = await authorizeTableSelect('pype_voice_call_logs', [{ column: 'agent_id', operator: 'eq', value: A1 }])
    expect(res).toMatchObject({ ok: true, agentId: A1, projectId: 'p1' })
  })

  it('accepts a project hint', async () => {
    const res = await authorizeTableSelect('pype_voice_call_logs', [], { projectId: '22222222-2222-4222-8222-222222222222' })
    expect(res).toMatchObject({ ok: true, projectId: '22222222-2222-4222-8222-222222222222' })
  })

  it('denies a hinted project the caller cannot see', async () => {
    role.mockResolvedValue(null as any)
    const res = await authorizeTableSelect('pype_voice_call_logs', [], { projectId: '22222222-2222-4222-8222-222222222222' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(403)
  })
})
