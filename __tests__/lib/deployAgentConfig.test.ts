import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { deployAgentConfig } from '@/lib/deployAgentConfig'

vi.mock('@/lib/serviceToken', () => ({
  serviceAuthHeaders: () => ({ 'x-api-key': 'test-key', Authorization: 'Bearer test-token' }),
}))

const AGENT = 'voice_testing_07d5abc1'
const VOICE_ID = 'CcvwadKSTkja3dbjRwC5'
const CONFIG_BODY = {
  agent: { name: AGENT, assistant: [{ tts: { name: 'elevenlabs', voice_id: VOICE_ID } }] },
}

function jsonResponse(status: number, body: any) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

describe('deployAgentConfig', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('PYPEAI_API_URL', 'https://api.test')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('returns unreachable 503 when no backend URL is configured', async () => {
    vi.stubEnv('PYPEAI_API_URL', '')
    vi.stubEnv('NEXT_PUBLIC_PYPEAI_API_URL', '')

    const result = await deployAgentConfig(AGENT, CONFIG_BODY)

    expect(result).toMatchObject({ ok: false, status: 503, unreachable: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('POSTs the config with service auth headers and returns backend data on success', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { status: 'success' }))

    const result = await deployAgentConfig(AGENT, CONFIG_BODY)

    expect(result).toEqual({ ok: true, status: 200, data: { status: 'success' } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`https://api.test/agent_config/${AGENT}`)
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer test-token')
    expect(JSON.parse(init.body)).toEqual(CONFIG_BODY)
  })

  it('succeeds even when the backend returns a non-JSON success body', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => { throw new Error('not json') },
      text: async () => 'ok',
    } as unknown as Response)

    const result = await deployAgentConfig(AGENT, CONFIG_BODY)

    expect(result).toEqual({ ok: true, status: 200, data: {} })
  })

  it('returns the backend error for non-gateway failures without verifying', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(403, { detail: 'Invalid token' }))

    const result = await deployAgentConfig(AGENT, CONFIG_BODY)

    expect(result).toMatchObject({ ok: false, status: 403 })
    expect((result as any).errorText).toContain('Invalid token')
    expect(fetchMock).toHaveBeenCalledTimes(1) // no verify GET
  })

  it('returns unreachable 503 when the fetch times out', async () => {
    const timeoutErr = new Error('timed out')
    timeoutErr.name = 'TimeoutError'
    fetchMock.mockRejectedValueOnce(timeoutErr)

    const result = await deployAgentConfig(AGENT, CONFIG_BODY)

    expect(result).toMatchObject({ ok: false, status: 503, unreachable: true })
  })

  it('rethrows unexpected fetch errors', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom'))

    await expect(deployAgentConfig(AGENT, CONFIG_BODY)).rejects.toThrow('boom')
  })

  it('treats a 502 as success when the re-read config shows the voice was applied', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(502, 'Bad Gateway'))
      .mockResolvedValueOnce(jsonResponse(200, {
        agent: { assistant: [{ tts: { voice_id: VOICE_ID } }] },
      }))

    const result = await deployAgentConfig(AGENT, CONFIG_BODY)

    expect(result).toMatchObject({ ok: true, status: 200, verifiedAfterError: true })
    expect(fetchMock.mock.calls[1][1].method).toBe('GET')
  })

  it('reports failure when the 502 verify never sees the new voice', async () => {
    vi.useFakeTimers()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(502, 'Bad Gateway'))
      .mockResolvedValue(jsonResponse(200, {
        agent: { assistant: [{ tts: { voice_id: 'old-voice' } }] },
      }))

    const promise = deployAgentConfig(AGENT, CONFIG_BODY)
    await vi.advanceTimersByTimeAsync(10_000) // skip the two 3s retry waits
    const result = await promise

    expect(result).toMatchObject({ ok: false, status: 502 })
    expect(fetchMock).toHaveBeenCalledTimes(4) // 1 POST + 3 verify GETs
  })

  it('keeps retrying the verify when GETs fail, then succeeds', async () => {
    vi.useFakeTimers()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(504, 'Gateway Timeout'))
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce(jsonResponse(200, {
        agent: { assistant: [{ tts: { voice_id: VOICE_ID } }] },
      }))

    const promise = deployAgentConfig(AGENT, CONFIG_BODY)
    await vi.advanceTimersByTimeAsync(10_000)
    const result = await promise

    expect(result).toMatchObject({ ok: true, verifiedAfterError: true })
  })

  it('does not verify a 502 when the posted config has no voice_id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(502, 'Bad Gateway'))

    const result = await deployAgentConfig(AGENT, { agent: { name: AGENT, assistant: [{}] } })

    expect(result).toMatchObject({ ok: false, status: 502 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
