import { describe, it, expect } from 'vitest'
import {
  serializeConfig,
  deserializeConfig,
  validateConfigSchema,
  prettyPrintConfig,
} from '@/utils/agentConfigSerializer'

const baseFormik = {
  selectedProvider: 'openai',
  selectedModel: 'gpt-4o',
  temperature: 0.7,
  ttsProvider: 'elevenlabs',
  ttsModel: 'eleven_flash_v2_5',
  selectedVoice: 'voice-id-1',
  selectedLanguage: 'en',
  ttsVoiceConfig: { stability: 0.5 },
  sttProvider: 'deepgram',
  sttModel: 'nova-2',
  sttConfig: { language: 'en' },
  prompt: 'You are a helpful assistant',
  variables: [{ name: 'name', value: 'John', description: 'User name' }],
  firstMessageMode: 'assistant_waits_for_user',
  customFirstMessage: 'Hello!',
  aiStartsAfterSilence: false,
  silenceTime: 10,
  dynamic_tts: [],
  advancedSettings: {
    interruption: { allowInterruptions: true, minInterruptionDuration: 0.5, minInterruptionWords: 2 },
    vad: { vadProvider: 'silero', minSilenceDuration: 0.3, minSpeechDuration: 0.1, prefixPaddingDuration: 0.3, maxBufferedSpeech: 60, activationThreshold: 0.5, forceCpu: false },
    session: { preemptiveGeneration: 'disabled', turn_detection: 'multilingual' },
    tools: { tools: [] },
    fillers: { enableFillerWords: true, language: 'auto', questionKeywords: [], questionFillers: [], ambiguousKeywords: [], ambiguousFillers: [], generalFillers: [], fillerCooldownSec: 4.0, latencyThreshold: 1.2, conversationFillers: [], conversationKeywords: [] },
    bugs: { enableBugReport: false, bugStartCommands: [], bugEndCommands: [], initialResponse: '', collectionPrompt: '' },
    backgroundAudio: { mode: 'dual', singleType: 'keyboard', singleVolume: 50, singleTiming: 'thinking', ambientType: 'office', ambientVolume: 5, thinkingType: 'keyboard', thinkingVolume: 0.5, thinkingProbability: 0.10, toolCallTyping: true, toolCallVolume: 0.80 },
  },
  fallbackLlmEnabled: false,
  fallbackLlmProvider: '',
  fallbackLlmModel: '',
  fallbackLlmTemperature: 0.3,
  fallbackTtsEnabled: false,
  fallbackTtsProvider: '',
  fallbackTtsModel: '',
  fallbackTtsVoiceId: '',
  fallbackTtsVoiceConfig: {},
  fallbackSttEnabled: false,
  fallbackSttProvider: '',
  fallbackSttModel: '',
  fallbackSttConfig: {},
}

const baseTts = { provider: 'elevenlabs', model: 'eleven_flash_v2_5', config: { stability: 0.5 } }
const baseStt = { provider: 'deepgram', model: 'nova-2', config: {} }
const baseAzure = { endpoint: '', apiVersion: '' }

