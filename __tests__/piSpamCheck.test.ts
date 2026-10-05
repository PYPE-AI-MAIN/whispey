import { describe, it, expect, vi } from 'vitest'
import { checkSpamNumber } from '@/lib/piSpamCheck'

const env = { SCAM_CHECK_TOKEN: 'tok' }
const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch

describe('checkSpamNumber', () => {
  it('sends digits only with the bearer token and returns the typed fields', async () => {
    const f = reply({ phone_number: '7988307935', operator: 'Jio', country_code: 'IN', is_spam: true, assessment: 'SPAM/FRAUD FLAGGED', extra: 'ignore me' })
    const out = await checkSpamNumber('+91 79883-07935', f, env)
    expect(out).toEqual({ success: true, result: { phone_number: '7988307935', is_spam: true, assessment: 'SPAM/FRAUD FLAGGED', operator: 'Jio', country_code: 'IN' } })
    const [url, init] = (f as any).mock.calls[0]
    expect(url).toBe('https://scam-check.pypeai.com/api/v1/check?number=917988307935')
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
    expect(out).toMatchObject({ success: false, result: { error: expect.stringContaining('SCAM_CHECK_TOKEN') } })
  })

  it.each([[401, 'token'], [403, 'token'], [500, 'HTTP 500']])('maps HTTP %s to a clear error', async (status, text) => {
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
