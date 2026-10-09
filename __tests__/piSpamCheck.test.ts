import { describe, it, expect, vi } from 'vitest'
import { checkSpamNumber, createGuardedSpamCheck, resetSpamTokenCache } from '@/lib/piSpamCheck'

const env = { SCAM_CHECK_TOKEN: 'tok' }
const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch

describe('checkSpamNumber', () => {
  it('sends the number URL-encoded with its + kept, a bearer token, and returns the typed fields', async () => {
    const f = reply({ phone_number: '7988307935', operator: 'Jio', country_code: 'IN', is_spam: true, assessment: 'SPAM/FRAUD FLAGGED', extra: 'ignore me' })
    const out = await checkSpamNumber('+91 79883-07935', f, env)
    expect(out).toEqual({ success: true, result: { phone_number: '7988307935', is_spam: true, assessment: 'SPAM/FRAUD FLAGGED', operator: 'Jio', country_code: 'IN' } })
    const [url, init] = (f as any).mock.calls[0]
    expect(url).toBe('https://scam-check.pypeai.com/api/v1/check?number=%2B917988307935')
    expect(init.headers.Authorization).toBe('Bearer tok')
  })

  it.each(['', 'abc', '123', '1'.repeat(16), undefined, '7988307935&x=1'.slice(0, 5)])('rejects an unusable number (%s) without calling the service', async (n) => {
    const f = reply({})
    expect((await checkSpamNumber(n, f, env)).success).toBe(false)
    expect(f).not.toHaveBeenCalled()
  })

  it('cannot be redirected through the number', async () => {
    const f = reply({ is_spam: false })
    await checkSpamNumber('7988307935/../../admin?x=1', f, env)
    expect((f as any).mock.calls[0][0]).toBe('https://scam-check.pypeai.com/api/v1/check?number=79883079351')
  })

  it('says so when no token is configured', async () => {
    const out = await checkSpamNumber('7988307935', reply({}), {})
    expect(out).toMatchObject({ success: false, result: { error: expect.stringContaining('SCAM_CHECK_CLIENT_ID') } })
  })

  it.each([[401, 'credentials'], [403, 'credentials'], [400, 'country code'], [422, 'country code'], [500, 'HTTP 500']])('maps HTTP %s to a clear error', async (status, text) => {
    const out = await checkSpamNumber('7988307935', reply({}, status), env)
    expect(out).toMatchObject({ success: false, result: { error: expect.stringContaining(text) } })
  })

  it('treats an unexpected body or a network failure as an error', async () => {
    expect((await checkSpamNumber('7988307935', reply({ hello: 1 }), env)).success).toBe(false)
    const boom = vi.fn(async () => { throw new Error('down') }) as unknown as typeof fetch
    expect(await checkSpamNumber('7988307935', boom, env)).toMatchObject({ success: false })
  })

  it('does not pass service text longer than the cap to the model', async () => {
    const out = await checkSpamNumber('7988307935', reply({ is_spam: false, assessment: 'x'.repeat(5000) }), env)
    expect((out.result.assessment as string).length).toBe(200)
  })

  it('keeps a number typed without + as typed (the service reads that as a local number)', async () => {
    for (const [typed, sent] of [['7988307935', '7988307935'], ['917988307935', '917988307935'], ['+917988307935', '%2B917988307935']]) {
      const f = reply({ is_spam: false })
      await checkSpamNumber(typed, f, env)
      expect((f as any).mock.calls[0][0]).toBe(`https://scam-check.pypeai.com/api/v1/check?number=${sent}`)
    }
  })

  describe('client credentials', () => {
    const creds = { SCAM_CHECK_CLIENT_ID: 'pype', SCAM_CHECK_CLIENT_SECRET: 's3' }
    const route = (handlers: { token?: () => Response; check?: (auth: string) => Response }) =>
      vi.fn(async (url: string, init: any) =>
        url.endsWith('/auth/token') ? (handlers.token ?? (() => new Response(JSON.stringify({ access_token: 'jwt-1', expires_in: 3600 }))))() : (handlers.check ?? (() => new Response(JSON.stringify({ is_spam: false }))))(init.headers.Authorization),
      ) as unknown as typeof fetch
    const callsTo = (f: any, suffix: string) => f.mock.calls.filter((c: any[]) => c[0].includes(suffix))

    it('exchanges the credentials for a token, uses it, and reuses it until it expires', async () => {
      resetSpamTokenCache()
      const f = route({})
      await checkSpamNumber('7988307935', f, creds)
      await checkSpamNumber('7988307936', f, creds)
      expect(callsTo(f, '/auth/token')).toHaveLength(1)
      expect(JSON.parse(callsTo(f, '/auth/token')[0][1].body)).toEqual({ client_id: 'pype', client_secret: 's3' })
      expect(callsTo(f, '/api/v1/check')[0][1].headers.Authorization).toBe('Bearer jwt-1')
    })

    it('fetches a new token after a 401 and retries once', async () => {
      resetSpamTokenCache()
      let issued = 0
      const f = route({
        token: () => new Response(JSON.stringify({ access_token: `jwt-${++issued}`, expires_in: 3600 })),
        check: (auth) => (auth === 'Bearer jwt-1' ? new Response('', { status: 401 }) : new Response(JSON.stringify({ is_spam: true, assessment: 'SPAM' }))),
      })
      const out = await checkSpamNumber('7988307935', f, creds)
      expect(out.success).toBe(true)
      expect(issued).toBe(2)
    })

    it('does not loop when a fresh token is refused too', async () => {
      resetSpamTokenCache()
      const f = route({ check: () => new Response('', { status: 401 }) })
      const out = await checkSpamNumber('7988307935', f, creds)
      expect(out).toMatchObject({ success: false, result: { error: expect.stringContaining('credentials') } })
      expect(callsTo(f, '/api/v1/check')).toHaveLength(2)
    })

    it.each([[401, 'rejected its client credentials'], [500, 'Could not get a token']])('reports a failed token exchange (%s)', async (status, text) => {
      resetSpamTokenCache()
      const f = route({ token: () => new Response('', { status }) })
      expect(await checkSpamNumber('7988307935', f, creds)).toMatchObject({ success: false, result: { error: expect.stringContaining(text) } })
      expect(callsTo(f, '/api/v1/check')).toHaveLength(0)
    })

    it('prefers the credentials over a fixed token', async () => {
      resetSpamTokenCache()
      const f = route({})
      await checkSpamNumber('7988307935', f, { ...creds, SCAM_CHECK_TOKEN: 'fixed' })
      expect(callsTo(f, '/api/v1/check')[0][1].headers.Authorization).toBe('Bearer jwt-1')
    })
  })

  describe('retry with backoff', () => {
    const seq = (...steps: (Response | Error)[]) => {
      const f = vi.fn(async () => { const n = steps.shift()!; if (n instanceof Error) throw n; return n })
      return f as unknown as typeof fetch
    }
    const ok = () => new Response(JSON.stringify({ is_spam: false }), { status: 200 })
    const noWait = vi.fn(async () => {})

    it('retries a 503 then succeeds, with a growing delay', async () => {
      const waits: number[] = []
      const f = seq(new Response('', { status: 503 }), new Response('', { status: 502 }), ok())
      const out = await checkSpamNumber('7988307935', f, env, async (ms) => { waits.push(ms) })
      expect(out.success).toBe(true)
      expect((f as any).mock.calls).toHaveLength(3)
      expect(waits[1]).toBeGreaterThan(waits[0])
    })

    it('retries a network error', async () => {
      const f = seq(new Error('reset'), ok())
      expect((await checkSpamNumber('7988307935', f, env, noWait)).success).toBe(true)
    })

    it('gives up after 3 attempts and reports the last status', async () => {
      const f = seq(new Response('', { status: 503 }), new Response('', { status: 503 }), new Response('', { status: 503 }))
      const out = await checkSpamNumber('7988307935', f, env, noWait)
      expect(out).toMatchObject({ success: false, result: { error: expect.stringContaining('503') } })
      expect((f as any).mock.calls).toHaveLength(3)
    })

    it.each([400, 401, 404])('does not retry a %s', async (status) => {
      const f = seq(new Response('', { status }))
      await checkSpamNumber('7988307935', f, env, noWait)
      expect((f as any).mock.calls).toHaveLength(1)
    })

    it('honours Retry-After but caps it', async () => {
      const waits: number[] = []
      const f = seq(new Response('', { status: 429, headers: { 'retry-after': '120' } }), ok())
      await checkSpamNumber('7988307935', f, env, async (ms) => { waits.push(ms) })
      expect(waits[0]).toBe(2000)
    })
  })
})

