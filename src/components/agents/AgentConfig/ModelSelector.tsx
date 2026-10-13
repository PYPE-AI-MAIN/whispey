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
  Server
} from 'lucide-react'
import { modelProviders, type Model, type Provider } from '@/config/llmCatalog'

// Re-exported for existing importers; the catalog itself lives in config/llmCatalog.
export { getModelBaseUrl } from '@/config/llmCatalog'

// How long a freshly-added provider/model keeps its "New" badge
const NEW_BADGE_DAYS = 30

// True while `addedAt` is within the last NEW_BADGE_DAYS. Badge disappears automatically afterwards.
const isNew = (addedAt?: string): boolean => {
  if (!addedAt) return false
  const added = new Date(addedAt).getTime()
  if (Number.isNaN(added)) return false
  return Date.now() - added < NEW_BADGE_DAYS * 24 * 60 * 60 * 1000
}

const NewBadge = () => (
  <span className="ml-1 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-success flex-shrink-0">
    New
  </span>
)

interface AzureConfig {
  endpoint: string
  apiVersion: string
  deploymentName?: string
}

const DEFAULT_AZURE_CONFIG: AzureConfig = {
  endpoint: 'https://pype-azure-openai.cognitiveservices.azure.com/',
  apiVersion: '2024-12-01-preview'
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

const getProviderIcon = (providerKey: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    openai: <Zap className="h-3 w-3" />,
    anthropic: <Brain className="h-3 w-3" />,
    groq: <Cpu className="h-3 w-3" />,
    google: <Cloud className="h-3 w-3" />,
    azure_openai: <Cloud className="h-3 w-3" />,
    aws: <Cloud className="h-3 w-3" />,
    cerebras: <Cpu className="h-3 w-3" />,
    livekit: <Zap className="h-3 w-3" />,
    self_hosted: <Server className="h-3 w-3" />
  }
  return iconMap[providerKey]
}

