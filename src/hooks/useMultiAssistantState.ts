// hooks/useMultiAssistantState.ts
import { useState, useCallback, useMemo } from 'react'
import { FormikProps } from 'formik'
import { getFallback } from '@/config/agentDefaults'

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
  
  const [assistantNames, setAssistantNames] = useState<string[]>(() => {
    return initialAssistants.map(a => a.name) || [agentName]
  })

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

  const updateAssistantData = useCallback((name: string, updates: Partial<AssistantFormData>) => {
    setAssistantsData(prev => {
      const newMap = new Map(prev)
      const currentData = getAssistantData(name)
      newMap.set(name, { ...currentData, ...updates })
      return newMap
    })
  }, [getAssistantData])

  const buildSavePayload = useCallback(() => {
    if (currentFormik && assistantNames.length <= 1) {
      const formValues = currentFormik.values
      
      const variablesObject = Array.isArray(formValues.variables)
        ? formValues.variables.reduce((acc: any, v: any) => {
            acc[v.name] = v.value
            return acc
          }, {})
        : formValues.variables || {}

      const firstMessageModeConfig = typeof formValues.firstMessageMode === 'object'
        ? {
            mode: formValues.firstMessageMode.mode,
            first_message: formValues.firstMessageMode.first_message || '',
            allow_interruptions: formValues.firstMessageMode.allow_interruptions ?? getFallback(null, 'first_message_mode.allow_interruptions')
          }
        : {
            mode: formValues.firstMessageMode || getFallback(null, 'first_message_mode.mode'),
            first_message: formValues.customFirstMessage || getFallback(null, 'first_message_mode.first_message'),
            allow_interruptions: getFallback(null, 'first_message_mode.allow_interruptions')
          }

      const assistant = {
        name: agentName,
        prompt: formValues.prompt || '',
        variables: variablesObject,
        stt: {
          name: currentSttConfig?.provider || formValues.sttProvider || getFallback(null, 'stt.name'),
          language: currentSttConfig?.config?.language || formValues.sttConfig?.language || getFallback(null, 'stt.language'),
          model: currentSttConfig?.model || formValues.sttModel || getFallback(null, 'stt.model')
        },
        llm: {
          name: formValues.selectedProvider || getFallback(null, 'llm.name'),
          provider: formValues.selectedProvider === 'azure_openai' ? 'azure' : formValues.selectedProvider || getFallback(null, 'llm.provider'),
          model: formValues.selectedModel || getFallback(null, 'llm.model'),
          temperature: formValues.temperature ?? getFallback(null, 'llm.temperature'),
          ...(formValues.selectedProvider === 'azure_openai' && currentAzureConfig && {
            azure_deployment: getFallback(null, 'llm.azure_deployment'),
            azure_endpoint: currentAzureConfig.endpoint || getFallback(null, 'llm.azure_endpoint'),
            api_version: currentAzureConfig.apiVersion || getFallback(null, 'llm.api_version'),
            api_key_env: getFallback(null, 'llm.api_key_env')
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
        tts: (() => {
          const ttsProvider = currentTtsConfig?.provider || formValues.ttsProvider || getFallback(null, 'tts.name')
          const isSarvam = ttsProvider === 'sarvam' || ttsProvider === 'sarvam_tts'
          const isGoogle = ttsProvider === 'google'
          
          if (isSarvam) {
            // Sarvam TTS configuration - using ElevenLabs format
            const targetLanguageCode = currentTtsConfig?.config?.target_language_code || formValues.ttsVoiceConfig?.target_language_code || 'en-IN'
            const sarvamSpeed = currentTtsConfig?.config?.speed ?? formValues.ttsVoiceConfig?.speed ?? 1.0
            const sarvamLoudness = currentTtsConfig?.config?.loudness ?? formValues.ttsVoiceConfig?.loudness ?? 1.0
            
            return {
              name: ttsProvider,
              voice_id: formValues.selectedVoice || getFallback(null, 'tts.voice_id'),
              model: currentTtsConfig?.model || formValues.ttsModel || getFallback(null, 'tts.model'),
              language: targetLanguageCode, // Map target_language_code to language
              voice_settings: {
                similarity_boost: 1, // Default for Sarvam
                stability: 0.8, // Default for Sarvam
                style: 1, // Default for Sarvam
                use_speaker_boost: true, // Default for Sarvam
                speed: sarvamSpeed, // Map speed from Sarvam config
                loudness: sarvamLoudness, // Include loudness in voice_settings
                enable_preprocessing: currentTtsConfig?.config?.enable_preprocessing ?? formValues.ttsVoiceConfig?.enable_preprocessing ?? true
              }
            }
          } else if (isGoogle) {
            // Google TTS configuration - only send voice_name and gender (lowercase)
            const googleConfig = currentTtsConfig?.config || formValues.ttsVoiceConfig || {}
            const result: any = {
              name: 'google',
              voice_name: formValues.selectedVoice || googleConfig.voice_name || getFallback(null, 'tts.voice_name')
            }
            
            // Only add gender if it's specified, and convert to lowercase
            if (googleConfig.gender && googleConfig.gender !== 'none') {
              result.gender = googleConfig.gender.toLowerCase()
            }
            
            return result
          } else {
            // ElevenLabs or other TTS configuration
            return {
              name: ttsProvider,
              voice_id: formValues.selectedVoice || getFallback(null, 'tts.voice_id'),
              model: currentTtsConfig?.model || formValues.ttsModel || getFallback(null, 'tts.model'),
              language: currentTtsConfig?.config?.language || formValues.ttsVoiceConfig?.language || getFallback(null, 'tts.language'),
              voice_settings: {
                similarity_boost: currentTtsConfig?.config?.similarityBoost ?? formValues.ttsVoiceConfig?.similarityBoost ?? getFallback(null, 'tts.voice_settings.similarity_boost'),
                stability: currentTtsConfig?.config?.stability ?? formValues.ttsVoiceConfig?.stability ?? getFallback(null, 'tts.voice_settings.stability'),
                style: currentTtsConfig?.config?.style ?? formValues.ttsVoiceConfig?.style ?? getFallback(null, 'tts.voice_settings.style'),
                use_speaker_boost: currentTtsConfig?.config?.useSpeakerBoost ?? formValues.ttsVoiceConfig?.useSpeakerBoost ?? getFallback(null, 'tts.voice_settings.use_speaker_boost'),
                speed: currentTtsConfig?.config?.speed ?? formValues.ttsVoiceConfig?.speed ?? getFallback(null, 'tts.voice_settings.speed')
              }
            }
          }
        })(),
        vad: {
          name: formValues.advancedSettings?.vad?.vadProvider || getFallback(null, 'vad.name'),
          ...(formValues.advancedSettings?.vad?.minSilenceDuration !== undefined && {
            min_silence_duration: formValues.advancedSettings.vad.minSilenceDuration
          }),
          ...(formValues.advancedSettings?.vad?.minSpeechDuration !== undefined && {
            min_speech_duration: formValues.advancedSettings.vad.minSpeechDuration
          }),
          ...(formValues.advancedSettings?.vad?.prefixPaddingDuration !== undefined && {
            prefix_padding_duration: formValues.advancedSettings.vad.prefixPaddingDuration
          }),
          ...(formValues.advancedSettings?.vad?.maxBufferedSpeech !== undefined && {
            max_buffered_speech: formValues.advancedSettings.vad.maxBufferedSpeech
          }),
          ...(formValues.advancedSettings?.vad?.activationThreshold !== undefined && {
            activation_threshold: formValues.advancedSettings.vad.activationThreshold
          }),
          ...(formValues.advancedSettings?.vad?.sampleRate !== undefined && {
            sample_rate: formValues.advancedSettings.vad.sampleRate
          }),
          ...(formValues.advancedSettings?.vad?.forceCpu !== undefined && {
            force_cpu: formValues.advancedSettings.vad.forceCpu
          })
        },
        tools: formValues.advancedSettings?.tools?.tools?.map((tool: any) => {
          const baseToolConfig = {
            type: tool.type
          }

          // end_call has no additional fields
          if (tool.type === 'end_call') {
            return baseToolConfig
          }

          // handoff and custom_function have these common fields
          const commonFields = {
            name: tool.name,
            description: tool.config?.description || ''
          }

          // custom_function has additional fields
          if (tool.type === 'custom_function') {
            // Parse response_mapping_raw to create response_mapping object
            let responseMappingObject = {}
            try {
              if (tool.config?.responseMapping) {
                responseMappingObject = JSON.parse(tool.config.responseMapping)
              }
            } catch (e) {
              console.warn('Failed to parse response mapping:', e)
            }

            return {
              ...baseToolConfig,
              ...commonFields,
              api_url: tool.config?.endpoint || '',
              http_method: tool.config?.method || 'GET',
              timeout: tool.config?.timeout || 10,
              async: tool.config?.asyncExecution || false,
              headers: tool.config?.headers || {},
              parameters: tool.config?.parameters?.map((param: any) => ({
                name: param.name,
                type: param.type,
                description: param.description,
                required: param.required
              })) || [],
              custom_payload: tool.config?.body || '',
              response_mapping: responseMappingObject,
              response_mapping_raw: tool.config?.responseMapping || '{}'
            }
          }

          // handoff specific fields (if needed in future)
          if (tool.type === 'handoff') {
            return {
              ...baseToolConfig,
              ...commonFields,
              target_agent: tool.config?.targetAgent || '',
              handoff_message: tool.config?.handoffMessage || ''
            }
          }

          // transfer_call specific fields
          if (tool.type === 'transfer_call') {
            return {
              ...baseToolConfig,
              ...commonFields,
              transfer_number: tool.config?.transferNumber || '',
              sip_outbound_trunk: tool.config?.sipTrunkId || ''
            }
          }

          if (tool.type === 'ivr_navigator') {
            return {
              ...baseToolConfig,
              ...commonFields,
              function_name: tool.config?.function_name || 'send_dtmf_code',
              docstring: tool.config?.docstring || 'Emit a DTMF digit when the IVR menu requests an input.',
              cooldown_seconds: tool.config?.cooldown_seconds || 3,
              publish_topic: tool.config?.publish_topic || 'dtmf_code',
              publish_data: tool.config?.publish_data ?? true,
              instruction_template: tool.config?.instruction_template || 'Listen carefully and press the most relevant option to accomplish: {task}.',
              default_task: tool.config?.default_task || 'Reach a live support representative',
              task_metadata_keys: tool.config?.task_metadata_keys || ['ivr_task', 'navigator_task', 'task']
            }
          }

          return baseToolConfig
        }) || getFallback(null, 'tools'),
        filler_words: {
          enabled: formValues.advancedSettings?.fillers?.enableFillerWords ?? getFallback(null, 'filler_words.enabled'),
          general_fillers: formValues.advancedSettings?.fillers?.generalFillers?.filter((f: string) => f !== '') || getFallback(null, 'filler_words.general_fillers'),
          conversation_fillers: formValues.advancedSettings?.fillers?.conversationFillers?.filter((f: string) => f !== '') || getFallback(null, 'filler_words.conversation_fillers'),
          conversation_keywords: formValues.advancedSettings?.fillers?.conversationKeywords?.filter((f: string) => f !== '') || getFallback(null, 'filler_words.conversation_keywords')
        },
        bug_reports: {
          enable: formValues.advancedSettings?.bugs?.enableBugReport ?? getFallback(null, 'bug_reports.enable'),
          bug_start_command: formValues.advancedSettings?.bugs?.bugStartCommands || getFallback(null, 'bug_reports.bug_start_command'),
          bug_end_command: formValues.advancedSettings?.bugs?.bugEndCommands || getFallback(null, 'bug_reports.bug_end_command'),
          response: formValues.advancedSettings?.bugs?.initialResponse || getFallback(null, 'bug_reports.response'),
          collection_prompt: formValues.advancedSettings?.bugs?.collectionPrompt || getFallback(null, 'bug_reports.collection_prompt')
        },
        interruptions: {
          allow_interruptions: formValues.advancedSettings?.interruption?.allowInterruptions ?? getFallback(null, 'interruptions.allow_interruptions'),
          min_interruption_duration: formValues.advancedSettings?.interruption?.minInterruptionDuration ?? getFallback(null, 'interruptions.min_interruption_duration'),
          min_interruption_words: formValues.advancedSettings?.interruption?.minInterruptionWords ?? getFallback(null, 'interruptions.min_interruption_words')
        },
        first_message_mode: firstMessageModeConfig,
        first_message: firstMessageModeConfig.first_message,
        turn_detection: formValues.advancedSettings?.session?.turn_detection || getFallback(null, 'session_behavior.turn_detection'),
        session_behavior: {
          preemptive_generation: formValues.advancedSettings?.session?.preemptiveGeneration || getFallback(null, 'session_behavior.preemptive_generation'),
          turn_detection: formValues.advancedSettings?.session?.turn_detection || getFallback(null, 'session_behavior.turn_detection'),
          unlikely_threshold: formValues.advancedSettings?.session?.unlikely_threshold ?? getFallback(null, 'session_behavior.unlikely_threshold'),
          min_endpointing_delay: formValues.advancedSettings?.session?.min_endpointing_delay ?? getFallback(null, 'session_behavior.min_endpointing_delay'),
          max_endpointing_delay: formValues.advancedSettings?.session?.max_endpointing_delay ?? getFallback(null, 'session_behavior.max_endpointing_delay'),
          ...(formValues.advancedSettings?.session?.user_away_timeout !== undefined && {
            user_away_timeout: formValues.advancedSettings.session.user_away_timeout
          }),
          ...(formValues.advancedSettings?.session?.user_away_timeout_message !== undefined && formValues.advancedSettings.session.user_away_timeout_message !== null && {
            user_away_timeout_message: formValues.advancedSettings.session.user_away_timeout_message
          })
        },
        background_audio: {
          enabled: formValues.advancedSettings?.backgroundAudio?.mode !== 'disabled',
          ...(formValues.advancedSettings?.backgroundAudio?.mode === 'single' && {
            type: formValues.advancedSettings.backgroundAudio.singleType || 'keyboard',
            volume: formValues.advancedSettings.backgroundAudio.singleVolume ?? 0.5,
            timing: formValues.advancedSettings.backgroundAudio.singleTiming || 'thinking'
          }),
          ...(formValues.advancedSettings?.backgroundAudio?.mode === 'dual' && {
            ambient: {
              type: formValues.advancedSettings.backgroundAudio.ambientType || getFallback(null, 'background_audio.ambient.type'),
              volume: formValues.advancedSettings.backgroundAudio.ambientVolume ?? getFallback(null, 'background_audio.ambient.volume')
            },
            thinking: {
              type: formValues.advancedSettings.backgroundAudio.thinkingType || getFallback(null, 'background_audio.thinking.type'),
              volume: formValues.advancedSettings.backgroundAudio.thinkingVolume ?? getFallback(null, 'background_audio.thinking.volume')
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
      
      const variablesObject = Array.isArray(formValues.variables)
        ? formValues.variables.reduce((acc: any, v: any) => {
            acc[v.name] = v.value
            return acc
          }, {})
        : formValues.variables || {}

      const firstMessageModeConfig = typeof formValues.firstMessageMode === 'object'
        ? {
            mode: formValues.firstMessageMode.mode,
            first_message: formValues.firstMessageMode.first_message || '',
            allow_interruptions: formValues.firstMessageMode.allow_interruptions ?? getFallback(null, 'first_message_mode.allow_interruptions')
          }
        : {
            mode: formValues.firstMessageMode || getFallback(null, 'first_message_mode.mode'),
            first_message: formValues.customFirstMessage || getFallback(null, 'first_message_mode.first_message'),
            allow_interruptions: getFallback(null, 'first_message_mode.allow_interruptions')
          }
      
      return {
        name: name,
        prompt: formValues.prompt || '',
        variables: variablesObject,
        stt: {
          name: data.sttConfig?.name || formValues.sttProvider || getFallback(null, 'stt.name'),
          language: data.sttConfig?.language || formValues.sttConfig?.language || getFallback(null, 'stt.language'),
          model: data.sttConfig?.model || formValues.sttModel || getFallback(null, 'stt.model')
        },
        llm: {
          name: formValues.selectedProvider || getFallback(null, 'llm.name'),
          provider: formValues.selectedProvider === 'azure_openai' ? 'azure' : formValues.selectedProvider || getFallback(null, 'llm.provider'),
          model: formValues.selectedModel || getFallback(null, 'llm.model'),
          temperature: formValues.temperature ?? getFallback(null, 'llm.temperature'),
          ...(formValues.selectedProvider === 'azure_openai' && currentAzureConfig && {
            azure_deployment: getFallback(null, 'llm.azure_deployment'),
            azure_endpoint: currentAzureConfig.endpoint || getFallback(null, 'llm.azure_endpoint'),
            api_version: currentAzureConfig.apiVersion || getFallback(null, 'llm.api_version'),
            api_key_env: getFallback(null, 'llm.api_key_env')
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
          name: data.ttsConfig?.name || formValues.ttsProvider || getFallback(null, 'tts.name'),
          voice_id: data.ttsConfig?.voice_id || formValues.selectedVoice || getFallback(null, 'tts.voice_id'),
          model: data.ttsConfig?.model || formValues.ttsModel || getFallback(null, 'tts.model'),
          language: data.ttsConfig?.language || formValues.ttsVoiceConfig?.language || getFallback(null, 'tts.language'),
          voice_settings: {
            similarity_boost: data.ttsConfig?.voice_settings?.similarity_boost ?? formValues.ttsVoiceConfig?.similarityBoost ?? getFallback(null, 'tts.voice_settings.similarity_boost'),
            stability: data.ttsConfig?.voice_settings?.stability ?? formValues.ttsVoiceConfig?.stability ?? getFallback(null, 'tts.voice_settings.stability'),
            style: data.ttsConfig?.voice_settings?.style ?? formValues.ttsVoiceConfig?.style ?? getFallback(null, 'tts.voice_settings.style'),
            use_speaker_boost: data.ttsConfig?.voice_settings?.use_speaker_boost ?? formValues.ttsVoiceConfig?.useSpeakerBoost ?? getFallback(null, 'tts.voice_settings.use_speaker_boost'),
            speed: data.ttsConfig?.voice_settings?.speed ?? formValues.ttsVoiceConfig?.speed ?? getFallback(null, 'tts.voice_settings.speed')
          }
        },
        vad: {
          name: formValues.advancedSettings?.vad?.vadProvider || getFallback(null, 'vad.name'),
          ...(formValues.advancedSettings?.vad?.minSilenceDuration !== undefined && {
            min_silence_duration: formValues.advancedSettings.vad.minSilenceDuration
          }),
          ...(formValues.advancedSettings?.vad?.minSpeechDuration !== undefined && {
            min_speech_duration: formValues.advancedSettings.vad.minSpeechDuration
          }),
          ...(formValues.advancedSettings?.vad?.prefixPaddingDuration !== undefined && {
            prefix_padding_duration: formValues.advancedSettings.vad.prefixPaddingDuration
          }),
          ...(formValues.advancedSettings?.vad?.maxBufferedSpeech !== undefined && {
            max_buffered_speech: formValues.advancedSettings.vad.maxBufferedSpeech
          }),
          ...(formValues.advancedSettings?.vad?.activationThreshold !== undefined && {
            activation_threshold: formValues.advancedSettings.vad.activationThreshold
          }),
          ...(formValues.advancedSettings?.vad?.sampleRate !== undefined && {
            sample_rate: formValues.advancedSettings.vad.sampleRate
          }),
          ...(formValues.advancedSettings?.vad?.forceCpu !== undefined && {
            force_cpu: formValues.advancedSettings.vad.forceCpu
          })
        },
        tools: formValues.advancedSettings?.tools?.tools?.map((tool: any) => {
          const baseToolConfig = {
            type: tool.type
          }

          // end_call has no additional fields
          if (tool.type === 'end_call') {
            return baseToolConfig
          }

          // handoff and custom_function have these common fields
          const commonFields = {
            name: tool.name,
            description: tool.config?.description || ''
          }

          // custom_function has additional fields
          if (tool.type === 'custom_function') {
            // Parse response_mapping_raw to create response_mapping object
            let responseMappingObject = {}
            try {
              if (tool.config?.responseMapping) {
                responseMappingObject = JSON.parse(tool.config.responseMapping)
              }
            } catch (e) {
              console.warn('Failed to parse response mapping:', e)
            }

            return {
              ...baseToolConfig,
              ...commonFields,
              api_url: tool.config?.endpoint || '',
              http_method: tool.config?.method || 'GET',
              timeout: tool.config?.timeout || 10,
              async: tool.config?.asyncExecution || false,
              headers: tool.config?.headers || {},
              parameters: tool.config?.parameters?.map((param: any) => ({
                name: param.name,
                type: param.type,
                description: param.description,
                required: param.required
              })) || [],
              custom_payload: tool.config?.body || '',
              response_mapping: responseMappingObject,
              response_mapping_raw: tool.config?.responseMapping || '{}'
            }
          }

          // handoff specific fields (if needed in future)
          if (tool.type === 'handoff') {
            return {
              ...baseToolConfig,
              ...commonFields,
              target_agent: tool.config?.targetAgent || '',
              handoff_message: tool.config?.handoffMessage || ''
            }
          }

          // transfer_call specific fields
          if (tool.type === 'transfer_call') {
            return {
              ...baseToolConfig,
              ...commonFields,
              transfer_number: tool.config?.transferNumber || '',
              sip_outbound_trunk: tool.config?.sipTrunkId || ''
            }
          }

          if (tool.type === 'ivr_navigator') {
            return {
              ...baseToolConfig,
              ...commonFields,
              function_name: tool.config?.function_name || 'send_dtmf_code',
              docstring: tool.config?.docstring || 'Emit a DTMF digit when the IVR menu requests an input.',
              cooldown_seconds: tool.config?.cooldown_seconds || 3,
              publish_topic: tool.config?.publish_topic || 'dtmf_code',
              publish_data: tool.config?.publish_data ?? true,
              instruction_template: tool.config?.instruction_template || 'Listen carefully and press the most relevant option to accomplish: {task}.',
              default_task: tool.config?.default_task || 'Reach a live support representative',
              task_metadata_keys: tool.config?.task_metadata_keys || ['ivr_task', 'navigator_task', 'task']
            }
          }

          return baseToolConfig
        }) || getFallback(null, 'tools'),
        filler_words: {
          enabled: formValues.advancedSettings?.fillers?.enableFillerWords ?? getFallback(null, 'filler_words.enabled'),
          general_fillers: formValues.advancedSettings?.fillers?.generalFillers?.filter((f: string) => f !== '') || getFallback(null, 'filler_words.general_fillers'),
          conversation_fillers: formValues.advancedSettings?.fillers?.conversationFillers?.filter((f: string) => f !== '') || getFallback(null, 'filler_words.conversation_fillers'),
          conversation_keywords: formValues.advancedSettings?.fillers?.conversationKeywords?.filter((f: string) => f !== '') || getFallback(null, 'filler_words.conversation_keywords')
        },
        bug_reports: {
          enable: formValues.advancedSettings?.bugs?.enableBugReport ?? getFallback(null, 'bug_reports.enable'),
          bug_start_command: formValues.advancedSettings?.bugs?.bugStartCommands || getFallback(null, 'bug_reports.bug_start_command'),
          bug_end_command: formValues.advancedSettings?.bugs?.bugEndCommands || getFallback(null, 'bug_reports.bug_end_command'),
          response: formValues.advancedSettings?.bugs?.initialResponse || getFallback(null, 'bug_reports.response'),
          collection_prompt: formValues.advancedSettings?.bugs?.collectionPrompt || getFallback(null, 'bug_reports.collection_prompt')
        },
        interruptions: {
          allow_interruptions: formValues.advancedSettings?.interruption?.allowInterruptions ?? getFallback(null, 'interruptions.allow_interruptions'),
          min_interruption_duration: formValues.advancedSettings?.interruption?.minInterruptionDuration ?? getFallback(null, 'interruptions.min_interruption_duration'),
          min_interruption_words: formValues.advancedSettings?.interruption?.minInterruptionWords ?? getFallback(null, 'interruptions.min_interruption_words')
        },
        first_message_mode: firstMessageModeConfig,
        first_message: firstMessageModeConfig.first_message,
        turn_detection: formValues.advancedSettings?.session?.turn_detection || getFallback(null, 'session_behavior.turn_detection'),
        session_behavior: {
          preemptive_generation: formValues.advancedSettings?.session?.preemptiveGeneration || getFallback(null, 'session_behavior.preemptive_generation'),
          turn_detection: formValues.advancedSettings?.session?.turn_detection || getFallback(null, 'session_behavior.turn_detection'),
          unlikely_threshold: formValues.advancedSettings?.session?.unlikely_threshold ?? getFallback(null, 'session_behavior.unlikely_threshold'),
          min_endpointing_delay: formValues.advancedSettings?.session?.min_endpointing_delay ?? getFallback(null, 'session_behavior.min_endpointing_delay'),
          max_endpointing_delay: formValues.advancedSettings?.session?.max_endpointing_delay ?? getFallback(null, 'session_behavior.max_endpointing_delay'),
          ...(formValues.advancedSettings?.session?.user_away_timeout !== undefined && {
            user_away_timeout: formValues.advancedSettings.session.user_away_timeout
          }),
          ...(formValues.advancedSettings?.session?.user_away_timeout_message !== undefined && formValues.advancedSettings.session.user_away_timeout_message !== null && {
            user_away_timeout_message: formValues.advancedSettings.session.user_away_timeout_message
          })
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

  const registerFormikRef = useCallback((assistantName: string, formikRef: FormikProps<any>) => {
    updateAssistantData(assistantName, { formikRef })
  }, [updateAssistantData])

  const updateTTSConfig = useCallback((assistantName: string, ttsConfig: any) => {
    updateAssistantData(assistantName, { ttsConfig, hasUnsavedChanges: true })
  }, [updateAssistantData])

  const updateSTTConfig = useCallback((assistantName: string, sttConfig: any) => {
    updateAssistantData(assistantName, { sttConfig, hasUnsavedChanges: true })
  }, [updateAssistantData])

  const updateAzureConfig = useCallback((assistantName: string, azureConfig: any) => {
    updateAssistantData(assistantName, { azureConfig, hasUnsavedChanges: true })
  }, [updateAssistantData])

  const hasUnsavedChanges = useMemo(() => {
    const mapHasChanges = Array.from(assistantsData.values()).some(data => data.hasUnsavedChanges)
    return mapHasChanges || (currentFormik?.dirty ?? false)
  }, [assistantsData, currentFormik])

  const resetUnsavedChanges = useCallback(() => {
    setAssistantsData(prev => {
      const newMap = new Map(prev)
      newMap.forEach((data, name) => {
        newMap.set(name, { ...data, hasUnsavedChanges: false })
      })
      return newMap
    })
  }, [])

  const addAssistant = useCallback((name: string) => {
    setAssistantNames(prev => [...prev, name])
    updateAssistantData(name, {
      name,
      hasUnsavedChanges: true,
      isConfigured: false
    })
  }, [updateAssistantData])

  const removeAssistant = useCallback((name: string) => {
    setAssistantNames(prev => prev.filter(n => n !== name))
    setAssistantsData(prev => {
      const newMap = new Map(prev)
      newMap.delete(name)
      return newMap
    })
  }, [])

  return {
    buildSavePayload,
    assistantNames,
    assistantsData,
    hasUnsavedChanges,
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