'use client'

import React, { useState, useEffect } from 'react'
import { useSupabaseQuery } from '@/hooks/useSupabase'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { CopyIcon, CheckIcon, SettingsIcon } from 'lucide-react'
import { languageOptions, firstMessageModes } from '@/utils/constants'
import { useFormik } from 'formik'
import ModelSelector from '@/components/agents/AgentConfig/ModelSelector'
import SelectTTS from '@/components/agents/AgentConfig/SelectTTSDialog'
import SelectSTT from '@/components/agents/AgentConfig/SelectSTTDialog'
import AgentAdvancedSettings from '@/components/agents/AgentConfig/AgentAdvancedSettings'
import PromptSettingsSheet from '@/components/agents/AgentConfig/PromptSettingsSheet'
import { usePromptSettings } from '@/hooks/usePromptSettings'

interface AzureConfig {
  endpoint: string
  apiVersion: string
}

export default function AgentConfig() {
  const { agentid } = useParams()
  const [isCopied, setIsCopied] = useState(false)
  const [debugInfo, setDebugInfo] = useState({}) 
  const [isPromptSettingsOpen, setIsPromptSettingsOpen] = useState(false)
  const [promptFontSize, setPromptFontSize] = useState(11)

  const { getTextareaStyles } = usePromptSettings()

  
  // Azure config state for ModelSelector
  const [azureConfig, setAzureConfig] = useState<AzureConfig>({
    endpoint: '',
    apiVersion: ''
  })

  const [ttsConfig, setTtsConfig] = useState({
    provider: '',
    model: '',
    config: {}
  })

  const [sttConfig, setSTTConfig] = useState({
    provider: '',
    model: '',
    config: {}
  })

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(formik.values.prompt)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = formik.values.prompt
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }
  }

  // Formik form state management
  const formik = useFormik({
    initialValues: {
      selectedProvider: 'openai',
      selectedModel: 'gpt-4o',
      selectedVoice: '',
      selectedLanguage: languageOptions[0]?.value || 'en',
      firstMessageMode: 'user_speaks_first',
      customFirstMessage: '',
      aiStartsAfterSilence: false,
      silenceTime: 10,
      prompt: '',
      temperature: 0.7,
      ttsProvider: '',
      ttsModel: '',
      ttsVoiceConfig: {},
      sttProvider: '',
      sttModel: '',
      sttConfig: {},
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
          turnDetection: 'multilingual' as 'multilingual' | 'english' | 'disabled'
        },
        tools: {
          tools: [] as Array<{
            id: string
            type: 'endCall' | 'handoff' | 'custom'
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
    },
    enableReinitialize: true,
    onSubmit: (values) => {
      console.log('Form submitted:', values)
      // Handle form submission here
    }
  })

  const { data: agentDataResponse, loading: agentLoading } = useSupabaseQuery("pype_voice_agents", {
    select: "id, name, agent_type, configuration, vapi_api_key_encrypted, vapi_project_key_encrypted",
    filters: [{ column: "id", operator: "eq", value: agentid }],
    limit: 1
  })

  const agentName = agentDataResponse?.[0]?.name

  const fetchAgentData = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_PYPEAI_API_URL}/agent_config/${agentName}`, {
        method: 'GET',
        headers: {
          'x-api-key': 'pype-api-v1'
        }
      })
      const data = await response.json()
      
      // Populate form with fetched data
      if (data?.agent?.assistant?.[0]) {
        const assistant = data.agent.assistant[0]
        
        // Parse provider and model from the llm.model field
        const modelValue = assistant.llm?.model || 'gpt-4o'
        let provider = 'openai'
        let model = modelValue
        

        // Determine provider based on model value
        if (modelValue.includes('claude')) {
          provider = 'anthropic'
        } else if (modelValue.includes('llama') || modelValue.includes('mixtral') || modelValue.includes('groq')) {
          provider = 'groq'
        } else if (modelValue.includes('gpt') && assistant.llm?.provider === 'azure') {
          provider = 'azure_openai'
        } else if (modelValue.includes('cerebras')) {
          provider = 'cerebras'
        }

        const formValues = {
          selectedProvider: provider,
          selectedModel: modelValue,
          selectedVoice: assistant.tts?.voice_id || assistant.tts?.speaker || '',
          selectedLanguage: assistant.tts?.language || assistant.stt?.language || languageOptions[0]?.value || 'en',
          firstMessageMode: assistant.first_message_mode || 'user_speaks_first',
          customFirstMessage: assistant.first_message || '',
          aiStartsAfterSilence: assistant.ai_starts_after_silence || false,
          silenceTime: assistant.silence_time || 10,
          prompt: assistant.prompt || '',
          temperature: assistant.temperature || 0.7,
          ttsProvider: assistant.tts?.name || 'elevenlabs',
          ttsModel: assistant.tts?.model || 'eleven_multilingual_v2',
          ttsVoiceConfig: assistant.tts?.name === 'sarvam' ? {
            targetLanguage: assistant.tts?.target_language_code || 'en',
            loudness: assistant.tts?.loudness || 1.0,
            speed: assistant.tts?.speed || 1.0,
            enablePreprocessing: assistant.tts?.enable_preprocessing ?? true
          } : assistant.tts?.name === 'elevenlabs' ? {
            voiceId: assistant.tts?.voice_id || '',
            language: assistant.tts?.language || 'en',
            similarityBoost: assistant.tts?.voice_settings?.similarity_boost || 0.75,
            stability: assistant.tts?.voice_settings?.stability || 0.5,
            style: assistant.tts?.voice_settings?.style || 0,
            useSpeakerBoost: assistant.tts?.voice_settings?.use_speaker_boost ?? true,
            speed: assistant.tts?.voice_settings?.speed || 1.0
          } : {},
          sttProvider: assistant.stt?.provider || 'openai',
          sttModel: assistant.stt?.model || 'whisper-1',
          sttConfig: assistant.stt?.config || {},
          
          // MAP BACKEND TO FRONTEND ADVANCED SETTINGS:
          advancedSettings: {
            interruption: {
              allowInterruptions: assistant.allow_interruptions ?? true,
              minInterruptionDuration: 1.5,
              minInterruptionWords: 2
            },
            vad: {
              vadProvider: assistant.vad?.name || 'silero',
              minSilenceDuration: assistant.vad?.min_silence_duration || 1.0
            },
            session: {
              preemptiveGeneration: (assistant.preemptive_generation || 'enabled') as 'enabled' | 'disabled',
              turnDetection: 'multilingual' as 'multilingual' | 'english' | 'disabled'
            },
            tools: {
              tools: assistant.tools?.map((tool: any) => ({
                id: `tool_${Date.now()}_${Math.random()}`,
                type: (tool.type === 'custom_function' ? 'custom' : tool.type) as 'endCall' | 'handoff' | 'custom',
                name: tool.name || '',
                config: {
                  description: tool.description || '',
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
        
        formik.setValues(formValues)
        

        setTtsConfig({
          provider: formValues.ttsProvider,
          model: formValues.ttsModel,
          config: formValues.ttsVoiceConfig
        })
        
        setSTTConfig({
          provider: formValues.sttProvider,
          model: formValues.sttModel,
          config: formValues.sttConfig
        })
        
        // Set Azure config if it's an Azure provider
        if (provider === 'azure_openai' && assistant.llm?.azure_config) {
          setAzureConfig({
            endpoint: assistant.llm.azure_config.endpoint || '',
            apiVersion: assistant.llm.azure_config.api_version || ''
          })
        }

      } else {
        console.log('🔍 DEBUG - No assistant data found in response')
      }
      
      return data
    } catch (error: any) {
      console.error('🔍 DEBUG - API fetch error:', error)
      setDebugInfo(prev => ({...prev, error: error.message}))
      return null
    }
  }

  useEffect(() => {
    if (!agentLoading && agentName) {
      fetchAgentData()
    }
  }, [agentLoading, agentName])


  const handleSaveDraft = () => {
    const completeFormData = {
      // Basic form values
      formikValues: formik.values,
      
      // TTS Configuration
      ttsConfiguration: {
        voiceId: formik.values.selectedVoice,
        provider: formik.values.ttsProvider || ttsConfig.provider,
        model: formik.values.ttsModel || ttsConfig.model,
        config: formik.values.ttsVoiceConfig || ttsConfig.config
      },
      
      // STT Configuration (if implemented)
      sttConfiguration: {
        provider: sttConfig.provider,
        model: sttConfig.model,
        config: sttConfig.config
      },
      
      // LLM Configuration
      llmConfiguration: {
        provider: formik.values.selectedProvider,
        model: formik.values.selectedModel,
        temperature: formik.values.temperature,
        azureConfig: formik.values.selectedProvider === 'azure_openai' ? azureConfig : null
      },
      
      // Agent Settings
      agentSettings: {
        language: formik.values.selectedLanguage,
        firstMessageMode: formik.values.firstMessageMode,
        customFirstMessage: formik.values.customFirstMessage,
        aiStartsAfterSilence: formik.values.aiStartsAfterSilence,
        silenceTime: formik.values.silenceTime,
        prompt: formik.values.prompt
      },
      
      // Metadata
      metadata: {
        agentId: agentid,
        agentName: agentName,
        timestamp: new Date().toISOString(),
        action: 'SAVE_DRAFT'
      }
    }
    
    console.log('💾 SAVE DRAFT - Complete Configuration:', completeFormData)
    console.log('💾 SAVE DRAFT - JSON String:', JSON.stringify(completeFormData, null, 2))
    
    // Handle save draft API call here
    // Example API call structure:
    /*
    try {
      const response = await fetch('/api/agent/save-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completeFormData)
      })
      const result = await response.json()
      console.log('💾 SAVE DRAFT - API Response:', result)
    } catch (error) {
      console.error('💾 SAVE DRAFT - API Error:', error)
    }
    */
  }

  const handleSaveAndDeploy = () => {
    const completeFormData = {
      // Basic form values
      formikValues: formik.values,
      
      // TTS Configuration
      ttsConfiguration: {
        voiceId: formik.values.selectedVoice,
        provider: formik.values.ttsProvider || ttsConfig.provider,
        model: formik.values.ttsModel || ttsConfig.model,
        config: formik.values.ttsVoiceConfig || ttsConfig.config
      },
      
      // STT Configuration (if implemented)
      sttConfiguration: {
        provider: sttConfig.provider,
        model: sttConfig.model,
        config: sttConfig.config
      },
      
      // LLM Configuration
      llmConfiguration: {
        provider: formik.values.selectedProvider,
        model: formik.values.selectedModel,
        temperature: formik.values.temperature,
        azureConfig: formik.values.selectedProvider === 'azure_openai' ? azureConfig : null
      },
      
      // Agent Settings
      agentSettings: {
        language: formik.values.selectedLanguage,
        firstMessageMode: formik.values.firstMessageMode,
        customFirstMessage: formik.values.customFirstMessage,
        aiStartsAfterSilence: formik.values.aiStartsAfterSilence,
        silenceTime: formik.values.silenceTime,
        prompt: formik.values.prompt
      },
      
      // Validation Check
      validationStatus: {
        hasLLM: !!(formik.values.selectedProvider && formik.values.selectedModel),
        hasTTS: !!(formik.values.selectedVoice && formik.values.ttsProvider),
        hasSTT: !!(sttConfig.provider),
        hasPrompt: !!formik.values.prompt.trim(),
        isReadyForDeploy: !!(
          formik.values.selectedProvider && 
          formik.values.selectedModel && 
          formik.values.prompt.trim()
        )
      },
      
      // Metadata
      metadata: {
        agentId: agentid,
        agentName: agentName,
        timestamp: new Date().toISOString(),
        action: 'SAVE_AND_DEPLOY'
      }
    }
    
    console.log('🚀 SAVE & DEPLOY - Complete Configuration:', completeFormData)
    console.log('🚀 SAVE & DEPLOY - JSON String:', JSON.stringify(completeFormData, null, 2))
    
    // Validation before deployment
    if (!completeFormData.validationStatus.isReadyForDeploy) {
      console.warn('⚠️ SAVE & DEPLOY - Validation Failed:', completeFormData.validationStatus)
      // Show validation error to user
      return
    }
    
    // Handle save and deploy API call here
    formik.handleSubmit()
    
    // Example API call structure:
    /*
    try {
      const response = await fetch('/api/agent/save-and-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completeFormData)
      })
      const result = await response.json()
      console.log('🚀 SAVE & DEPLOY - API Response:', result)
    } catch (error) {
      console.error('🚀 SAVE & DEPLOY - API Error:', error)
    }
    */
  }

  const handleCancel = () => {
    formik.resetForm()
  }

  const handleVoiceSelect = (voiceId: string, provider: string, model?: string, config?: any) => {
    console.log('TTS Configuration received:', { voiceId, provider, model, config })
    
    // Update formik values
    formik.setFieldValue('selectedVoice', voiceId)
    formik.setFieldValue('ttsProvider', provider)
    formik.setFieldValue('ttsModel', model || '')
    formik.setFieldValue('ttsVoiceConfig', config || {})
    
    // Also update local state
    setTtsConfig({
      provider: provider,
      model: model || '',
      config: config || {}
    })
    
    console.log('✅ TTS config stored successfully')
  }

  const handleSTTSelect = (provider: string, model: string, config: any) => {
    console.log('STT Configuration received:', { provider, model, config })
    
    // Update formik values
    formik.setFieldValue('sttProvider', provider)
    formik.setFieldValue('sttModel', model)
    formik.setFieldValue('sttConfig', config)
    
    // Update local state
    setSTTConfig({ provider, model, config })
  }
  
  
  // Handlers for ModelSelector
  const handleProviderChange = (provider: string) => {
    formik.setFieldValue('selectedProvider', provider)
  }

  const handleModelChange = (model: string) => {
    formik.setFieldValue('selectedModel', model)
  }

  const handleTemperatureChange = (temperature: number) => {
    formik.setFieldValue('temperature', temperature)
  }

  const handleAzureConfigChange = (config: AzureConfig) => {
    setAzureConfig(config)
  }

  if (agentLoading) {
    return (
      <div className="h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-64"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-96"></div>
            <div className="h-96 bg-gray-200 dark:bg-gray-800 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Header with Save Actions */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {agentName || 'Loading...'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleCancel}>
              Cancel
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleSaveDraft}>
              Save Draft
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={handleSaveAndDeploy}>
              Save & Deploy
            </Button>
          </div>
        </div>
      </div>

      {/* <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 p-2">
        <details>
          <summary className="text-xs font-mono cursor-pointer">🔍 Debug Info (click to expand)</summary>
          <pre className="text-xs bg-white dark:bg-gray-800 p-2 mt-1 rounded overflow-auto max-h-32">
            {JSON.stringify({
              agentId: agentid,
              agentName: agentName,
              loading: agentLoading,
              currentFormValues: formik.values,
              debugInfo: debugInfo
            }, null, 2)}
          </pre>
        </details>
      </div> */}

      {/* Main Content */}
      <div className="flex-1 pb-6 pt-3 px-3 overflow-hidden">
        <div className="w-full h-full flex flex-col max-w-7xl mx-auto">
          <div className="flex gap-4 flex-1 overflow-hidden">
            {/* Left Side - Configuration */}
            <div className="flex-1 overflow-hidden flex flex-col space-y-2">
              {/* Quick Setup Row */}
              <div className="flex gap-3 flex-shrink-0">
                {/* LLM Selection */}
                <div className="flex-1">
                  <ModelSelector
                    selectedProvider={formik.values.selectedProvider}
                    selectedModel={formik.values.selectedModel}
                    temperature={formik.values.temperature}
                    onProviderChange={handleProviderChange}
                    onModelChange={handleModelChange}
                    onTemperatureChange={handleTemperatureChange}
                    azureConfig={azureConfig}
                    onAzureConfigChange={handleAzureConfigChange}
                  />
                </div>

                {/* STT Selection */}
                <div className="flex-1">
                  <SelectSTT 
                    selectedProvider={formik.values.sttProvider}
                    selectedModel={formik.values.sttModel}
                    onSTTSelect={handleSTTSelect}
                  />
                </div>

                {/* TTS Selection */}
                <div className="flex-1">
                  <SelectTTS 
                    selectedVoice={formik.values.selectedVoice}
                    initialProvider={formik.values.ttsProvider}
                    initialModel={formik.values.ttsModel}
                    initialConfig={formik.values.ttsVoiceConfig}
                    onVoiceSelect={handleVoiceSelect}
                  />
                </div>

              </div>

              {/* Conversation Flow */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3 flex-shrink-0">
                <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Conversation Start
                    </label>
                    <Select 
                    value={formik.values.firstMessageMode} 
                    onValueChange={(value) => formik.setFieldValue('firstMessageMode', value)}
                    >
                    <SelectTrigger className="h-8 text-sm w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {firstMessageModes.map((mode) => (
                        <SelectItem key={mode.value} value={mode.value} className="text-sm">
                            {mode.label}
                        </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                </div>

                {(formik.values.firstMessageMode === 'assistant_speaks_first') && (
                    <Textarea
                    placeholder={formik.values.firstMessageMode === 'assistant_speaks_first' ? 
                        "Enter the first message..." : 
                        "Context for AI generation..."
                    }
                    value={formik.values.customFirstMessage}
                    onChange={(e) => formik.setFieldValue('customFirstMessage', e.target.value)}
                    className="min-h-[60px] text-xs resize-none border-gray-200 dark:border-gray-700"
                    />
                )}

                {formik.values.firstMessageMode === 'user_speaks_first' && (
                    <div className="space-y-2 p-2 bg-gray-50 dark:bg-gray-900/30 rounded border border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                        AI starts after silence
                        </span>
                        <Switch
                        checked={formik.values.aiStartsAfterSilence}
                        onCheckedChange={(checked) => formik.setFieldValue('aiStartsAfterSilence', checked)}
                        className="scale-75"
                        />
                    </div>
                    
                    {formik.values.aiStartsAfterSilence && (
                        <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                            Silence Duration
                            </span>
                            <span className="text-xs font-mono bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300">
                            {formik.values.silenceTime}s
                            </span>
                        </div>
                        <Input
                            type="range"
                            min="1"
                            max="30"
                            value={formik.values.silenceTime}
                            onChange={(e) => formik.setFieldValue('silenceTime', parseInt(e.target.value))}
                            className="h-1.5"
                        />
                        </div>
                    )}
                    </div>
                )}
                </div>

              {/* System Prompt */}
              <div className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-3 flex-shrink-0">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">System Prompt</span>
                  <div className="flex gap-2">
                    {/* Another button for settings, where we will keep settings related to prompt, like setting variables, font size, etc. but inside a sheet, so clicking on the settings icon opens the sheet  */}
                    <button
                      onClick={() => setIsPromptSettingsOpen(true)}
                      className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer transition-colors"
                    >
                      <SettingsIcon className="w-4 h-4" />
                      <span>Settings</span>
                    </button>

                    <button
                      onClick={copyToClipboard}
                      className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer transition-colors"
                      disabled={!formik.values.prompt}
                    >
                      {isCopied ? (
                        <>
                          <CheckIcon className="w-4 h-4 text-green-500" />
                          <span className="text-green-500">Copied!</span>
                        </>
                      ) : (
                        <>
                          <CopyIcon className="w-4 h-4" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <Textarea
                  placeholder="Define your agent's behavior and personality..."
                  value={formik.values.prompt}
                  onChange={(e) => formik.setFieldValue('prompt', e.target.value)}
                  className="flex-1 font-mono resize-none leading-relaxed border-gray-200 dark:border-gray-700 overflow-auto"
                  style={getTextareaStyles()}
                />
                <div className="flex justify-between items-center mt-2 flex-shrink-0">
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {formik.values.prompt.length.toLocaleString()} chars
                  </span>
                </div>
              </div>
            </div>

            {/* Right Side - Advanced Settings */}
            <div className="w-80 flex-shrink-0">
              <AgentAdvancedSettings 
                advancedSettings={formik.values.advancedSettings}
                onFieldChange={formik.setFieldValue}
              />
            </div>
          </div>
        </div>
      </div>




      <PromptSettingsSheet
        open={isPromptSettingsOpen}
        onOpenChange={setIsPromptSettingsOpen}
        prompt={formik.values.prompt}
        onPromptChange={(newPrompt) => formik.setFieldValue('prompt', newPrompt)}
      />
    </div>
  )
}