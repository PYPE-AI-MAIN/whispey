// hooks/useAgentConfig.ts
import { languageOptions } from '@/utils/constants'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Interface definitions remain the same...
export interface AgentConfigResponse {
  agent: {
    assistant: Array<{
      name?: string,
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
        min_silence_duration: number
      }
      prompt?: string
      variables?: Record<string, string>
      first_message_mode?: {
        mode: string
        allow_interruptions: boolean
        first_message: string
      } | string
      interruptions?: {
        allow_interruptions: boolean
        min_interruption_duration: number
        min_interruption_words: number
      }
      turn_detection?: string
      first_message?: string
      ai_starts_after_silence?: boolean
      silence_time?: number
      allow_interruptions?: boolean
      min_interruption_duration?: number
      min_interruption_words?: number
      preemptive_generation?: string
      tools?: Array<{
        type: 'end_call' | 'handoff' | 'custom_function' | string
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
    }>
  }
}

const fetchAgentConfig = async (agentName: string): Promise<AgentConfigResponse> => {
  if (!agentName) {
    throw new Error('Agent name is required')
  }

  console.log('Fetching agent config for:', agentName)

  // Use your Next.js API proxy instead of direct external API call
  const response = await fetch(`/api/agent-config/${agentName}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch agent config: ${response.status} ${response.statusText}`)
  }

  // Check if response is actually JSON
  const contentType = response.headers.get('content-type')
  if (!contentType || !contentType.includes('application/json')) {
    const textResponse = await response.text()
    console.error('Non-JSON response received:', textResponse.substring(0, 200))
    throw new Error(`Expected JSON response but received: ${contentType || 'unknown content type'}`)
  }

  try {
    return await response.json()
  } catch (jsonError) {
    const textResponse = await response.text()
    console.error('Failed to parse JSON response:', textResponse.substring(0, 200))
    throw new Error('Invalid JSON response from server')
  }
}

const saveAgentDraft = async (data: any) => {
  const response = await fetch('/api/agents/save-draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.message || 'Failed to save draft')
  }
  
  return response.json()
}

const saveAndDeployAgent = async (data: any) => {
  const response = await fetch('/api/agents/save-and-deploy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.message || 'Failed to save and deploy')
  }
  
  return response.json()
}

// Hook to fetch agent config
export const useAgentConfig = (agentName: string | null | undefined) => {
  return useQuery({
    queryKey: ['agent-config', agentName],
    queryFn: () => fetchAgentConfig(agentName!),
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
        queryClient.invalidateQueries({ queryKey: ['agent-config', agentName] })
      }
      console.log('✅ Draft saved successfully')
      // You could add a toast notification here
    },
    onError: (error) => {
      console.error('❌ Failed to save draft:', error)
      // You could add a toast notification here
    }
  })
  
  const saveAndDeployMutation = useMutation({
    mutationFn: saveAndDeployAgent,
    onSuccess: () => {
      if (agentName) {
        queryClient.invalidateQueries({ queryKey: ['agent-config', agentName] })
      }
      console.log('✅ Agent deployed successfully')
      // You could add a toast notification here
    },
    onError: (error) => {
      console.error('❌ Failed to deploy agent:', error)
      // You could add a toast notification here
    }
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
    }
  }
}



export const getDefaultFormValues = () => ({
  selectedProvider: 'openai',
  selectedModel: 'gpt-4o',
  selectedVoice: '',
  selectedLanguage: languageOptions[0]?.value || 'en',
  firstMessageMode: {
    mode: 'user_speaks_first',
    allow_interruptions: true,
    first_message: ''
  },
  customFirstMessage: '',
  aiStartsAfterSilence: false,
  silenceTime: 10,
  prompt: '',
  variables: [],
  temperature: 0.7,
  ttsProvider: '',
  ttsModel: '',
  ttsVoiceConfig: {},
  sttProvider: '',
  sttModel: '',
  sttConfig: {language: 'en'},
  advancedSettings: {
    interruption: {
      allowInterruptions: true,
      minInterruptionDuration: 1.5,
      minInterruptionWords: 2
    },
    vad: {
      vadProvider: 'silero',
      minSilenceDuration: 0.5
    },
    session: {
      preemptiveGeneration: 'enabled' as 'enabled' | 'disabled',
      turn_detection: 'multilingual' as 'multilingual' | 'english' | 'disabled'
    },
    tools: {
      tools: [] as Array<{
        id: string
        type: 'end_call' | 'handoff' | 'custom_function'
        name: string
        config: any
      }>
    },
    fillers: {
      enableFillerWords: true,
      generalFillers: [] as string[],
      conversationFillers: [] as string[],
      conversationKeywords: [] as string[]
    },
    bugs: {
      enableBugReport: false,
      bugStartCommands: [] as string[],
      bugEndCommands: [] as string[],
      initialResponse: '',
      collectionPrompt: ''
    }
  }
})


