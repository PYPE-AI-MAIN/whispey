import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Volume2, Sparkles, Settings, RotateCcw } from 'lucide-react'

import VoiceSelectionPanel from './VoiceSelectionPanel'
import SettingsPanel from './SettingsPanel'
import HeaderVoiceDisplay from './HeaderVoiceDisplay'

// Types
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
  labels?: Record<string, string>;
  settings?: {
    stability: number;
    similarity_boost: number;
    style?: number;
  };
}

interface SarvamConfig {
  target_language_code: string;  // was: targetLanguage
  model: string;
  speaker: string;
  loudness: number;
  speed: number;
  enable_preprocessing: boolean;  // was: enablePreprocessing
}

interface ElevenLabsConfig {
  voiceId: string;
  language: string;
  model: string;
  similarityBoost: number;
  stability: number;
  style: number;
  useSpeakerBoost: boolean;
  speed: number;
}

interface SelectTTSProps {
  selectedVoice: string;
  initialProvider?: string;
  initialModel?: string;
  initialConfig?: any;
  onVoiceSelect?: (voiceId: string, provider: string, model?: string, config?: any) => void;
}

// Voice data
const allSarvamVoices: (SarvamVoice & { compatibleModels: string[] })[] = [
  { id: 'meera', name: 'Meera', language: 'Hindi', gender: 'Female', style: 'Natural', accent: 'Indian', description: 'Warm Hindi voice for storytelling', compatibleModels: ['bulbul:v1'] },
  { id: 'anushka', name: 'Anushka', language: 'Multi-lingual', gender: 'Female', style: 'Professional', accent: 'Indian', description: 'Professional business voice', compatibleModels: ['bulbul:v2'] },
  { id: 'vidya', name: 'Vidya', language: 'Multi-lingual', gender: 'Female', style: 'Conversational', accent: 'Indian', description: 'Natural conversational tone', compatibleModels: ['bulbul:v2'] },
  { id: 'manisha', name: 'Manisha', language: 'Multi-lingual', gender: 'Female', style: 'Narrative', accent: 'Indian', description: 'Perfect for narration', compatibleModels: ['bulbul:v2'] },
  { id: 'arya', name: 'Arya', language: 'Multi-lingual', gender: 'Female', style: 'Youthful', accent: 'Indian', description: 'Energetic youthful voice', compatibleModels: ['bulbul:v2'] },
  { id: 'abhilash', name: 'Abhilash', language: 'Multi-lingual', gender: 'Male', style: 'Deep', accent: 'Indian', description: 'Deep authoritative voice', compatibleModels: ['bulbul:v2'] },
  { id: 'karun', name: 'Karun', language: 'Multi-lingual', gender: 'Male', style: 'Professional', accent: 'Indian', description: 'Clear professional male voice', compatibleModels: ['bulbul:v2'] },
  { id: 'hitesh', name: 'Hitesh', language: 'Multi-lingual', gender: 'Male', style: 'Conversational', accent: 'Indian', description: 'Natural conversational male voice', compatibleModels: ['bulbul:v2'] },
]

