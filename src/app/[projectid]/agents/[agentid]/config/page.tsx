'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useSupabaseQuery } from '@/hooks/useSupabase'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { CopyIcon, CheckIcon, SettingsIcon, TypeIcon, SlidersHorizontal } from 'lucide-react'
import { languageOptions, firstMessageModes } from '@/utils/constants'
import { useFormik } from 'formik'
import ModelSelector from '@/components/agents/AgentConfig/ModelSelector'
import SelectTTS from '@/components/agents/AgentConfig/SelectTTSDialog'
import SelectSTT from '@/components/agents/AgentConfig/SelectSTTDialog'
import AgentAdvancedSettings from '@/components/agents/AgentConfig/AgentAdvancedSettings'
import PromptSettingsSheet from '@/components/agents/AgentConfig/PromptSettingsSheet'
import { usePromptSettings } from '@/hooks/usePromptSettings'
import { buildFormValuesFromAgent, getDefaultFormValues, useAgentConfig, useAgentMutations } from '@/hooks/useAgentConfig'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Label } from 'recharts'
import { Slider } from '@/components/ui/slider'

interface AzureConfig {
  endpoint: string
  apiVersion: string
}

export default function AgentConfig() {
  const { agentid } = useParams()
  const [isCopied, setIsCopied] = useState(false)
  const [isPromptSettingsOpen, setIsPromptSettingsOpen] = useState(false)
  const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false)

  const { getTextareaStyles, settings, setFontSize } = usePromptSettings()

  // Azure config state for ModelSelector
  const [azureConfig, setAzureConfig] = useState<AzureConfig>({
    endpoint: '',
    apiVersion: ''
  })

  const [tempAzureConfig, setTempAzureConfig] = useState<AzureConfig>({
    endpoint: '',
    apiVersion: ''
  })

  const [hasExternalChanges, setHasExternalChanges] = useState(false)

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

  // Get agent data from Supabase
  const { data: agentDataResponse, loading: agentLoading } = useSupabaseQuery("pype_voice_agents", {
    select: "id, name, agent_type, configuration, vapi_api_key_encrypted, vapi_project_key_encrypted",
    filters: [{ column: "id", operator: "eq", value: agentid }],
    limit: 1
  })

  const agentName = agentDataResponse?.[0]?.name

  // Use React Query for agent config
  const { 
    data: agentConfigData, 
    isLoading: isConfigLoading, 
    error: configError,
    isError: isConfigError,
    refetch: refetchConfig 
  } = useAgentConfig(agentName)

  // Use mutations for save operations
  const { saveDraft, saveAndDeploy } = useAgentMutations(agentName)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(formik.values.prompt)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
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
    initialValues: useMemo(() => {
      if (agentConfigData?.agent?.assistant?.[0]) {
        return buildFormValuesFromAgent(agentConfigData.agent.assistant[0])
      }
      return getDefaultFormValues()
    }, [agentConfigData]),
    enableReinitialize: true,
    onSubmit: (values) => {
      console.log('Form submitted:', values)
    }
  })

  // Handle the agent config data when it loads
  useEffect(() => {
    if (agentConfigData?.agent?.assistant?.[0]) {
      const assistant = agentConfigData.agent.assistant[0]
      
      // Only handle the external state that's not in Formik
      const formValues = buildFormValuesFromAgent(assistant)
      
      setTtsConfig({
        provider: formValues.ttsProvider,
        model: formValues.ttsModel,
        config: formValues.ttsVoiceConfig
      })
      
      setSTTConfig({
        provider: assistant.stt?.name || assistant.stt?.provider || 'openai',            
        model: assistant.stt?.model || 'whisper-1',
        config: {
          language: assistant.stt?.language || 'en',
          ...assistant.stt?.config || {}
        }
      })
      
      // Set Azure config if it's an Azure provider
      const llmConfig = assistant.llm || {}
      const providerValue = llmConfig.provider || llmConfig.name || 'openai'
      let mappedProvider = providerValue
      if (providerValue === 'groq') {
        mappedProvider = 'groq'
      } else if (providerValue === 'azure') {
        mappedProvider = 'azure_openai' 
      } else if (llmConfig.model?.includes('claude')) {
        mappedProvider = 'anthropic'
      } else if (llmConfig.model?.includes('cerebras')) {
        mappedProvider = 'cerebras'
      }
      
      if (mappedProvider === 'azure_openai' && assistant.llm) {
        const azureConfigData = {
          endpoint: assistant.llm.azure_endpoint || '',
          apiVersion: assistant.llm.api_version || ''
        }
        setAzureConfig(azureConfigData)
        setTempAzureConfig(azureConfigData)
      }
    }
  }, [agentConfigData])

  const handleSaveDraft = () => {
    const completeFormData = {
      formikValues: formik.values,
      ttsConfiguration: {
        voiceId: formik.values.selectedVoice,
        provider: formik.values.ttsProvider || ttsConfig.provider,
        model: formik.values.ttsModel || ttsConfig.model,
        config: formik.values.ttsVoiceConfig || ttsConfig.config
      },
      sttConfiguration: {
        provider: sttConfig.provider,
        model: sttConfig.model,
        config: sttConfig.config
      },
      llmConfiguration: {
        provider: formik.values.selectedProvider,
        model: formik.values.selectedModel,
        temperature: formik.values.temperature,
        azureConfig: formik.values.selectedProvider === 'azure_openai' ? azureConfig : null
      },
      agentSettings: {
        language: formik.values.selectedLanguage,
        firstMessageMode: formik.values.firstMessageMode,
        customFirstMessage: formik.values.customFirstMessage,
        aiStartsAfterSilence: formik.values.aiStartsAfterSilence,
        silenceTime: formik.values.silenceTime,
        prompt: formik.values.prompt
      },
      assistantName: agentConfigData?.agent?.assistant?.[0]?.name || 'Assistant',
      metadata: {
        agentId: agentid,
        agentName: agentName,
        timestamp: new Date().toISOString(),
        action: 'SAVE_DRAFT'
      }
    }
    
    console.log('💾 SAVE DRAFT - Complete Configuration:', completeFormData)
    saveDraft.mutate(completeFormData)
  }

  const handleSaveAndDeploy = () => {
    const completeFormData = {
      formikValues: formik.values,
      ttsConfiguration: {
        voiceId: formik.values.selectedVoice,
        provider: formik.values.ttsProvider || ttsConfig.provider,
        model: formik.values.ttsModel || ttsConfig.model,
        config: formik.values.ttsVoiceConfig || ttsConfig.config
      },
      sttConfiguration: {
        provider: sttConfig.provider,
        model: sttConfig.model,
        config: sttConfig.config
      },
      llmConfiguration: {
        provider: formik.values.selectedProvider,
        model: formik.values.selectedModel,
        temperature: formik.values.temperature,
        azureConfig: formik.values.selectedProvider === 'azure_openai' ? azureConfig : null
      },
      agentSettings: {
        language: formik.values.selectedLanguage,
        firstMessageMode: formik.values.firstMessageMode,
        customFirstMessage: formik.values.customFirstMessage,
        aiStartsAfterSilence: formik.values.aiStartsAfterSilence,
        silenceTime: formik.values.silenceTime,
        prompt: formik.values.prompt
      },
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
      assistantName: agentConfigData?.agent?.assistant?.[0]?.name || 'Assistant',
      metadata: {
        agentId: agentid,
        agentName: agentName,
        timestamp: new Date().toISOString(),
        action: 'SAVE_AND_DEPLOY'
      }
    }
    
    console.log('🚀 SAVE & DEPLOY - Complete Configuration:', completeFormData)
    
    // Validation before deployment
    if (!completeFormData.validationStatus.isReadyForDeploy) {
      console.warn('⚠️ SAVE & DEPLOY - Validation Failed:', completeFormData.validationStatus)
      return
    }
    
    saveAndDeploy.mutate(completeFormData)
  }

  const handleCancel = () => {
    formik.resetForm()
    setHasExternalChanges(false)
  }

  const handleVoiceSelect = (voiceId: string, provider: string, model?: string, config?: any) => {
    console.log('TTS Configuration received:', { voiceId, provider, model, config })
    
    formik.setFieldValue('selectedVoice', voiceId)
    formik.setFieldValue('ttsProvider', provider)
    formik.setFieldValue('ttsModel', model || '')
    formik.setFieldValue('ttsVoiceConfig', config || {})
    
    setTtsConfig({
      provider: provider,
      model: model || '',
      config: config || {}
    })
    
    console.log('✅ TTS config stored successfully')
  }

  const handleSTTSelect = (provider: string, model: string, config: any) => {
    console.log('STT Configuration received:', { provider, model, config })
    
    formik.setFieldValue('sttProvider', provider)
    formik.setFieldValue('sttModel', model)
    formik.setFieldValue('sttConfig', config)
    
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
    setHasExternalChanges(true)
  }

  // Loading state
  if (agentLoading || isConfigLoading) {
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

  if (isConfigError) {
    return (
      <div className="h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center shadow-lg">
            {/* Icon */}
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
  
            {/* Title */}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Agent Not Found in Command Center
            </h3>
  
            {/* Description */}
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
              This agent exists in your workspace but couldn't be found in the current command center environment. 
              It might be deployed to a different environment or needs to be created.
            </p>
  
            {/* Environment Info */}
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 mb-6 text-left">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">Current Environment:</span>
                <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-700 dark:text-gray-300">
                  {process.env.NODE_ENV === 'development' ? 'Development' : 'Production'}
                </code>
              </div>
            </div>
  
            {/* Actions */}
            <div className="space-y-3">
              <Button 
                onClick={() => refetchConfig()} 
                variant="outline"
                className="w-full"
              >
                Try Again
              </Button>
              <Button 
                onClick={() => window.history.back()} 
                variant="ghost"
                size="sm"
                className="w-full text-gray-600 dark:text-gray-400"
              >
                Go Back
              </Button>
            </div>
  
            {/* Help Text */}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
              Need help? Check if the agent was deployed to the correct environment.
            </p>
          </div>
        </div>
      </div>
    )
  }

  
  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
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
            {(formik.dirty || hasExternalChanges) && (
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleCancel}>
                Cancel
              </Button>
            )}
            
            {/* Advanced Settings Button - Mobile Only */}
            <div className="lg:hidden">
              <Sheet open={isAdvancedSettingsOpen} onOpenChange={setIsAdvancedSettingsOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    <SlidersHorizontal className="w-3 h-3 mr-1" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:w-96 p-0">
                  <SheetHeader className="px-4 py-3 border-b">
                    <SheetTitle className="text-sm">Advanced Settings</SheetTitle>
                  </SheetHeader>
                  <div className="flex-1 overflow-y-auto">
                    <AgentAdvancedSettings 
                      advancedSettings={formik.values.advancedSettings}
                      onFieldChange={formik.setFieldValue}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
            
            <Button 
              size="sm" 
              className="h-8 text-xs" 
              onClick={handleSaveAndDeploy}
              disabled={saveAndDeploy.isPending || (!formik.dirty && !hasExternalChanges)}
            >
              {saveAndDeploy.isPending ? 'Deploying...' : 'Save & Deploy'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - Responsive Layout */}
      <div className="flex-1 min-h-0 max-w-7xl mx-auto w-full p-4">
        <div className="h-full flex gap-4">
          
          {/* Left Side - Main Configuration */}
          <div className="flex-1 min-w-0 flex flex-col space-y-3">
            
            {/* Quick Setup Row - Responsive Stack */}
            <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
              {/* LLM Selection */}
              <div className="flex-1 min-w-0">
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
              <div className="flex-1 min-w-0">
                <SelectSTT 
                  selectedProvider={formik.values.sttProvider}
                  selectedModel={formik.values.sttModel}
                  selectedLanguage={formik.values.sttConfig?.language}   
                  initialConfig={formik.values.sttConfig}                
                  onSTTSelect={handleSTTSelect}
                />
              </div>

              {/* TTS Selection */}
              <div className="flex-1 min-w-0">
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
                  value={formik.values.firstMessageMode?.mode || formik.values.firstMessageMode} 
                  onValueChange={(value) => {
                    // Handle both old string format and new object format
                    if (typeof formik.values.firstMessageMode === 'object') {
                      formik.setFieldValue('firstMessageMode', {
                        ...formik.values.firstMessageMode,
                        mode: value
                      })
                    } else {
                      // Convert to new object format
                      formik.setFieldValue('firstMessageMode', {
                        mode: value,
                        allow_interruptions: true,
                        first_message: formik.values.customFirstMessage || ''
                      })
                    }
                  }}
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

              {/* First Message Textarea */}
              {((typeof formik.values.firstMessageMode === 'object' && formik.values.firstMessageMode.mode === 'assistant_speaks_first') ||
                (typeof formik.values.firstMessageMode === 'string' && formik.values.firstMessageMode === 'assistant_speaks_first')) && (
                <Textarea
                  placeholder="Enter the first message..."
                  value={
                    typeof formik.values.firstMessageMode === 'object' 
                      ? formik.values.firstMessageMode.first_message 
                      : formik.values.customFirstMessage
                  }
                  onChange={(e) => {
                    if (typeof formik.values.firstMessageMode === 'object') {
                      formik.setFieldValue('firstMessageMode', {
                        ...formik.values.firstMessageMode,
                        first_message: e.target.value
                      })
                    } else {
                      // Also update the old customFirstMessage field for backward compatibility
                      formik.setFieldValue('customFirstMessage', e.target.value)
                      // Convert to new object format
                      formik.setFieldValue('firstMessageMode', {
                        mode: formik.values.firstMessageMode || 'assistant_speaks_first',
                        allow_interruptions: true,
                        first_message: e.target.value
                      })
                    }
                  }}
                  className="min-h-[60px] text-xs resize-none border-gray-200 dark:border-gray-700"
                />
              )}
            </div>

            {/* System Prompt */}
            <div className="flex-1 min-h-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">System Prompt</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                        <TypeIcon className="w-3 h-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-3" align="start">
                      <div className="space-y-2">
                        <Label className="text-xs">Font Size</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs">{settings.fontSize}px</span>
                          <Slider
                            value={[settings.fontSize]}
                            onValueChange={(value) => setFontSize(value[0])} // This will auto-save to localStorage
                            min={8}
                            max={18}
                            step={1}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex gap-2">
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
                className="flex-1 min-h-0 font-mono resize-none leading-relaxed border-gray-200 dark:border-gray-700"
                style={getTextareaStyles()}
              />
              
              <div className="flex justify-between items-center mt-2 flex-shrink-0">
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {formik.values.prompt.length.toLocaleString()} chars
                </span>
              </div>
            </div>
          </div>

          {/* Right Side - Advanced Settings - Desktop Only */}
          <div className="hidden lg:block w-80 flex-shrink-0 min-h-0">
            <AgentAdvancedSettings 
              advancedSettings={formik.values.advancedSettings}
              onFieldChange={formik.setFieldValue}
            />
          </div>
          
        </div>
      </div>

      <PromptSettingsSheet
        open={isPromptSettingsOpen}
        onOpenChange={setIsPromptSettingsOpen}
        prompt={formik.values.prompt}
        onPromptChange={(newPrompt) => formik.setFieldValue('prompt', newPrompt)}
        variables={formik.values.variables}
        onVariablesChange={(newVariables) => formik.setFieldValue('variables', newVariables)}
      />
    </div>
  )
}