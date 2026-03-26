// src/utils/agentConfigSerializer.ts

export interface SerializedAgentConfig {
  version: string
  timestamp: string
  config: {
    llm: {
      provider: string
      model: string
      temperature: number
      azureConfig?: {
        endpoint: string
        apiVersion: string
      }
    }
    tts: {
      provider: string
      model: string
      voiceId: string
      language?: string
      config: any
    }
    stt: {
      provider: string
      model: string
      config: any
    }
    prompt: {
      text: string
      variables: Array<{
        name: string
        value: string
        description: string
      }>
    }
    conversationFlow: {
      firstMessageMode: any
      customFirstMessage?: string
      aiStartsAfterSilence: boolean
      silenceTime: number
    }
    dynamicTTS: any[]
    advancedSettings: {
      interruption: {
        allowInterruptions: boolean
        minInterruptionDuration: number
        minInterruptionWords: number
      }
      vad: {
        vadProvider: string
        minSilenceDuration: number
        minSpeechDuration: number
        prefixPaddingDuration: number
        maxBufferedSpeech: number
        activationThreshold: number
        sampleRate?: 8000 | 16000
        forceCpu: boolean
      }
      session: {
        preemptiveGeneration: 'disabled' | 'enabled'
        turn_detection: 'multilingual' | 'english' | 'smollm2turndetector' | 'llmturndetector' | 'smollm360m' | 'disabled'
        unlikely_threshold?: number
        min_endpointing_delay?: number
        max_endpointing_delay?: number
        user_away_timeout?: number
        user_away_timeout_message?: string
      }
      tools: {
        tools: any[]
      }
      fillers: {
        enableFillerWords: boolean
        language: 'auto' | 'en' | 'hi'
        questionKeywords: string[]
        questionFillers: string[]
        ambiguousKeywords: string[]
        ambiguousFillers: string[]
        generalFillers: string[]
        fillerCooldownSec: number
        latencyThreshold: number
        conversationFillers: string[]
        conversationKeywords: string[]
      }
      bugs: {
        enableBugReport: boolean
        bugStartCommands: string[]
        bugEndCommands: string[]
        initialResponse: string
        collectionPrompt: string
      }
      backgroundAudio: {
        mode: 'disabled' | 'single' | 'dual'
        singleType?: string
        singleVolume?: number
        singleTiming?: 'thinking' | 'always'
        ambientType?: string
        ambientVolume?: number
        thinkingType?: string
        thinkingVolume?: number
        thinkingProbability?: number
        toolCallTyping?: boolean
        toolCallVolume?: number
      }
    }
  }
}

