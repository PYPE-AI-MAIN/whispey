import { describe, it, expect, vi, afterEach } from 'vitest'

describe('lib/utils', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('cn (class name merger)', () => {
    it('merges class names', async () => {
      const { cn } = await import('@/lib/utils')
      expect(cn('foo', 'bar')).toBe('foo bar')
    })

    it('deduplicates tailwind classes', async () => {
      const { cn } = await import('@/lib/utils')
      // tailwind-merge should resolve conflicts (last one wins)
      const result = cn('px-2', 'px-4')
      expect(result).toBe('px-4')
    })

    it('ignores falsy values', async () => {
      const { cn } = await import('@/lib/utils')
      expect(cn('a', false && 'b', undefined, null, 'c')).toBe('a c')
    })

    it('supports conditional objects', async () => {
      const { cn } = await import('@/lib/utils')
      expect(cn({ active: true, disabled: false })).toBe('active')
    })
  })

  describe('getPipecatBaseUrl', () => {
    it('returns PIPECAT_BASE_URL when set', async () => {
      vi.stubEnv('PIPECAT_BASE_URL', 'https://custom.pypeai.com')
      // Re-import to pick up the stubbed env (utils reads env at call time)
      const { getPipecatBaseUrl } = await import('@/lib/utils')
      expect(getPipecatBaseUrl()).toBe('https://custom.pypeai.com')
    })

    it('strips trailing slashes from PIPECAT_BASE_URL', async () => {
      vi.stubEnv('PIPECAT_BASE_URL', 'https://custom.pypeai.com///')
      const { getPipecatBaseUrl } = await import('@/lib/utils')
      expect(getPipecatBaseUrl()).toBe('https://custom.pypeai.com')
    })

    it('falls back to https://ws.pypeai.com when PIPECAT_BASE_URL is not set', async () => {
      vi.stubEnv('PIPECAT_BASE_URL', '')
      const { getPipecatBaseUrl } = await import('@/lib/utils')
      // Empty string is falsy, so fallback applies
      expect(getPipecatBaseUrl()).toBe('https://ws.pypeai.com')
    })
  })
})