describe('serializeConfig', () => {
  it('returns version 1.0', () => {
    const result = serializeConfig(baseFormik, baseTts, baseStt, baseAzure)
    expect(result.version).toBe('1.0')
  })

  it('includes a valid ISO timestamp', () => {
    const result = serializeConfig(baseFormik, baseTts, baseStt, baseAzure)
    expect(() => new Date(result.timestamp)).not.toThrow()
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('maps llm fields correctly', () => {
    const result = serializeConfig(baseFormik, baseTts, baseStt, baseAzure)
    expect(result.config.llm.provider).toBe('openai')
    expect(result.config.llm.model).toBe('gpt-4o')
    expect(result.config.llm.temperature).toBe(0.7)
  })

  it('does not include azureConfig for non-azure provider', () => {
    const result = serializeConfig(baseFormik, baseTts, baseStt, baseAzure)
    expect(result.config.llm.azureConfig).toBeUndefined()
  })

  it('includes azureConfig for azure_openai provider', () => {
    const azureFormik = { ...baseFormik, selectedProvider: 'azure_openai' }
    const azureConfig = { endpoint: 'https://my.azure.com', apiVersion: '2024-02-01' }
    const result = serializeConfig(azureFormik, baseTts, baseStt, azureConfig)
    expect(result.config.llm.azureConfig).toEqual(azureConfig)
  })

  it('maps tts fields from ttsConfig', () => {
    const result = serializeConfig(baseFormik, baseTts, baseStt, baseAzure)
    expect(result.config.tts.provider).toBe('elevenlabs')
    expect(result.config.tts.voiceId).toBe('voice-id-1')
  })

  it('maps stt fields', () => {
    const result = serializeConfig(baseFormik, baseTts, baseStt, baseAzure)
    expect(result.config.stt.provider).toBe('deepgram')
    expect(result.config.stt.model).toBe('nova-2')
  })

  it('maps prompt and variables', () => {
    const result = serializeConfig(baseFormik, baseTts, baseStt, baseAzure)
    expect(result.config.prompt.text).toBe('You are a helpful assistant')
    expect(result.config.prompt.variables).toHaveLength(1)
    expect(result.config.prompt.variables[0].name).toBe('name')
  })

  it('maps conversation flow', () => {
    const result = serializeConfig(baseFormik, baseTts, baseStt, baseAzure)
    expect(result.config.conversationFlow.firstMessageMode).toBe('assistant_waits_for_user')
    expect(result.config.conversationFlow.aiStartsAfterSilence).toBe(false)
  })

  it('maps fallback settings', () => {
    const result = serializeConfig(baseFormik, baseTts, baseStt, baseAzure)
    expect(result.config.fallback.llm.enabled).toBe(false)
    expect(result.config.fallback.tts.enabled).toBe(false)
    expect(result.config.fallback.stt.enabled).toBe(false)
  })

  it('handles missing optional formik fields gracefully', () => {
    const minimal = { selectedProvider: 'openai', selectedModel: 'gpt-4o', temperature: 0.5 }
    const result = serializeConfig(minimal, {}, {}, {})
    expect(result.version).toBe('1.0')
    expect(result.config.llm.provider).toBe('openai')
  })
})

describe('deserializeConfig', () => {
  it('round-trips through serialize → stringify → deserialize', () => {
    const serialized = serializeConfig(baseFormik, baseTts, baseStt, baseAzure)
    const json = JSON.stringify(serialized)
    const result = deserializeConfig(json)
    expect(result.formikValues.selectedProvider).toBe('openai')
    expect(result.formikValues.selectedModel).toBe('gpt-4o')
    expect(result.formikValues.ttsProvider).toBe('elevenlabs')
    expect(result.formikValues.sttProvider).toBe('deepgram')
    expect(result.formikValues.prompt).toBe('You are a helpful assistant')
  })

  it('restores ttsConfig and sttConfig objects', () => {
    const serialized = serializeConfig(baseFormik, baseTts, baseStt, baseAzure)
    const result = deserializeConfig(JSON.stringify(serialized))
    expect(result.ttsConfig.provider).toBe('elevenlabs')
    expect(result.sttConfig.provider).toBe('deepgram')
  })

  it('restores azureConfig', () => {
    const azureFormik = { ...baseFormik, selectedProvider: 'azure_openai' }
    const azureConfig = { endpoint: 'https://my.azure.com', apiVersion: '2024-02-01' }
    const serialized = serializeConfig(azureFormik, baseTts, baseStt, azureConfig)
    const result = deserializeConfig(JSON.stringify(serialized))
    expect(result.azureConfig.endpoint).toBe('https://my.azure.com')
    expect(result.azureConfig.apiVersion).toBe('2024-02-01')
  })

  it('handles snapshot format (agent.assistant array)', () => {
    const snapshot = {
      agent: {
        assistant: [{
          llm: { provider: 'openai', model: 'gpt-4o', temperature: 0.8 },
          tts: { provider: 'elevenlabs', model: 'flash', voice: 'voice-x' },
          stt: { provider: 'deepgram', model: 'nova-2', config: {} },
          prompt: 'Be helpful',
          variables: [],
          first_message_mode: 'assistant_waits_for_user',
          first_message: 'Hi!',
        }]
      }
    }
    const result = deserializeConfig(JSON.stringify(snapshot))
    expect(result.formikValues.selectedProvider).toBe('openai')
    expect(result.formikValues.selectedModel).toBe('gpt-4o')
    expect(result.formikValues.temperature).toBe(0.8)
    expect(result.formikValues.ttsProvider).toBe('elevenlabs')
    expect(result.formikValues.selectedVoice).toBe('voice-x')
    expect(result.formikValues.prompt).toBe('Be helpful')
  })

  it('snapshot format falls back for missing fields', () => {
    const snapshot = { agent: { assistant: [{ llm: {}, tts: {}, stt: {} }] } }
    const result = deserializeConfig(JSON.stringify(snapshot))
    expect(result.formikValues.selectedProvider).toBe('')
    expect(result.formikValues.temperature).toBe(0.7)
  })

  it('restores fallback settings', () => {
    const formikWithFallback = {
      ...baseFormik,
      fallbackLlmEnabled: true,
      fallbackLlmProvider: 'openai',
      fallbackLlmModel: 'gpt-4o-mini',
      fallbackLlmTemperature: 0.5,
    }
    const serialized = serializeConfig(formikWithFallback, baseTts, baseStt, baseAzure)
    const result = deserializeConfig(JSON.stringify(serialized))
    expect(result.formikValues.fallbackLlmEnabled).toBe(true)
    expect(result.formikValues.fallbackLlmProvider).toBe('openai')
    expect(result.formikValues.fallbackLlmTemperature).toBe(0.5)
  })
})

describe('validateConfigSchema', () => {
  it('validates a fully correct serialized config', () => {
    const serialized = serializeConfig(baseFormik, baseTts, baseStt, baseAzure)
    const result = validateConfigSchema(JSON.stringify(serialized))
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects invalid JSON', () => {
    const result = validateConfigSchema('not json {')
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toMatch(/invalid json/i)
  })

  it('rejects missing version', () => {
    const serialized = serializeConfig(baseFormik, baseTts, baseStt, baseAzure) as any
    delete serialized.version
    const result = validateConfigSchema(JSON.stringify(serialized))
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing version field')
  })

  it('rejects wrong version', () => {
    const serialized = serializeConfig(baseFormik, baseTts, baseStt, baseAzure) as any
    serialized.version = '9.9'
    const result = validateConfigSchema(JSON.stringify(serialized))
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('Unsupported version'))).toBe(true)
  })

  it('rejects missing config object', () => {
    const result = validateConfigSchema(JSON.stringify({ version: '1.0' }))
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing config object')
  })

  it('rejects missing llm section', () => {
    const serialized = serializeConfig(baseFormik, baseTts, baseStt, baseAzure) as any
    delete serialized.config.llm
    const result = validateConfigSchema(JSON.stringify(serialized))
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing LLM configuration')
  })

  it('rejects missing llm.provider', () => {
    const serialized = serializeConfig(baseFormik, baseTts, baseStt, baseAzure) as any
    serialized.config.llm.provider = ''
    const result = validateConfigSchema(JSON.stringify(serialized))
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing LLM provider')
  })

  it('rejects missing tts section', () => {
    const serialized = serializeConfig(baseFormik, baseTts, baseStt, baseAzure) as any
    delete serialized.config.tts
    const result = validateConfigSchema(JSON.stringify(serialized))
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing TTS configuration')
  })

  it('rejects missing stt section', () => {
    const serialized = serializeConfig(baseFormik, baseTts, baseStt, baseAzure) as any
    delete serialized.config.stt
    const result = validateConfigSchema(JSON.stringify(serialized))
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing STT configuration')
  })

  it('rejects missing prompt section', () => {
    const serialized = serializeConfig(baseFormik, baseTts, baseStt, baseAzure) as any
    delete serialized.config.prompt
    const result = validateConfigSchema(JSON.stringify(serialized))
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing prompt configuration')
  })

  it('rejects missing advancedSettings', () => {
    const serialized = serializeConfig(baseFormik, baseTts, baseStt, baseAzure) as any
    delete serialized.config.advancedSettings
    const result = validateConfigSchema(JSON.stringify(serialized))
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing advanced settings')
  })

  it('rejects missing advancedSettings sub-sections', () => {
    const serialized = serializeConfig(baseFormik, baseTts, baseStt, baseAzure) as any
    delete serialized.config.advancedSettings.vad
    const result = validateConfigSchema(JSON.stringify(serialized))
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('vad'))).toBe(true)
  })

  it('validates snapshot format with valid assistant', () => {
    const snapshot = {
      agent: {
        assistant: [{
          llm: { provider: 'openai', model: 'gpt-4o' },
          tts: { provider: 'elevenlabs' },
          stt: { provider: 'deepgram' },
        }]
      }
    }
    const result = validateConfigSchema(JSON.stringify(snapshot))
    expect(result.valid).toBe(true)
  })

  it('rejects snapshot format with missing providers', () => {
    const snapshot = {
      agent: {
        assistant: [{ llm: {}, tts: {}, stt: {} }]
      }
    }
    const result = validateConfigSchema(JSON.stringify(snapshot))
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing LLM provider')
    expect(result.errors).toContain('Missing TTS provider')
    expect(result.errors).toContain('Missing STT provider')
  })

  it('rejects snapshot with empty assistant', () => {
    const snapshot = { agent: { assistant: [] } }
    const result = validateConfigSchema(JSON.stringify(snapshot))
    expect(result.valid).toBe(false)
  })
})

describe('prettyPrintConfig', () => {
  it('returns valid JSON string', () => {
    const serialized = serializeConfig(baseFormik, baseTts, baseStt, baseAzure)
    const pretty = prettyPrintConfig(serialized)
    expect(() => JSON.parse(pretty)).not.toThrow()
    expect(JSON.parse(pretty)).toEqual(serialized)
  })

  it('uses 2-space indentation', () => {
    const serialized = serializeConfig(baseFormik, baseTts, baseStt, baseAzure)
    const pretty = prettyPrintConfig(serialized)
    expect(pretty).toMatch(/^{\n  "/)
  })
})
