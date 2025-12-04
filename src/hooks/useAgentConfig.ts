// hooks/useAgentConfig.ts
import { AGENT_DEFAULT_CONFIG, getFallback, getFormDefaults } from "@/config/agentDefaults"
import { languageOptions } from "@/utils/constants"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

// Interface definitions remain the same...
export interface AgentConfigResponse {
  agent: {
    assistant: Array<{
      name?: string
      llm: {
        model: string
        provider?: string
        name?: string
        temperature?: number
        azure_config?: {
          endpoint: string
          api_version: string
        }
        azure_endpoint?: string
        api_version?: string
        azure_deployment?: string
        api_key_env?: string
      }
      tts?: {
        name: string
        model: string
        voice_id?: string
        speaker?: string
        language?: string
        target_language_code?: string
        loudness?: number
        speed?: number
        enable_preprocessing?: boolean
        voice_settings?: {
          similarity_boost: number
          stability: number
          style: number
          use_speaker_boost: boolean
          speed: number
        }
      }
      stt?: {
        name?: string
        provider?: string
        model?: string
        language?: string
        config?: Record<string, any>
      }
      vad?: {
        name: string
        min_silence_duration?: number
        min_speech_duration?: number
        prefix_padding_duration?: number
        max_buffered_speech?: number
        activation_threshold?: number
        sample_rate?: 8000 | 16000
        force_cpu?: boolean
      }
      prompt?: string
      variables?: Record<string, string>
      first_message_mode?:
        | {
            mode: string
            allow_interruptions: boolean
            first_message: string
          }
        | string
      interruptions?: {
        allow_interruptions: boolean
        min_interruption_duration: number
        min_interruption_words: number
      }
      first_message?: string
      ai_starts_after_silence?: boolean
      silence_time?: number
      allow_interruptions?: boolean
      min_interruption_duration?: number
      min_interruption_words?: number
      tools?: Array<{
        type: "end_call" | "handoff" | "custom_function" | string
        name?: string
        description?: string
        api_url?: string
        http_method?: string
        timeout?: number
        async?: boolean
        headers?: Record<string, any>
        parameters?: any[]
      }>
      filler_words?: {
        enabled: boolean
        general_fillers: string[]
        conversation_fillers: string[]
        conversation_keywords: string[]
      }
      bug_reports?: {
        enable: boolean
        bug_start_command: string[]
        bug_end_command: string[]
        response: string
        collection_prompt: string
      }
      background_audio?: {
        enabled: boolean
        type?: string
        volume?: number
        timing?: string
        ambient?: {
          type: string
          volume: number
        }
        thinking?: {
          type: string
          volume: number
        }
      }
      session_behavior?: {
        preemptive_generation: string
        turn_detection: "multilingual" | "english" | "smollm2" | "llm" | "smollm360m" | "disabled"
        unlikely_threshold?: number
        min_endpointing_delay?: number
        max_endpointing_delay?: number
        user_away_timeout?: number
        user_away_timeout_message?: string
      }
    }>
  }
  _usedAgentName?: string
}

const fetchAgentConfigWithFallback = async (
  primaryAgentName: string,
  fallbackAgentName?: string
): Promise<AgentConfigResponse> => {
  if (!primaryAgentName) {
    throw new Error("Agent name is required")
  }

  // Try primary name first (new format with ID)
  try {
    const response = await fetch(`/api/agent-config/${primaryAgentName}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    })

    if (response.ok) {
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const textResponse = await response.text()
        console.error("Non-JSON response received:", textResponse.substring(0, 200))
        throw new Error(`Expected JSON response but received: ${contentType || "unknown content type"}`)
      }
      const data = await response.json()
      // Mark which name was used
      data._usedAgentName = primaryAgentName
      return data
    }

    // If 404 and we have a fallback, try legacy format (without ID)
    if (response.status === 404 && fallbackAgentName && fallbackAgentName !== primaryAgentName) {
      
      const fallbackResponse = await fetch(`/api/agent-config/${fallbackAgentName}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      })

      if (fallbackResponse.ok) {
        const contentType = fallbackResponse.headers.get("content-type")
        if (!contentType || !contentType.includes("application/json")) {
          const textResponse = await fallbackResponse.text()
          console.error("Non-JSON response received:", textResponse.substring(0, 200))
          throw new Error(`Expected JSON response but received: ${contentType || "unknown content type"}`)
        }
        const data = await fallbackResponse.json()
        
        data._usedAgentName = fallbackAgentName
        return data
      }
    }

    throw new Error(`Failed to fetch agent config: ${response.status} ${response.statusText}`)
  } catch (error) {
    throw error
  }
}

