import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Mic, Settings, CheckCircle, ArrowLeft } from 'lucide-react'

// Types
// Language and Model interfaces
interface Language {
  code: string;
  name: string;
}

interface Model {
  id: string;
  name: string;
  description?: string;
}

// Provider type interfaces
interface BaseProvider {
  name: string;
  models: Model[];
}

interface StandardProvider extends BaseProvider {
  languages: Language[];
}

interface DeepgramProvider extends BaseProvider {
  languagesByModel: {
    [modelId: string]: Language[];
  };
}

interface STTProviders {
  openai: StandardProvider;
  deepgram: DeepgramProvider;
  sarvam: StandardProvider;
}

// Config interfaces
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
  mode: string;
  domain: string;
  with_timestamps: boolean;
  enable_formatting: boolean;
}

interface SelectSTTProps {
  selectedProvider?: string;
  selectedModel?: string;
  selectedLanguage?: string;
  initialConfig?: any;
  onSTTSelect?: (provider: string, model: string, config: any) => void;
}

// STT Provider Data
const STT_PROVIDERS: STTProviders = {
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
      { code: 'zh', name: 'Chinese' },
      {code:'sw' ,name:'Swahili'}
    ]
  },
  deepgram: {
    name: 'Deepgram',
    models: [
      { id: 'nova-2', name: 'Nova 2' },
      { id: 'nova-3', name: 'Nova 3' },
    ],
    languagesByModel: {
      'nova-2': [
        { code: 'multi', name: 'Multilingual (Spanish + English)' },
        { code: 'bg', name: 'Bulgarian' },
        { code: 'ca', name: 'Catalan' },
        { code: 'zh', name: 'Chinese (Mandarin, Simplified)' },
        { code: 'zh-CN', name: 'Chinese (Mandarin, Simplified - CN)' },
        { code: 'zh-Hans', name: 'Chinese (Simplified - Hans)' },
        { code: 'zh-TW', name: 'Chinese (Mandarin, Traditional - TW)' },
        { code: 'zh-Hant', name: 'Chinese (Traditional - Hant)' },
        { code: 'zh-HK', name: 'Chinese (Cantonese, Traditional)' },
        { code: 'cs', name: 'Czech' },
        { code: 'da', name: 'Danish' },
        { code: 'da-DK', name: 'Danish (DK)' },
        { code: 'nl', name: 'Dutch' },
        { code: 'nl-BE', name: 'Flemish' },
        { code: 'en', name: 'English' },
        { code: 'en-US', name: 'English (US)' },
        { code: 'en-AU', name: 'English (AU)' },
        { code: 'en-GB', name: 'English (GB)' },
        { code: 'en-NZ', name: 'English (NZ)' },
        { code: 'en-IN', name: 'English (IN)' },
        { code: 'et', name: 'Estonian' },
        { code: 'fi', name: 'Finnish' },
        { code: 'fr', name: 'French' },
        { code: 'fr-CA', name: 'French (CA)' },
        { code: 'de', name: 'German' },
        { code: 'de-CH', name: 'German (Switzerland)' },
        { code: 'el', name: 'Greek' },
        { code: 'hi', name: 'Hindi' },
        { code: 'hu', name: 'Hungarian' },
        { code: 'id', name: 'Indonesian' },
        { code: 'it', name: 'Italian' },
        { code: 'ja', name: 'Japanese' },
        { code: 'ko', name: 'Korean' },
        { code: 'ko-KR', name: 'Korean (KR)' },
        { code: 'lv', name: 'Latvian' },
        { code: 'lt', name: 'Lithuanian' },
        { code: 'ms', name: 'Malay' },
        { code: 'no', name: 'Norwegian' },
        { code: 'pl', name: 'Polish' },
        { code: 'pt', name: 'Portuguese' },
        { code: 'pt-BR', name: 'Portuguese (BR)' },
        { code: 'pt-PT', name: 'Portuguese (PT)' },
        { code: 'ro', name: 'Romanian' },
        { code: 'ru', name: 'Russian' },
        { code: 'sk', name: 'Slovak' },
        { code: 'es', name: 'Spanish' },
        { code: 'es-419', name: 'Spanish (Latin America)' },
        { code: 'sv', name: 'Swedish' },
        { code: 'sv-SE', name: 'Swedish (SE)' },
        { code: 'th', name: 'Thai' },
        { code: 'th-TH', name: 'Thai (TH)' },
        { code: 'tr', name: 'Turkish' },
        { code: 'uk', name: 'Ukrainian' },
        { code: 'vi', name: 'Vietnamese' }
      ],
      'nova-3': [
        { code: 'multi', name: 'Multilingual' },
        { code: 'en', name: 'English' },
        { code: 'en-US', name: 'English (US)' },
        { code: 'en-AU', name: 'English (AU)' },
        { code: 'en-GB', name: 'English (GB)' },
        { code: 'en-IN', name: 'English (IN)' },
        { code: 'en-NZ', name: 'English (NZ)' },
        { code: 'de', name: 'German' },
        { code: 'nl', name: 'Dutch' },
        { code: 'sv', name: 'Swedish' },
        { code: 'sv-SE', name: 'Swedish (SE)' },
        { code: 'da', name: 'Danish' },
        { code: 'da-DK', name: 'Danish (DK)' },
        { code: 'es', name: 'Spanish' },
        { code: 'es-419', name: 'Spanish (Latin America)' },
        { code: 'fr', name: 'French' },
        { code: 'fr-CA', name: 'French (CA)' },
        { code: 'pt', name: 'Portuguese' },
        { code: 'pt-BR', name: 'Portuguese (BR)' },
        { code: 'pt-PT', name: 'Portuguese (PT)' },
        { code: 'it', name: 'Italian' },
        { code: 'tr', name: 'Turkish' },
        { code: 'no', name: 'Norwegian' },
        { code: 'id', name: 'Indonesian' }
      ]
    }
  },
  sarvam: {
    name: 'Sarvam AI',
    models: [
      { id: 'saarika:v2.5', name: 'Saarika v2.5', description: 'Same-language transcription with code-mixing support' },
      { id: 'saaras:v2.5', name: 'Saaras v2.5', description: 'Speech→English translation (auto-detects input language)' },
      { id: 'saaras:v3', name: 'Saaras v3', description: 'Latest model — supports transcribe, translate, verbatim, translit, codemix' }
    ],
    languages: [
      { code: 'unknown', name: '🌐 Auto-detect (Saaras only)' },
      { code: 'hi-IN', name: 'Hindi' },
      { code: 'en-IN', name: 'English' },
      { code: 'bn-IN', name: 'Bengali' },
      { code: 'gu-IN', name: 'Gujarati' },
      { code: 'kn-IN', name: 'Kannada' },
      { code: 'ml-IN', name: 'Malayalam' },
      { code: 'mr-IN', name: 'Marathi' },
      { code: 'or-IN', name: 'Odia' },
      { code: 'pa-IN', name: 'Punjabi' },
      { code: 'ta-IN', name: 'Tamil' },
      { code: 'te-IN', name: 'Telugu' },
    ]
  }
}

