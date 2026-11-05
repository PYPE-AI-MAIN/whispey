import { DestinationUnavailable } from './errors'

export const BREAKER_FAILURES = 5
export const BREAKER_WINDOW_MS = 30_000
export const BREAKER_COOLDOWN_MS = 15_000

/** Opens after 5 failures in 30 s; after the cool-down one trial call is let through. */
export class CircuitBreaker {
  private failures: number[] = []
  private openedAt: number | null = null

  constructor(private readonly destination: string, private readonly now: () => number = Date.now) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const t = this.now()
    if (this.openedAt !== null) {
      if (t - this.openedAt < BREAKER_COOLDOWN_MS) {
        throw new DestinationUnavailable(this.destination, 'Data destination is unavailable (circuit open)')
      }
      this.openedAt = t // half-open: this call is the trial, others wait out a fresh cool-down
    }
    try {
      const out = await fn()
      this.failures = []
      this.openedAt = null
      return out
    } catch (e) {
      // Only destination failures count; a constraint error is the caller's, not an outage.
      if (e instanceof DestinationUnavailable) {
        this.failures = this.failures.filter((f) => t - f < BREAKER_WINDOW_MS).concat(t)
        if (this.failures.length >= BREAKER_FAILURES) this.openedAt = this.now()
      }
      throw e
    }
  }
}

function wrapPort(port: any, breaker: CircuitBreaker) {
  return new Proxy(port, {
    get(target, key) {
      const v = target[key]
      return typeof v === 'function' ? (...args: unknown[]) => breaker.run(() => v.apply(target, args)) : v
    },
  })
}

/** Wraps every async method of every port so each call goes through the breaker. */
export function withBreaker<P extends object>(plane: P, breaker: CircuitBreaker): P {
  return Object.fromEntries(Object.entries(plane).map(([k, port]) => [k, wrapPort(port, breaker)])) as P
}