// Main Component
function SelectTTS({ selectedVoice, initialProvider, initialModel, initialConfig, onVoiceSelect }: SelectTTSProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>([])
  const [isLoadingElevenLabs, setIsLoadingElevenLabs] = useState(false)
  const [elevenLabsError, setElevenLabsError] = useState<string | null>(null)
  const [elevenLabsFetched, setElevenLabsFetched] = useState(false)
  
  // Single source of truth for current selection (internal state)
  const [currentVoiceId, setCurrentVoiceId] = useState(selectedVoice || '')
  const [currentProvider, setCurrentProvider] = useState(() => {
    const normalized = initialProvider === 'sarvam_tts' ? 'sarvam' : initialProvider
    return normalized || ''
  })
  
  // Determine active tab based on current provider
  const [activeTab, setActiveTab] = useState(() => {
    if (currentProvider === 'sarvam' || currentProvider === 'sarvam_tts') return 'sarvam'
    if (currentProvider === 'elevenlabs') return 'elevenlabs'
    return 'sarvam' // Default
  })
  
  // Initialize Sarvam configuration with defaults
  const [sarvamConfig, setSarvamConfig] = useState<SarvamConfig>(() => {
    if ((initialProvider === 'sarvam' || initialProvider === 'sarvam_tts') && initialConfig) {
      return {
        target_language_code: initialConfig.target_language_code || 'en-IN',
        model: initialModel || 'bulbul:v2',
        speaker: selectedVoice || '',
        loudness: initialConfig.loudness || 1.0,
        speed: initialConfig.speed || 1.0,
        enable_preprocessing: initialConfig.enable_preprocessing !== undefined ? initialConfig.enable_preprocessing : true
      }
    }
    return {
      target_language_code: 'en-IN',
      model: 'bulbul:v2',
      speaker: selectedVoice || '',
      loudness: 1.0,
      speed: 1.0,
      enable_preprocessing: true
    }
  })

  // Initialize ElevenLabs configuration with defaults
  const [elevenLabsConfig, setElevenLabsConfig] = useState<ElevenLabsConfig>(() => {
    if (currentProvider === 'elevenlabs' && initialConfig) {
      return {
        voiceId: selectedVoice || '',
        language: initialConfig.language || 'en',
        model: initialModel || 'eleven_multilingual_v2',
        similarityBoost: initialConfig.similarityBoost || 0.75,
        stability: initialConfig.stability || 0.5,
        style: initialConfig.style || 0,
        useSpeakerBoost: initialConfig.useSpeakerBoost !== undefined ? initialConfig.useSpeakerBoost : true,
        speed: initialConfig.speed || 1.0
      }
    }
    return {
      voiceId: selectedVoice || '',
      language: 'en',
      model: 'eleven_multilingual_v2',
      similarityBoost: 0.75,
      stability: 0.5,
      style: 0,
      useSpeakerBoost: true,
      speed: 1.0
    }
  })

  const [showSettings, setShowSettings] = useState(true)

  const originalValues = {
    voiceId: selectedVoice || '',
    provider: initialProvider === 'sarvam_tts' ? 'sarvam' : (initialProvider || ''),
    sarvamConfig: (initialProvider === 'sarvam' || initialProvider === 'sarvam_tts') && initialConfig ? {
      target_language_code: initialConfig.target_language_code || 'en-IN',
      model: initialModel || 'bulbul:v2',
      speaker: selectedVoice || '',
      loudness: initialConfig.loudness || 1.0,
      speed: initialConfig.speed || 1.0,
      enable_preprocessing: initialConfig.enable_preprocessing !== undefined ? initialConfig.enable_preprocessing : true
    } : {
      target_language_code: 'en-IN',
      model: 'bulbul:v2',
      speaker: selectedVoice || '',
      loudness: 1.0,
      speed: 1.0,
      enable_preprocessing: true
    },
    elevenLabsConfig: (initialProvider === 'elevenlabs' && initialConfig) ? {
      voiceId: selectedVoice || '',
      language: initialConfig.language || 'en',
      model: initialModel || 'eleven_multilingual_v2',
      similarityBoost: initialConfig.similarityBoost || 0.75,
      stability: initialConfig.stability || 0.5,
      style: initialConfig.style || 0,
      useSpeakerBoost: initialConfig.useSpeakerBoost !== undefined ? initialConfig.useSpeakerBoost : true,
      speed: initialConfig.speed || 1.0
    } : {
      voiceId: selectedVoice || '',
      language: 'en',
      model: 'eleven_multilingual_v2',
      similarityBoost: 0.75,
      stability: 0.5,
      style: 0,
      useSpeakerBoost: true,
      speed: 1.0
    }
  }


  const handleReset = () => {
    setCurrentVoiceId(originalValues.voiceId)
    setCurrentProvider(originalValues.provider)
    setSarvamConfig(originalValues.sarvamConfig)
    setElevenLabsConfig(originalValues.elevenLabsConfig)
    
    // Set correct tab based on original provider
    if (originalValues.provider === 'sarvam') {
      setActiveTab('sarvam')
    } else if (originalValues.provider === 'elevenlabs') {
      setActiveTab('elevenlabs')
    }
  }

  // Pre-load ElevenLabs voices on component mount
  useEffect(() => {
    fetchElevenLabsVoices()
  }, [])


  // Sync configs when provider gets normalized
  useEffect(() => {
    if ((currentProvider === 'sarvam' || initialProvider === 'sarvam_tts') && initialConfig) {
      setSarvamConfig({
        target_language_code: initialConfig.target_language_code ?? 'en-IN',
        model: initialModel ?? 'bulbul:v2',
        speaker: selectedVoice ?? '',
        loudness: initialConfig.loudness ?? 1.0,
        speed: initialConfig.speed ?? 1.0,
        enable_preprocessing: initialConfig.enable_preprocessing ?? true
      })
    } else if (initialProvider === 'elevenlabs' && initialConfig) {
      setElevenLabsConfig({
        voiceId: selectedVoice || initialConfig.voiceId || '',
        language: initialConfig.language ?? 'en',
        model: initialModel ?? 'eleven_multilingual_v2',
        similarityBoost: initialConfig.similarityBoost ?? 0.75,
        stability: initialConfig.stability ?? 0.5,
        style: initialConfig.style ?? 0,
        useSpeakerBoost: initialConfig.useSpeakerBoost ?? true,
        speed: initialConfig.speed ?? 1.0
      })
    }
  }, [currentProvider, initialProvider, initialConfig, initialModel, selectedVoice])

  // Update internal state when props change (this is the initial sync)
  useEffect(() => {
    if (selectedVoice !== currentVoiceId) {
      setCurrentVoiceId(selectedVoice || '')
    }
    if (initialProvider !== currentProvider) {
      const normalized = initialProvider === 'sarvam_tts' ? 'sarvam' : initialProvider
      setCurrentProvider(normalized || '')
      if (initialProvider === 'sarvam' || initialProvider === 'sarvam_tts') {
        setActiveTab('sarvam')
      } else if (initialProvider === 'elevenlabs') {
        setActiveTab('elevenlabs')
      }
    }
  }, [selectedVoice, initialProvider])

  const fetchElevenLabsVoices = async () => {
    if (elevenLabsFetched) return
    
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

  // MAIN VOICE SELECT HANDLER - this updates internal state immediately
  const handleVoiceSelect = (voiceId: string, provider: string) => {
    
    const normalizedProvider = provider === 'sarvam_tts' ? 'sarvam' : provider
    
    // Update internal state immediately
    setCurrentVoiceId(voiceId)
    setCurrentProvider(normalizedProvider)
    
    // Update appropriate config
    if (normalizedProvider === 'sarvam') {
      setSarvamConfig(prev => ({ ...prev, speaker: voiceId }))
    } else if (normalizedProvider === 'elevenlabs') {
      setElevenLabsConfig(prev => ({ ...prev, voiceId }))
    }
    
    // Switch tab if needed
    if ((normalizedProvider === 'sarvam' && activeTab !== 'sarvam') || 
        (normalizedProvider === 'elevenlabs' && activeTab !== 'elevenlabs')) {
      setActiveTab(normalizedProvider === 'sarvam' ? 'sarvam' : 'elevenlabs')
    }
    
    // Show settings panel when a voice is selected
    setShowSettings(true)
  }

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab)
    setShowSettings(false)
  }

  const handleToggleSettings = () => {
    setShowSettings(!showSettings)
  }

  const handleConfirm = () => {
    if (currentVoiceId && currentProvider && onVoiceSelect) {
      const config = currentProvider === 'sarvam' ? sarvamConfig : elevenLabsConfig
      const model = currentProvider === 'sarvam' ? sarvamConfig.model : elevenLabsConfig.model
      onVoiceSelect(currentVoiceId, currentProvider, model, config)
    }
    setIsOpen(false)
  }

  const getSelectedVoiceName = () => {
    if (selectedVoice && (!elevenLabsFetched || isLoadingElevenLabs)) {
      return (
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          <div className="w-16 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
      )
    }
    
    if (!selectedVoice) return "Choose Voice"
    
    const sarvamVoice = allSarvamVoices.find(v => v.id === selectedVoice)
    if (sarvamVoice) return sarvamVoice.name
    const elevenLabsVoice = elevenLabsVoices.find(v => v.voice_id === selectedVoice)
    if (elevenLabsVoice) return elevenLabsVoice.name
    return "Voice Selected"
  }


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="justify-start text-xs font-normal w-full">
          <Volume2 className="w-3.5 h-3.5 mr-2" />
          {getSelectedVoiceName()}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="flex flex-col justify-start min-w-7xl h-screen p-0 gap-0 bg-white dark:bg-gray-900">
        <DialogHeader className="p-6 border-b border-gray-200 dark:border-gray-800 flex-shrink-0 h-fit">
          <div className="flex items-center justify-between gap-3 pr-5">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                Configure TTS Voice & Settings
              </DialogTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400">Choose voice and configure speech synthesis settings</p>
            </div>
            
            {/* Header Voice Display - uses internal state */}
            <div className="flex items-center gap-3">
              {/* NEW: Reset Button */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleReset}
                className="h-8 px-3 text-xs flex items-center gap-1.5"
                disabled={!originalValues.voiceId && !originalValues.provider}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </Button>
              
              <HeaderVoiceDisplay 
                selectedVoiceId={currentVoiceId}
                selectedProvider={currentProvider}
                allSarvamVoices={allSarvamVoices}
                elevenLabsVoices={elevenLabsVoices}
                showSettings={true}
                onToggleSettings={() => {}}
              />
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 flex overflow-hidden">
          {/* Voice Selection Panel - uses internal state */}
          <VoiceSelectionPanel
            activeTab={activeTab}
            onTabChange={handleTabChange}
            showSettings={showSettings}
            selectedVoiceId={currentVoiceId}
            selectedProvider={currentProvider}
            onVoiceSelect={handleVoiceSelect}
            sarvamConfig={sarvamConfig}
            setSarvamConfig={setSarvamConfig}
            elevenLabsVoices={elevenLabsVoices}
            setElevenLabsVoices={setElevenLabsVoices}
            allSarvamVoices={allSarvamVoices}
          />
          
          {/* Settings Panel - uses internal state */}
          {showSettings && (
            <SettingsPanel
              selectedProvider={currentProvider}
              sarvamConfig={sarvamConfig}
              setSarvamConfig={setSarvamConfig}
              elevenLabsConfig={elevenLabsConfig}
              setElevenLabsConfig={setElevenLabsConfig}
            />
          )}
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center flex-shrink-0">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {currentVoiceId && currentProvider && (
              <span>Voice and settings configured</span>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={!currentVoiceId || !currentProvider}
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

export default SelectTTS