import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DataPlaneResolver, REGISTRY_CACHE_MS, resolveSecret, type RegistryRoute, type RegistryDestination } from '@/server/data-plane/resolver'
import { DestinationIncompatible, DestinationUnavailable, RouteInMaintenance } from '@/server/data-plane/errors'
import { createFakePlane } from '@/server/data-plane/testing/fakePlane'

const dest = (over: Partial<RegistryDestination> = {}): RegistryDestination => ({
  id: 'd1', name: 'acme', kind: 'postgrest', config: { base_url: 'https://acme.test' },
  secret_ref: 'env:KEY', schema_version: 1, status: 'healthy', ...over,
})
const route = (data_type: RegistryRoute['data_type'], destination: RegistryDestination | null, over: Partial<RegistryRoute> = {}): RegistryRoute =>
  ({ data_type, state: 'active', version: 1, effective_from: null, destination, ...over })

function make(routes: RegistryRoute[] | Error) {
  const pype = createFakePlane()
  const customer = createFakePlane()
  const registry = vi.fn(async () => { if (routes instanceof Error) throw routes; return routes })
  let t = 1_000_000
  const postgrestPlane = vi.fn(() => customer)
  const r = new DataPlaneResolver({ registry, secrets: async () => 'pem', now: () => t, pypePlane: () => pype, postgrestPlane })
  return { r, pype, customer, registry, postgrestPlane, tick: (ms: number) => { t += ms } }
}
const unit = [route('call_data', dest()), route('qa', dest()), route('dnc', dest())]

describe('DataPlaneResolver', () => {
  it('no route means Pype', async () => {
    const m = make([])
    expect(await m.r.forProject('p1')).toBe(m.pype)
  })

  it('a route sends call data to the customer destination, never Pype', async () => {
    const m = make(unit)
    const plane = await m.r.forProject('p1')
    await plane.callData.countCallLogs({ agentIds: ['a'] })
    expect(m.customer.calls).toContain('countCallLogs')
    expect(m.pype.calls).toEqual([])
  })

  it('caches the registry for 15 s', async () => {
    const m = make([])
    await m.r.forProject('p1'); await m.r.forProject('p1')
    expect(m.registry).toHaveBeenCalledTimes(1)
    m.tick(REGISTRY_CACHE_MS + 1)
    await m.r.forProject('p1')
    expect(m.registry).toHaveBeenCalledTimes(2)
  })

  it('a paused route is RouteInMaintenance, not Pype', async () => {
    const m = make([...unit.slice(0, 2), route('dnc', dest(), { state: 'paused' })])
    await expect(m.r.forProject('p1')).rejects.toBeInstanceOf(RouteInMaintenance)
  })

  it('an unreachable registry fails closed', async () => {
    await expect(make(new Error('boom')).r.forProject('p1')).rejects.toThrow('boom')
    const m = make(new DestinationUnavailable(undefined))
    await expect(m.r.forProject('p1')).rejects.toBeInstanceOf(DestinationUnavailable)
  })

  it.each([
    ['unverified', dest({ status: 'unverified' }), DestinationUnavailable],
    ['wrong schema version', dest({ schema_version: 2 }), DestinationIncompatible],
    ['no secret reference', dest({ secret_ref: null }), DestinationIncompatible],
  ])('refuses a destination with %s', async (_n, d, Err) => {
    const m = make([route('call_data', d), route('qa', d), route('dnc', d)])
    await expect(m.r.forProject('p1')).rejects.toBeInstanceOf(Err)
  })

  it('call data, qa and dnc must share one destination', async () => {
    const other = dest({ id: 'd2', name: 'other' })
    await expect(make([route('call_data', dest()), route('qa', other), route('dnc', dest())]).r.forProject('p1')).rejects.toBeInstanceOf(DestinationIncompatible)
    await expect(make([route('call_data', dest())]).r.forProject('p1')).rejects.toBeInstanceOf(DestinationIncompatible)
  })

  it('a customer campaigns route needs call data on the same destination', async () => {
    await expect(make([route('campaigns', dest())]).r.forProject('p1')).rejects.toBeInstanceOf(DestinationIncompatible)
    const ok = make([...unit, route('campaigns', dest())])
    expect(await ok.r.forProject('p1')).toBeTruthy()
    const m = make([route('campaigns', dest({ kind: 'pype_supabase' }))])
    expect(await m.r.forProject('p1')).toMatchObject({ callData: m.pype.callData })
  })

  it('recordings can route separately from call data', async () => {
    const m = make([route('recordings', dest())])
    const plane = await m.r.forProject('p1')
    expect(plane.callData).toBe(m.pype.callData)
    await plane.storage.signRecordingUrl('k', 60)
    expect(m.customer.calls).toContain('signRecordingUrl')
  })

  it('ignores a route whose effective_from is in the future', async () => {
    const future = new Date(1_000_000 + 60_000).toISOString()
    const m = make(unit.map((r) => ({ ...r, effective_from: future })))
    expect(await m.r.forProject('p1')).toBe(m.pype)
  })

  it('never puts the secret reference in an error', async () => {
    const d = dest({ status: 'down', secret_ref: 'arn:SECRET' })
    const r = new DataPlaneResolver({ registry: async () => [route('call_data', d), route('qa', d), route('dnc', d)] })
    const err = await r.forProject('p1').catch((e) => e)
    expect(err).toBeInstanceOf(DestinationUnavailable)
    expect(String(err.message)).not.toContain('SECRET')
  })
})

