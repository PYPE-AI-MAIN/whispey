import { describe, it, expect } from 'vitest'
import {
  RAYA_LANGUAGES,
  RAYA_MODELS,
  RAYA_PREVIEW_TEXT,
  RAYA_SAMPLE_RATES,
  normalizeRayaConfig,
  normalizeRayaLanguage,
  rayaConfigFromTts,
  rayaTtsPayload,
} from '@/lib/tts/raya'
import {
  buildFallbackTtsPayload,
  buildSingleAssistantTtsPayload,
  serializeLanguageSwitchTTS,
} from '@/hooks/useMultiAssistantState'
import { deriveFallbackTtsVoiceConfig, deriveTtsVoiceConfig } from '@/hooks/useAgentConfig'
import { PROVIDER_DISPLAY_NAMES } from '@/utils/providerDisplay'
import { TTS_PROVIDERS, getTtsProvider, isNewProvider, normalizeTtsProvider, tabForProvider } from '@/components/agents/AgentConfig/SelectTTSDialog/providers'

// Raya (Bakbak) TTS — https://docs.litwizlabs.com. The contract below is TTSRequest from its
// OpenAPI spec; the backend enforces the same values in utils/raya_tts_config.py.

describe('raya contract', () => {
  it('offers exactly the documented models, languages and sample rates', () => {
    expect(RAYA_MODELS.map((m) => m.value).sort()).toEqual(['m1', 'standard'])
    expect(RAYA_LANGUAGES.map((l) => l.value).sort()).toEqual(
      ['as', 'bn', 'en-in', 'en-us', 'gu', 'hi', 'kn', 'ml', 'mr', 'ne', 'ta', 'te'],
    )
    expect(RAYA_SAMPLE_RATES.map((r) => r.value)).toEqual([8000, 16000, 22050, 24000])
  })

  it('has a preview line for every language', () => {
    for (const l of RAYA_LANGUAGES) expect(RAYA_PREVIEW_TEXT[l.value]).toBeTruthy()
  })
})

describe('normalizeRayaLanguage', () => {
  it.each([
    ['hi', 'hi'], ['hi-IN', 'hi'], ['ta_IN', 'ta'], ['en', 'en-in'], ['en-IN', 'en-in'],
    ['EN-US', 'en-us'], [' mr ', 'mr'],
  ])('%s -> %s', (given, expected) => {
    expect(normalizeRayaLanguage(given)).toBe(expected)
  })

  it('falls back to Hindi for anything Raya does not support', () => {
    expect(normalizeRayaLanguage('fr')).toBe('hi')
    expect(normalizeRayaLanguage(undefined)).toBe('hi')
  })
})

describe('normalizeRayaConfig', () => {
  it('fills defaults', () => {
    expect(normalizeRayaConfig({})).toEqual({ language: 'hi', model: 'm1', speed: 1, sample_rate: 24000 })
  })

  it('clamps speed to the API range and rounds it', () => {
    expect(normalizeRayaConfig({ speed: 9 }).speed).toBe(1.5)
    expect(normalizeRayaConfig({ speed: 0.1 }).speed).toBe(0.5)
    expect(normalizeRayaConfig({ speed: 1.2345 }).speed).toBe(1.23)
  })

  it('treats a stored speed of 0 as unset instead of clamping it to the minimum', () => {
    expect(normalizeRayaConfig({ speed: 0 }).speed).toBe(1)
  })

  it('reads a carried-over Sarvam pace', () => {
    expect(normalizeRayaConfig({ pace: 1.3 }).speed).toBe(1.3)
  })

  it('rejects unsupported model and sample rate', () => {
    const c = normalizeRayaConfig({ model: 'bulbul:v3', sample_rate: 44100 })
    expect(c.model).toBe('m1')
    expect(c.sample_rate).toBe(24000)
  })

  it('accepts a sample rate sent as a string', () => {
    expect(normalizeRayaConfig({ sample_rate: '16000' }).sample_rate).toBe(16000)
  })
})

describe('rayaTtsPayload / rayaConfigFromTts', () => {
  const config = { language: 'ta', model: 'standard', speed: 0.8, sample_rate: 8000 }

  it('builds the persisted tts shape', () => {
    const tts = rayaTtsPayload('voice-1', 'standard', config)
    expect(tts).toMatchObject({ name: 'raya', voice_id: 'voice-1', model: 'standard', language: 'ta' })
    expect(tts.voice_settings).toMatchObject({ speed: 0.8, sample_rate: 8000 })
  })

  it('includes the fields the backend TTSVoiceSettings model requires', () => {
    // utils/create_agent.py TTSVoiceSettings has no defaults for these; omitting them is a 422 on save
    const vs = rayaTtsPayload('v', 'm1', {}).voice_settings
    for (const key of ['similarity_boost', 'stability', 'style', 'use_speaker_boost', 'speed']) {
      expect(vs).toHaveProperty(key)
    }
  })

  it('the explicit model argument beats the one inside config', () => {
    expect(rayaTtsPayload('v', 'm1', { ...config, model: 'standard' }).model).toBe('m1')
  })

  it('round-trips: save, reload, same dialog config', () => {
    const reloaded = rayaConfigFromTts(rayaTtsPayload('voice-1', config.model, config))
    expect(reloaded).toEqual(config)
  })
})

