import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  attachNumberToTrunk, buyNumber, digitsOnly, getOwnedNumber, inboundAlias, listOwnedNumbers,
  resolveInboundTrunk, restoreNumberApp, searchAvailableNumbers, slugify,
} from '@/lib/plivoNumbers'

type Call = { url: URL; method: string; body: any }
let calls: Call[]

function mockPlivo(handler: (call: Call) => { status?: number; json: unknown }) {
  calls = []
  vi.stubGlobal('fetch', vi.fn(async (url: URL, init: RequestInit) => {
    const call = { url: new URL(String(url)), method: init.method ?? 'GET', body: init.body ? JSON.parse(String(init.body)) : undefined }
    calls.push(call)
    const { status = 200, json } = handler(call)
    return { ok: status >= 200 && status < 300, status, json: async () => json } as Response
  }))
}

beforeEach(() => {
  vi.stubEnv('PLIVO_AUTH_ID', 'MAXXXXXXXXXXXXXXXXXX')
  vi.stubEnv('PLIVO_AUTH_TOKEN', 'secret-token')
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('naming helpers', () => {
  it('digitsOnly strips everything but digits', () => {
    expect(digitsOnly('+91 80355-31988')).toBe('918035531988')
  })
  it('slugify makes a safe alias and never returns empty', () => {
    expect(slugify('ASK TOWER WORKSPACE')).toBe('ask-tower-workspace')
    expect(slugify('  --Super Health!!  ')).toBe('super-health')
    expect(slugify('!!!')).toBe('project')
  })
  it('slugify matches the regex it replaced on thousands of random strings, and is fast on dash-heavy input', () => {
    let x = 11
    const next = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32)
    const alphabet = ['-', '-', 'a', 'B', '1', ' ', '_', '!', 'é']
    const reference = (s: string) => s.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-+|-+$/g, '') || 'project'
    for (let i = 0; i < 5000; i++) {
      const text = Array.from({ length: Math.floor(next() * 14) }, () => alphabet[Math.floor(next() * alphabet.length)]).join('')
      expect(slugify(text), JSON.stringify(text)).toBe(reference(text))
    }
    const start = performance.now()
    slugify('-'.repeat(200000) + 'x' + '-'.repeat(200000))
    expect(performance.now() - start).toBeLessThan(500)
  })
  it('inboundAlias is <project>-inbound-<last4>', () => {
    expect(inboundAlias('Super Health', '+918035315519')).toBe('super-health-inbound-5519')
  })
})

describe('Plivo requests', () => {
  it('sends basic auth for the account and surfaces Plivo error messages', async () => {
    mockPlivo(() => ({ status: 400, json: { error: 'compliance_application_id is required to rent this number.' } }))
    await expect(buyNumber('918065531988')).rejects.toThrow('compliance_application_id is required')
    const auth = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(auth.Authorization).toBe(`Basic ${Buffer.from('MAXXXXXXXXXXXXXXXXXX:secret-token').toString('base64')}`)
    expect(calls[0].url.pathname).toBe('/v1/Account/MAXXXXXXXXXXXXXXXXXX/PhoneNumber/918065531988/')
  })

  it('fails clearly when credentials are not configured', async () => {
    vi.stubEnv('PLIVO_AUTH_TOKEN', '')
    await expect(listOwnedNumbers()).rejects.toThrow('PLIVO_AUTH_ID / PLIVO_AUTH_TOKEN are not configured')
  })

  it('falls back to a generic message when Plivo returns no error text', async () => {
    mockPlivo(() => ({ status: 503, json: {} }))
    await expect(buyNumber('1')).rejects.toThrow('Plivo request failed (HTTP 503)')
  })
})

describe('resolveInboundTrunk', () => {
  it('reads the shared trunk id (and compliance id) from the reference number', async () => {
    mockPlivo(() => ({ json: { objects: [{ number: '912268079848', alias: 'Agent Command Center 17', application: '/v1/Account/MA/Zentrunk/Trunk/76442399806752212/', compliance_application_id: 'comp-1' }] } }))
    await expect(resolveInboundTrunk()).resolves.toEqual({ trunkId: '76442399806752212', complianceApplicationId: 'comp-1' })
    expect(calls[0].url.searchParams.get('alias')).toBe('Agent Command Center 17')
  })

  it('throws when the reference number is missing or is not on a trunk', async () => {
    mockPlivo(() => ({ json: { objects: [] } }))
    await expect(resolveInboundTrunk()).rejects.toThrow('Could not find the "Agent Command Center 17" number')
    mockPlivo(() => ({ json: { objects: [{ application: '/v1/Account/MA/Application/123/' }] } }))
    await expect(resolveInboundTrunk()).rejects.toThrow('Could not find')
  })
})