describe('createGuardedSpamCheck', () => {
  const good = { success: true, result: { is_spam: false } }
  const outage = { success: false, result: { error: 'down' }, transient: true }
  const clock = () => { let t = 1_000_000; return { now: () => t, tick: (ms: number) => { t += ms } } }

  it('serves a repeat number from cache, and shares one call between concurrent identical checks', async () => {
    const check = vi.fn(async () => good)
    const run = createGuardedSpamCheck({ check })
    await Promise.all([run('u1', '7988307935'), run('u2', '+91 7988307935'.slice(4))])
    await run('u1', '79883-07935')
    expect(check).toHaveBeenCalledTimes(1)
  })

  it('expires the cache after 10 minutes', async () => {
    const c = clock(); const check = vi.fn(async () => good)
    const run = createGuardedSpamCheck({ check, now: c.now })
    await run('u', '7988307935'); c.tick(11 * 60_000); await run('u', '7988307935')
    expect(check).toHaveBeenCalledTimes(2)
  })

  it('does not cache failures', async () => {
    const check = vi.fn(async () => ({ success: false, result: { error: 'bad token' } }))
    const run = createGuardedSpamCheck({ check })
    await run('u', '7988307935'); await run('u', '7988307935')
    expect(check).toHaveBeenCalledTimes(2)
  })

  it('limits one user to 30 distinct checks per 10 minutes, without blocking another user', async () => {
    const c = clock(); const check = vi.fn(async () => good)
    const run = createGuardedSpamCheck({ check, now: c.now })
    for (let i = 0; i < 30; i++) await run('u', String(9000000000 + i))
    const blocked = await run('u', '9100000000')
    expect(blocked).toMatchObject({ success: false, result: { error: expect.stringContaining('limit') } })
    expect((await run('other', '9100000000')).success).toBe(true)
    c.tick(11 * 60_000)
    expect((await run('u', '9100000001')).success).toBe(true)
  })

  it('does not spend rate limit on an unusable number', async () => {
    const check = vi.fn(async () => ({ success: false, result: { error: 'Give a phone number' } }))
    const run = createGuardedSpamCheck({ check })
    for (let i = 0; i < 40; i++) await run('u', 'abc')
    expect((await run('u', 'abc')).result.error).toBe('Give a phone number')
  })

  it('opens the circuit after 3 outages, fails fast, then recovers after 30s', async () => {
    const c = clock(); let up = false
    const check = vi.fn(async () => (up ? good : outage))
    const run = createGuardedSpamCheck({ check, now: c.now })
    for (let i = 0; i < 3; i++) await run('u', String(9000000000 + i))
    const fast = await run('u', '9200000000')
    expect(fast.result.error).toEqual(expect.stringContaining('temporarily unavailable'))
    expect(check).toHaveBeenCalledTimes(3)
    c.tick(31_000); up = true
    expect((await run('u', '9200000000')).success).toBe(true)
  })

  it('a bad token or bad request does not open the circuit', async () => {
    const check = vi.fn(async () => ({ success: false, result: { error: 'rejected' } }))
    const run = createGuardedSpamCheck({ check })
    for (let i = 0; i < 6; i++) await run('u', String(9000000000 + i))
    expect(check).toHaveBeenCalledTimes(6)
  })

  it('never leaks the internal transient flag to the model', async () => {
    const run = createGuardedSpamCheck({ check: async () => outage })
    expect(Object.keys(await run('u', '7988307935')).sort()).toEqual(['result', 'success'])
  })
})
