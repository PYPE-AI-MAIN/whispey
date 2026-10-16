import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { acefoneCallIdOf, openAcefoneRecording } from '@/lib/acefoneRecording'

describe('acefoneCallIdOf', () => {
  it('finds the Acefone call id in call metadata', () => {
    expect(acefoneCallIdOf({ acefone_call_id: 'a1' })).toBe('a1')
    expect(acefoneCallIdOf({ provider: 'acefone', callId: 'c1' })).toBe('c1')
    expect(acefoneCallIdOf({ provider: 'acefone', callid: 'c2' })).toBe('c2')
    expect(acefoneCallIdOf({ provider: 'acefone', call_id: 'c3' })).toBe('c3')
  })

  it('returns null for other calls', () => {
    expect(acefoneCallIdOf(null)).toBeNull()
    expect(acefoneCallIdOf({})).toBeNull()
    expect(acefoneCallIdOf({ provider: 'plivo', callId: 'x' })).toBeNull()
    expect(acefoneCallIdOf({ provider: 'acefone' })).toBeNull()
  })
})

describe('openAcefoneRecording', () => {
  let tab: { location: { href: string }; close: ReturnType<typeof vi.fn> }
  const alert = vi.fn()

  beforeEach(() => {
    tab = { location: { href: '' }, close: vi.fn() }
    alert.mockReset()
    vi.stubGlobal('window', { open: vi.fn(() => tab) })
    vi.stubGlobal('alert', alert)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('opens the tab first, then sends it to the recording', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ recordingUrl: 'https://acefone/rec/1' }) }))
    vi.stubGlobal('fetch', fetchMock)
    await openAcefoneRecording('c1', 'agent-1')
    expect(fetchMock).toHaveBeenCalledWith('/api/acefone-recording', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ callId: 'c1', agentId: 'agent-1' }),
    }))
    expect(tab.location.href).toBe('https://acefone/rec/1')
    expect(alert).not.toHaveBeenCalled()
  })

  it('closes the tab and says so when there is no recording', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })))
    await openAcefoneRecording('c1', 'agent-1')
    expect(tab.close).toHaveBeenCalled()
    expect(alert).toHaveBeenCalledWith('Telephony recording not found for this call')
  })

  it('closes the tab and says so when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    await openAcefoneRecording('c1', 'agent-1')
    expect(tab.close).toHaveBeenCalled()
    expect(alert).toHaveBeenCalledWith('Failed to fetch telephony recording')
  })
})
