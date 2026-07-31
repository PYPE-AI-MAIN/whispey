import { describe, it, expect, vi, afterEach } from 'vitest'

describe('pypeApiFetch', () => {
  afterEach(() => vi.unstubAllEnvs())

  describe('PYPE_API_FETCH_TIMEOUT_MS', () => {
    it('equals 8000ms', async () => {
      const { PYPE_API_FETCH_TIMEOUT_MS } = await import('@/lib/pypeApiFetch')
      expect(PYPE_API_FETCH_TIMEOUT_MS).toBe(8_000)
    })
  })

  describe('getPypeApiBaseUrlForServer', () => {
    it('returns PYPEAI_API_URL when set', async () => {
      vi.stubEnv('PYPEAI_API_URL', 'http://127.0.0.1:8000')
      vi.stubEnv('NEXT_PUBLIC_PYPEAI_API_URL', 'https://public.pypeai.com')
      const { getPypeApiBaseUrlForServer } = await import('@/lib/pypeApiFetch')
      expect(getPypeApiBaseUrlForServer()).toBe('http://127.0.0.1:8000')
    })

    it('falls back to NEXT_PUBLIC_PYPEAI_API_URL when PYPEAI_API_URL is absent', async () => {
      vi.stubEnv('PYPEAI_API_URL', '')
      vi.stubEnv('NEXT_PUBLIC_PYPEAI_API_URL', 'https://public.pypeai.com')
      const { getPypeApiBaseUrlForServer } = await import('@/lib/pypeApiFetch')
      expect(getPypeApiBaseUrlForServer()).toBe('https://public.pypeai.com')
    })

    it('returns undefined when neither env var is set', async () => {
      vi.stubEnv('PYPEAI_API_URL', '')
      vi.stubEnv('NEXT_PUBLIC_PYPEAI_API_URL', '')
      const { getPypeApiBaseUrlForServer } = await import('@/lib/pypeApiFetch')
      expect(getPypeApiBaseUrlForServer()).toBeFalsy()
    })

    it("returns PYPEAI_API_URL_DOCKER when target is 'docker'", async () => {
      vi.stubEnv('PYPEAI_API_URL_DOCKER', 'https://agents.stg.pypeai.com')
      vi.stubEnv('PYPEAI_API_URL', 'http://127.0.0.1:8000')
      const { getPypeApiBaseUrlForServer } = await import('@/lib/pypeApiFetch')
      expect(getPypeApiBaseUrlForServer('docker')).toBe('https://agents.stg.pypeai.com')
    })

    it("ignores classic env vars when target is 'docker'", async () => {
      vi.stubEnv('PYPEAI_API_URL_DOCKER', '')
      vi.stubEnv('PYPEAI_API_URL', 'http://127.0.0.1:8000')
      const { getPypeApiBaseUrlForServer } = await import('@/lib/pypeApiFetch')
      expect(getPypeApiBaseUrlForServer('docker')).toBeFalsy()
    })
  })

  describe('requireApiBaseUrl', () => {
    it('returns { apiUrl } when the backend URL is configured', async () => {
      vi.stubEnv('PYPEAI_API_URL', 'http://127.0.0.1:8000')
      const { requireApiBaseUrl } = await import('@/lib/pypeApiFetch')
      const result = requireApiBaseUrl('classic')
      expect('apiUrl' in result && result.apiUrl).toBe('http://127.0.0.1:8000')
    })

    it('returns { errorResponse } with a 500 when the backend URL is missing', async () => {
      vi.stubEnv('PYPEAI_API_URL', '')
      vi.stubEnv('NEXT_PUBLIC_PYPEAI_API_URL', '')
      const { requireApiBaseUrl } = await import('@/lib/pypeApiFetch')
      const result = requireApiBaseUrl('classic')
      expect('errorResponse' in result).toBe(true)
      if ('errorResponse' in result) {
        expect(result.errorResponse.status).toBe(500)
        const body = await result.errorResponse.json()
        expect(body.error).toBe('API configuration error')
      }
    })

    it('resolves the docker target independently of classic env vars', async () => {
      vi.stubEnv('PYPEAI_API_URL_DOCKER', 'https://agents.stg.pypeai.com')
      const { requireApiBaseUrl } = await import('@/lib/pypeApiFetch')
      const result = requireApiBaseUrl('docker')
      expect('apiUrl' in result && result.apiUrl).toBe('https://agents.stg.pypeai.com')
    })
  })

  describe('isPypeUpstreamUnreachable', () => {
    it('returns false for null/undefined', async () => {
      const { isPypeUpstreamUnreachable } = await import('@/lib/pypeApiFetch')
      expect(isPypeUpstreamUnreachable(null)).toBe(false)
      expect(isPypeUpstreamUnreachable(undefined)).toBe(false)
    })

    it('returns true for AbortError', async () => {
      const { isPypeUpstreamUnreachable } = await import('@/lib/pypeApiFetch')
      const err = Object.assign(new Error('aborted'), { name: 'AbortError' })
      expect(isPypeUpstreamUnreachable(err)).toBe(true)
    })

    it('returns true for TimeoutError', async () => {
      const { isPypeUpstreamUnreachable } = await import('@/lib/pypeApiFetch')
      const err = Object.assign(new Error('timeout'), { name: 'TimeoutError' })
      expect(isPypeUpstreamUnreachable(err)).toBe(true)
    })

    it('returns true for ECONNREFUSED', async () => {
      const { isPypeUpstreamUnreachable } = await import('@/lib/pypeApiFetch')
      const err = Object.assign(new Error('connect'), { cause: { code: 'ECONNREFUSED' } })
      expect(isPypeUpstreamUnreachable(err)).toBe(true)
    })

    it('returns true for ENOTFOUND', async () => {
      const { isPypeUpstreamUnreachable } = await import('@/lib/pypeApiFetch')
      const err = Object.assign(new Error('dns'), { cause: { code: 'ENOTFOUND' } })
      expect(isPypeUpstreamUnreachable(err)).toBe(true)
    })

    it('returns true for EAI_AGAIN', async () => {
      const { isPypeUpstreamUnreachable } = await import('@/lib/pypeApiFetch')
      const err = Object.assign(new Error('dns again'), { cause: { code: 'EAI_AGAIN' } })
      expect(isPypeUpstreamUnreachable(err)).toBe(true)
    })

    it('returns true for UND_ERR_CONNECT_TIMEOUT', async () => {
      const { isPypeUpstreamUnreachable } = await import('@/lib/pypeApiFetch')
      const err = Object.assign(new Error('timeout'), { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } })
      expect(isPypeUpstreamUnreachable(err)).toBe(true)
    })

    it('returns true for UND_ERR_SOCKET', async () => {
      const { isPypeUpstreamUnreachable } = await import('@/lib/pypeApiFetch')
      const err = Object.assign(new Error('socket'), { cause: { code: 'UND_ERR_SOCKET' } })
      expect(isPypeUpstreamUnreachable(err)).toBe(true)
    })

    it('returns true for TypeError with "fetch failed" message', async () => {
      const { isPypeUpstreamUnreachable } = await import('@/lib/pypeApiFetch')
      const err = new TypeError('fetch failed')
      expect(isPypeUpstreamUnreachable(err)).toBe(true)
    })

    it('returns false for a plain HTTP 404 error', async () => {
      const { isPypeUpstreamUnreachable } = await import('@/lib/pypeApiFetch')
      const err = new Error('404 Not Found')
      expect(isPypeUpstreamUnreachable(err)).toBe(false)
    })

    it('returns false for a string (not an object)', async () => {
      const { isPypeUpstreamUnreachable } = await import('@/lib/pypeApiFetch')
      expect(isPypeUpstreamUnreachable('some error string')).toBe(false)
    })

    it('returns false for a regular Error with no network cause', async () => {
      const { isPypeUpstreamUnreachable } = await import('@/lib/pypeApiFetch')
      expect(isPypeUpstreamUnreachable(new Error('validation error'))).toBe(false)
    })
  })

  describe('pypeApiAbortSignal', () => {
    it('returns an AbortSignal', async () => {
      const { pypeApiAbortSignal } = await import('@/lib/pypeApiFetch')
      const signal = pypeApiAbortSignal(5000)
      expect(signal).toBeDefined()
      expect(typeof signal.aborted).toBe('boolean')
    })

    it('signal is not immediately aborted', async () => {
      const { pypeApiAbortSignal } = await import('@/lib/pypeApiFetch')
      const signal = pypeApiAbortSignal(10_000)
      expect(signal.aborted).toBe(false)
    })
  })

  describe('pypeAgentControlHeaders', () => {
    it('includes the ngrok bypass and JSON accept/content-type headers', async () => {
      const { pypeAgentControlHeaders } = await import('@/lib/pypeApiFetch')
      const headers = pypeAgentControlHeaders()
      expect(headers['ngrok-skip-browser-warning']).toBe('true')
      expect(headers.Accept).toBe('application/json')
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('includes a Bearer service auth token', async () => {
      const { pypeAgentControlHeaders } = await import('@/lib/pypeApiFetch')
      const headers = pypeAgentControlHeaders()
      expect(headers.Authorization).toMatch(/^Bearer .+/)
    })
  })
})
