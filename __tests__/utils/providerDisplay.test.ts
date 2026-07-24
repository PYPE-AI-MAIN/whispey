import { describe, it, expect } from 'vitest'
import { formatProviderLabel, PROVIDER_DISPLAY_NAMES } from '@/utils/providerDisplay'

describe('formatProviderLabel', () => {
  it('maps a known plugin segment to its display name', () => {
    expect(formatProviderLabel('livekit.plugins.deepgram.stt.STT')).toBe('Deepgram')
  })

  it('maps every backend actually used by the Python codegen', () => {
    // These correspond 1:1 to the provider/backend identifiers create_agent.py
    // dispatches on for STT/TTS/LLM — see utils/create_agent.py.
    const used = ['deepgram', 'sarvam', 'google', 'openai', 'elevenlabs', 'azure', 'cerebras', 'groq', 'aws', 'smallestai']
    for (const key of used) {
      expect(PROVIDER_DISPLAY_NAMES[key]).toBeTruthy()
    }
  })

  it('capitalizes an unknown plugin segment as a fallback', () => {
    expect(formatProviderLabel('livekit.plugins.newvendor.tts.TTS')).toBe('Newvendor')
  })

  it('returns "unknown" for an empty/undefined label', () => {
    expect(formatProviderLabel(undefined)).toBe('unknown')
    expect(formatProviderLabel('')).toBe('unknown')
  })

  it('returns the raw label unchanged if it does not contain "plugins"', () => {
    expect(formatProviderLabel('SomeCustomClass')).toBe('SomeCustomClass')
  })

  it('is case-insensitive when looking up the display name', () => {
    expect(formatProviderLabel('livekit.plugins.DEEPGRAM.stt.STT')).toBe('Deepgram')
  })
})
