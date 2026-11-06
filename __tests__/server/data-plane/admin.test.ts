import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const admin = { email: 'boss@pypeai.com' as string | null }
vi.mock('@clerk/nextjs/server', () => ({
  auth: async () => ({ userId: admin.email ? 'u1' : null }),
  currentUser: async () => ({ emailAddresses: [{ emailAddress: admin.email }] }),
}))
vi.mock('@/lib/supabase-server', () => ({
  createServiceRoleClient: () => ({
    from: (t: string) => ({
      select: () => ({
        eq: (_c: string, id: string) => ({
          maybeSingle: async () => ({ data: t === 'pype_voice_projects' ? { name: 'Acme' } : null }),
          then: (r: any) => r({ data: [{ id: 'a1' }] }),
        }),
      }),
    }),
  }),
}))

import { GET as listGET, POST as createPOST } from '@/app/api/admin/data-destinations/route'
import { DELETE as destDELETE, PATCH as destPATCH } from '@/app/api/admin/data-destinations/[id]/route'
import { PUT as routePUT } from '@/app/api/admin/data-destinations/projects/[projectId]/route'
import { POST as statePOST } from '@/app/api/admin/data-destinations/projects/[projectId]/state/route'
import { POST as killPOST } from '@/app/api/admin/data-destinations/kill-switch/route'
import { GET as auditGET } from '@/app/api/admin/data-destinations/audit/route'
import { setRegistryStoreForTests } from '@/server/data-plane/admin/registryStore'
import { createFakeRegistry, type FakeRegistry } from '@/server/data-plane/testing/fakeRegistry'
import { setDataPlaneResolverForTests } from '@/server/data-plane/resolver'
import { createFakePlane } from '@/server/data-plane/testing/fakePlane'
import { checkRoutes, checkDetach, parseDestinationInput } from '@/server/data-plane/routingPolicy'
import { changeProjectRoutes } from '@/server/data-plane/admin/routeChange'

const req = (body?: unknown, url = 'http://x/api') => ({ json: async () => body, nextUrl: new URL(url) }) as any
const ARN = 'arn:aws:secretsmanager:us-east-2:123456789012:secret:pype/acme-key-AbCdEf'
let reg: FakeRegistry

beforeEach(() => {
  admin.email = 'boss@pypeai.com'
  process.env.PYPE_ADMINS = 'boss@pypeai.com'
  reg = createFakeRegistry()
  setRegistryStoreForTests(reg)
  setDataPlaneResolverForTests({ forProject: async () => createFakePlane() })
})
afterEach(() => { setRegistryStoreForTests(null); setDataPlaneResolverForTests(null) })

const dest = (over: object = {}) =>
  reg.createDestination({ name: 'acme', kind: 'postgrest', config: { base_url: 'https://a.test' }, secret_ref: ARN, ...over } as never, 'boss')

describe('routing policy', () => {
  const d = (id: string, kind: 'postgrest' | 'pype_supabase' = 'postgrest') => ({ id, kind })
  it('call_data, qa and dnc share one destination', () => {
    expect(checkRoutes([{ data_type: 'call_data', destination: d('1') }])).toMatch(/share one destination/)
    expect(checkRoutes(['call_data', 'qa', 'dnc'].map((t) => ({ data_type: t as any, destination: d('1') })))).toBeNull()
    expect(checkRoutes([{ data_type: 'call_data', destination: d('1') }, { data_type: 'qa', destination: d('2') }, { data_type: 'dnc', destination: d('1') }])).toMatch(/share one/)
  })
  it('campaigns in a customer destination need call data on the same one', () => {
    const unit = ['call_data', 'qa', 'dnc'].map((t) => ({ data_type: t as any, destination: d('1') }))
    expect(checkRoutes([{ data_type: 'campaigns', destination: d('1') }])).toMatch(/same destination/)
    expect(checkRoutes([...unit, { data_type: 'campaigns', destination: d('2') }])).toMatch(/same destination/)
    expect(checkRoutes([...unit, { data_type: 'campaigns', destination: d('1') }])).toBeNull()
    expect(checkRoutes([{ data_type: 'campaigns', destination: d('1', 'pype_supabase') }])).toBeNull()
  })
  it('a default country code looks like +NN', () => {
    expect(parseDestinationInput({ name: 'acme', kind: 'postgrest', config: { default_country_code: '+1' } })).toHaveProperty('value')
    expect(parseDestinationInput({ name: 'acme', kind: 'postgrest', config: { default_country_code: '91' } })).toHaveProperty('error')
  })
  it('a routed destination cannot be detached', () => {
    expect(checkDetach(2)).toMatch(/2 routes/)
    expect(checkDetach(0)).toBeNull()
  })
  it('secrets are references only', () => {
    expect(parseDestinationInput({ name: 'acme', kind: 'postgrest', secret_ref: '-----BEGIN PRIVATE KEY-----' })).toHaveProperty('error')
    expect(parseDestinationInput({ name: 'acme', kind: 'postgrest', config: { api_key: 'x' } })).toHaveProperty('error')
    expect(parseDestinationInput({ name: 'acme', kind: 'postgrest', secret_ref: ARN })).toHaveProperty('value')
  })
})

