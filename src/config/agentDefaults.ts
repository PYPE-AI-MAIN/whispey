// src/config/agentDefaults.ts

/**
 * Default configuration for PypeAI voice agents
 * This serves as the single source of truth for all agent defaults
 * Used in: agent creation, agent config UI, and payload building
 */

export const AGENT_DEFAULT_CONFIG = {
    // Speech-to-Text (STT) Configuration
    stt: {
      name: "deepgram",
      provider: "deepgram",
      language: "en",
      model: "nova-3",
      config: {}
    },
  
    // Large Language Model (LLM) Configuration
    llm: {
      name: "azure_openai",
      provider: "azure",
      model: "gpt-4.1-mini",
      temperature: 0.3,
      azure_deployment: "gpt-4.1-mini",
      azure_endpoint: "https://pype-azure-openai.openai.azure.com/",
      api_version: "2024-10-01-preview",
      api_key_env: "AZURE_OPENAI_API_KEY"
    },
  
    // Text-to-Speech (TTS) Configuration
    tts: {
      name: "elevenlabs",
      provider: "elevenlabs",
      voice_id: "MmQVkVZnQ0dUbfWzcW6f",
      model: "eleven_flash_v2_5",
      language: "en",
      voice_settings: {
        similarity_boost: 1,
        stability: 0.8,
        style: 1,
        use_speaker_boost: true,
        speed: 1.05
      }
    },
  
    // Voice Activity Detection (VAD) Configuration
    vad: {
      name: "silero",
      min_silence_duration: 0.55,
      min_speech_duration: 0.05,
      prefix_padding_duration: 0.5,
      max_buffered_speech: 60.0,
      activation_threshold: 0.5,
      sample_rate: 16000,
      force_cpu: true
    },
  
    // Interruption Settings
    interruptions: {
      allow_interruptions: true,
      min_interruption_duration: 0.8,
      min_interruption_words: 0
    },
  
    // First Message Configuration
    first_message_mode: {
      mode: "assistant_speaks_first",
      first_message: "Hello! How can I help you today?",
      allow_interruptions: false
    },
  
    // Session Behavior Configuration
    session_behavior: {
      preemptive_generation: "disabled",
      turn_detection: "disabled",
      unlikely_threshold: 0.6,
      min_endpointing_delay: 0.7,
      max_endpointing_delay: 0.7,
      user_away_timeout: undefined, // None to disable, 0 to use config default, or seconds
      user_away_timeout_message: undefined // Message to speak when user goes away
    },
  
    // Background Audio Configuration
    background_audio: {
      enabled: false,
      ambient: {
        type: "office",
        volume: 5
      },
      thinking: {
        type: "keyboard",
        volume: 0.5
      }
    },
  
    // Tools Configuration
    tools: [
      {
        type: "end_call"
      }
    ],
  
    // Filler Words Configuration
    filler_words: {
      enabled: false,
      general_fillers: [],
      conversation_fillers: [],
      conversation_keywords: []
    },
  
    // Bug Report Configuration
    bug_reports: {
      enable: false,
      bug_start_command: [],
      bug_end_command: [],
      response: "",
      collection_prompt: ""
    }
  }
  
  /**
   * UI Form defaults mapped from AGENT_DEFAULT_CONFIG
   * Used in Formik initialization and form state
   */
  export const getFormDefaults = () => ({
    // LLM Settings
    selectedProvider: AGENT_DEFAULT_CONFIG.llm.name,
    selectedModel: AGENT_DEFAULT_CONFIG.llm.model,
    temperature: AGENT_DEFAULT_CONFIG.llm.temperature,
  
    // TTS Settings
    selectedVoice: AGENT_DEFAULT_CONFIG.tts.voice_id,
    ttsProvider: AGENT_DEFAULT_CONFIG.tts.name,
    ttsModel: AGENT_DEFAULT_CONFIG.tts.model,
    ttsVoiceConfig: {
      voiceId: AGENT_DEFAULT_CONFIG.tts.voice_id,
      language: AGENT_DEFAULT_CONFIG.tts.language,
      similarityBoost: AGENT_DEFAULT_CONFIG.tts.voice_settings.similarity_boost,
      stability: AGENT_DEFAULT_CONFIG.tts.voice_settings.stability,
      style: AGENT_DEFAULT_CONFIG.tts.voice_settings.style,
      useSpeakerBoost: AGENT_DEFAULT_CONFIG.tts.voice_settings.use_speaker_boost,
      speed: AGENT_DEFAULT_CONFIG.tts.voice_settings.speed
    },
  
    // STT Settings
    selectedLanguage: AGENT_DEFAULT_CONFIG.stt.language,
    sttProvider: AGENT_DEFAULT_CONFIG.stt.name,
    sttModel: AGENT_DEFAULT_CONFIG.stt.model,
    sttConfig: {
      language: AGENT_DEFAULT_CONFIG.stt.language,
      ...AGENT_DEFAULT_CONFIG.stt.config
    },
  
    // First Message Settings
    firstMessageMode: {
      mode: AGENT_DEFAULT_CONFIG.first_message_mode.mode,
      allow_interruptions: AGENT_DEFAULT_CONFIG.first_message_mode.allow_interruptions,
      first_message: AGENT_DEFAULT_CONFIG.first_message_mode.first_message
    },
    customFirstMessage: AGENT_DEFAULT_CONFIG.first_message_mode.first_message,
  
    // Basic Settings
    prompt: "",
    variables: [],
    // Note: The following predefined system variables are automatically available if user wants to use:
    // - wcalling_number: The phone number (if provided)
    // - wcurrent_time: Current time (IST)
    // - wcurrent_date: Current date in timezone
    // - wcontext_dropoff: Context summary for drop-off calls (generated from context drop-off prompt)
    // These variables are populated by the system and don't need to be added to the variables array
    aiStartsAfterSilence: false,
    silenceTime: 10,
  
    // Advanced Settings
    advancedSettings: {
      interruption: {
        allowInterruptions: AGENT_DEFAULT_CONFIG.interruptions.allow_interruptions,
        minInterruptionDuration: AGENT_DEFAULT_CONFIG.interruptions.min_interruption_duration,
        minInterruptionWords: AGENT_DEFAULT_CONFIG.interruptions.min_interruption_words
      },
      vad: {
        vadProvider: AGENT_DEFAULT_CONFIG.vad.name,
        minSilenceDuration: AGENT_DEFAULT_CONFIG.vad.min_silence_duration,
        minSpeechDuration: AGENT_DEFAULT_CONFIG.vad.min_speech_duration,
        prefixPaddingDuration: AGENT_DEFAULT_CONFIG.vad.prefix_padding_duration,
        maxBufferedSpeech: AGENT_DEFAULT_CONFIG.vad.max_buffered_speech,
        activationThreshold: AGENT_DEFAULT_CONFIG.vad.activation_threshold,
        sampleRate: 16000 as 8000 | 16000,
        forceCpu: AGENT_DEFAULT_CONFIG.vad.force_cpu
      },
      session: {
        preemptiveGeneration: AGENT_DEFAULT_CONFIG.session_behavior.preemptive_generation as "disabled" | "enabled",
        turn_detection: AGENT_DEFAULT_CONFIG.session_behavior.turn_detection as "multilingual" | "english" | "smollm2turndetector" | "llmturndetector" | "smollm360m" | "disabled",
        unlikely_threshold: AGENT_DEFAULT_CONFIG.session_behavior.unlikely_threshold,
        min_endpointing_delay: AGENT_DEFAULT_CONFIG.session_behavior.min_endpointing_delay,
        max_endpointing_delay: AGENT_DEFAULT_CONFIG.session_behavior.max_endpointing_delay,
        user_away_timeout: AGENT_DEFAULT_CONFIG.session_behavior.user_away_timeout,
        user_away_timeout_message: AGENT_DEFAULT_CONFIG.session_behavior.user_away_timeout_message
      },
      tools: {
        tools: AGENT_DEFAULT_CONFIG.tools.map((tool, index) => ({
          id: `tool_${tool.type}_${Date.now()}_${index}`,
          type: tool.type as "end_call" | "handoff" | "custom_function",
          name: tool.type === "end_call" ? "End Call" : "",
          config: {
            description: tool.type === "end_call" ? "Allow assistant to end the conversation" : ""
          }
        }))
      },
      fillers: {
        enableFillerWords: AGENT_DEFAULT_CONFIG.filler_words.enabled,
        generalFillers: [...AGENT_DEFAULT_CONFIG.filler_words.general_fillers],
        conversationFillers: [...AGENT_DEFAULT_CONFIG.filler_words.conversation_fillers],
        conversationKeywords: [...AGENT_DEFAULT_CONFIG.filler_words.conversation_keywords]
      },
      bugs: {
        enableBugReport: AGENT_DEFAULT_CONFIG.bug_reports.enable,
        bugStartCommands: [...AGENT_DEFAULT_CONFIG.bug_reports.bug_start_command],
        bugEndCommands: [...AGENT_DEFAULT_CONFIG.bug_reports.bug_end_command],
        initialResponse: AGENT_DEFAULT_CONFIG.bug_reports.response,
        collectionPrompt: AGENT_DEFAULT_CONFIG.bug_reports.collection_prompt
      },
      backgroundAudio: {
        mode: 'disabled' as 'disabled' | 'single' | 'dual',
        singleType: 'keyboard',
        singleVolume: 50,
        singleTiming: 'thinking' as 'thinking' | 'always',
        ambientType: AGENT_DEFAULT_CONFIG.background_audio.ambient.type,
        ambientVolume: AGENT_DEFAULT_CONFIG.background_audio.ambient.volume,
        thinkingType: AGENT_DEFAULT_CONFIG.background_audio.thinking.type,
        thinkingVolume: AGENT_DEFAULT_CONFIG.background_audio.thinking.volume
      },
      webhook: {
        triggerOnCallLog: false,
        webhookUrl: '',
        httpMethod: 'POST',
        headers: {},
        isActive: false
      }
    }
  })
  
  /**
   * Helper function to get fallback value with default
   * Usage: getFallback(value, 'llm.temperature')
   */
  export const getFallback = (value: any, path: string): any => {
    if (value !== undefined && value !== null) return value
  
    const keys = path.split('.')
    let current: any = AGENT_DEFAULT_CONFIG
  
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key]
      } else {
        return undefined
      }
    }
  
    return current
  }