const saveAgentDraft = async (data: any) => {
  const response = await fetch("/api/agents/save-draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.message || "Failed to save draft")
  }

  return response.json()
}

const saveAndDeployAgent = async (data: any) => {
  const response = await fetch("/api/agents/save-and-deploy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.message || "Failed to save and deploy")
  }

  return response.json()
}

// Hook to fetch agent config
export const useAgentConfig = (
  agentName: string | null | undefined,
  legacyAgentName?: string | null
) => {
  return useQuery({
    queryKey: ["agent-config", agentName, legacyAgentName],
    queryFn: () => fetchAgentConfigWithFallback(agentName!, legacyAgentName || undefined),
    enabled: !!agentName,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    throwOnError: false,
  })
}

// Hook for mutations (save operations)
export const useAgentMutations = (agentName: string | null) => {
  const queryClient = useQueryClient()

  const saveDraftMutation = useMutation({
    mutationFn: saveAgentDraft,
    onSuccess: () => {
      if (agentName) {
        queryClient.invalidateQueries({ queryKey: ["agent-config", agentName] })
      }
      console.log("✅ Draft saved successfully")
      // You could add a toast notification here
    },
    onError: (error) => {
      console.error("❌ Failed to save draft:", error)
      // You could add a toast notification here
    },
  })

  const saveAndDeployMutation = useMutation({
    mutationFn: saveAndDeployAgent,
    onSuccess: () => {
      if (agentName) {
        queryClient.invalidateQueries({ queryKey: ["agent-config", agentName] })
      }
      console.log("✅ Agent deployed successfully")
      // You could add a toast notification here
    },
    onError: (error) => {
      console.error("❌ Failed to deploy agent:", error)
      // You could add a toast notification here
    },
  })

  return {
    saveDraft: {
      mutate: saveDraftMutation.mutate,
      isPending: saveDraftMutation.isPending,
      error: saveDraftMutation.error,
      isSuccess: saveDraftMutation.isSuccess,
    },
    saveAndDeploy: {
      mutate: saveAndDeployMutation.mutate,
      isPending: saveAndDeployMutation.isPending,
      error: saveAndDeployMutation.error,
      isSuccess: saveAndDeployMutation.isSuccess,
    },
  }
}

export const getDefaultFormValues = getFormDefaults