describe('admin API gate and secrets', () => {
  it('401 signed out, 403 for non-admins', async () => {
    admin.email = null
    expect((await listGET()).status).toBe(401)
    admin.email = 'someone@else.com'
    expect((await listGET()).status).toBe(403)
    expect((await createPOST(req({}))).status).toBe(403)
  })

  it('never returns the secret reference', async () => {
    const res = await createPOST(req({ name: 'acme', kind: 'postgrest', config: { base_url: 'https://a.test' }, secret_ref: ARN }))
    expect(res.status).toBe(201)
    const created = await res.json()
    expect(JSON.stringify(created)).not.toContain('secretsmanager')
    expect(created.destination.has_secret).toBe(true)
    const list = await (await listGET()).json()
    expect(JSON.stringify(list)).not.toContain('secretsmanager')
    expect(JSON.stringify(reg.audit)).not.toContain('secretsmanager')
  })

  it('refuses to delete or re-point a destination that has routes', async () => {
    const d = await dest()
    await reg.upsertRoute({ project_id: 'p1', data_type: 'call_data', destination_id: d.id, state: 'active', version: 1, effective_from: null })
    const ctx = { params: Promise.resolve({ id: d.id }) }
    expect((await destDELETE(req(), ctx)).status).toBe(409)
    expect((await destPATCH(req({ config: { base_url: 'https://other.test' } }), ctx)).status).toBe(409)
    expect((await destPATCH(req({ name: 'renamed' }), ctx)).status).toBe(200)
  })
})

