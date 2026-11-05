import { describe, it, expect, vi, afterEach } from 'vitest'
import { generateKeyPairSync, createVerify } from 'node:crypto'
import { createPostgrestPlane, mintToken, verifyPostgrestDestination } from '@/server/data-plane/adapters/postgrest'
import { DestinationIncompatible, DestinationUnavailable } from '@/server/data-plane/errors'

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const dest = { id: 'd1', name: 'acme', config: { base_url: 'https://acme.test/' } }

afterEach(() => vi.unstubAllGlobals())

describe('postgrest adapter', () => {
  it('mints a 5-minute RS256 token for the customer audience', () => {
    const tok = mintToken(dest, pem, 1_000_000_000)
    const [h, b, s] = tok.split('.')
    expect(createVerify('RSA-SHA256').update(`${h}.${b}`).verify(publicKey, Buffer.from(s, 'base64url'))).toBe(true)
    expect(JSON.parse(Buffer.from(b, 'base64url').toString())).toEqual({ aud: 'acme', role: 'pype_writer', iat: 1_000_000, exp: 1_000_300 })
  })

  it('reads from the customer base URL with a bearer token and a timeout', async () => {
    const fetchMock = vi.fn(async () => new Response('[]', { status: 200, headers: { 'content-range': '0-0/4' } }))
    vi.stubGlobal('fetch', fetchMock)
    const n = await createPostgrestPlane(dest, pem).callData.countCallLogs({ agentIds: ['a1'] })
    expect(n).toBe(4)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url.startsWith('https://acme.test/')).toBe(true)
    expect(url).not.toContain('/rest/v1')
    expect(new Headers(init.headers).get('Authorization')).toMatch(/^Bearer /)
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('maps a network failure and a 5xx to DestinationUnavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed') }))
    await expect(createPostgrestPlane(dest, pem).callData.countCallLogs({ agentIds: ['a1'] })).rejects.toBeInstanceOf(DestinationUnavailable)
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"message":"x"}', { status: 502 })))
    await expect(createPostgrestPlane(dest, pem).callData.getCallLog('c1', '*')).rejects.toBeInstanceOf(DestinationUnavailable)
  })

  it('a 4xx is the caller\'s error, not an outage', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"message":"bad filter","code":"PGRST100"}', { status: 400 })))
    const err = await createPostgrestPlane(dest, pem).callData.getCallLog('c1', '*').catch((e) => e)
    expect(err).not.toBeInstanceOf(DestinationUnavailable)
    expect(err.message).toBe('bad filter')
  })

  it('falls back to the 13-argument call-log function when the 15-argument one is missing', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{"code":"PGRST202","message":"no fn"}', { status: 404 }))
      .mockResolvedValueOnce(new Response('[{"id":"c1"}]', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const rows = await createPostgrestPlane(dest, pem).callData.queryCallLogs({ p_agent_id: 'a1', p_select: '*' }, { clerkId: 'u', email: 'e@x.com' })
    expect(rows).toEqual([{ id: 'c1' }])
    const bodies = fetchMock.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string))
    expect(bodies[0]).toHaveProperty('p_user_clerk_id')
    expect(bodies[1]).not.toHaveProperty('p_user_clerk_id')
    expect(bodies[1].p_allowed_agent_ids).toEqual(['a1'])
  })

  it('refuses a destination without an https base_url', () => {
    expect(() => createPostgrestPlane({ ...dest, config: { base_url: 'http://acme.test' } }, pem)).toThrow(DestinationIncompatible)
    expect(() => createPostgrestPlane({ ...dest, config: { base_url: 'http://localhost:3000' } }, pem)).not.toThrow()
  })

  it('verify runs the checklist and reports each failing item without secrets', async () => {
    const ok = () => new Response('{"schema":1,"schema_version":1,"url":"https://s/x"}', { status: 200 })
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/signer/v1/version')) return new Response('{"schema":2}', { status: 200 })
      if (url.endsWith('/rpc/schema_info')) return new Response('{"schema_version":2}', { status: 200 })
      return ok()
    }))
    const checks = await verifyPostgrestDestination(dest, pem, 1)
    expect(checks.map((c) => [c.name, c.ok])).toEqual([
      ['connect', true], ['schema version', false], ['database', false],
    ])
    expect(checks[1].detail).toMatch(/schema version 2, expected 1/)
    expect(JSON.stringify(checks)).not.toContain('PRIVATE KEY')
  })

  it('puts the configured kid in the token header', () => {
    const head = JSON.parse(Buffer.from(mintToken({ ...dest, config: { ...dest.config, kid: 'k1' } }, pem).split('.')[0], 'base64url').toString())
    expect(head.kid).toBe('k1')
  })

  it('storage none checks the data API root instead of the signer health', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => { urls.push(url); return new Response('{"schema":1,"schema_version":1}', { status: 200 }) }))
    await verifyPostgrestDestination({ ...dest, config: { ...dest.config, storage: 'none' } }, pem, 1)
    expect(urls.some((u) => u.includes('/signer/v1/health'))).toBe(false)
  })
})
