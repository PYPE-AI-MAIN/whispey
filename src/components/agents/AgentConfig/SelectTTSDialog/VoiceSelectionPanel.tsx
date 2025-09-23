import React, { useState, useEffect, useRef } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Search,
  Loader2,
  AlertCircle,
  Plus,
  CheckCircle,
  ExternalLink,
  Mic,
  Copy,
  Check
} from 'lucide-react'

interface SarvamVoice {
  id: string;
  name: string;
  language: string;
  gender: 'Male' | 'Female';
  style: string;
  accent: string;
  description: string;
}

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
}

// Updated to match API format
interface SarvamConfig {
  target_language_code: string;  // Changed from targetLanguage
  model: string;
  speaker: string;
  loudness: number;
  speed: number;
  enable_preprocessing: boolean;  // Changed from enablePreprocessing
}

interface VoiceSelectionPanelProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  showSettings: boolean;
  selectedVoiceId: string;
  selectedProvider: string;
  onVoiceSelect: (voiceId: string, provider: string) => void;
  sarvamConfig: SarvamConfig;
  setSarvamConfig: React.Dispatch<React.SetStateAction<SarvamConfig>>;
  elevenLabsVoices: ElevenLabsVoice[];
  setElevenLabsVoices: React.Dispatch<React.SetStateAction<ElevenLabsVoice[]>>;
  allSarvamVoices: (SarvamVoice & { compatibleModels: string[] })[];
}

const CopyButton = ({ text, className = "" }: { text: string, className?: string }) => {
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
      className={`w-7 h-7 p-0 ${className}`}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-600" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-gray-400" />
      )}
    </Button>
  )
}

