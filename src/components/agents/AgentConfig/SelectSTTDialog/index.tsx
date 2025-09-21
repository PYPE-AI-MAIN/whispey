import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Mic, Settings, CheckCircle, Copy, Check } from 'lucide-react'

// Types
interface OpenAISTTConfig {
  model: string;
  language: string;
  temperature: number;
  response_format: string;
  timestamp_granularities: string[];
}

interface DeepgramConfig {
  model: string;
  language: string;
  tier: string;
  version: string;
  punctuate: boolean;
  profanity_filter: boolean;
  redact: string[];
  diarize: boolean;
  smart_format: boolean;
  utterances: boolean;
  detect_language: boolean;
}

interface SarvamConfig {
  model: string;
  language: string;
  domain: string;
  with_timestamps: boolean;
  enable_formatting: boolean;
}

interface SelectSTTProps {
  selectedProvider?: string;
  selectedModel?: string;
  onSTTSelect?: (provider: string, model: string, config: any) => void;
}

// STT Provider Data
const STT_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    models: [
      { id: 'whisper-1', name: 'Whisper v1', description: 'General-purpose speech recognition' }
    ],
    languages: [
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ru', name: 'Russian' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'zh', name: 'Chinese' }
    ]
  },
  deepgram: {
    name: 'Deepgram',
    models: [
      { id: 'nova-2', name: 'Nova 2', description: 'Latest general model' },
      { id: 'nova', name: 'Nova', description: 'Previous generation model' },
      { id: 'enhanced', name: 'Enhanced', description: 'Enhanced accuracy model' },
      { id: 'base', name: 'Base', description: 'Base model' }
    ],
    languages: [
      { code: 'en', name: 'English' },
      { code: 'en-US', name: 'English (US)' },
      { code: 'en-GB', name: 'English (UK)' },
      { code: 'en-AU', name: 'English (AU)' },
      { code: 'es', name: 'Spanish' },
      { code: 'es-419', name: 'Spanish (Latin America)' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'pt-BR', name: 'Portuguese (Brazil)' },
      { code: 'nl', name: 'Dutch' },
      { code: 'hi', name: 'Hindi' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'zh', name: 'Chinese' }
    ]
  },
  sarvam: {
    name: 'Sarvam AI',
    models: [
      { id: 'saaras:v1', name: 'Saaras v1', description: 'Multilingual speech recognition' },
      { id: 'saaras:v2', name: 'Saaras v2', description: 'Enhanced multilingual model' }
    ],
    languages: [
      { code: 'hi', name: 'Hindi' },
      { code: 'en', name: 'English' },
      { code: 'bn', name: 'Bengali' },
      { code: 'gu', name: 'Gujarati' },
      { code: 'kn', name: 'Kannada' },
      { code: 'ml', name: 'Malayalam' },
      { code: 'mr', name: 'Marathi' },
      { code: 'or', name: 'Odia' },
      { code: 'pa', name: 'Punjabi' },
      { code: 'ta', name: 'Tamil' },
      { code: 'te', name: 'Telugu' }
    ]
  }
}

// Utility Components
const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="w-7 h-7 p-0"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-600" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-gray-400" />
      )}
    </Button>
  )
}