export interface DeserializedConfig {
  formikValues: any
  ttsConfig: {
    provider: string
    model: string
    config: any
  }
  sttConfig: {
    provider: string
    model: string
    config: any
  }
  azureConfig: {
    endpoint: string
    apiVersion: string
  }
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

const CURRENT_VERSION = '1.0'

/**
 * Serializes the current agent configuration to a portable JSON format
 */
export function serializeConfig(
  formikValues: any,
  ttsConfig: any,
  sttConfig: any,
  azureConfig: any
): SerializedAgentConfig {
  return {
    version: CURRENT_VERSION,
    timestamp: new Date().toISOString(),
    config: {
      llm: {
        provider: formikValues.selectedProvider || 'openai',
        model: formikValues.selectedModel || '',
        temperature: formikValues.temperature || 0.7,
        ...(formikValues.selectedProvider === 'azure_openai' && {
          azureConfig: {
            endpoint: azureConfig.endpoint || '',
            apiVersion: azureConfig.apiVersion || ''
          }
        })
      },
      tts: {
        provider: ttsConfig.provider || formikValues.ttsProvider || '',
        model: ttsConfig.model || formikValues.ttsModel || '',
        voiceId: formikValues.selectedVoice || '',
        language: formikValues.selectedLanguage || '',
        config: ttsConfig.config || formikValues.ttsVoiceConfig || {}
      },
      stt: {
        provider: sttConfig.provider || formikValues.sttProvider || '',
        model: sttConfig.model || formikValues.sttModel || '',
        config: sttConfig.config || formikValues.sttConfig || {}
      },
      prompt: {
        text: formikValues.prompt || '',
        variables: formikValues.variables || []
      },
      conversationFlow: {
        firstMessageMode: formikValues.firstMessageMode || 'assistant_waits_for_user',
        customFirstMessage: formikValues.customFirstMessage || '',
        aiStartsAfterSilence: formikValues.aiStartsAfterSilence || false,
        silenceTime: formikValues.silenceTime || 10
      },
      dynamicTTS: formikValues.dynamic_tts || [],
      advancedSettings: formikValues.advancedSettings || {
        interruption: {
          allowInterruptions: true,
          minInterruptionDuration: 0.5,
          minInterruptionWords: 2
        },
        vad: {
          vadProvider: 'silero',
          minSilenceDuration: 0.3,
          minSpeechDuration: 0.1,
          prefixPaddingDuration: 0.3,
          maxBufferedSpeech: 60,
          activationThreshold: 0.5,
          forceCpu: false
        },
        session: {
          preemptiveGeneration: 'disabled',
          turn_detection: 'multilingual'
        },
        tools: {
          tools: []
        },
        fillers: {
          enableFillerWords: true,
          language: 'auto' as 'auto' | 'en' | 'hi',
          questionKeywords: [],
          questionFillers: [],
          ambiguousKeywords: [],
          ambiguousFillers: [],
          generalFillers: [],
          fillerCooldownSec: 4.0,
          latencyThreshold: 1.2,
          conversationFillers: [],
          conversationKeywords: []
        },
        bugs: {
          enableBugReport: false,
          bugStartCommands: [],
          bugEndCommands: [],
          initialResponse: '',
          collectionPrompt: ''
        },
        backgroundAudio: {
          mode: 'dual' as 'disabled' | 'single' | 'dual',
          singleType: 'keyboard',
          singleVolume: 50,
          singleTiming: 'thinking' as 'thinking' | 'always',
          ambientType: 'office',
          ambientVolume: 5,
          thinkingType: 'keyboard',
          thinkingVolume: 0.5,
          thinkingProbability: 0.10,
          toolCallTyping: true,
          toolCallVolume: 0.80
        }
      }
    }
  }
}

/**
 * Deserializes a JSON configuration back to application state.
 * Accepts BOTH the serialized format and the raw config_snapshot format.
 */
export function deserializeConfig(json: string): DeserializedConfig {
  const parsed = JSON.parse(json)

  // Raw config_snapshot format
  if (isSnapshotFormat(parsed)) {
    return deserializeFromSnapshot(parsed)
  }

  // Serialized format
  const { config } = parsed as SerializedAgentConfig

  return {
    formikValues: {
      selectedProvider: config.llm.provider,
      selectedModel:    config.llm.model,
      temperature:      config.llm.temperature,

      ttsProvider:    config.tts.provider,
      ttsModel:       config.tts.model,
      selectedVoice:  config.tts.voiceId,
      selectedLanguage: config.tts.language,
      ttsVoiceConfig: config.tts.config,

      sttProvider: config.stt.provider,
      sttModel:    config.stt.model,
      sttConfig:   config.stt.config,

      prompt:    config.prompt.text,
      variables: config.prompt.variables,

      firstMessageMode:     config.conversationFlow.firstMessageMode,
      customFirstMessage:   config.conversationFlow.customFirstMessage,
      aiStartsAfterSilence: config.conversationFlow.aiStartsAfterSilence,
      silenceTime:          config.conversationFlow.silenceTime,

      dynamic_tts:      config.dynamicTTS,
      advancedSettings: config.advancedSettings,
    },
    ttsConfig: {
      provider: config.tts.provider,
      model:    config.tts.model,
      config:   config.tts.config,
    },
    sttConfig: {
      provider: config.stt.provider,
      model:    config.stt.model,
      config:   config.stt.config,
    },
    azureConfig: {
      endpoint:   config.llm.azureConfig?.endpoint   || '',
      apiVersion: config.llm.azureConfig?.apiVersion || '',
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: detect which format the pasted JSON is
// ─────────────────────────────────────────────────────────────────────────────

function isSnapshotFormat(parsed: any): boolean {
  // Raw config_snapshot: { agent: { assistant: [{ ... }] } }
  return !!(parsed?.agent?.assistant && Array.isArray(parsed.agent.assistant))
}

function extractAssistant(parsed: any): any {
  return parsed?.agent?.assistant?.[0] ?? parsed?.assistant?.[0] ?? {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: deserialize from raw config_snapshot
// ─────────────────────────────────────────────────────────────────────────────

function deserializeFromSnapshot(parsed: any): DeserializedConfig {
  const a = extractAssistant(parsed)

  return {
    formikValues: {
      selectedProvider: a.llm?.provider || '',
      selectedModel:    a.llm?.model    || '',
      temperature:      a.llm?.temperature ?? 0.7,

      ttsProvider:    a.tts?.provider || '',
      ttsModel:       a.tts?.model    || '',
      selectedVoice:  a.tts?.voice ?? a.tts?.voiceId ?? a.tts?.voice_id ?? '',
      ttsVoiceConfig: a.tts?.config   || {},

      sttProvider: a.stt?.provider || '',
      sttModel:    a.stt?.model    || '',
      sttConfig:   a.stt?.config   || {},

      prompt:    a.prompt    || '',
      variables: Array.isArray(a.variables) ? a.variables : [],

      firstMessageMode:   a.first_message_mode ?? a.firstMessageMode ?? 'assistant_waits_for_user',
      customFirstMessage: a.first_message ?? a.firstMessage ?? '',
      aiStartsAfterSilence: false,
      silenceTime: 10,

      dynamic_tts:      a.dynamic_tts      || [],
      advancedSettings: a.advancedSettings  || {},
    },
    ttsConfig: {
      provider: a.tts?.provider || '',
      model:    a.tts?.model    || '',
      config:   a.tts?.config   || {},
    },
    sttConfig: {
      provider: a.stt?.provider || '',
      model:    a.stt?.model    || '',
      config:   a.stt?.config   || {},
    },
    azureConfig: {
      endpoint:   a.llm?.azureConfig?.endpoint   || '',
      apiVersion: a.llm?.azureConfig?.apiVersion || '',
    },
  }
}

/**
 * Validates the configuration JSON structure.
 * Accepts BOTH the serialized format ({ version, config }) and
 * the raw config_snapshot format ({ agent: { assistant: [...] } }).
 */
export function validateConfigSchema(json: string): ValidationResult {
  const errors: string[] = []

  try {
    const parsed = JSON.parse(json)

    // ── Raw config_snapshot format ────────────────────────────────────────────
    if (isSnapshotFormat(parsed)) {
      const a = extractAssistant(parsed)
      if (!a || Object.keys(a).length === 0) {
        errors.push('Could not find assistant configuration inside the snapshot')
        return { valid: false, errors }
      }
      if (!a.llm?.provider) errors.push('Missing LLM provider')
      if (!a.llm?.model)    errors.push('Missing LLM model')
      if (!a.tts?.provider) errors.push('Missing TTS provider')
      if (!a.stt?.provider) errors.push('Missing STT provider')
      return { valid: errors.length === 0, errors }
    }

    // ── Serialized format ({ version, config }) ───────────────────────────────
    if (!parsed.version) {
      errors.push('Missing version field')
    } else if (parsed.version !== CURRENT_VERSION) {
      errors.push(`Unsupported version: ${parsed.version}. Expected: ${CURRENT_VERSION}`)
    }

    if (!parsed.config) {
      errors.push('Missing config object')
      return { valid: false, errors }
    }

    const { config } = parsed

    if (!config.llm) {
      errors.push('Missing LLM configuration')
    } else {
      if (!config.llm.provider) errors.push('Missing LLM provider')
      if (!config.llm.model)    errors.push('Missing LLM model')
      if (typeof config.llm.temperature !== 'number') errors.push('Invalid temperature value')
    }

    if (!config.tts) {
      errors.push('Missing TTS configuration')
    } else {
      if (!config.tts.provider) errors.push('Missing TTS provider')
    }

    if (!config.stt) {
      errors.push('Missing STT configuration')
    } else {
      if (!config.stt.provider) errors.push('Missing STT provider')
    }

    if (!config.prompt) {
      errors.push('Missing prompt configuration')
    } else {
      if (typeof config.prompt.text !== 'string') errors.push('Invalid prompt text')
      if (!Array.isArray(config.prompt.variables)) errors.push('Invalid variables format')
    }

    if (!config.conversationFlow) errors.push('Missing conversation flow configuration')

    if (!config.advancedSettings) {
      errors.push('Missing advanced settings')
    } else {
      const required = ['interruption', 'vad', 'session', 'tools', 'fillers', 'bugs', 'backgroundAudio']
      for (const section of required) {
        if (!config.advancedSettings[section]) {
          errors.push(`Missing advanced settings section: ${section}`)
        }
      }
    }

    return { valid: errors.length === 0, errors }

  } catch (error) {
    errors.push(error instanceof SyntaxError ? 'Invalid JSON format' : 'Unknown validation error')
    return { valid: false, errors }
  }
}

/**
 * Pretty prints JSON for display
 */
export function prettyPrintConfig(config: SerializedAgentConfig): string {
  return JSON.stringify(config, null, 2)
}