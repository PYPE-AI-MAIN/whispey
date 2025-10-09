// hooks/useMultiAssistantState.ts
import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { FormikProps } from 'formik'

interface AssistantFormData {
  name: string
  formikRef?: FormikProps<any> | null
  ttsConfig: any
  sttConfig: any
  azureConfig: any
  hasUnsavedChanges: boolean
  isConfigured: boolean
}

interface UseMultiAssistantStateProps {
  initialAssistants: any[]
  agentId: string
  agentName: string
  agentType?: string
  // Current form state (for single assistant mode)
  currentFormik?: FormikProps<any>
  currentTtsConfig?: any
  currentSttConfig?: any
  currentAzureConfig?: any
}

export function useMultiAssistantState({ 
  initialAssistants, 
  agentId, 
  agentName,
  agentType = 'OUTBOUND',
  currentFormik,
  currentTtsConfig,
  currentSttConfig,
  currentAzureConfig
}: UseMultiAssistantStateProps) {
  
  // Store assistant names list
  const [assistantNames, setAssistantNames] = useState<string[]>(() => {
    return initialAssistants.map(a => a.name) || [agentName]
  })

  // Store assistant data in a Map for efficient lookup
  const [assistantsData, setAssistantsData] = useState<Map<string, AssistantFormData>>(() => {
    const map = new Map()
    if (initialAssistants.length > 0) {
      initialAssistants.forEach(assistant => {
        map.set(assistant.name, {
          name: assistant.name,
          formikRef: null,
          ttsConfig: assistant.tts || {},
          sttConfig: assistant.stt || {},
          azureConfig: {},
          hasUnsavedChanges: false,
          isConfigured: true
        })
      })
    } else {
      // Initialize with single assistant if no initial data
      map.set(agentName, {
        name: agentName,
        formikRef: null,
        ttsConfig: {},
        sttConfig: {},
        azureConfig: {},
        hasUnsavedChanges: false,
        isConfigured: false
      })
    }
    return map
  })

  // Get assistant data helper
  const getAssistantData = useCallback((name: string): AssistantFormData => {
    return assistantsData.get(name) || {
      name,
      formikRef: null,
      ttsConfig: {},
      sttConfig: {},
      azureConfig: {},
      hasUnsavedChanges: false,
      isConfigured: false
    }
  }, [assistantsData])

  // Update assistant data
  const updateAssistantData = useCallback((name: string, updates: Partial<AssistantFormData>) => {
    setAssistantsData(prev => {
      const newMap = new Map(prev)
      const currentData = getAssistantData(name)
      newMap.set(name, { ...currentData, ...updates })
      return newMap
    })
  }, [getAssistantData])

  // Build save payload
  const buildSavePayload = useCallback(() => {
    // For single assistant mode (current implementation)
    if (currentFormik && assistantNames.length <= 1) {
      const formValues = currentFormik.values
      
      // Convert variables array to object
      const variablesObject = Array.isArray(formValues.variables)
        ? formValues.variables.reduce((acc: any, v: any) => {
            acc[v.name] = v.value
            return acc
          }, {})
        : formValues.variables || {}

      // Properly format first_message_mode
      const firstMessageModeConfig = typeof formValues.firstMessageMode === 'object'
        ? {
            mode: formValues.firstMessageMode.mode,
            first_message: formValues.firstMessageMode.first_message || '',
            allow_interruptions: formValues.firstMessageMode.allow_interruptions ?? false
          }
        : {
            mode: formValues.firstMessageMode || 'assistant_waits_for_user',
            first_message: formValues.customFirstMessage || '',
            allow_interruptions: false
          }

      const assistant = {
        name: agentName,
        prompt: formValues.prompt || '',
        variables: variablesObject,
        stt: {
          name: currentSttConfig?.provider || formValues.sttProvider || 'openai',
          language: currentSttConfig?.config?.language || formValues.sttConfig?.language || 'en',
          model: currentSttConfig?.model || formValues.sttModel || 'whisper-1'
        },
        llm: {
          name: formValues.selectedProvider || 'openai',
          provider: formValues.selectedProvider === 'azure_openai' ? 'azure' : formValues.selectedProvider || 'openai',
          model: formValues.selectedModel || 'gpt-4',
          temperature: formValues.temperature || 0.7,
          ...(formValues.selectedProvider === 'azure_openai' && currentAzureConfig && {
            azure_deployment: "gpt-4.1-mini",
            azure_endpoint: currentAzureConfig.endpoint || 'https://pype-azure-openai.openai.azure.com/',
            api_version: currentAzureConfig.apiVersion || '2024-10-01-preview',
            api_key_env: 'AZURE_OPENAI_API_KEY'
          }),
          ...(formValues.selectedProvider === 'openai' && {
            api_key_env: 'OPENAI_API_KEY'
          }),
          ...(formValues.selectedProvider === 'groq' && {
            api_key_env: 'GROQ_API_KEY'
          }),
          ...(formValues.selectedProvider === 'cerebras' && {
            api_key_env: 'CEREBRAS_API_KEY'
          })
        },
        tts: {
          name: currentTtsConfig?.provider || formValues.ttsProvider || 'openai',
          voice_id: formValues.selectedVoice || '',
          model: currentTtsConfig?.model || formValues.ttsModel || '',
          language: currentTtsConfig?.config?.language || formValues.ttsVoiceConfig?.language || 'en',
          voice_settings: {
            similarity_boost: currentTtsConfig?.config?.similarityBoost ?? formValues.ttsVoiceConfig?.similarityBoost ?? 0.75,
            stability: currentTtsConfig?.config?.stability ?? formValues.ttsVoiceConfig?.stability ?? 0.5,
            style: currentTtsConfig?.config?.style ?? formValues.ttsVoiceConfig?.style ?? 0,
            use_speaker_boost: currentTtsConfig?.config?.useSpeakerBoost ?? formValues.ttsVoiceConfig?.useSpeakerBoost ?? true,
            speed: currentTtsConfig?.config?.speed ?? formValues.ttsVoiceConfig?.speed ?? 1.0
          }
        },
        vad: {
          name: formValues.advancedSettings?.vad?.vadProvider || 'silero',
          min_silence_duration: formValues.advancedSettings?.vad?.minSilenceDuration || 0.3
        },
        tools: formValues.advancedSettings?.tools?.tools?.map((tool: any) => ({
          type: tool.type,
          ...(tool.type !== 'end_call' && {
            name: tool.name,
            description: tool.config?.description || '',
            ...(tool.type === 'custom_function' && {
              api_url: tool.config?.endpoint || '',
              http_method: tool.config?.method || 'GET',
              timeout: tool.config?.timeout || 10,
              async: tool.config?.asyncExecution || false,
              headers: tool.config?.headers || {},
              parameters: tool.config?.parameters || []
            })
          })
        })) || [],
        filler_words: {
          enabled: formValues.advancedSettings?.fillers?.enableFillerWords ?? false,
          general_fillers: formValues.advancedSettings?.fillers?.generalFillers?.filter((f: string) => f !== '') || [],
          conversation_fillers: formValues.advancedSettings?.fillers?.conversationFillers?.filter((f: string) => f !== '') || [],
          conversation_keywords: formValues.advancedSettings?.fillers?.conversationKeywords?.filter((f: string) => f !== '') || []
        },
        bug_reports: {
          enable: formValues.advancedSettings?.bugs?.enableBugReport ?? false,
          bug_start_command: formValues.advancedSettings?.bugs?.bugStartCommands || [],
          bug_end_command: formValues.advancedSettings?.bugs?.bugEndCommands || [],
          response: formValues.advancedSettings?.bugs?.initialResponse || '',
          collection_prompt: formValues.advancedSettings?.bugs?.collectionPrompt || ''
        },
        interruptions: {
          allow_interruptions: formValues.advancedSettings?.interruption?.allowInterruptions ?? true,
          min_interruption_duration: formValues.advancedSettings?.interruption?.minInterruptionDuration ?? 1.3,
          min_interruption_words: formValues.advancedSettings?.interruption?.minInterruptionWords ?? 2
        },
        first_message_mode: firstMessageModeConfig,
        first_message: firstMessageModeConfig.first_message,
        turn_detection: formValues.advancedSettings?.session?.turn_detection || 'multilingual',
        session_behavior: {
          preemptive_generation: formValues.advancedSettings?.session?.preemptiveGeneration || 'enabled',
          turn_detection: formValues.advancedSettings?.session?.turn_detection || 'multilingual',
          unlikely_threshold: formValues.advancedSettings?.session?.unlikelyThreshold ?? 0.6,
          min_endpointing_delay: formValues.advancedSettings?.session?.minEndpointingDelay ?? 0.5,
          max_endpointing_delay: formValues.advancedSettings?.session?.maxEndpointingDelay ?? 3
        },
        background_audio: {
          enabled: formValues.advancedSettings?.backgroundAudio?.mode !== 'disabled',
          ...(formValues.advancedSettings?.backgroundAudio?.mode === 'single' && {
            type: formValues.advancedSettings.backgroundAudio.singleType,
            volume: formValues.advancedSettings.backgroundAudio.singleVolume,
            timing: formValues.advancedSettings.backgroundAudio.singleTiming
          }),
          ...(formValues.advancedSettings?.backgroundAudio?.mode === 'dual' && {
            ambient: {
              type: formValues.advancedSettings.backgroundAudio.ambientType,
              volume: formValues.advancedSettings.backgroundAudio.ambientVolume
            },
            thinking: {
              type: formValues.advancedSettings.backgroundAudio.thinkingType,
              volume: formValues.advancedSettings.backgroundAudio.thinkingVolume
            }
          })
        }
      }

      return {
        agent: {
          name: agentName,
          type: agentType,
          assistant: [assistant]
        }
      }
    }

    // For multiple assistants (future implementation)
    const assistants = assistantNames.map(name => {
      const data = assistantsData.get(name) || getAssistantData(name)
      const formValues = data.formikRef?.values || {}
      
      // Convert variables array to object
      const variablesObject = Array.isArray(formValues.variables)
        ? formValues.variables.reduce((acc: any, v: any) => {
            acc[v.name] = v.value
            return acc
          }, {})
        : formValues.variables || {}

      // Properly format first_message_mode
      const firstMessageModeConfig = typeof formValues.firstMessageMode === 'object'
        ? {
            mode: formValues.firstMessageMode.mode,
            first_message: formValues.firstMessageMode.first_message || '',
            allow_interruptions: formValues.firstMessageMode.allow_interruptions ?? false
          }
        : {
            mode: formValues.firstMessageMode || 'assistant_waits_for_user',
            first_message: formValues.customFirstMessage || '',
            allow_interruptions: false
          }
      
      return {
        name: name,
        prompt: formValues.prompt || '',
        variables: variablesObject,
        stt: {
          name: data.sttConfig?.name || formValues.sttProvider || 'openai',
          language: data.sttConfig?.language || formValues.sttConfig?.language || 'en',
          model: data.sttConfig?.model || formValues.sttModel || 'whisper-1'
        },
        llm: {
          name: formValues.selectedProvider || 'openai',
          provider: formValues.selectedProvider === 'azure_openai' ? 'azure' : formValues.selectedProvider || 'openai',
          model: formValues.selectedModel || 'gpt-4',
          temperature: formValues.temperature || 0.7,
          ...(formValues.selectedProvider === 'azure_openai' && currentAzureConfig && {
            azure_deployment: "gpt-4.1-mini", // Use the selected model as deployment
            azure_endpoint: currentAzureConfig.endpoint || 'https://pype-azure-openai.openai.azure.com/',
            api_version: currentAzureConfig.apiVersion || '2024-10-01-preview',
            api_key_env: 'AZURE_OPENAI_API_KEY'
          }),
          ...(formValues.selectedProvider === 'openai' && {
            api_key_env: 'OPENAI_API_KEY'
          }),
          ...(formValues.selectedProvider === 'groq' && {
            api_key_env: 'GROQ_API_KEY'
          }),
          ...(formValues.selectedProvider === 'cerebras' && {
            api_key_env: 'CEREBRAS_API_KEY'
          })
        },
        tts: {
          name: data.ttsConfig?.name || formValues.ttsProvider || 'openai',
          voice_id: data.ttsConfig?.voice_id || formValues.selectedVoice || '',
          model: data.ttsConfig?.model || formValues.ttsModel || '',
          language: data.ttsConfig?.language || formValues.ttsVoiceConfig?.language || 'en',
          voice_settings: {
            similarity_boost: data.ttsConfig?.voice_settings?.similarity_boost ?? formValues.ttsVoiceConfig?.similarityBoost ?? 0.75,
            stability: data.ttsConfig?.voice_settings?.stability ?? formValues.ttsVoiceConfig?.stability ?? 0.5,
            style: data.ttsConfig?.voice_settings?.style ?? formValues.ttsVoiceConfig?.style ?? 0,
            use_speaker_boost: data.ttsConfig?.voice_settings?.use_speaker_boost ?? formValues.ttsVoiceConfig?.useSpeakerBoost ?? true,
            speed: data.ttsConfig?.voice_settings?.speed ?? formValues.ttsVoiceConfig?.speed ?? 1.0
          }
        },
        vad: {
          name: formValues.advancedSettings?.vad?.vadProvider || 'silero',
          min_silence_duration: formValues.advancedSettings?.vad?.minSilenceDuration || 0.3
        },
        tools: formValues.advancedSettings?.tools?.tools?.map((tool: any) => ({
          type: tool.type,
          ...(tool.type !== 'end_call' && {
            name: tool.name,
            description: tool.config?.description || '',
            ...(tool.type === 'custom_function' && {
              api_url: tool.config?.endpoint || '',
              http_method: tool.config?.method || 'GET',
              timeout: tool.config?.timeout || 10,
              async: tool.config?.asyncExecution || false,
              headers: tool.config?.headers || {},
              parameters: tool.config?.parameters || []
            })
          })
        })) || [],
        filler_words: {
          enabled: formValues.advancedSettings?.fillers?.enableFillerWords ?? false,
          general_fillers: formValues.advancedSettings?.fillers?.generalFillers?.filter((f: string) => f !== '') || [],
          conversation_fillers: formValues.advancedSettings?.fillers?.conversationFillers?.filter((f: string) => f !== '') || [],
          conversation_keywords: formValues.advancedSettings?.fillers?.conversationKeywords?.filter((f: string) => f !== '') || []
        },
        bug_reports: {
          enable: formValues.advancedSettings?.bugs?.enableBugReport ?? false,
          bug_start_command: formValues.advancedSettings?.bugs?.bugStartCommands || [],
          bug_end_command: formValues.advancedSettings?.bugs?.bugEndCommands || [],
          response: formValues.advancedSettings?.bugs?.initialResponse || '',
          collection_prompt: formValues.advancedSettings?.bugs?.collectionPrompt || ''
        },
        interruptions: {
          allow_interruptions: formValues.advancedSettings?.interruption?.allowInterruptions ?? true,
          min_interruption_duration: formValues.advancedSettings?.interruption?.minInterruptionDuration ?? 1.3,
          min_interruption_words: formValues.advancedSettings?.interruption?.minInterruptionWords ?? 2
        },
        first_message_mode: firstMessageModeConfig,
        first_message: firstMessageModeConfig.first_message,
        turn_detection: formValues.advancedSettings?.session?.turn_detection || 'multilingual',
        session_behavior: {
          preemptive_generation: formValues.advancedSettings?.session?.preemptiveGeneration || 'enabled',
          turn_detection: formValues.advancedSettings?.session?.turn_detection || 'multilingual',
          unlikely_threshold: formValues.advancedSettings?.session?.unlikelyThreshold ?? 0.6,
          min_endpointing_delay: formValues.advancedSettings?.session?.minEndpointingDelay ?? 0.5,
          max_endpointing_delay: formValues.advancedSettings?.session?.maxEndpointingDelay ?? 3
        },
        background_audio: {
          enabled: formValues.advancedSettings?.backgroundAudio?.mode !== 'disabled',
          ...(formValues.advancedSettings?.backgroundAudio?.mode === 'single' && {
            type: formValues.advancedSettings.backgroundAudio.singleType,
            volume: formValues.advancedSettings.backgroundAudio.singleVolume,
            timing: formValues.advancedSettings.backgroundAudio.singleTiming
          }),
          ...(formValues.advancedSettings?.backgroundAudio?.mode === 'dual' && {
            ambient: {
              type: formValues.advancedSettings.backgroundAudio.ambientType,
              volume: formValues.advancedSettings.backgroundAudio.ambientVolume
            },
            thinking: {
              type: formValues.advancedSettings.backgroundAudio.thinkingType,
              volume: formValues.advancedSettings.backgroundAudio.thinkingVolume
            }
          })
        }
      }
    })

    return {
      agent: {
        name: agentName,
        type: agentType,
        assistant: assistants
      }
    }
  }, [
    assistantNames, 
    assistantsData, 
    getAssistantData, 
    agentName, 
    agentType,
    currentFormik,
    currentTtsConfig,
    currentSttConfig,
    currentAzureConfig
  ])

  // Register formik ref for an assistant (for future multi-assistant support)
  const registerFormikRef = useCallback((assistantName: string, formikRef: FormikProps<any>) => {
    updateAssistantData(assistantName, { formikRef })
  }, [updateAssistantData])

  // Update TTS config for an assistant
  const updateTTSConfig = useCallback((assistantName: string, ttsConfig: any) => {
    updateAssistantData(assistantName, { ttsConfig, hasUnsavedChanges: true })
  }, [updateAssistantData])

  // Update STT config for an assistant
  const updateSTTConfig = useCallback((assistantName: string, sttConfig: any) => {
    updateAssistantData(assistantName, { sttConfig, hasUnsavedChanges: true })
  }, [updateAssistantData])

  // Update Azure config for an assistant
  const updateAzureConfig = useCallback((assistantName: string, azureConfig: any) => {
    updateAssistantData(assistantName, { azureConfig, hasUnsavedChanges: true })
  }, [updateAssistantData])

  // Check if any assistant has unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return Array.from(assistantsData.values()).some(data => data.hasUnsavedChanges)
  }, [assistantsData])

  // Reset unsaved changes
  const resetUnsavedChanges = useCallback(() => {
    setAssistantsData(prev => {
      const newMap = new Map(prev)
      newMap.forEach((data, name) => {
        newMap.set(name, { ...data, hasUnsavedChanges: false })
      })
      return newMap
    })
  }, [])

  // Add assistant (for future use)
  const addAssistant = useCallback((name: string) => {
    setAssistantNames(prev => [...prev, name])
    updateAssistantData(name, {
      name,
      hasUnsavedChanges: true,
      isConfigured: false
    })
  }, [updateAssistantData])

  // Remove assistant (for future use)
  const removeAssistant = useCallback((name: string) => {
    setAssistantNames(prev => prev.filter(n => n !== name))
    setAssistantsData(prev => {
      const newMap = new Map(prev)
      newMap.delete(name)
      return newMap
    })
  }, [])

  return {
    // Core functions
    buildSavePayload,
    
    // State
    assistantNames,
    assistantsData,
    hasUnsavedChanges,
    
    // Assistant management (for future use)
    addAssistant,
    removeAssistant,
    registerFormikRef,
    updateTTSConfig,
    updateSTTConfig,
    updateAzureConfig,
    resetUnsavedChanges,
    getAssistantData,
    updateAssistantData
  }
}