const ProviderCard = ({ 
  provider, 
  providerKey, 
  isSelected, 
  onSelect 
}: { 
  provider: any, 
  providerKey: string, 
  isSelected: boolean, 
  onSelect: () => void 
}) => {
  const getProviderColor = () => {
    switch (providerKey) {
      case 'openai': return 'from-green-400 to-green-600'
      case 'deepgram': return 'from-blue-400 to-blue-600'
      case 'sarvam': return 'from-orange-400 to-red-500'
      default: return 'from-gray-400 to-gray-600'
    }
  }

  const getBorderColor = () => {
    switch (providerKey) {
      case 'openai': return 'border-green-200 dark:border-green-600 bg-green-50 dark:bg-green-900/10'
      case 'deepgram': return 'border-blue-200 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/10'
      case 'sarvam': return 'border-orange-200 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/10'
      default: return 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/10'
    }
  }

  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer p-4 rounded-lg border transition-all hover:shadow-sm ${
        isSelected 
          ? getBorderColor()
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getProviderColor()} flex items-center justify-center`}>
          <Mic className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
              {provider.name}
            </h3>
            {isSelected && <CheckCircle className="w-4 h-4 text-green-600" />}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {provider.models.length} models • {provider.languages.length} languages
          </p>
        </div>
      </div>
    </div>
  )
}

// Main Component
const SelectSTT: React.FC<SelectSTTProps> = ({ 
  selectedProvider = '', 
  selectedModel = '',
  onSTTSelect 
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [activeProvider, setActiveProvider] = useState(selectedProvider || 'openai')
  const [showSettings, setShowSettings] = useState(false)
  
  // Configuration states
  const [openaiConfig, setOpenAIConfig] = useState<OpenAISTTConfig>({
    model: 'whisper-1',
    language: 'en',
    temperature: 0,
    response_format: 'json',
    timestamp_granularities: ['segment']
  })

  const [deepgramConfig, setDeepgramConfig] = useState<DeepgramConfig>({
    model: 'nova-2',
    language: 'en',
    tier: 'enhanced',
    version: 'latest',
    punctuate: true,
    profanity_filter: false,
    redact: [],
    diarize: false,
    smart_format: true,
    utterances: false,
    detect_language: false
  })

  const [sarvamConfig, setSarvamConfig] = useState<SarvamConfig>({
    model: 'saaras:v2',
    language: 'en',
    domain: 'general',
    with_timestamps: true,
    enable_formatting: true
  })

  const getCurrentConfig = () => {
    switch (activeProvider) {
      case 'openai': return openaiConfig
      case 'deepgram': return deepgramConfig
      case 'sarvam': return sarvamConfig
      default: return {}
    }
  }

  const getCurrentModel = () => {
    const config = getCurrentConfig() as any
    return config.model || ''
  }

  const handleApply = () => {
    if (onSTTSelect) {
      const config = getCurrentConfig()
      onSTTSelect(activeProvider, getCurrentModel(), config)
    }
    setIsOpen(false)
  }

  const getDisplayName = () => {
    if (!selectedProvider) return "Choose STT"
    const provider = STT_PROVIDERS[selectedProvider as keyof typeof STT_PROVIDERS]
    return provider?.name || "STT Selected"
  }

  const renderProviderSettings = () => {
    const provider = STT_PROVIDERS[activeProvider as keyof typeof STT_PROVIDERS]
    
    if (!provider) return null

    return (
      <div className="space-y-6">
        {/* Model Selection */}
        <div className="space-y-2">
          <Label>Model</Label>
          <Select 
            value={getCurrentModel()} 
            onValueChange={(value) => {
              if (activeProvider === 'openai') {
                setOpenAIConfig(prev => ({ ...prev, model: value }))
              } else if (activeProvider === 'deepgram') {
                setDeepgramConfig(prev => ({ ...prev, model: value }))
              } else if (activeProvider === 'sarvam') {
                setSarvamConfig(prev => ({ ...prev, model: value }))
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {provider.models.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div>
                    <div className="font-medium">{model.name}</div>
                    <div className="text-xs text-gray-500">{model.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Language Selection */}
        <div className="space-y-2">
          <Label>Language</Label>
          <Select 
            value={(getCurrentConfig() as any).language} 
            onValueChange={(value) => {
              if (activeProvider === 'openai') {
                setOpenAIConfig(prev => ({ ...prev, language: value }))
              } else if (activeProvider === 'deepgram') {
                setDeepgramConfig(prev => ({ ...prev, language: value }))
              } else if (activeProvider === 'sarvam') {
                setSarvamConfig(prev => ({ ...prev, language: value }))
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {provider.languages.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Provider-specific settings */}
        {activeProvider === 'openai' && (
          <div className="space-y-4">
            <div className="space-y-3">
              <Label>Temperature: {openaiConfig.temperature}</Label>
              <Slider
                value={[openaiConfig.temperature]}
                onValueChange={([value]) => setOpenAIConfig(prev => ({ ...prev, temperature: value }))}
                min={0}
                max={1}
                step={0.1}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Response Format</Label>
              <Select 
                value={openaiConfig.response_format}
                onValueChange={(value) => setOpenAIConfig(prev => ({ ...prev, response_format: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="srt">SRT</SelectItem>
                  <SelectItem value="verbose_json">Verbose JSON</SelectItem>
                  <SelectItem value="vtt">VTT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {activeProvider === 'deepgram' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Smart Formatting</Label>
              <Switch
                checked={deepgramConfig.smart_format}
                onCheckedChange={(checked) => setDeepgramConfig(prev => ({ ...prev, smart_format: checked }))}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label>Punctuation</Label>
              <Switch
                checked={deepgramConfig.punctuate}
                onCheckedChange={(checked) => setDeepgramConfig(prev => ({ ...prev, punctuate: checked }))}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label>Speaker Diarization</Label>
              <Switch
                checked={deepgramConfig.diarize}
                onCheckedChange={(checked) => setDeepgramConfig(prev => ({ ...prev, diarize: checked }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Tier</Label>
              <Select 
                value={deepgramConfig.tier}
                onValueChange={(value) => setDeepgramConfig(prev => ({ ...prev, tier: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nova">Nova</SelectItem>
                  <SelectItem value="enhanced">Enhanced</SelectItem>
                  <SelectItem value="base">Base</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {activeProvider === 'sarvam' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Domain</Label>
              <Select 
                value={sarvamConfig.domain}
                onValueChange={(value) => setSarvamConfig(prev => ({ ...prev, domain: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between">
              <Label>Include Timestamps</Label>
              <Switch
                checked={sarvamConfig.with_timestamps}
                onCheckedChange={(checked) => setSarvamConfig(prev => ({ ...prev, with_timestamps: checked }))}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label>Enable Formatting</Label>
              <Switch
                checked={sarvamConfig.enable_formatting}
                onCheckedChange={(checked) => setSarvamConfig(prev => ({ ...prev, enable_formatting: checked }))}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start text-xs font-normal">
          <Mic className="w-3.5 h-3.5 mr-2" />
          {getDisplayName()}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="min-w-6xl h-5xl p-0 gap-0 bg-white dark:bg-gray-900">
        <DialogHeader className="p-6 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Mic className="w-5 h-5 text-blue-500" />
                Configure STT Provider & Settings
              </DialogTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Choose speech-to-text provider and configure recognition settings
              </p>
            </div>
            
            {activeProvider && (
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSettings(!showSettings)}
                  className={showSettings ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-700' : ''}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>
        
        <div className="flex-1 flex overflow-hidden">
          {/* Provider Selection */}
          <div className={`${showSettings ? 'w-1/2' : 'w-full'} transition-all duration-300 ${showSettings ? 'border-r border-gray-200 dark:border-gray-800' : ''} p-6 overflow-y-auto`}>
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Choose STT Provider
              </h3>
              
              {Object.entries(STT_PROVIDERS).map(([key, provider]) => (
                <ProviderCard
                  key={key}
                  provider={provider}
                  providerKey={key}
                  isSelected={activeProvider === key}
                  onSelect={() => setActiveProvider(key)}
                />
              ))}
            </div>
          </div>
          
          {/* Settings Panel */}
          {showSettings && activeProvider && (
            <div className="w-1/2 flex flex-col">
              <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {STT_PROVIDERS[activeProvider as keyof typeof STT_PROVIDERS]?.name} Settings
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Configure speech recognition parameters
                </p>
              </div>
              
              <div className="flex-1 p-6 overflow-y-auto">
                {renderProviderSettings()}
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center flex-shrink-0">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {activeProvider && (
              <span>
                {STT_PROVIDERS[activeProvider as keyof typeof STT_PROVIDERS]?.name} selected
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleApply} 
              disabled={!activeProvider}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Apply Settings
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default SelectSTT