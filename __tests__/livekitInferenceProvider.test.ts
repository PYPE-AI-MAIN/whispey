import { describe, it, expect } from 'vitest'
import { buildSingleAssistantLlmPayload } from '@/hooks/useMultiAssistantState'
import { modelOptions } from '@/utils/constants'
import { PROVIDER_DISPLAY_NAMES } from '@/utils/providerDisplay'

// The LiveKit Inference provider is deliberately wired with *no* new mapping code:
// it relies on the existing pass-through branches. These tests pin that down, so a
// future refactor of the provider mappings can't silently reroute it to OpenAI.
describe('livekit inference provider', () => {
  it('is selectable in the provider dropdown', () => {
    expect(modelOptions.map(o => o.value)).toContain('livekit')
  })

  it('has a display name', () => {
    expect(PROVIDER_DISPLAY_NAMES.livekit).toBe('LiveKit Inference')
  })

  it('sends provider+name verbatim so both backend paths resolve it', () => {
    // create_agent.py reads llm.provider; workflow/providers.py reads llm.name
    const llm = buildSingleAssistantLlmPayload(
      { selectedProvider: 'livekit', selectedModel: 'google/gemma-4-31b-it', temperature: 0.3 },
      null, null,
    )
    expect(llm.provider).toBe('livekit')
    expect(llm.name).toBe('livekit')
    expect(llm.model).toBe('google/gemma-4-31b-it')
    expect(llm.temperature).toBe(0.3)
  })

  it('adds no api_key_env — the gateway auths with LIVEKIT_API_KEY/SECRET', () => {
    const llm = buildSingleAssistantLlmPayload(
      { selectedProvider: 'livekit', selectedModel: 'google/gemma-4-31b-it' }, null, null,
    )
    expect(llm).not.toHaveProperty('api_key_env')
  })

  it('works as a fallback provider too', () => {
    const llm = buildSingleAssistantLlmPayload(
      {
        selectedProvider: 'openai', selectedModel: 'gpt-4.1-mini',
        fallbackLlmProvider: 'livekit', fallbackLlmModel: 'google/gemma-4-31b-it',
      },
      null, null,
    )
    expect(llm.fallback.provider).toBe('livekit')
    expect(llm.fallback.model).toBe('google/gemma-4-31b-it')
    expect(llm.fallback).not.toHaveProperty('api_key_env')
  })
})
