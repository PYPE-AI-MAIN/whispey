import { describe, it, expect } from 'vitest'
import { CircuitBreaker, withBreaker, BREAKER_COOLDOWN_MS } from '@/server/data-plane/breaker'
import { DestinationUnavailable } from '@/server/data-plane/errors'

const down = async () => { throw new DestinationUnavailable('acme') }

describe('CircuitBreaker', () => {
  it('opens after 5 failures in 30 s and then rejects without calling', async () => {
    let t = 0
    const b = new CircuitBreaker('acme', () => t)
    for (let i = 0; i < 5; i++) await expect(b.run(down)).rejects.toThrow('unavailable')
    let called = false
    await expect(b.run(async () => { called = true })).rejects.toThrow('circuit open')
    expect(called).toBe(false)
    t += BREAKER_COOLDOWN_MS
    await expect(b.run(async () => 'ok')).resolves.toBe('ok')
  })

  it('does not open when failures are spread over more than 30 s', async () => {
    let t = 0
    const b = new CircuitBreaker('acme', () => t)
    for (let i = 0; i < 6; i++) { await expect(b.run(down)).rejects.toThrow(); t += 10_000 }
    await expect(b.run(async () => 'ok')).resolves.toBe('ok')
  })

  it("ignores the caller's own errors", async () => {
    const b = new CircuitBreaker('acme', () => 0)
    for (let i = 0; i < 8; i++) await expect(b.run(async () => { throw new Error('duplicate key') })).rejects.toThrow('duplicate key')
    await expect(b.run(async () => 'ok')).resolves.toBe('ok')
  })

  it('wraps every port method', async () => {
    const b = new CircuitBreaker('acme', () => 0)
    const plane = withBreaker({ port: { ping: async () => { throw new DestinationUnavailable('acme') }, n: 3 } }, b)
    for (let i = 0; i < 5; i++) await expect(plane.port.ping()).rejects.toThrow()
    await expect(plane.port.ping()).rejects.toThrow('circuit open')
    expect(plane.port.n).toBe(3)
  })
})