describe('provider registry', () => {
  it('lists Raya and resolves aliases', () => {
    expect(TTS_PROVIDERS.map((p) => p.key)).toContain('raya')
    expect(normalizeTtsProvider('sarvam_tts')).toBe('sarvam')
    expect(normalizeTtsProvider('raya')).toBe('raya')
    expect(normalizeTtsProvider(undefined)).toBe('')
  })

  it('has unique keys, so adding a provider cannot shadow another', () => {
    const keys = TTS_PROVIDERS.map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('maps providers to tabs, defaulting to Sarvam like the old dialog', () => {
    expect(tabForProvider('raya')).toBe('raya')
    expect(tabForProvider('sarvam_tts')).toBe('sarvam')
    expect(tabForProvider('cartesia')).toBe('sarvam')
    expect(getTtsProvider('cartesia')).toBeUndefined()
  })

  it('shows the New badge for 30 days only', () => {
    const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
    expect(isNewProvider(daysAgo(5))).toBe(true)
    expect(isNewProvider(daysAgo(45))).toBe(false)
    expect(isNewProvider(undefined)).toBe(false)
    expect(isNewProvider('not-a-date')).toBe(false)
  })

  it('has a display name for observability', () => {
    expect(PROVIDER_DISPLAY_NAMES.raya).toBe('Raya')
  })
})

describe('saving a Raya agent', () => {
  const dialogConfig = { language: 'mr', model: 'm1', speed: 1.1, sample_rate: 16000 }

  it('single assistant: serializes voice, model, language, speed and sample rate', () => {
    const tts = buildSingleAssistantTtsPayload(
      { ttsProvider: 'raya', selectedVoice: 'v-1', ttsModel: 'm1', ttsVoiceConfig: dialogConfig },
      { provider: 'raya', model: 'm1', config: dialogConfig },
    )
    expect(tts).toMatchObject({ name: 'raya', voice_id: 'v-1', model: 'm1', language: 'mr' })
    expect(tts.voice_settings).toMatchObject({ speed: 1.1, sample_rate: 16000 })
  })

  it('single assistant: never falls back to the default ElevenLabs voice or settings', () => {
    const tts = buildSingleAssistantTtsPayload({ ttsProvider: 'raya', selectedVoice: '', ttsVoiceConfig: {} }, null)
    expect(tts.voice_id).toBe('')
    expect(tts.voice_settings.stability).not.toBe(0.5)
  })

  it('single assistant: attaches a Raya fallback to another primary and vice versa', () => {
    const withFallback = buildSingleAssistantTtsPayload(
      {
        ttsProvider: 'raya', selectedVoice: 'v-1', ttsModel: 'm1', ttsVoiceConfig: dialogConfig,
        fallbackTtsProvider: 'elevenlabs', fallbackTtsVoiceId: 'Rachel', fallbackTtsModel: 'eleven_flash_v2_5',
        fallbackTtsVoiceConfig: {},
      },
      null,
    )
    expect(withFallback.fallback).toMatchObject({ name: 'elevenlabs', voice_id: 'Rachel' })

    const rayaFallback = buildFallbackTtsPayload({
      fallbackTtsProvider: 'raya', fallbackTtsVoiceId: 'v-9', fallbackTtsModel: 'standard',
      fallbackTtsVoiceConfig: { language: 'en-in', model: 'standard', speed: 1, sample_rate: 24000 },
    })
    expect(rayaFallback).toMatchObject({ name: 'raya', voice_id: 'v-9', model: 'standard', language: 'en-in' })
  })

  it('language switch: keeps the voice instead of collapsing to { name }', () => {
    const out = serializeLanguageSwitchTTS(rayaTtsPayload('v-2', 'm1', { language: 'ta' }))
    expect(out).toMatchObject({ name: 'raya', voice_id: 'v-2', language: 'ta' })
    expect(out.voice_settings.sample_rate).toBe(24000)
  })
})

describe('reopening a saved Raya agent', () => {
  const saved = rayaTtsPayload('v-1', 'standard', { language: 'te', speed: 0.9, sample_rate: 22050 })

  it('primary: restores the dialog config from the stored tts', () => {
    expect(deriveTtsVoiceConfig(saved)).toEqual({ language: 'te', model: 'standard', speed: 0.9, sample_rate: 22050 })
  })

  it('fallback: restores the dialog config too', () => {
    expect(deriveFallbackTtsVoiceConfig(saved)).toEqual({ language: 'te', model: 'standard', speed: 0.9, sample_rate: 22050 })
  })
})