const SarvamVoiceCard = ({ 
  voice, 
  isSelected, 
  onClick 
}: { 
  voice: SarvamVoice, 
  isSelected: boolean, 
  onClick: () => void 
}) => {
  return (
    <div
      onClick={onClick}
      className={`group cursor-pointer p-2 rounded-md border transition-all hover:shadow-sm ${
        isSelected 
          ? 'border-orange-300 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/10' 
          : 'border-gray-200 dark:border-gray-700 hover:border-orange-200 dark:hover:border-orange-700 hover:bg-orange-50/50 dark:hover:bg-orange-900/5'
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-medium text-xs flex-shrink-0">
          {voice.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-xs text-gray-900 dark:text-gray-100 truncate">{voice.name}</h3>
            {isSelected && <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />}
            <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">{voice.id}</code>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-300">
              {voice.style}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{voice.gender}</span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{voice.language}</span>
          </div>
        </div>
        <CopyButton text={voice.id} />
      </div>
    </div>
  )
}

const ElevenLabsVoiceCard = ({ 
  voice, 
  isSelected, 
  onClick 
}: { 
  voice: ElevenLabsVoice, 
  isSelected: boolean, 
  onClick: () => void 
}) => {
  return (
    <div
      onClick={onClick}
      className={`group cursor-pointer p-2 rounded-md border transition-all hover:shadow-sm ${
        isSelected 
          ? 'border-purple-300 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/10' 
          : 'border-gray-200 dark:border-gray-700 hover:border-purple-200 dark:hover:border-purple-700 hover:bg-purple-50/50 dark:hover:bg-purple-900/5'
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-medium text-xs flex-shrink-0">
          {voice.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-xs text-gray-900 dark:text-gray-100 truncate">{voice.name}</h3>
            {isSelected && <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />}
            <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">{voice.voice_id}</code>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-300">
              {voice.category === 'professional' ? 'Professional' : 'Personal'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Multi-language</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <CopyButton text={voice.voice_id} />
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              window.open('https://elevenlabs.io/app/voice-lab', '_blank')
            }}
            className="w-5 h-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ExternalLink className="w-3 h-3 text-gray-400" />
          </Button>
        </div>
      </div>
    </div>
  )
}

const EmptyState = ({ 
  icon: Icon, 
  title, 
  description, 
  actions 
}: { 
  icon: React.ComponentType<any>, 
  title: string, 
  description: string, 
  actions?: React.ReactNode 
}) => (
  <div className="flex items-center justify-center h-full">
    <div className="text-center space-y-4 max-w-sm">
      <Icon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto" />
      <div>
        <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
        <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">{description}</p>
      </div>
      {actions}
    </div>
  </div>
)

const VoiceSelectionPanel: React.FC<VoiceSelectionPanelProps> = ({
  activeTab,
  onTabChange,
  showSettings,
  selectedVoiceId,
  selectedProvider,
  onVoiceSelect,
  sarvamConfig,
  setSarvamConfig,
  elevenLabsVoices,
  setElevenLabsVoices,
  allSarvamVoices
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoadingElevenLabs, setIsLoadingElevenLabs] = useState(false)
  const [elevenLabsError, setElevenLabsError] = useState<string | null>(null)
  const [elevenLabsFetched, setElevenLabsFetched] = useState(false)
  const sarvamListRef = useRef<HTMLDivElement>(null)
  const elevenLabsListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedVoiceId && selectedProvider) {
      const scrollToSelected = () => {
        if ((selectedProvider === 'sarvam' && activeTab !== 'sarvam') || 
            (selectedProvider === 'elevenlabs' && activeTab !== 'elevenlabs')) {
          console.log('Wrong tab active, skipping scroll')
          return
        }
        
        const listRef = selectedProvider === 'sarvam' ? sarvamListRef : elevenLabsListRef
        console.log('Scroll Debug:', {
          selectedVoiceId,
          selectedProvider,
          activeTab,
          listRef: listRef.current,
          selector: `[data-voice-id="${selectedVoiceId}"]`
        })
        
        if (listRef.current) {
          const selectedCard = listRef.current.querySelector(`[data-voice-id="${selectedVoiceId}"]`)
          console.log('Found element:', selectedCard)
          
          if (selectedCard) {
            selectedCard.scrollIntoView({ behavior: 'smooth', block: 'center' })
            console.log('Scrolled to element')
          } else {
            console.log('Element not found with selector:', `[data-voice-id="${selectedVoiceId}"]`)
          }
        } else {
          console.log('List ref not found, retrying...')
          setTimeout(scrollToSelected, 200)
        }
      }
      
      setTimeout(scrollToSelected, 300)
    }
  }, [selectedVoiceId, selectedProvider, activeTab])

  useEffect(() => {
    if (!elevenLabsFetched) {
      fetchElevenLabsVoices()
    }
  }, [elevenLabsFetched])

  const fetchElevenLabsVoices = async () => {
    setIsLoadingElevenLabs(true)
    setElevenLabsError(null)
    try {
      const response = await fetch('/api/elevenlabs-voices')
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch voices')
      }
      const data = await response.json()
      setElevenLabsVoices(data.voices || [])
      setElevenLabsFetched(true)
    } catch (error) {
      setElevenLabsError(error instanceof Error ? error.message : 'Failed to load voices')
    } finally {
      setIsLoadingElevenLabs(false)
    }
  }

  const getCompatibleSarvamVoices = (model: string): SarvamVoice[] => {
    return allSarvamVoices
      .filter(voice => voice.compatibleModels.includes(model))
      .map(({ compatibleModels, ...voice }) => voice)
  }

  const handleModelChange = (newModel: string) => {
    setSarvamConfig(prev => ({ ...prev, model: newModel }))
    
    if (selectedProvider === 'sarvam' && selectedVoiceId) {
      const compatibleVoices = getCompatibleSarvamVoices(newModel)
      const isCurrentVoiceCompatible = compatibleVoices.some(v => v.id === selectedVoiceId)
      if (!isCurrentVoiceCompatible) {
        onVoiceSelect('', '')
      }
    }
  }

  const sarvamVoices = getCompatibleSarvamVoices(sarvamConfig.model)
  const filteredSarvam = sarvamVoices.filter(v => 
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.language.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.style.toLowerCase().includes(searchTerm.toLowerCase())
  )
  const filteredElevenLabs = elevenLabsVoices.filter(v => 
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.description && v.description.toLowerCase().includes(searchTerm.toLowerCase())) || 
    v.voice_id.toLowerCase().includes(searchTerm.toLowerCase()) 
  )

  return (
    <div className={`${showSettings ? 'w-1/2' : 'w-full'} transition-all duration-300 ${showSettings ? 'border-r border-gray-200 dark:border-gray-800' : ''} flex flex-col`}>
      <Tabs value={activeTab} onValueChange={onTabChange} className="flex flex-col flex-1 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <TabsList className="grid w-full grid-cols-2 h-10">
            <TabsTrigger value="sarvam" className="text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gradient-to-r from-orange-400 to-red-500 rounded-full"></div>
                Sarvam AI
                <Badge variant="secondary" className="text-xs">{getCompatibleSarvamVoices(sarvamConfig.model).length}</Badge>
              </div>
            </TabsTrigger>
            <TabsTrigger value="elevenlabs" className="text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gradient-to-r from-purple-400 to-purple-600 rounded-full"></div>
                ElevenLabs
                <Badge variant="secondary" className="text-xs">{elevenLabsVoices.length}</Badge>
              </div>
            </TabsTrigger>
          </TabsList>
        </div>
        
        <div className="flex-1 min-h-0 overflow-hidden">
          <TabsContent value="sarvam" className="h-full p-6 mt-0 flex flex-col overflow-hidden">            
            <div className="flex gap-3 mb-6 flex-shrink-0">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input 
                  placeholder="Search voices..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="pl-10 h-10" 
                />
              </div>
              <div className="flex flex-col gap-1 w-36">
                <Input
                  value={sarvamConfig.model}
                  onChange={(e) => handleModelChange(e.target.value)}
                  placeholder="bulbul:v2"
                  className="h-10 text-sm"
                />
              </div>
            </div>

            <div ref={sarvamListRef} className="flex-1 min-h-0 overflow-y-auto space-y-3">
              {filteredSarvam.map((voice) => {
                const isSelected = selectedVoiceId === voice.id && (selectedProvider === 'sarvam' || selectedProvider === 'sarvam_tts')            
                return (
                  <div key={voice.id} data-voice-id={voice.id}>
                    <SarvamVoiceCard
                      voice={voice}
                      isSelected={isSelected}
                      onClick={() => {
                        onVoiceSelect(voice.id, 'sarvam')
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </TabsContent>
          
          <TabsContent value="elevenlabs" className="h-full p-6 mt-0 flex flex-col overflow-hidden">
            <div className="flex gap-3 mb-6 flex-shrink-0">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input 
                  placeholder="Search or enter voice ID..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="pl-10 h-10" 
                />
              </div>
              <Button 
                variant="outline" 
                onClick={() => {
                  setElevenLabsFetched(false)
                  fetchElevenLabsVoices()
                }} 
                disabled={isLoadingElevenLabs} 
                className="h-10 px-4"
              >
                {isLoadingElevenLabs && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Refresh
              </Button>
            </div>

            <div className="flex-1 min-h-0">
              {isLoadingElevenLabs ? (
                <EmptyState
                  icon={Loader2}
                  title="Loading voices..."
                  description="Fetching your personal voices from ElevenLabs."
                />
              ) : elevenLabsError ? (
                <EmptyState
                  icon={AlertCircle}
                  title="Failed to load voices"
                  description={elevenLabsError}
                  actions={
                    <Button variant="outline" onClick={() => {
                      setElevenLabsFetched(false)
                      fetchElevenLabsVoices()
                    }}>
                      Try Again
                    </Button>
                  }
                />
              ) : filteredElevenLabs.length === 0 ? (
                <EmptyState
                  icon={Mic}
                  title="No personal voices found"
                  description="Create or clone voices in ElevenLabs, or enter a voice ID manually."
                  actions={
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href="https://elevenlabs.io/voice-lab" target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Voice Lab
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <a href="https://elevenlabs.io/voice-cloning" target="_blank" rel="noopener noreferrer">
                          <Plus className="w-4 h-4 mr-2" />
                          Clone Voice
                        </a>
                      </Button>
                    </div>
                  }
                />
              ) : (
                <div ref={elevenLabsListRef} className="h-full overflow-y-auto space-y-3">
                  {filteredElevenLabs.map((voice) => {
                    const isSelected = selectedVoiceId === voice.voice_id && selectedProvider === 'elevenlabs'
                    return (
                      <div key={voice.voice_id} data-voice-id={voice.voice_id}>
                        <ElevenLabsVoiceCard
                          voice={voice}
                          isSelected={isSelected}
                          onClick={() => {
                            onVoiceSelect(voice.voice_id, 'elevenlabs')
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

export default VoiceSelectionPanel