import { describe, it, expect } from 'vitest'
import { getAgentPlatform } from '@/utils/agentDetection'

describe('getAgentPlatform', () => {
  it('returns "vapi" when agent_type is "vapi"', () => {
    expect(getAgentPlatform({ agent_type: 'vapi' })).toBe('vapi')
  })

  it('returns "vapi" when assistantId is present in configuration', () => {
    expect(
      getAgentPlatform({ configuration: { vapi: { assistantId: 'asst_123' } } })
    ).toBe('vapi')
  })

  it('returns "vapi" when vapi_api_key_encrypted is present', () => {
    expect(getAgentPlatform({ vapi_api_key_encrypted: 'enc:abc' })).toBe('vapi')
  })

  it('returns "livekit" for a standard livekit agent', () => {
    expect(getAgentPlatform({ agent_type: 'livekit' })).toBe('livekit')
  })

  it('returns "livekit" when no vapi indicators are present', () => {
    expect(getAgentPlatform({ agent_type: 'other', name: 'demo' })).toBe('livekit')
  })

  it('returns "livekit" for an empty object', () => {
    expect(getAgentPlatform({})).toBe('livekit')
  })

  it('returns "livekit" for null/undefined agent', () => {
    expect(getAgentPlatform(null)).toBe('livekit')
    expect(getAgentPlatform(undefined)).toBe('livekit')
  })
})