// Provider Card Component
const ProviderCard = ({ 
  provider, 
  providerKey, 
  isSelected, 
  onSelect,
  disabled = false
}: { 
  provider: any, 
  providerKey: string, 
  isSelected: boolean, 
  onSelect: () => void,
  disabled?: boolean
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

  const getLanguageCount = () => {
    if ('languagesByModel' in provider) {
      const allLanguages = new Set<string>()
      Object.values(provider.languagesByModel).forEach((langs: any) => {
        langs.forEach((lang: any) => allLanguages.add(lang.code))
      })
      return allLanguages.size
    }
    return provider.languages?.length || 0
  }

  return (
    <div
      onClick={disabled ? undefined : onSelect}
      className={`${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} p-3 sm:p-4 rounded-lg border transition-all hover:shadow-sm ${
        isSelected 
          ? getBorderColor()
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getProviderColor()} flex items-center justify-center ${disabled ? 'opacity-50' : ''}`}>
          <Mic className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100">
              {provider.name}
            </h3>
            {isSelected && <CheckCircle className="w-4 h-4 text-green-600" />}
          </div>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {provider.models.length} models • {getLanguageCount()} languages
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
  selectedLanguage = 'en',
  initialConfig = {},
  onSTTSelect 
}) => {
  const DISABLE_SETTINGS = false
  const [isOpen, setIsOpen] = useState(false)
  const [activeProvider, setActiveProvider] = useState(selectedProvider || 'openai')
  const [showSettings, setShowSettings] = useState(!!selectedProvider)
  const [showCustomModel, setShowCustomModel] = useState(false)
  const [showCustomLanguage, setShowCustomLanguage] = useState(false)

  const [openaiConfig, setOpenAIConfig] = useState<OpenAISTTConfig>({
    model: selectedProvider === 'openai' ? selectedModel : 'whisper-1',
    language: selectedProvider === 'openai' ? selectedLanguage : 'en',
    temperature: initialConfig?.temperature || 0,
    response_format: initialConfig?.response_format || 'json',
    timestamp_granularities: initialConfig?.timestamp_granularities || ['segment']
  })

  const [deepgramConfig, setDeepgramConfig] = useState<DeepgramConfig>({
    model: selectedProvider === 'deepgram' ? selectedModel : 'nova-2',
    language: selectedProvider === 'deepgram' ? selectedLanguage : 'en',
    tier: initialConfig?.tier || 'enhanced',
    version: initialConfig?.version || 'latest',
    punctuate: initialConfig?.punctuate ?? true,
    profanity_filter: initialConfig?.profanity_filter ?? false,
    redact: initialConfig?.redact || [],
    diarize: initialConfig?.diarize ?? false,
    smart_format: initialConfig?.smart_format ?? true,
    utterances: initialConfig?.utterances ?? false,
    detect_language: initialConfig?.detect_language ?? false
  })

  const [sarvamConfig, setSarvamConfig] = useState<SarvamConfig>({
    model: selectedProvider === 'sarvam' ? selectedModel : 'saarika:v2.5',
    language: selectedProvider === 'sarvam' ? selectedLanguage : 'hi-IN',
    mode: initialConfig?.mode || 'transcribe',
    domain: initialConfig?.domain || 'general',
    with_timestamps: initialConfig?.with_timestamps ?? true,
    enable_formatting: initialConfig?.enable_formatting ?? true
  })

  useEffect(() => {
    setShowSettings(!!selectedProvider)
  }, [selectedProvider])

  useEffect(() => {
    if (selectedProvider) {
      setActiveProvider(selectedProvider)
      
      if (selectedProvider === 'openai') {
        setOpenAIConfig(prev => ({
          ...prev,
          model: selectedModel || prev.model,
          language: selectedLanguage || prev.language,
          ...initialConfig
        }))
      } else if (selectedProvider === 'deepgram') {
        setDeepgramConfig(prev => ({
          ...prev,
          model: selectedModel || prev.model,
          language: selectedLanguage || prev.language,
          ...initialConfig
        }))
        } else if (selectedProvider === 'sarvam') {
          setSarvamConfig(prev => ({
            ...prev,
            model: selectedModel || prev.model,
            language: selectedLanguage || prev.language,
            mode: initialConfig?.mode || prev.mode || 'transcribe',
            ...initialConfig
          }))
        }
    }
  }, [selectedProvider, selectedModel, selectedLanguage, initialConfig])

  useEffect(() => {
    const provider = STT_PROVIDERS[activeProvider as keyof STTProviders]
    if (provider) {
      const config = getCurrentConfig() as any
      setShowCustomModel(!provider.models.some(m => m.id === config.model) && config.model !== '')
      
      if ('languagesByModel' in provider) {
        const availableLangs = provider.languagesByModel[config.model] || []
        setShowCustomLanguage(!availableLangs.some(l => l.code === config.language) && config.language !== '')
      } else if ('languages' in provider) {
        setShowCustomLanguage(!provider.languages.some(l => l.code === config.language) && config.language !== '')
      }
    }
  }, [activeProvider])

  const getCurrentConfig = () => {
    switch (activeProvider) {
      case 'openai': return openaiConfig
      case 'deepgram': return deepgramConfig
      case 'sarvam': return sarvamConfig
      default: return {}
    }
  }

  const getCurrentModel = () => {
    const config = getCurrentConfig() as OpenAISTTConfig | DeepgramConfig | SarvamConfig
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

    const currentModel = getCurrentModel()
    const currentLanguage = (getCurrentConfig() as any).language

    const getAvailableLanguages = (): Language[] => {
      const currentProvider = STT_PROVIDERS[activeProvider as keyof STTProviders]
      
      if (activeProvider === 'deepgram' && 'languagesByModel' in currentProvider) {
        return currentProvider.languagesByModel[currentModel] || currentProvider.languagesByModel['nova-2'] || []
      }
      
      if ('languages' in currentProvider) {
        return currentProvider.languages
      }
      
      return []
    }

    const availableLanguages = getAvailableLanguages()

    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="space-y-2">
          <Label className="text-sm sm:text-base">Model</Label>
          <div className="space-y-2">
            <Select 
              value={showCustomModel ? 'custom' : currentModel} 
              onValueChange={(value) => {
                if (DISABLE_SETTINGS) return
                if (value === 'custom') {
                  setShowCustomModel(true)
                } else {
                  setShowCustomModel(false)
                  if (activeProvider === 'openai') {
                    setOpenAIConfig(prev => ({ ...prev, model: value }))
                  } else if (activeProvider === 'deepgram') {
                    setDeepgramConfig(prev => ({ ...prev, model: value, language: 'en' }))
                  } else if (activeProvider === 'sarvam') {
                    setSarvamConfig(prev => ({ 
                      ...prev, 
                      model: value,
                      language: value === 'saaras:v2.5' ? 'unknown' : prev.language,
                      mode: 'transcribe' // reset to default when switching models
                    }))
                  }
                }
              }}
              disabled={DISABLE_SETTINGS}
            >
              <SelectTrigger className="h-10 sm:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {provider.models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div>
                      <div className="font-medium text-sm">{model.name}</div>
                      {model.description && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{model.description}</div>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Language selector - Hide for Saaras (auto-detects language) */}
        {!(activeProvider === 'sarvam' && currentModel === 'saaras:v2.5') && (
          <div className="space-y-2">
            <Label className="text-sm sm:text-base">Language</Label>
            <div className="space-y-2">
              <Select 
                value={showCustomLanguage ? 'custom' : currentLanguage} 
                onValueChange={(value) => {
                  if (DISABLE_SETTINGS) return
                  if (value === 'custom') {
                    setShowCustomLanguage(true)
                  } else {
                    setShowCustomLanguage(false)
                    if (activeProvider === 'openai') {
                      setOpenAIConfig(prev => ({ ...prev, language: value }))
                    } else if (activeProvider === 'deepgram') {
                      setDeepgramConfig(prev => ({ ...prev, language: value }))
                    } else if (activeProvider === 'sarvam') {
                      setSarvamConfig(prev => ({ ...prev, language: value }))
                    }
                  }
                }}
                disabled={DISABLE_SETTINGS}
              >
                <SelectTrigger className="h-10 sm:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableLanguages.map((lang: any) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {activeProvider === 'sarvam' && currentModel === 'saaras:v3' && (
          <div className="space-y-2">
            <Label className="text-sm sm:text-base">Mode</Label>
            <Select
              value={sarvamConfig.mode || 'transcribe'}
              onValueChange={(value) => setSarvamConfig(prev => ({ ...prev, mode: value }))}
              disabled={DISABLE_SETTINGS}
            >
              <SelectTrigger className="h-10 sm:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transcribe">
                  <div>
                    <div className="font-medium text-sm">Transcribe</div>
                    <div className="text-xs text-gray-500 mt-0.5">Standard transcription in original language</div>
                  </div>
                </SelectItem>
                <SelectItem value="translate">
                  <div>
                    <div className="font-medium text-sm">Translate</div>
                    <div className="text-xs text-gray-500 mt-0.5">Translate speech from any Indian language to English</div>
                  </div>
                </SelectItem>
                <SelectItem value="verbatim">
                  <div>
                    <div className="font-medium text-sm">Verbatim</div>
                    <div className="text-xs text-gray-500 mt-0.5">Word-for-word, preserving filler words and spoken numbers</div>
                  </div>
                </SelectItem>
                <SelectItem value="translit">
                  <div>
                    <div className="font-medium text-sm">Transliterate</div>
                    <div className="text-xs text-gray-500 mt-0.5">Romanization — speech to Latin/Roman script</div>
                  </div>
                </SelectItem>
                <SelectItem value="codemix">
                  <div>
                    <div className="font-medium text-sm">Codemix</div>
                    <div className="text-xs text-gray-500 mt-0.5">English words in English, Indic words in native script</div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Show auto-detect message for Saaras */}
        {activeProvider === 'sarvam' && currentModel === 'saaras:v2.5' && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
              <span className="text-lg">🌐</span>
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Auto-detects Language</p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Saaras automatically detects the input language and translates speech to English. No language configuration needed.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start text-xs font-normal h-8 sm:h-9">
          <Mic className="w-3.5 h-3.5 mr-2" />
          <span className="truncate">{getDisplayName()}</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="w-[calc(100vw-1rem)] sm:min-w-6xl h-[92vh] sm:h-5xl p-0 gap-0 bg-white dark:bg-gray-900 mx-2 sm:mx-auto">
        <DialogHeader className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                {showSettings && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSettings(false)}
                    className="p-1 h-6 w-6 sm:hidden"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                <span className="text-sm sm:text-base">
                  {showSettings ? `${STT_PROVIDERS[activeProvider as keyof typeof STT_PROVIDERS]?.name} Settings` : 'Configure STT Provider'}
                </span>
              </DialogTitle>
              {!showSettings && (
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Choose speech-to-text provider and configure recognition settings
                </p>
              )}
            </div>
            
            {activeProvider && !showSettings && (
              <div className="flex items-center gap-3">
                <Button
                  disabled={DISABLE_SETTINGS}
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSettings(true)}
                  className="h-8 sm:h-9 text-xs sm:text-sm"
                >
                  <Settings className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Settings
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>
        
        <div className="flex-1 flex overflow-hidden">
          <div className={`${showSettings ? 'hidden sm:block sm:w-1/2' : 'w-full'} transition-all duration-300 ${showSettings ? 'border-r border-gray-200 dark:border-gray-800' : ''} p-4 sm:p-6 overflow-y-auto`}>
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100">
                Choose STT Provider
              </h3>
              
              {Object.entries(STT_PROVIDERS).map(([key, provider]) => (
                <ProviderCard
                  key={key}
                  provider={provider}
                  providerKey={key}
                  isSelected={activeProvider === key}
                  onSelect={() => setActiveProvider(key)}
                  disabled={DISABLE_SETTINGS}
                />
              ))}
            </div>
          </div>
          
          {showSettings && activeProvider && (
            <div className="w-full sm:w-1/2 flex flex-col">
              <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800 flex-shrink-0 hidden sm:block">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {STT_PROVIDERS[activeProvider as keyof typeof STT_PROVIDERS]?.name} Settings
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Configure speech recognition parameters
                </p>
              </div>
              
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
                {renderProviderSettings()}
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0 flex-shrink-0">
          <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center sm:text-left">
            {activeProvider && (
              <span>
                {STT_PROVIDERS[activeProvider as keyof typeof STT_PROVIDERS]?.name} selected
              </span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              className="h-10 sm:h-9 text-sm"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleApply} 
              disabled={!activeProvider || DISABLE_SETTINGS}
              className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed h-10 sm:h-9 text-sm"
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