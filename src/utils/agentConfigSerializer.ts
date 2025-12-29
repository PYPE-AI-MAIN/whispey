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
      selfHostedLLMConfig?: {
        url: string
        maxTokens: number
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
        generalFillers: string[]
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
  selfHostedLLMConfig?: {
    url: string
    maxTokens: number
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
  azureConfig: any,
  selfHostedLLMConfig?: any
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
        }),
        ...(formikValues.selectedProvider === 'self_hosted_llm' && selfHostedLLMConfig && {
          selfHostedLLMConfig: {
            url: selfHostedLLMConfig.url || 'http://localhost:8000/generate',
            maxTokens: selfHostedLLMConfig.maxTokens || 80
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
          enableFillerWords: false,
          generalFillers: [],
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
          mode: 'disabled'
        }
      }
    }
  }
}

/**
 * Deserializes a JSON configuration back to application state
 */
export function deserializeConfig(json: string): DeserializedConfig {
  const parsed: SerializedAgentConfig = JSON.parse(json)
  
  const { config } = parsed

  return {
    formikValues: {
      // LLM
      selectedProvider: config.llm.provider,
      selectedModel: config.llm.model,
      temperature: config.llm.temperature,
      
      // TTS
      ttsProvider: config.tts.provider,
      ttsModel: config.tts.model,
      selectedVoice: config.tts.voiceId,
      selectedLanguage: config.tts.language,
      ttsVoiceConfig: config.tts.config,
      
      // STT
      sttProvider: config.stt.provider,
      sttModel: config.stt.model,
      sttConfig: config.stt.config,
      
      // Prompt
      prompt: config.prompt.text,
      variables: config.prompt.variables,
      
      // Conversation Flow
      firstMessageMode: config.conversationFlow.firstMessageMode,
      customFirstMessage: config.conversationFlow.customFirstMessage,
      aiStartsAfterSilence: config.conversationFlow.aiStartsAfterSilence,
      silenceTime: config.conversationFlow.silenceTime,
      
      // Dynamic TTS
      dynamic_tts: config.dynamicTTS,
      
      // Advanced Settings
      advancedSettings: config.advancedSettings
    },
    ttsConfig: {
      provider: config.tts.provider,
      model: config.tts.model,
      config: config.tts.config
    },
    sttConfig: {
      provider: config.stt.provider,
      model: config.stt.model,
      config: config.stt.config
    },
    azureConfig: {
      endpoint: config.llm.azureConfig?.endpoint || '',
      apiVersion: config.llm.azureConfig?.apiVersion || ''
    },
    selfHostedLLMConfig: config.llm.selfHostedLLMConfig ? {
      url: config.llm.selfHostedLLMConfig.url || 'http://localhost:8000/generate',
      maxTokens: config.llm.selfHostedLLMConfig.maxTokens || 80
    } : undefined
  }
}

/**
 * Validates the configuration JSON structure
 */
export function validateConfigSchema(json: string): ValidationResult {
  const errors: string[] = []

  try {
    const parsed = JSON.parse(json)

    // Check version
    if (!parsed.version) {
      errors.push('Missing version field')
    } else if (parsed.version !== CURRENT_VERSION) {
      errors.push(`Unsupported version: ${parsed.version}. Expected: ${CURRENT_VERSION}`)
    }

    // Check config object exists
    if (!parsed.config) {
      errors.push('Missing config object')
      return { valid: false, errors }
    }

    const { config } = parsed

    // Validate LLM
    if (!config.llm) {
      errors.push('Missing LLM configuration')
    } else {
      if (!config.llm.provider) errors.push('Missing LLM provider')
      if (!config.llm.model) errors.push('Missing LLM model')
      if (typeof config.llm.temperature !== 'number') {
        errors.push('Invalid temperature value')
      }
    }

    // Validate TTS
    if (!config.tts) {
      errors.push('Missing TTS configuration')
    } else {
      if (!config.tts.provider) errors.push('Missing TTS provider')
    }

    // Validate STT
    if (!config.stt) {
      errors.push('Missing STT configuration')
    } else {
      if (!config.stt.provider) errors.push('Missing STT provider')
    }

    // Validate Prompt
    if (!config.prompt) {
      errors.push('Missing prompt configuration')
    } else {
      if (typeof config.prompt.text !== 'string') {
        errors.push('Invalid prompt text')
      }
      if (!Array.isArray(config.prompt.variables)) {
        errors.push('Invalid variables format')
      }
    }

    // Validate Conversation Flow
    if (!config.conversationFlow) {
      errors.push('Missing conversation flow configuration')
    }

    // Validate Advanced Settings (basic structure check)
    if (!config.advancedSettings) {
      errors.push('Missing advanced settings')
    } else {
      const requiredSections = ['interruption', 'vad', 'session', 'tools', 'fillers', 'bugs', 'backgroundAudio']
      for (const section of requiredSections) {
        if (!config.advancedSettings[section]) {
          errors.push(`Missing advanced settings section: ${section}`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }

  } catch (error) {
    if (error instanceof SyntaxError) {
      errors.push('Invalid JSON format')
    } else {
      errors.push('Unknown validation error')
    }
    return { valid: false, errors }
  }
}

/**
 * Pretty prints JSON for display
 */
export function prettyPrintConfig(config: SerializedAgentConfig): string {
  return JSON.stringify(config, null, 2)
}