describe('campaignLocation', () => {
  const loc = (routes: RegistryRoute[]) => new DataPlaneResolver({ registry: async () => routes }).campaignLocation('p1')
  it('is pype with no route or a pype destination, customer for anything else', async () => {
    expect(await loc([])).toBe('pype')
    expect(await loc([route('campaigns', dest({ kind: 'pype_supabase' }))])).toBe('pype')
    expect(await loc([route('campaigns', dest())])).toBe('customer')
  })
  it('names the customer destination only', async () => {
    const name = (routes: RegistryRoute[]) => new DataPlaneResolver({ registry: async () => routes }).campaignDestinationName('p1')
    expect(await name([route('campaigns', dest())])).toBe('acme')
    expect(await name([route('campaigns', dest({ kind: 'pype_supabase' }))])).toBeNull()
    expect(await name([])).toBeNull()
  })
})

describe('resolveSecret env values', () => {
  const pem = '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n'
  it.each([
    ['raw', pem],
    ['escaped newlines', pem.replace(/\n/g, '\\n')],
    ['base64', Buffer.from(pem).toString('base64')],
  ])('returns the PEM from a %s value', async (_n, v) => {
    process.env.TEST_PEM = v
    expect(await resolveSecret('env:TEST_PEM')).toBe(pem)
    delete process.env.TEST_PEM
  })
  it('passes a non-PEM secret through', async () => {
    process.env.TEST_PEM = 'plain-secret'
    expect(await resolveSecret('env:TEST_PEM')).toBe('plain-secret')
    delete process.env.TEST_PEM
  })
})

const smSend = vi.fn()
vi.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: vi.fn(() => ({ send: smSend })),
  GetSecretValueCommand: vi.fn((input) => ({ input })),
}))

describe('resolveSecret from Secrets Manager', () => {
  beforeEach(() => smSend.mockReset())
  const PEM = '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n'
  it('returns private_key from a JSON secret', async () => {
    smSend.mockResolvedValueOnce({ SecretString: JSON.stringify({ private_key: PEM }) })
    expect(await resolveSecret('pype/prod/dest-a')).toBe(PEM)
  })
  it('returns a bare PEM secret and caches it', async () => {
    smSend.mockResolvedValueOnce({ SecretString: PEM })
    expect(await resolveSecret('pype/prod/dest-b')).toBe(PEM)
    expect(await resolveSecret('pype/prod/dest-b')).toBe(PEM)
    expect(smSend).toHaveBeenCalledTimes(1)
  })
  it('a failed or empty lookup is DestinationUnavailable', async () => {
    smSend.mockRejectedValueOnce(new Error('AccessDenied'))
    await expect(resolveSecret('pype/prod/dest-c')).rejects.toBeInstanceOf(DestinationUnavailable)
    smSend.mockResolvedValueOnce({ SecretString: '' })
    await expect(resolveSecret('pype/prod/dest-d')).rejects.toBeInstanceOf(DestinationUnavailable)
  })
})
