import { describe, it, expect } from 'vitest'
import { deriveTtsVoiceConfig } from '@/hooks/useAgentConfig'

describe('ElevenLabs expressive mode config', () => {
  it('loads the saved flag and tags', () => {
    const cfg = deriveTtsVoiceConfig({ name: 'elevenlabs', model: 'eleven_v4_turbo', voice_id: 'v', expressive: true, audio_tags: ['warmly'], audio_tag_notes: { warmly: 'when greeting' } })
    expect(cfg.expressive).toBe(true)
    expect(cfg.audioTags).toEqual(['warmly'])
    expect(cfg.audioTagNotes).toEqual({ warmly: 'when greeting' })
  })

  it('is off with no tags when nothing was saved', () => {
    const cfg = deriveTtsVoiceConfig({ name: 'elevenlabs', model: 'eleven_flash_v2_5', voice_id: 'v' })
    expect(cfg.expressive).toBe(false)
    expect(cfg.audioTags).toEqual([])
    expect(cfg.audioTagNotes).toEqual({})
  })
})

import { buildSingleAssistantTtsPayload } from '@/hooks/useMultiAssistantState'

describe('what the page saves for a classic agent', () => {
  const form = (model: string, cfg: Record<string, unknown>) => ({
    ttsProvider: 'elevenlabs', selectedVoice: 'v', ttsModel: model, ttsVoiceConfig: { language: 'en', ...cfg },
  })
  const tts = (model: string, cfg: Record<string, unknown>) =>
    buildSingleAssistantTtsPayload(form(model, cfg), { provider: 'elevenlabs', model, config: { language: 'en', ...cfg } })

  it('sends expressive and the tags for a v4 voice', () => {
    const out = tts('eleven_v4_turbo', { expressive: true, audioTags: ['warmly', 'patiently'] })
    expect(out.expressive).toBe(true)
    expect(out.audio_tags).toEqual(['warmly', 'patiently'])
    expect(out.voice_settings).not.toHaveProperty('expressive') // VoiceSettings(**) on the worker would reject it
  })

  it('sends nothing extra when it is off or the model has no tags', () => {
    expect(tts('eleven_v4_turbo', { expressive: false })).not.toHaveProperty('expressive')
    expect(tts('eleven_flash_v2_5', { expressive: true, audioTags: ['warmly'] })).not.toHaveProperty('audio_tags')
  })

  it('sends only the notes for picked tags, trimmed, and drops blank ones', () => {
    const out = tts('eleven_v4_turbo', {
      expressive: true, audioTags: ['warmly', 'patiently'],
      audioTagNotes: { warmly: '  when greeting ', patiently: '   ', sighs: 'not picked' },
    })
    expect(out.audio_tag_notes).toEqual({ warmly: 'when greeting' })
    expect(out.voice_settings).not.toHaveProperty('audio_tag_notes')
  })
})