export const buildFormValuesFromAgent = (assistant: any) => {
  const llmConfig = assistant.llm || {}
  const modelValue = llmConfig.model || getFallback(null, 'llm.model')
  const providerValue = llmConfig.provider || llmConfig.name || getFallback(null, 'llm.name')
  const temperatureValue = llmConfig.temperature ?? getFallback(null, 'llm.temperature')

  let mappedProvider = providerValue
  if (providerValue === "groq") {
    mappedProvider = "groq"
  } else if (providerValue === "azure") {
    mappedProvider = "azure_openai"
  } else if (modelValue.includes("claude")) {
    mappedProvider = "anthropic"
  } else if (modelValue.includes("cerebras") || providerValue === "cerebras") {
    mappedProvider = "cerebras"
  }

  let firstMessageModeValue
  let customFirstMessageValue = ""

  if (assistant.first_message_mode) {
    if (typeof assistant.first_message_mode === "object") {
      firstMessageModeValue = {
        mode: assistant.first_message_mode.mode || getFallback(null, 'first_message_mode.mode'),
        allow_interruptions: assistant.first_message_mode.allow_interruptions ?? getFallback(null, 'first_message_mode.allow_interruptions'),
        first_message: assistant.first_message_mode.first_message || getFallback(null, 'first_message_mode.first_message'),
      }
      customFirstMessageValue = assistant.first_message_mode.first_message || getFallback(null, 'first_message_mode.first_message')
    } else {
      firstMessageModeValue = {
        mode: assistant.first_message_mode,
        allow_interruptions: getFallback(null, 'first_message_mode.allow_interruptions'),
        first_message: assistant.first_message || getFallback(null, 'first_message_mode.first_message'),
      }
      customFirstMessageValue = assistant.first_message || getFallback(null, 'first_message_mode.first_message')
    }
  } else {
    firstMessageModeValue = {
      mode: getFallback(null, 'first_message_mode.mode'),
      allow_interruptions: getFallback(null, 'first_message_mode.allow_interruptions'),
      first_message: assistant.first_message || getFallback(null, 'first_message_mode.first_message'),
    }
    customFirstMessageValue = assistant.first_message || getFallback(null, 'first_message_mode.first_message')
  }

  const sessionBehavior = assistant.session_behavior || {}

  const backgroundAudio = assistant.background_audio || {}
  const hasAmbient = backgroundAudio.ambient?.type !== undefined
  const hasThinking = backgroundAudio.thinking?.type !== undefined
  
  let backgroundAudioMode: 'disabled' | 'single' | 'dual' = 'disabled'
  if (backgroundAudio.enabled) {
    if (hasAmbient && hasThinking) {
      backgroundAudioMode = 'dual'
    } else if (hasThinking || hasAmbient) {
      backgroundAudioMode = 'single'
    }
  }

  return {
    selectedProvider: mappedProvider,
    selectedModel: modelValue,
    selectedVoice: assistant.tts?.voice_id || assistant.tts?.speaker || assistant.tts?.voice_name || getFallback(null, 'tts.voice_id'),
    selectedLanguage: assistant.tts?.language || assistant.stt?.language || getFallback(null, 'stt.language'),
    firstMessageMode: firstMessageModeValue,
    customFirstMessage: customFirstMessageValue,
    aiStartsAfterSilence: assistant.ai_starts_after_silence || false,
    silenceTime: assistant.silence_time || 10,
    prompt: assistant.prompt || "",
    variables: assistant.variables
      ? Object.entries(assistant.variables).map(([name, value]) => ({
          name,
          value: String(value),
          description: "",
        }))
      : [],
    temperature: temperatureValue,
    ttsProvider: assistant.tts?.name || getFallback(null, 'tts.name'),
    ttsModel: assistant.tts?.model || getFallback(null, 'tts.model'),
    ttsVoiceConfig:
      assistant.tts?.name === "sarvam" || assistant.tts?.name === "sarvam_tts"
        ? {
            // Map language back to target_language_code for Sarvam (since we save in ElevenLabs format)
            target_language_code: assistant.tts?.target_language_code ?? assistant.tts?.language ?? "en-IN",
            loudness: assistant.tts?.voice_settings?.loudness ?? assistant.tts?.loudness ?? 1.0,
            speed: assistant.tts?.voice_settings?.speed ?? assistant.tts?.speed ?? 1.0,
            enable_preprocessing: assistant.tts?.voice_settings?.enable_preprocessing ?? assistant.tts?.enable_preprocessing ?? true,
          }
        : assistant.tts?.name === "elevenlabs"
          ? {
              voiceId: assistant.tts?.voice_id ?? getFallback(null, 'tts.voice_id'),
              language: assistant.tts?.language ?? getFallback(null, 'tts.language'),
              similarityBoost: assistant.tts?.voice_settings?.similarity_boost ?? getFallback(null, 'tts.voice_settings.similarity_boost'),
              stability: assistant.tts?.voice_settings?.stability ?? getFallback(null, 'tts.voice_settings.stability'),
              style: assistant.tts?.voice_settings?.style ?? getFallback(null, 'tts.voice_settings.style'),
              useSpeakerBoost: assistant.tts?.voice_settings?.use_speaker_boost ?? getFallback(null, 'tts.voice_settings.use_speaker_boost'),
              speed: assistant.tts?.voice_settings?.speed ?? getFallback(null, 'tts.voice_settings.speed'),
            }
          : assistant.tts?.name === "google"
            ? {
                voice_name: assistant.tts?.voice_name ?? getFallback(null, 'tts.voice_name'),
                gender: assistant.tts?.gender,
              }
            : {},
    sttProvider: assistant.stt?.provider || assistant.stt?.name || getFallback(null, 'stt.name'),
    sttModel: assistant.stt?.model || getFallback(null, 'stt.model'),
    sttConfig: {
      language: assistant.stt?.language || getFallback(null, 'stt.language'),
      ...(assistant.stt?.config || {}),
    },
    advancedSettings: {
      interruption: {
        allowInterruptions: assistant.interruptions?.allow_interruptions ?? assistant.allow_interruptions ?? getFallback(null, 'interruptions.allow_interruptions'),
        minInterruptionDuration: assistant.interruptions?.min_interruption_duration ?? assistant.min_interruption_duration ?? getFallback(null, 'interruptions.min_interruption_duration'),
        minInterruptionWords: assistant.interruptions?.min_interruption_words ?? assistant.min_interruption_words ?? getFallback(null, 'interruptions.min_interruption_words'),
      },
      vad: {
        vadProvider: assistant.vad?.name || getFallback(null, 'vad.name'),
        minSilenceDuration: assistant.vad?.min_silence_duration ?? getFallback(null, 'vad.min_silence_duration'),
        minSpeechDuration: assistant.vad?.min_speech_duration ?? getFallback(null, 'vad.min_speech_duration'),
        prefixPaddingDuration: assistant.vad?.prefix_padding_duration ?? getFallback(null, 'vad.prefix_padding_duration'),
        maxBufferedSpeech: assistant.vad?.max_buffered_speech ?? getFallback(null, 'vad.max_buffered_speech'),
        activationThreshold: assistant.vad?.activation_threshold ?? getFallback(null, 'vad.activation_threshold'),
        sampleRate: (() => {
          const value = assistant.vad?.sample_rate ?? getFallback(null, 'vad.sample_rate')
          if (value === 8000 || value === 16000) {
            return value as 8000 | 16000
          }
          return undefined
        })(),
        forceCpu: assistant.vad?.force_cpu ?? getFallback(null, 'vad.force_cpu'),
      },
      session: {
        preemptiveGeneration: (sessionBehavior.preemptive_generation || getFallback(null, 'session_behavior.preemptive_generation')) as "disabled" | "enabled",
        turn_detection: (sessionBehavior.turn_detection || getFallback(null, 'session_behavior.turn_detection')) as "multilingual" | "english" | "smollm2turndetector" | "llmturndetector" | "smollm360m" | "disabled",
        unlikely_threshold: sessionBehavior.unlikely_threshold ?? getFallback(null, 'session_behavior.unlikely_threshold'),
        min_endpointing_delay: sessionBehavior.min_endpointing_delay ?? getFallback(null, 'session_behavior.min_endpointing_delay'),
        max_endpointing_delay: sessionBehavior.max_endpointing_delay ?? getFallback(null, 'session_behavior.max_endpointing_delay'),
        user_away_timeout: sessionBehavior.user_away_timeout !== undefined && sessionBehavior.user_away_timeout !== null ? sessionBehavior.user_away_timeout : undefined,
        user_away_timeout_message: sessionBehavior.user_away_timeout_message !== undefined && sessionBehavior.user_away_timeout_message !== null && sessionBehavior.user_away_timeout_message !== '' ? sessionBehavior.user_away_timeout_message : undefined,
      },
      tools: {
        tools: assistant.tools?.map((tool: any) => ({
          id: `tool_${tool.type}_${Date.now()}_${Math.random()}`,
          type: tool.type,
          name: tool.name || (
            tool.type === 'end_call' ? 'End Call' : 
            tool.type === 'handoff' ? 'Handoff Agent' : 
            tool.type === 'transfer_call' ? 'Transfer Call' : 
            tool.type === 'ivr_navigator' ? 'Send DTMF' : 
            'Custom Tool'
          ),
          config: {
            description: tool.description || '',
            endpoint: tool.api_url || '',
            method: tool.http_method || 'GET',
            headers: tool.headers || {},
            body: tool.custom_payload || '',
            targetAgent: tool.target_agent || '',
            handoffMessage: tool.handoff_message || '',
            transferNumber: tool.transfer_number || '',
            sipTrunkId: tool.sip_outbound_trunk || '',
            timeout: tool.timeout || 10,
            asyncExecution: tool.async || false,
            parameters: tool.parameters?.map((param: any) => ({
              id: `param_${param.name}_${Date.now()}_${Math.random()}`,
              name: param.name,
              type: param.type,
              description: param.description,
              required: param.required
            })) || [],
            responseMapping: tool.response_mapping_raw || '{}',
            // IVR Navigator fields
            function_name: tool.function_name || 'send_dtmf_code',
            docstring: tool.docstring || '',
            cooldown_seconds: tool.cooldown_seconds || 3,
            publish_topic: tool.publish_topic || 'dtmf_code',
            publish_data: tool.publish_data ?? true,
            instruction_template: tool.instruction_template || '',
            default_task: tool.default_task || 'Reach a live support representative',
            task_metadata_keys: tool.task_metadata_keys || ['ivr_task', 'navigator_task', 'task']
          }
        })) || []
      },
      fillers: {
        enableFillerWords: assistant.filler_words?.enabled ?? getFallback(null, 'filler_words.enabled'),
        generalFillers: assistant.filler_words?.general_fillers?.filter((f: string) => f !== "") || [],
        conversationFillers: assistant.filler_words?.conversation_fillers?.filter((f: string) => f !== "") || [],
        conversationKeywords: assistant.filler_words?.conversation_keywords?.filter((f: string) => f !== "") || [],
      },
      bugs: {
        enableBugReport: assistant.bug_reports?.enable ?? getFallback(null, 'bug_reports.enable'),
        bugStartCommands: assistant.bug_reports?.bug_start_command || [],
        bugEndCommands: assistant.bug_reports?.bug_end_command || [],
        initialResponse: assistant.bug_reports?.response || "",
        collectionPrompt: assistant.bug_reports?.collection_prompt || "",
      },
      backgroundAudio: {
        mode: backgroundAudioMode,
        singleType: backgroundAudio.thinking?.type || backgroundAudio.ambient?.type || backgroundAudio.type || 'keyboard',
        singleVolume: backgroundAudio.thinking?.volume ?? backgroundAudio.ambient?.volume ?? backgroundAudio.volume ?? 50,
        singleTiming: (backgroundAudio.timing || 'thinking') as 'thinking' | 'always',
        ambientType: backgroundAudio.ambient?.type || getFallback(null, 'background_audio.ambient.type'),
        ambientVolume: backgroundAudio.ambient?.volume ?? getFallback(null, 'background_audio.ambient.volume'),
        thinkingType: backgroundAudio.thinking?.type || getFallback(null, 'background_audio.thinking.type'),
        thinkingVolume: backgroundAudio.thinking?.volume ?? getFallback(null, 'background_audio.thinking.volume'),
      },
    },
  }
}