describe('listOwnedNumbers', () => {
  it('pages through every number and classifies trunk vs application', async () => {
    mockPlivo(({ url }) => {
      const offset = Number(url.searchParams.get('offset'))
      if (offset === 0) {
        return { json: { meta: { next: '/next' }, objects: [
          { number: '911', alias: 'a', application: '/v1/Account/MA/Zentrunk/Trunk/555/', type: 'fixed', monthly_rental_rate: '2.5' },
          { number: '912', alias: null, application: '/v1/Account/MA/Application/777/' },
        ] } }
      }
      return { json: { meta: { next: null }, objects: [{ number: '913', application: '' }] } }
    })
    const all = await listOwnedNumbers()
    expect(all.map((n) => n.number)).toEqual(['911', '912', '913'])
    expect(all[0]).toMatchObject({ trunkId: '555', appId: null, alias: 'a', type: 'fixed' })
    expect(all[1]).toMatchObject({ trunkId: null, appId: '777', alias: null })
    expect(all[2]).toMatchObject({ trunkId: null, appId: null })
    expect(calls).toHaveLength(2)
  })
})

describe('getOwnedNumber', () => {
  it('returns the number with its current routing, normalising the dialled format', async () => {
    mockPlivo(() => ({ json: { number: '918035315519', alias: 'free-notinuse', application: '/v1/Account/MA/Zentrunk/Trunk/555/' } }))
    await expect(getOwnedNumber('+91 80353 15519')).resolves.toMatchObject({ number: '918035315519', alias: 'free-notinuse', application: expect.stringContaining('555') })
    expect(calls[0].url.pathname.endsWith('/Number/918035315519/')).toBe(true)
  })
  it('returns null when Plivo does not know the number', async () => {
    mockPlivo(() => ({ status: 404, json: { error: 'not found' } }))
    await expect(getOwnedNumber('910000000000')).resolves.toBeNull()
  })
})

describe('searchAvailableNumbers', () => {
  it('uppercases the country, asks for voice numbers, caps the limit and maps the fields', async () => {
    mockPlivo(() => ({ json: { objects: [{ number: '918065531988', type: 'fixed', city: 'Bangalore', country: 'INDIA', monthly_rental_rate: '2.50000', setup_rate: '0.00000' }] } }))
    const res = await searchAvailableNumbers({ country_iso: 'in', type: 'local', pattern: '8065', limit: 500 })
    expect(calls[0].url.searchParams.get('country_iso')).toBe('IN')
    expect(calls[0].url.searchParams.get('services')).toBe('voice')
    expect(calls[0].url.searchParams.get('limit')).toBe('20')
    expect(res).toEqual([{ number: '918065531988', type: 'fixed', city: 'Bangalore', country: 'INDIA', monthly_rental_rate_usd: '2.50000', setup_rate_usd: '0.00000' }])
  })
  it('falls back to region and tolerates an empty result', async () => {
    mockPlivo(() => ({ json: { objects: [{ number: '1', region: 'Karnataka' }] } }))
    expect((await searchAvailableNumbers({ country_iso: 'IN' }))[0].city).toBe('Karnataka')
    mockPlivo(() => ({ json: {} }))
    expect(await searchAvailableNumbers({ country_iso: 'IN' })).toEqual([])
  })
})

describe('buy / attach / restore', () => {
  it('buyNumber POSTs the compliance id only when given', async () => {
    mockPlivo(() => ({ json: { status: 'fulfilled' } }))
    await buyNumber('+91 80655 31988', 'comp-1')
    await buyNumber('918065531989')
    expect(calls[0]).toMatchObject({ method: 'POST', body: { compliance_application_id: 'comp-1' } })
    expect(calls[0].url.pathname.endsWith('/PhoneNumber/918065531988/')).toBe(true)
    expect(calls[1].body).toEqual({})
  })
  it('attachNumberToTrunk puts the trunk id in app_id and sets the alias', async () => {
    mockPlivo(() => ({ json: {} }))
    await attachNumberToTrunk('+918035315519', '76442399806752212', 'ask-tower-workspace-inbound-5519')
    expect(calls[0]).toMatchObject({ method: 'POST', body: { app_id: '76442399806752212', alias: 'ask-tower-workspace-inbound-5519' } })
    expect(calls[0].url.pathname.endsWith('/Number/918035315519/')).toBe(true)
  })
  it('restoreNumberApp puts back the previous routing and alias (rollback)', async () => {
    mockPlivo(() => ({ json: {} }))
    await restoreNumberApp('918035315519', '777', 'old-alias')
    await restoreNumberApp('918035315519', null, null)
    expect(calls[0].body).toEqual({ app_id: '777', alias: 'old-alias' })
    expect(calls[1].body).toEqual({ alias: '' })
  })
})
