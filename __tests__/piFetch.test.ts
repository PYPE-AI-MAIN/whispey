import { describe, it, expect, vi } from 'vitest'
import { fetchWithBackoff } from '@/lib/piFetch'

const res = (status: number, headers: Record<string, string> = {}) => new Response('', { status, headers })
const seq = (...steps: (Response | Error)[]) => vi.fn(async () => { const n = steps.shift()!; if (n instanceof Error) throw n; return n }) as unknown as typeof fetch

describe('fetchWithBackoff', () => {
  const wait = vi.fn(async () => {})

  it('returns a good response untouched', async () => {
    const f = seq(res(200))
    expect((await fetchWithBackoff('/x', {}, { fetchImpl: f, wait })).status).toBe(200)
    expect((f as any).mock.calls).toHaveLength(1)
  })

  it.each([429, 502, 503, 504])('retries a %s and then succeeds', async (status) => {
    const f = seq(res(status), res(200))
    expect((await fetchWithBackoff('/x', {}, { fetchImpl: f, wait })).status).toBe(200)
    expect((f as any).mock.calls).toHaveLength(2)
  })

  it('retries a network error', async () => {
    const f = seq(new TypeError('Failed to fetch'), res(200))
    expect((await fetchWithBackoff('/x', {}, { fetchImpl: f, wait })).status).toBe(200)
  })

  it('backs off with a growing delay', async () => {
    const waits: number[] = []
    await fetchWithBackoff('/x', {}, { fetchImpl: seq(res(503), res(503), res(200)), wait: async (ms) => { waits.push(ms) } })
    expect(waits[1]).toBeGreaterThan(waits[0])
  })

  it('gives up after the retries: returns the last bad response, or throws the last error', async () => {
    expect((await fetchWithBackoff('/x', {}, { fetchImpl: seq(res(503), res(503), res(503)), wait })).status).toBe(503)
    await expect(fetchWithBackoff('/x', {}, { fetchImpl: seq(new Error('a'), new Error('b'), new Error('c')), wait })).rejects.toThrow('c')
  })

  it.each([400, 401, 403, 404, 409, 500])('does not retry a %s', async (status) => {
    const f = seq(res(status))
    expect((await fetchWithBackoff('/x', {}, { fetchImpl: f, wait })).status).toBe(status)
    expect((f as any).mock.calls).toHaveLength(1)
  })

  it('honours Retry-After, capped at 3s', async () => {
    const waits: number[] = []
    await fetchWithBackoff('/x', {}, { fetchImpl: seq(res(429, { 'retry-after': '90' }), res(200)), wait: async (ms) => { waits.push(ms) } })
    expect(waits[0]).toBe(3000)
  })
})
