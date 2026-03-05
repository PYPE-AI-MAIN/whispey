import React, { useState, useRef, useEffect } from 'react'
import { useMobile } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  ChevronDown, 
  Settings, 
  ExternalLink, 
  Check, 
  Zap,
  Cpu,
  Brain,
  Cloud,
  Loader2,
  ArrowLeft
} from 'lucide-react'

interface Model {
  value: string
  label: string
  id?: string
}

interface ModelGroup {
  name: string
  models: Model[]
}

interface Provider {
  label: string
  icon: string
  color: string
  type: 'direct' | 'config' | 'grouped'
  models?: Model[]
  groups?: ModelGroup[]
  description?: string
}

interface AzureConfig {
  endpoint: string
  apiVersion: string
}

interface ModelSelectorProps {
  selectedProvider?: string
  selectedModel?: string
  temperature?: number
  onProviderChange?: (provider: string) => void
  onModelChange?: (model: string) => void
  onTemperatureChange?: (temperature: number) => void
  azureConfig?: AzureConfig
  onAzureConfigChange?: (config: AzureConfig) => void
}

const modelProviders: Record<string, Provider> = {
  openai: {
    label: 'OpenAI',
    icon: 'O',
    color: 'bg-emerald-500',
    type: 'direct',
    models: [
      { value: 'gpt-5', label: 'GPT 5' },
      { value: 'gpt-5-mini', label: 'GPT 5 Mini' },
      { value: 'gpt-5-nano', label: 'GPT 5 Nano' },
      { value: 'gpt-4.1', label: 'GPT 4.1' },
      { value: 'gpt-4.1-mini', label: 'GPT 4.1 Mini' },
      { value: 'gpt-4.1-nano', label: 'GPT 4.1 Nano' },
      { value: 'gpt-4o', label: 'GPT 4o' },
      { value: 'gpt-4o-mini', label: 'GPT 4o Mini' },
    ]
  },
  google: {
    label: 'Google',
    icon: 'G',
    color: 'bg-blue-500',
    type: 'direct',
    models: [
      { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'gemini-2.5-flash-preview-09-2025', label: 'Gemini 2.5 Flash Preview' },
      { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-lite' },
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
      { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash-lite' },
    ]
  },
  azure_openai: {
    label: 'Azure OpenAI',
    icon: 'Az',
    color: 'bg-blue-500',
    type: 'config',
    models: [
      { value: 'gpt-4.1-mini', label: 'GPT 4.1 Mini' },
      { value: 'gpt-4o', label: 'GPT 4o' },
      { value: 'gpt-4o-mini', label: 'GPT 4o Mini' },
    ]
  },
  groq: {
    label: 'Groq',
    icon: 'G',
    color: 'bg-orange-500',
    type: 'grouped',
    groups: [
      {
        name: 'Featured Systems',
        models: [
          { value: 'groq/compound', label: 'Groq Compound' },
        ]
      },
      {
        name: 'Production Models',
        models: [
          { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B' },
          { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
          { value: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' },
          { value: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B' },
        ]
      },
      {
        name: 'Preview Models',
        models: [
          { value: 'meta-llama/llama-4-maverick-17b-128e-instruct', label: 'Llama 4 Maverick 17B 128E' },
          { value: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B 16E' },
          { value: 'moonshotai/kimi-k2-instruct-0905', label: 'Kimi K2 0905' },
          { value: 'openai/gpt-oss-safeguard-20b', label: 'Safety GPT-OSS 20B' },
          { value: 'qwen/qwen3-32b', label: 'Qwen3-32B' },
        ]
      }
    ]
  },
  cerebras: {
    label: 'Cerebras',
    icon: 'C',
    color: 'bg-purple-500',
    type: 'grouped',
    groups: [
      {
        name: 'Production Models',
        models: [
          { value: 'llama3.1-8b', label: 'Llama 3.1 8B' },
          { value: 'llama-3.3-70b', label: 'Llama 3.3 70B' },
          { value: 'gpt-oss-120b', label: 'OpenAI GPT-OSS 120B' },
          { value: 'qwen-3-32b', label: 'Qwen 3 32B' },
        ]
      },
      {
        name: 'Preview Models',
        models: [
          { value: 'qwen-3-235b-a22b-instruct-2507', label: 'Qwen 3 235B Instruct' },
          { value: 'qwen-3-235b-a22b-thinking-2507', label: 'Qwen 3 235B Thinking' },
          { value: 'zai-glm-4.6', label: 'Z.ai GLM 4.6' },
        ]
      }
    ]
  }
}

const getProviderIcon = (providerKey: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    openai: <Zap className="h-3 w-3" />,
    anthropic: <Brain className="h-3 w-3" />,
    groq: <Cpu className="h-3 w-3" />,
    google: <Cloud className="h-3 w-3" />,
    azure_openai: <Cloud className="h-3 w-3" />,
    cerebras: <Cpu className="h-3 w-3" />
  }
  return iconMap[providerKey]
}

export default function ModelSelector({
  selectedProvider = 'openai',
  selectedModel = '',
  temperature = 0.7,
  onProviderChange = () => {},
  onModelChange = () => {},
  onTemperatureChange = () => {},
  azureConfig = { endpoint: 'https://pype-azure-openai.cognitiveservices.azure.com/', apiVersion: '2024-12-01-preview' },
  onAzureConfigChange = () => {}
}: ModelSelectorProps) {
  // DISABLE CONTROLS
  const DISABLE_SETTINGS = false

  const DEFAULT_AZURE_CONFIG = {
    endpoint: 'https://pype-azure-openai.cognitiveservices.azure.com/',
    apiVersion: '2024-12-01-preview'
  }

  const [isOpen, setIsOpen] = useState(false)
  const [isAzureDialogOpen, setIsAzureDialogOpen] = useState(false)
  const [tempAzureConfig, setTempAzureConfig] = useState<AzureConfig>({
    ...DEFAULT_AZURE_CONFIG,
    ...azureConfig
  })
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [mobileSelectedProvider, setMobileSelectedProvider] = useState<string | null>(null)
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)


  // Add this function inside the ModelSelector component, after the mobile detection
const getFlattenedMenuItems = () => {
  const items: Array<{ 
    type: 'provider' | 'model' | 'separator', 
    providerKey?: string, 
    provider?: Provider, 
    model?: Model, 
    groupName?: string 
  }> = []

  Object.entries(modelProviders).forEach(([providerKey, provider]) => {
    if (provider.type === 'config') {
      // Config providers go directly as providers
      items.push({ type: 'provider', providerKey, provider })
    } else {
      // Add provider header
      items.push({ type: 'provider', providerKey, provider })
      
      if (provider.type === 'direct' && provider.models) {
        // Add direct models
        provider.models.forEach(model => {
          items.push({ type: 'model', providerKey, model })
        })
      } else if (provider.type === 'grouped' && provider.groups) {
        // Add grouped models
        provider.groups.forEach(group => {
          group.models.forEach(model => {
            items.push({ type: 'model', providerKey, model, groupName: group.name })
          })
        })
      }
      
      // Add separator after each provider
      items.push({ type: 'separator' })
    }
  })

  return items
}
  
  // Mobile detection
  const { isMobile } = useMobile(768)

  const isGPT5Model = (modelValue: string): boolean => {
    return modelValue === 'gpt-5' || modelValue === 'gpt-5-mini' || modelValue === 'gpt-5-nano'
  }

  useEffect(() => {
    setTempAzureConfig(azureConfig)
  }, [azureConfig])

  // Set temperature to 1 for GPT-5 models when they're selected
  useEffect(() => {
    if (isGPT5Model(selectedModel) && temperature !== 1) {
      onTemperatureChange(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel, temperature])

  const currentProvider = modelProviders[selectedProvider]
  const currentModel = currentProvider?.type === 'grouped'
    ? currentProvider.groups?.flatMap(g => g.models).find(m => m.value === selectedModel)
    : currentProvider?.models?.find(m => m.value === selectedModel)

  const handleProviderSelect = (providerKey: string) => {
      if (DISABLE_SETTINGS) return
      
      const provider = modelProviders[providerKey]
    
      if (isMobile && (provider.type === 'direct' || provider.type === 'grouped')) {
        setMobileSelectedProvider(providerKey)
        return
      }
    
      if (provider.type === 'config' && providerKey === 'azure_openai') {
        onProviderChange(providerKey)
        // Set a default Azure model when switching to Azure
        const defaultAzureModel = provider.models?.[0]?.value || 'gpt-4o'
        onModelChange(defaultAzureModel)
        // GPT-5 models only support temperature of 1
        if (isGPT5Model(defaultAzureModel)) {
          onTemperatureChange(1)
        }
        setIsAzureDialogOpen(true)
      } else if (provider.type === 'direct' && provider.models && provider.models.length > 0) {
        const firstModel = provider.models[0].value
        onProviderChange(providerKey)
        onModelChange(firstModel)
        // GPT-5 models only support temperature of 1
        if (isGPT5Model(firstModel)) {
          onTemperatureChange(1)
        }
      }
      setIsOpen(false)
    }

  const handleMobileBack = () => {
    setMobileSelectedProvider(null)
  }

  const handleModelSelect = (providerKey: string, modelValue: string) => {
    if (DISABLE_SETTINGS) return
    
    onProviderChange(providerKey)
    onModelChange(modelValue)
    
    // GPT-5 models only support temperature of 1
    if (isGPT5Model(modelValue)) {
      onTemperatureChange(1)
    }
    
    setIsOpen(false)
  }

  const handleAzureConfigSave = () => {
    if (DISABLE_SETTINGS) return
    
    onAzureConfigChange(tempAzureConfig)
    setIsAzureDialogOpen(false)
  }

  const getDisplayText = (): string => {
    if (selectedProvider === 'azure_openai' && azureConfig.endpoint) {
      const model = currentModel?.label || 'Select Model'
      return `${model}`
    }
    return currentModel?.label || currentProvider?.label || 'Select Provider'
  }

  const getTemperatureLabel = (temp: number) => {
    if (temp <= 0.3) return 'Precise'
    if (temp <= 0.7) return 'Balanced'
    return 'Creative'
  }

  // Reset mobile navigation when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setMobileSelectedProvider(null)
    }
  }, [isOpen])

  return (
    <div className="w-full flex">
      {/* Main Selector */}
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={`cursor-pointer flex-1 justify-between h-9 min-w-0 rounded-r-none border-r-0 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-900 dark:text-slate-100`}
          >
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              {currentProvider && (
                <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full ${currentProvider.color} flex items-center justify-center text-white flex-shrink-0`}>
                  {getProviderIcon(selectedProvider) || <span className="text-xs font-bold">{currentProvider.icon}</span>}
                </div>
              )}
              <span className="text-xs sm:text-sm font-medium truncate">
                {getDisplayText()}
              </span>
            </div>
            <ChevronDown className={`ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4 shrink-0 transition-transform text-gray-400 dark:text-slate-500 ${isOpen ? 'rotate-180' : ''} ${
              DISABLE_SETTINGS ? 'opacity-50' : ''
            }`} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          className="w-[calc(100vw-2rem)] sm:w-80 max-w-[380px] bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700" 
          align="start"
          side="bottom"
          sideOffset={4}
          avoidCollisions={true}
          collisionPadding={16}
        >
          {isMobile ? (
            // Mobile: Flattened menu
            Object.entries(modelProviders).map(([providerKey, provider]) => (
              <div key={providerKey}>
                {/* Provider Header */}
                <DropdownMenuItem
                  onClick={(e) => {
                    if (provider.type === 'config') {
                      handleProviderSelect(providerKey)
                    } else {
                      e.preventDefault() // Prevent dropdown from closing
                      e.stopPropagation() // Stop event bubbling
                      setExpandedProvider(expandedProvider === providerKey ? null : providerKey)
                    }
                  }}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full ${provider.color} flex items-center justify-center text-white flex-shrink-0`}>
                      {getProviderIcon(providerKey) || <span className="text-xs font-bold">{provider.icon}</span>}
                    </div>
                    <span className="font-medium text-sm">{provider.label}</span>
                    {provider.type === 'config' && <ExternalLink className="h-3 w-3 text-gray-400" />}
                    {selectedProvider === providerKey && <Check className="h-3 w-3 text-blue-600" />}
                  </div>
                  {(provider.type === 'direct' || provider.type === 'grouped') && (
                    <ChevronDown className={`h-4 w-4 transition-transform ${
                      expandedProvider === providerKey ? 'rotate-180' : ''
                    }`} />
                  )}
                </DropdownMenuItem>
                
                {/* Expanded Models */}
                {expandedProvider === providerKey && provider.type === 'direct' && provider.models && (
                  <div className="bg-white dark:bg-slate-900 border-l-2 border-gray-200 dark:border-slate-700 ml-4">
                    {provider.models.map((model) => (
                      <DropdownMenuItem
                        key={model.value}
                        onClick={() => handleModelSelect(providerKey, model.value)}
                        className={`flex items-center justify-between px-4 py-3 ${
                          selectedProvider === providerKey && selectedModel === model.value
                            ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                            : 'hover:bg-gray-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="text-sm">{model.label}</span>
                        {selectedProvider === providerKey && selectedModel === model.value && (
                          <Check className="h-3 w-3 text-blue-600" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </div>
                )}
                
                {/* Grouped Models */}
                {expandedProvider === providerKey && provider.type === 'grouped' && provider.groups && (
                  <div className="bg-white dark:bg-slate-900 border-l-2 border-gray-200 dark:border-slate-700 ml-4">
                    {provider.groups.map((group, groupIndex) => (
                      <div key={group.name}>
                        {groupIndex > 0 && <div className="border-t border-gray-200 dark:border-slate-700" />}
                        <div className="px-4 py-2 bg-gray-100 dark:bg-slate-800">
                          <h4 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">
                            {group.name}
                          </h4>
                        </div>
                        {group.models.map((model) => (
                          <DropdownMenuItem
                            key={model.value}
                            onClick={() => handleModelSelect(providerKey, model.value)}
                            className={`flex items-center justify-between px-6 py-2 ${
                              selectedProvider === providerKey && selectedModel === model.value
                                ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                                : 'hover:bg-gray-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span className="text-sm">{model.label}</span>
                            {selectedProvider === providerKey && selectedModel === model.value && (
                              <Check className="h-3 w-3 text-blue-600" />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            // Desktop: Original submenu structure
            Object.entries(modelProviders).map(([providerKey, provider]) => {
              // Providers with submenus (direct models or grouped models)
              if (provider.type === 'direct' || provider.type === 'grouped') {
                return (
                  <DropdownMenuSub key={providerKey}>
                    <DropdownMenuSubTrigger className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 text-gray-900 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-gray-800 focus:bg-gray-50 dark:focus:bg-gray-800 ${
                      DISABLE_SETTINGS ? 'opacity-50 cursor-not-allowed' : ''
                    }`}>
                      <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full ${provider.color} flex items-center justify-center text-white flex-shrink-0`}>
                        {getProviderIcon(providerKey) || <span className="text-xs font-bold">{provider.icon}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{provider.label}</span>
                          {selectedProvider === providerKey && (
                            <Check className="h-3 w-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                          )}
                        </div>
                        {provider.description && (
                          <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{provider.description}</p>
                        )}
                      </div>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent 
                      className="w-64 max-h-96 overflow-y-auto bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700"
                      sideOffset={8}
                      alignOffset={-4}
                      avoidCollisions={true}
                      collisionPadding={16}
                    >
                      {/* Direct models */}
                      {provider.type === 'direct' && provider.models && 
                        provider.models.map((model) => (
                          <DropdownMenuItem
                            key={model.value}
                            onClick={() => handleModelSelect(providerKey, model.value)}
                            className={`flex items-center justify-between p-2 text-gray-900 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800 focus:bg-gray-50 dark:focus:bg-slate-800 ${
                              selectedProvider === providerKey && selectedModel === model.value 
                                ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300' 
                                : ''
                            } ${DISABLE_SETTINGS ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <span className="font-medium text-sm truncate pr-2">{model.label}</span>
                            {selectedProvider === providerKey && selectedModel === model.value && (
                              <Check className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                            )}
                          </DropdownMenuItem>
                        ))
                      }
                      
                      {/* Grouped models */}
                      {provider.type === 'grouped' && provider.groups && 
                        provider.groups.map((group, groupIndex) => (
                          <React.Fragment key={group.name}>
                            {groupIndex > 0 && <DropdownMenuSeparator className="bg-gray-200 dark:bg-slate-700" />}
                            <div className="px-2 py-1.5 bg-gray-50 dark:bg-slate-800 sticky top-0 z-10">
                              <h4 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide truncate">
                                {group.name}
                              </h4>
                            </div>
                            {group.models.map((model) => (
                              <DropdownMenuItem
                                key={model.value}
                                onClick={() => handleModelSelect(providerKey, model.value)}
                                className={`flex items-center justify-between px-3 sm:px-4 py-2 text-gray-900 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800 focus:bg-gray-50 dark:focus:bg-slate-800 ${
                                  selectedProvider === providerKey && selectedModel === model.value 
                                    ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300' 
                                    : ''
                                } ${DISABLE_SETTINGS ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <span className="text-sm truncate pr-2">{model.label}</span>
                                {selectedProvider === providerKey && selectedModel === model.value && (
                                  <Check className="h-3 w-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                )}
                              </DropdownMenuItem>
                            ))}
                          </React.Fragment>
                        ))
                      }
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )
              } else {
                // Config providers (no submenu)
                return (
                  <DropdownMenuItem
                    key={providerKey}
                    onClick={() => handleProviderSelect(providerKey)}
                    className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 text-gray-900 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800 focus:bg-gray-50 dark:focus:bg-slate-800 ${
                      DISABLE_SETTINGS ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full ${provider.color} flex items-center justify-center text-white flex-shrink-0`}>
                      {getProviderIcon(providerKey) || <span className="text-xs font-bold">{provider.icon}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{provider.label}</span>
                        <ExternalLink className="h-3 w-3 text-gray-400 dark:text-slate-500 flex-shrink-0" />
                        {selectedProvider === providerKey && (
                          <Check className="h-3 w-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        )}
                      </div>
                      {provider.description && (
                        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{provider.description}</p>
                      )}
                    </div>
                  </DropdownMenuItem>
                )
              }
            })
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Settings Button */}
      <Popover open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`cursor-pointer h-9 w-8 sm:w-9 rounded-l-none border-l-0 bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800 border-gray-200 dark:border-slate-700 flex-shrink-0`}
          >
            <Settings className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500 dark:text-slate-400" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[calc(100vw-2rem)] sm:w-80 max-w-[380px] p-3 sm:p-4 bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700" 
          align="end"
          side="bottom"
          sideOffset={4}
          avoidCollisions={true}
          collisionPadding={16}
        >
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm text-gray-900 dark:text-slate-100">Temperature</h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {isGPT5Model(selectedModel) 
                      ? 'GPT-5 models only support temperature of 1' 
                      : 'Controls response creativity'}
                  </p>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <Badge variant="outline" className="font-mono text-xs border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-300">
                    {temperature.toFixed(2)}
                  </Badge>
                  {!isGPT5Model(selectedModel) && (
                    <Badge variant="secondary" className="text-xs bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hidden sm:inline-flex">
                      {getTemperatureLabel(temperature)}
                    </Badge>
                  )}
                </div>
              </div>
              <Slider
                value={[isGPT5Model(selectedModel) ? 1 : temperature]}
                onValueChange={DISABLE_SETTINGS || isGPT5Model(selectedModel) ? () => {} : (value) => onTemperatureChange(value[0])}
                max={1}
                min={0}
                step={0.01}
                className={`w-full ${DISABLE_SETTINGS || isGPT5Model(selectedModel) ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={DISABLE_SETTINGS || isGPT5Model(selectedModel)}
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400">
                <span>Focused</span>
                <span className="hidden sm:inline">Balanced</span>
                <span>Creative</span>
              </div>
            </div>
            
            {currentProvider && (
              <div className="border-t pt-3 border-gray-200 dark:border-slate-700">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-gray-900 dark:text-slate-100">Current Selection</h4>
                  <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                    <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full ${currentProvider.color} flex items-center justify-center text-white flex-shrink-0`}>
                      {getProviderIcon(selectedProvider) || <span className="text-xs font-bold">{currentProvider.icon}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{currentProvider.label}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                        {currentModel?.label || 'No model selected'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Azure Configuration Dialog */}
      <Dialog open={isAzureDialogOpen && !DISABLE_SETTINGS} onOpenChange={DISABLE_SETTINGS ? () => {} : setIsAzureDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-full max-w-md bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-slate-100">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-500 flex items-center justify-center text-white flex-shrink-0">
                <Cloud className="h-3 w-3" />
              </div>
              <span className="truncate">Configure Azure OpenAI</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="endpoint" className="text-gray-700 dark:text-slate-300">Azure Endpoint</Label>
              <Input
                id="endpoint"
                placeholder="https://your-resource.cognitiveservices.azure.com/"
                value={tempAzureConfig.endpoint || "https://pype-azure-openai.cognitiveservices.azure.com/"}
                onChange={DISABLE_SETTINGS ? () => {} : (e) => setTempAzureConfig(prev => ({ ...prev, endpoint: e.target.value }))}
                className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-slate-100 text-sm"
                disabled={DISABLE_SETTINGS}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiVersion" className="text-gray-700 dark:text-slate-300">API Version</Label>
              <Input
                id="apiVersion"
                placeholder="2024-12-01-preview"
                value={tempAzureConfig.apiVersion || "2024-12-01-preview"}
                onChange={DISABLE_SETTINGS ? () => {} : (e) => setTempAzureConfig(prev => ({ ...prev, apiVersion: e.target.value }))}
                className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-900 dark:text-slate-100 text-sm"
                disabled={DISABLE_SETTINGS}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setIsAzureDialogOpen(false)}
              className="border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-300 w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAzureConfigSave} 
              className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              disabled={DISABLE_SETTINGS}
            >
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}