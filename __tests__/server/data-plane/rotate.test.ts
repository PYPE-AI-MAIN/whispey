import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const verifyState = vi.hoisted(() => ({ ok: true, calls: [] as any[] }))
vi.mock('@clerk/nextjs/server', () => ({ auth: async () => ({ userId: 'u1' }), currentUser: async () => ({ emailAddresses: [{ emailAddress: 'boss@pypeai.com' }] }) }))
vi.mock('@/lib/supabase-server', () => ({ createServiceRoleClient: () => ({}) }))
vi.mock('@/server/data-plane/adapters/postgrest', async (orig) => ({
  ...(await orig<typeof import('@/server/data-plane/adapters/postgrest')>()),
  verifyPostgrestDestination: async (...a: any[]) => { verifyState.calls.push(a); return [{ name: 'connect', ok: verifyState.ok }] },
}))
vi.mock('@/server/data-plane/resolver', async (orig) => ({
  ...(await orig<typeof import('@/server/data-plane/resolver')>()),
  resolveSecret: async () => 'PEM',
  resolveClientCert: async () => ({ cert: 'C', key: 'K' }),
}))

import { POST as rotatePOST } from '@/app/api/admin/data-destinations/[id]/rotate/route'
import { setRegistryStoreForTests } from '@/server/data-plane/admin/registryStore'
import { createFakeRegistry, type FakeRegistry } from '@/server/data-plane/testing/fakeRegistry'
import { parseDestinationInput } from '@/server/data-plane/routingPolicy'

const OLD = 'arn:aws:secretsmanager:us-east-2:123456789012:secret:pype/acme-old-AbCdEf'
const NEW = 'arn:aws:secretsmanager:us-east-2:123456789012:secret:pype/acme-new-AbCdEf'
let reg: FakeRegistry
let id: string
const call = (body: unknown) => rotatePOST({ json: async () => body } as any, { params: Promise.resolve({ id }) })

beforeEach(async () => {
  process.env.PYPE_ADMINS = 'boss@pypeai.com'
  verifyState.ok = true
  verifyState.calls = []
  reg = createFakeRegistry()
  setRegistryStoreForTests(reg)
  const d = await reg.createDestination({ name: 'acme', kind: 'postgrest', config: { base_url: 'https://a.test', kid: 'k1', mtls: true }, secret_ref: OLD } as never, 'boss')
  id = d.id
  await reg.upsertRoute({ project_id: 'p1', data_type: 'call_data', destination_id: id, state: 'active', version: 1, effective_from: null })
})
afterEach(() => setRegistryStoreForTests(null))

describe('key rotation', () => {
  it('verifies the new key (with its client certificate) and then switches, even while routed', async () => {
    const res = await call({ kid: 'k2', secret_ref: NEW })
    expect(res.status).toBe(200)
    expect(verifyState.calls[0][0].config.kid).toBe('k2')
    expect(verifyState.calls[0][3]).toEqual({ cert: 'C', key: 'K' })
    const stored = await reg.getDestinationForVerify(id)
    expect(stored?.secret_ref).toBe(NEW)
    expect(stored?.config).toMatchObject({ kid: 'k2', base_url: 'https://a.test' })
    expect(JSON.stringify(reg.audit)).not.toContain('secretsmanager')
  })
  it('keeps the old key when the new one fails the checks', async () => {
    verifyState.ok = false
    expect((await call({ kid: 'k2', secret_ref: NEW })).status).toBe(400)
    expect((await reg.getDestinationForVerify(id))?.secret_ref).toBe(OLD)
  })
  it('rejects a secret value instead of a reference', async () => {
    expect((await call({ kid: 'k2', secret_ref: '-----BEGIN PRIVATE KEY-----' })).status).toBe(400)
  })
})

describe('destination config', () => {
  it('mtls is a boolean and ingress is short text', () => {
    expect(parseDestinationInput({ name: 'acme', kind: 'postgrest', config: { mtls: 'yes' } })).toHaveProperty('error')
    expect(parseDestinationInput({ name: 'acme', kind: 'postgrest', config: { ingress: 'x'.repeat(501) } })).toHaveProperty('error')
    expect(parseDestinationInput({ name: 'acme', kind: 'postgrest', config: { mtls: true, ingress: 'IP allow-list + mTLS' } })).toHaveProperty('value')
  })
})