// Renders a provider's model items (direct or grouped) inside its submenu.
// Extracted to a component so the map callbacks don't nest past 4 levels deep.
function ProviderModelItems({
  provider,
  providerKey,
  selectedProvider,
  selectedModel,
  disabled,
  onSelect,
}: Readonly<{
  provider: Provider
  providerKey: string
  selectedProvider: string
  selectedModel: string
  disabled: boolean
  onSelect: (providerKey: string, model: string) => void
}>) {
  const itemClass = (modelValue: string, extra: string) =>
    `flex items-center justify-between ${extra} text-foreground  hover:bg-muted/50  focus:bg-muted/50  ${
      selectedProvider === providerKey && selectedModel === modelValue
        ? 'bg-blue-50 dark:bg-blue-950/30 text-primary dark:text-blue-300'
        : ''
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`

  if (provider.type === 'direct') {
    return (
      <>
        {provider.models?.map((model) => (
          <DropdownMenuItem
            key={model.value}
            onClick={() => onSelect(providerKey, model.value)}
            className={itemClass(model.value, 'p-2')}
          >
            <span className="flex items-center font-medium text-sm truncate pr-2">
              {model.label}
              {isNew(model.addedAt) && <NewBadge />}
            </span>
            {selectedProvider === providerKey && selectedModel === model.value && (
              <Check className="h-3 w-3 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </>
    )
  }

  if (provider.type === 'grouped') {
    return (
      <>
        {provider.groups?.map((group, groupIndex) => (
          <React.Fragment key={group.name}>
            {groupIndex > 0 && <DropdownMenuSeparator className="bg-muted" />}
            <div className="px-2 py-1.5 bg-muted/50 sticky top-0 z-10">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
                {group.name}
              </h4>
            </div>
            <GroupModelItems
              models={group.models}
              providerKey={providerKey}
              selectedProvider={selectedProvider}
              selectedModel={selectedModel}
              itemClass={itemClass}
              onSelect={onSelect}
            />
          </React.Fragment>
        ))}
      </>
    )
  }

  return null
}

// Model items within a single group — separate component keeps nesting shallow.
function GroupModelItems({
  models,
  providerKey,
  selectedProvider,
  selectedModel,
  itemClass,
  onSelect,
}: Readonly<{
  models: Model[]
  providerKey: string
  selectedProvider: string
  selectedModel: string
  itemClass: (modelValue: string, extra: string) => string
  onSelect: (providerKey: string, model: string) => void
}>) {
  return (
    <>
      {models.map((model) => (
        <DropdownMenuItem
          key={model.value}
          onClick={() => onSelect(providerKey, model.value)}
          className={itemClass(model.value, 'px-3 sm:px-4 py-2')}
        >
          <span className="text-sm truncate pr-2">{model.label}</span>
          {selectedProvider === providerKey && selectedModel === model.value && (
            <Check className="h-3 w-3 text-primary flex-shrink-0" />
          )}
        </DropdownMenuItem>
      ))}
    </>
  )
}

// Mobile "expanded provider" model items within a group — extracted to keep the
// mobile submenu's map callbacks from nesting past 4 levels deep.
function MobileGroupModelItems({
  models,
  providerKey,
  selectedProvider,
  selectedModel,
  onSelect,
}: Readonly<{
  models: Model[]
  providerKey: string
  selectedProvider: string
  selectedModel: string
  onSelect: (providerKey: string, model: string) => void
}>) {
  return (
    <>
      {models.map((model) => (
        <DropdownMenuItem
          key={model.value}
          onClick={() => onSelect(providerKey, model.value)}
          className={`flex items-center justify-between px-6 py-2 ${
            selectedProvider === providerKey && selectedModel === model.value
              ? 'bg-blue-50 dark:bg-blue-950/30 text-primary dark:text-blue-300'
              : 'hover:bg-muted/50'
          }`}
        >
          <span className="text-sm">{model.label}</span>
          {selectedProvider === providerKey && selectedModel === model.value && (
            <Check className="h-3 w-3 text-primary" />
          )}
        </DropdownMenuItem>
      ))}
    </>
  )
}

export default function ModelSelector({
  selectedProvider = 'openai',
  selectedModel = '',
  temperature = 0.7,
  onProviderChange = () => {},
  onModelChange = () => {},
  onTemperatureChange = () => {},
  azureConfig = DEFAULT_AZURE_CONFIG,
  onAzureConfigChange = () => {}
}: Readonly<ModelSelectorProps>) {
  // DISABLE CONTROLS
  const DISABLE_SETTINGS = false

  const [isOpen, setIsOpen] = useState(false)
  const [isAzureDialogOpen, setIsAzureDialogOpen] = useState(false)
  const [tempAzureConfig, setTempAzureConfig] = useState<AzureConfig>({
    ...DEFAULT_AZURE_CONFIG,
    ...azureConfig
  })
  const [tempAzureModel, setTempAzureModel] = useState<string>(
    selectedProvider === 'azure_openai' && selectedModel
      ? selectedModel
      : modelProviders.azure_openai.models?.[0]?.value ?? 'gpt-4.1-mini'
  )
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
    return ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5.6-terra', 'gpt-5.6-luna'].includes(modelValue)
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
        // Pre-fill tempAzureModel with current selection or default
        const currentAzureModel =
          selectedProvider === 'azure_openai' && selectedModel
            ? selectedModel
            : provider.models?.[0]?.value ?? 'gpt-4.1-mini'
        setTempAzureModel(currentAzureModel)
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

    const selectedAzureModel = modelProviders.azure_openai.models?.find(m => m.value === tempAzureModel)
    onAzureConfigChange({
      ...tempAzureConfig,
      deploymentName: selectedAzureModel?.deploymentName ?? tempAzureModel,
    })
    onModelChange(tempAzureModel)
    if (isGPT5Model(tempAzureModel)) {
      onTemperatureChange(1)
    }
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
            className={`cursor-pointer flex-1 justify-between h-9 min-w-0 rounded-r-none border-r-0 bg-card hover:bg-muted/50 border-border text-foreground`}
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
            <ChevronDown className={`ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4 shrink-0 transition-transform text-muted-foreground  ${isOpen ? 'rotate-180' : ''} ${
              DISABLE_SETTINGS ? 'opacity-50' : ''
            }`} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          className="w-[calc(100vw-2rem)] sm:w-80 max-w-[380px] bg-card border-border" 
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
                  className="flex items-center justify-between p-3 bg-muted/50 hover:bg-muted"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full ${provider.color} flex items-center justify-center text-white flex-shrink-0`}>
                      {getProviderIcon(providerKey) || <span className="text-xs font-bold">{provider.icon}</span>}
                    </div>
                    <span className="font-medium text-sm">{provider.label}</span>
                    {isNew(provider.addedAt) && <NewBadge />}
                    {provider.type === 'config' && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                    {selectedProvider === providerKey && <Check className="h-3 w-3 text-primary" />}
                  </div>
                  {(provider.type === 'direct' || provider.type === 'grouped') && (
                    <ChevronDown className={`h-4 w-4 transition-transform ${
                      expandedProvider === providerKey ? 'rotate-180' : ''
                    }`} />
                  )}
                </DropdownMenuItem>
                
                {/* Expanded Models */}
                {expandedProvider === providerKey && provider.type === 'direct' && provider.models && (
                  <div className="bg-card border-l-2 border-border ml-4">
                    {provider.models.map((model) => (
                      <DropdownMenuItem
                        key={model.value}
                        onClick={() => handleModelSelect(providerKey, model.value)}
                        className={`flex items-center justify-between px-4 py-3 ${
                          selectedProvider === providerKey && selectedModel === model.value
                            ? 'bg-blue-50 dark:bg-blue-950/30 text-primary dark:text-blue-300'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <span className="flex items-center text-sm">
                          {model.label}
                          {isNew(model.addedAt) && <NewBadge />}
                        </span>
                        {selectedProvider === providerKey && selectedModel === model.value && (
                          <Check className="h-3 w-3 text-primary" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </div>
                )}
                
                {/* Grouped Models */}
                {expandedProvider === providerKey && provider.type === 'grouped' && provider.groups && (
                  <div className="bg-card border-l-2 border-border ml-4">
                    {provider.groups.map((group, groupIndex) => (
                      <div key={group.name}>
                        {groupIndex > 0 && <div className="border-t border-border" />}
                        <div className="px-4 py-2 bg-muted">
                          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            {group.name}
                          </h4>
                        </div>
                        <MobileGroupModelItems
                          models={group.models}
                          providerKey={providerKey}
                          selectedProvider={selectedProvider}
                          selectedModel={selectedModel}
                          onSelect={handleModelSelect}
                        />
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
                    <DropdownMenuSubTrigger className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 text-foreground  hover:bg-muted/50  focus:bg-muted/50  ${
                      DISABLE_SETTINGS ? 'opacity-50 cursor-not-allowed' : ''
                    }`}>
                      <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full ${provider.color} flex items-center justify-center text-white flex-shrink-0`}>
                        {getProviderIcon(providerKey) || <span className="text-xs font-bold">{provider.icon}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{provider.label}</span>
                          {isNew(provider.addedAt) && <NewBadge />}
                          {selectedProvider === providerKey && (
                            <Check className="h-3 w-3 text-primary flex-shrink-0" />
                          )}
                        </div>
                        {provider.description && (
                          <p className="text-xs text-muted-foreground truncate">{provider.description}</p>
                        )}
                      </div>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent 
                      className="w-64 max-h-96 overflow-y-auto bg-card border-border"
                      sideOffset={8}
                      alignOffset={-4}
                      avoidCollisions={true}
                      collisionPadding={16}
                    >
                      <ProviderModelItems
                        provider={provider}
                        providerKey={providerKey}
                        selectedProvider={selectedProvider}
                        selectedModel={selectedModel}
                        disabled={DISABLE_SETTINGS}
                        onSelect={handleModelSelect}
                      />
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )
              } else {
                // Config providers (no submenu)
                return (
                  <DropdownMenuItem
                    key={providerKey}
                    onClick={() => handleProviderSelect(providerKey)}
                    className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 text-foreground  hover:bg-muted/50  focus:bg-muted/50  ${
                      DISABLE_SETTINGS ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full ${provider.color} flex items-center justify-center text-white flex-shrink-0`}>
                      {getProviderIcon(providerKey) || <span className="text-xs font-bold">{provider.icon}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{provider.label}</span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        {selectedProvider === providerKey && (
                          <Check className="h-3 w-3 text-primary flex-shrink-0" />
                        )}
                      </div>
                      {provider.description && (
                        <p className="text-xs text-muted-foreground truncate">{provider.description}</p>
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
            className={`cursor-pointer h-9 w-8 sm:w-9 rounded-l-none border-l-0 bg-card hover:bg-muted/50 border-border flex-shrink-0`}
          >
            <Settings className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[calc(100vw-2rem)] sm:w-80 max-w-[380px] p-3 sm:p-4 bg-card border-border" 
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
                  <h4 className="font-medium text-sm text-foreground">Temperature</h4>
                  <p className="text-xs text-muted-foreground">
                    {isGPT5Model(selectedModel)
                      ? 'Selected model only supports temperature of 1'
                      : 'Controls response creativity'}
                  </p>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <Badge variant="outline" className="font-mono text-xs border-border text-foreground">
                    {temperature.toFixed(2)}
                  </Badge>
                  {!isGPT5Model(selectedModel) && (
                    <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground hidden sm:inline-flex">
                      {getTemperatureLabel(temperature)}
                    </Badge>
                  )}
                </div>
              </div>
              <div title={isGPT5Model(selectedModel) ? 'Selected model only supports temperature of 1' : undefined}>
                <Slider
                  value={[isGPT5Model(selectedModel) ? 1 : temperature]}
                  onValueChange={DISABLE_SETTINGS || isGPT5Model(selectedModel) ? () => {} : (value) => onTemperatureChange(value[0])}
                  max={1}
                  min={0}
                  step={0.01}
                  className={`w-full ${DISABLE_SETTINGS || isGPT5Model(selectedModel) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={DISABLE_SETTINGS || isGPT5Model(selectedModel)}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Focused</span>
                <span className="hidden sm:inline">Balanced</span>
                <span>Creative</span>
              </div>
            </div>
            
            {currentProvider && (
              <div className="border-t pt-3 border-border">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-foreground">Current Selection</h4>
                  <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-muted/50 rounded-lg">
                    <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full ${currentProvider.color} flex items-center justify-center text-white flex-shrink-0`}>
                      {getProviderIcon(selectedProvider) || <span className="text-xs font-bold">{currentProvider.icon}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{currentProvider.label}</p>
                      <p className="text-xs text-muted-foreground truncate">
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
        <DialogContent className="w-[calc(100vw-2rem)] sm:w-full max-w-md bg-card border-border mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-500 flex items-center justify-center text-white flex-shrink-0">
                <Cloud className="h-3 w-3" />
              </div>
              <span className="truncate">Configure Azure OpenAI</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Model</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {modelProviders.azure_openai.models?.map((model) => (
                  <button
                    key={model.value}
                    type="button"
                    onClick={DISABLE_SETTINGS ? undefined : () => setTempAzureModel(model.value)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors text-left ${
                      tempAzureModel === model.value
                        ? 'border-blue-500 bg-primary/10  text-primary dark:text-blue-300'
                        : 'border-border hover:bg-muted/50 text-foreground'
                    } ${DISABLE_SETTINGS ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {tempAzureModel === model.value && (
                      <Check className="h-3 w-3 text-primary shrink-0" />
                    )}
                    <span className="truncate">{model.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="endpoint" className="text-foreground">Azure Endpoint</Label>
              <Input
                id="endpoint"
                placeholder="https://your-resource.cognitiveservices.azure.com/"
                value={tempAzureConfig.endpoint || "https://pype-azure-openai.cognitiveservices.azure.com/"}
                onChange={DISABLE_SETTINGS ? () => {} : (e) => setTempAzureConfig(prev => ({ ...prev, endpoint: e.target.value }))}
                className="bg-card border-border text-foreground text-sm"
                disabled={DISABLE_SETTINGS}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiVersion" className="text-foreground">API Version</Label>
              <Input
                id="apiVersion"
                placeholder="2024-12-01-preview"
                value={tempAzureConfig.apiVersion || "2024-12-01-preview"}
                onChange={DISABLE_SETTINGS ? () => {} : (e) => setTempAzureConfig(prev => ({ ...prev, apiVersion: e.target.value }))}
                className="bg-card border-border text-foreground text-sm"
                disabled={DISABLE_SETTINGS}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => setIsAzureDialogOpen(false)}
              className="border-border text-foreground w-full sm:w-auto"
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