describe('route change procedure', () => {
  const base = (d: string, over: Partial<Parameters<typeof changeProjectRoutes>[0]> = {}) => ({
    projectId: 'p1', actor: 'boss', dryRun: false, store: reg, sleep: async () => {}, drainTimeoutMs: 0, activeCalls: async () => 0,
    desired: ['call_data', 'qa', 'dnc'].map((t) => ({ data_type: t as any, destination_id: d })), ...over,
  })

  it('dry run changes nothing and records a dry-run audit entry', async () => {
    const d = await dest()
    const r = await changeProjectRoutes(base(d.id, { dryRun: true, activeCalls: async () => 3 }))
    expect(r).toMatchObject({ ok: true, dryRun: true, activeCalls: 3 })
    expect(reg.routes).toEqual([])
    expect(reg.audit.at(-1)).toMatchObject({ action: 'route_change', dry_run: true })
  })

  it('rejects a combination the policy forbids, and an unknown destination', async () => {
    const d = await dest()
    expect(await changeProjectRoutes(base(d.id, { desired: [{ data_type: 'call_data', destination_id: d.id }] }))).toMatchObject({ ok: false, status: 400 })
    expect(await changeProjectRoutes(base('nope'))).toMatchObject({ ok: false, status: 400 })
  })

  it('switches, bumps the version and resumes', async () => {
    const d = await dest()
    expect((await changeProjectRoutes(base(d.id))).ok).toBe(true)
    expect(reg.routes.map((r) => [r.data_type, r.state, r.version]).sort()).toEqual([['call_data', 'active', 1], ['dnc', 'active', 1], ['qa', 'active', 1]])
    const d2 = await dest({ name: 'acme2' })
    const sleeps: number[] = []
    await changeProjectRoutes(base(d2.id, { sleep: async (ms) => { sleeps.push(ms) } }))
    expect(reg.routes.every((r) => r.destination_id === d2.id && r.version === 2 && r.state === 'active')).toBe(true)
    expect(sleeps[0]).toBeGreaterThanOrEqual(15_000)
    expect(reg.audit.map((a) => a.action)).toContain('pause')
  })

  it('campaigns: refuses an unhealthy destination, notes that existing campaigns stay in Pype', async () => {
    const d = await dest()
    const withCampaigns = base(d.id, { dryRun: true, desired: ['call_data', 'qa', 'dnc', 'campaigns'].map((t) => ({ data_type: t as any, destination_id: d.id })) })
    expect(await changeProjectRoutes(withCampaigns)).toMatchObject({ ok: false, status: 400, error: expect.stringMatching(/healthy/) })
    await reg.recordHealth(d.id, 'healthy', {})
    const r = await changeProjectRoutes(withCampaigns)
    expect(r).toMatchObject({ ok: true })
    expect(r.ok && r.plan.at(-1)).toMatch(/existing campaigns stay in Pype/)
    expect(JSON.stringify(reg.audit.at(-1)?.after)).toMatch(/existing campaigns stay in Pype/)
    // call data alone: no campaigns note
    const plain = await changeProjectRoutes(base(d.id, { dryRun: true }))
    expect(plain.ok && plain.plan.join()).not.toMatch(/campaigns/)
    expect(reg.audit.at(-1)?.after).toBeInstanceOf(Array)
  })

  it('aborts and restores the old routes when calls are still active', async () => {
    const d = await dest()
    await changeProjectRoutes(base(d.id))
    const d2 = await dest({ name: 'acme2' })
    const r = await changeProjectRoutes(base(d2.id, { activeCalls: async () => 2 }))
    expect(r).toMatchObject({ ok: false, status: 409, activeCalls: 2 })
    expect(reg.routes.every((x) => x.destination_id === d.id && x.state === 'active')).toBe(true)
    expect(reg.audit.at(-1)?.action).toBe('route_change_aborted')
  })

  it('force applies despite active calls; null sends a project back to Pype', async () => {
    const d = await dest()
    expect((await changeProjectRoutes(base(d.id, { activeCalls: async () => 2, force: true }))).ok).toBe(true)
    await changeProjectRoutes(base(d.id, { desired: ['call_data', 'qa', 'dnc'].map((t) => ({ data_type: t as any, destination_id: null })) }))
    expect(reg.routes).toEqual([])
  })
})

describe('project routes API', () => {
  it('needs the project name to apply, but not for a dry run', async () => {
    const d = await dest()
    const routes = ['call_data', 'qa', 'dnc'].map((t) => ({ data_type: t, destination_id: d.id }))
    const ctx = { params: Promise.resolve({ projectId: 'p1' }) }
    expect((await routePUT(req({ routes }, 'http://x/api?dryRun=1'), ctx)).status).toBe(200)
    expect((await routePUT(req({ routes, confirm: 'wrong' }), ctx)).status).toBe(400)
    expect(reg.routes).toEqual([])
  })

  it('pause/resume and the kill switch only touch routes, and are audited', async () => {
    const d = await dest()
    const pg = await reg.createDestination({ name: 'pype', kind: 'pype_supabase', config: {}, secret_ref: null } as never, 'x')
    await reg.upsertRoute({ project_id: 'p1', data_type: 'call_data', destination_id: d.id, state: 'active', version: 1, effective_from: null })
    await reg.upsertRoute({ project_id: 'p2', data_type: 'campaigns', destination_id: pg.id, state: 'active', version: 1, effective_from: null })
    const ctx = { params: Promise.resolve({ projectId: 'p1' }) }
    await statePOST(req({ action: 'pause' }), ctx)
    expect(reg.routes.find((r) => r.project_id === 'p1')?.state).toBe('paused')
    await statePOST(req({ action: 'resume' }), ctx)
    const res = await killPOST(req({ action: 'pause' }))
    expect(await res.json()).toMatchObject({ routes: 1 })
    expect(reg.routes.find((r) => r.project_id === 'p2')?.state).toBe('active')
    expect((await auditGET(req(undefined, 'http://x/api?action=kill_switch_pause'))).status).toBe(200)
    expect(reg.audit.map((a) => a.action)).toEqual(expect.arrayContaining(['pause', 'resume', 'kill_switch_pause']))
  })
})
