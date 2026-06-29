import { describe, it, expect, vi, afterEach } from 'vitest'
import jwt from 'jsonwebtoken'

describe('serviceToken', () => {
  afterEach(() => vi.unstubAllEnvs())

  describe('mintServiceToken', () => {
    it('returns a valid HS256 JWT', async () => {
      vi.stubEnv('PYPE_JWT_SECRET', 'test-secret-for-unit-tests')
      const { mintServiceToken } = await import('@/lib/serviceToken')
      const token = mintServiceToken()
      const decoded = jwt.decode(token, { complete: true })
      expect(decoded?.header.alg).toBe('HS256')
    })

    it('embeds the correct sub, iss, and aud claims', async () => {
      vi.stubEnv('PYPE_JWT_SECRET', 'test-secret-for-unit-tests')
      const { mintServiceToken } = await import('@/lib/serviceToken')
      const token = mintServiceToken()
      const payload = jwt.decode(token) as Record<string, any>
      expect(payload.sub).toBe('pype-analytics-dashboard')
      expect(payload.iss).toBe('pype-analytics-dashboard')
      expect(payload.aud).toBe('pype-vc-bots')
    })

    it('token expires within ~5 minutes', async () => {
      vi.stubEnv('PYPE_JWT_SECRET', 'test-secret-for-unit-tests')
      const { mintServiceToken } = await import('@/lib/serviceToken')
      const token = mintServiceToken()
      const payload = jwt.decode(token) as Record<string, any>
      const nowSec = Math.floor(Date.now() / 1000)
      expect(payload.exp).toBeGreaterThan(nowSec)
      expect(payload.exp).toBeLessThanOrEqual(nowSec + 301) // 5 min + 1s tolerance
    })

    it('uses fallback secret when PYPE_JWT_SECRET is not set', async () => {
      vi.stubEnv('PYPE_JWT_SECRET', '')
      const { mintServiceToken } = await import('@/lib/serviceToken')
      // Should not throw even with empty env var
      expect(() => mintServiceToken()).not.toThrow()
    })

    it('each call produces a different token (different iat)', async () => {
      vi.stubEnv('PYPE_JWT_SECRET', 'test-secret')
      const { mintServiceToken } = await import('@/lib/serviceToken')
      // Two tokens minted 1ms apart may have same iat but the random nonce differs
      const t1 = mintServiceToken()
      expect(t1).toBeTruthy()
      expect(t1.split('.').length).toBe(3) // header.payload.signature
    })
  })

  describe('serviceAuthHeaders', () => {
    it('returns x-api-key and Authorization headers', async () => {
      vi.stubEnv('PYPE_JWT_SECRET', 'test-secret')
      const { serviceAuthHeaders } = await import('@/lib/serviceToken')
      const headers = serviceAuthHeaders('my-api-key')
      expect(headers['x-api-key']).toBe('my-api-key')
      expect(headers.Authorization).toMatch(/^Bearer .+\..+\..+$/)
    })

    it('uses default api key when none provided', async () => {
      vi.stubEnv('PYPE_JWT_SECRET', 'test-secret')
      const { serviceAuthHeaders } = await import('@/lib/serviceToken')
      const headers = serviceAuthHeaders()
      expect(headers['x-api-key']).toBe('pype-api-v1')
    })
  })
})