export const buildFormValuesFromAgent = (assistant: any) => {
  const llmConfig = assistant.llm || {}
  const modelValue = llmConfig.model || 'gpt-4o'
  const providerValue = llmConfig.provider || llmConfig.name || 'openai'
  const temperatureValue = llmConfig.temperature || 0.7

  // Provider mapping
  let mappedProvider = providerValue
  if (providerValue === 'groq') {
    mappedProvider = 'groq'
  } else if (providerValue === 'azure') {
    mappedProvider = 'azure_openai' 
  } else if (modelValue.includes('claude')) {
    mappedProvider = 'anthropic'
  } else if (modelValue.includes('cerebras')) {
    mappedProvider = 'cerebras'
  }

  let firstMessageModeValue
  let customFirstMessageValue = ''

  if (assistant.first_message_mode) {
    if (typeof assistant.first_message_mode === 'object') {
      // New object format
      firstMessageModeValue = {
        mode: assistant.first_message_mode.mode || 'user_speaks_first',
        allow_interruptions: assistant.first_message_mode.allow_interruptions ?? true,
        first_message: assistant.first_message_mode.first_message || ''
      }
      customFirstMessageValue = assistant.first_message_mode.first_message || ''
    } else {
      // Old string format - convert to object
      firstMessageModeValue = {
        mode: assistant.first_message_mode,
        allow_interruptions: true,
        first_message: assistant.first_message || ''
      }
      customFirstMessageValue = assistant.first_message || ''
    }
  } else {
    // Fallback to old individual fields
    firstMessageModeValue = {
      mode: 'user_speaks_first',
      allow_interruptions: true,
      first_message: assistant.first_message || ''
    }
    customFirstMessageValue = assistant.first_message || ''
  }

  return {
    selectedProvider: mappedProvider,
    selectedModel: modelValue,
    selectedVoice: assistant.tts?.voice_id || assistant.tts?.speaker || '',
    selectedLanguage: assistant.tts?.language || assistant.stt?.language || languageOptions[0]?.value || 'en',
    firstMessageMode: firstMessageModeValue,
    customFirstMessage: customFirstMessageValue, // Keep for backward compatibility
    aiStartsAfterSilence: assistant.ai_starts_after_silence || false,
    silenceTime: assistant.silence_time || 10,
    prompt: assistant.prompt || '',
    variables: assistant.variables 
    ? Object.entries(assistant.variables).map(([name, value]) => ({
        name,
        value: String(value),
        description: ''
      }))
    : [],
    temperature: temperatureValue,
    ttsProvider: assistant.tts?.name || 'elevenlabs',
    ttsModel: assistant.tts?.model || 'eleven_multilingual_v2',
    ttsVoiceConfig: (assistant.tts?.name === 'sarvam' || assistant.tts?.name === 'sarvam_tts') ? {
      target_language_code: assistant.tts?.target_language_code ?? 'en-IN',
      loudness: assistant.tts?.loudness ?? 1.0,
      speed: assistant.tts?.speed ?? 1.0,
      enable_preprocessing: assistant.tts?.enable_preprocessing ?? true
    } : assistant.tts?.name === 'elevenlabs' ? {
      voiceId: assistant.tts?.voice_id ?? '',
      language: assistant.tts?.language ?? 'en',
      similarityBoost: assistant.tts?.voice_settings?.similarity_boost ?? 0.75,
      stability: assistant.tts?.voice_settings?.stability ?? 0.5,
      style: assistant.tts?.voice_settings?.style ?? 0,
      useSpeakerBoost: assistant.tts?.voice_settings?.use_speaker_boost ?? true,
      speed: assistant.tts?.voice_settings?.speed ?? 1.0
    } : {},
    sttProvider: assistant.stt?.provider || assistant.stt?.name || 'openai',
    sttModel: assistant.stt?.model || 'whisper-1',
    sttConfig: {
      language: assistant.stt?.language || 'en',           
      ...assistant.stt?.config || {}                       
    },
    advancedSettings: {
      interruption: {
        allowInterruptions: assistant.interruptions?.allow_interruptions ?? assistant.allow_interruptions ?? true,           
        minInterruptionDuration: assistant.interruptions?.min_interruption_duration ?? assistant.min_interruption_duration ?? 1.2, 
        minInterruptionWords: assistant.interruptions?.min_interruption_words ?? assistant.min_interruption_words ?? 2          
      },
      vad: {
        vadProvider: assistant.vad?.name || 'silero',
        minSilenceDuration: assistant.vad?.min_silence_duration || 0.1
      },
      session: {
        preemptiveGeneration: (assistant.preemptive_generation || 'enabled') as 'enabled' | 'disabled',
        turn_detection: (assistant.turn_detection || 'multilingual') as 'multilingual' | 'english' | 'disabled'
      },
      tools: {
        tools: assistant.tools?.map((tool: any) => ({
          id: `tool_${Date.now()}_${Math.random()}`,
          type: tool.type,
          name: tool.name || (tool.type === 'end_call' ? 'End Call' : ''),
          config: {
            description: tool.description || (tool.type === 'end_call' ? 'Allow assistant to end the conversation' : ''),
            endpoint: tool.api_url || '',
            method: tool.http_method || 'GET',
            timeout: tool.timeout || 10,
            asyncExecution: tool.async || false,
            headers: tool.headers || {},
            parameters: tool.parameters || []
          }
        })) || []
      },
      fillers: {
        enableFillerWords: assistant.filler_words?.enabled ?? true,
        generalFillers: assistant.filler_words?.general_fillers?.filter((f: string) => f !== '') || [],
        conversationFillers: assistant.filler_words?.conversation_fillers?.filter((f: string) => f !== '') || [],
        conversationKeywords: assistant.filler_words?.conversation_keywords?.filter((f: string) => f !== '') || []
      },
      bugs: {
        enableBugReport: assistant.bug_reports?.enable ?? false,
        bugStartCommands: assistant.bug_reports?.bug_start_command || [],
        bugEndCommands: assistant.bug_reports?.bug_end_command || [],
        initialResponse: assistant.bug_reports?.response || '',
        collectionPrompt: assistant.bug_reports?.collection_prompt || ''
      }
    }
  }
}