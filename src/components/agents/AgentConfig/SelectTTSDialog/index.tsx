import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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

// FIX 1: SarvamConfig — `pace` replaces `speed`, `temperature` removed,
// `loudness`/`enable_preprocessing`/`pitch` always present (valid for all models;
// plugin drops them from API payload for v3-beta internally).
interface SarvamConfig {
  target_language_code: string;
  model: string;
  speaker: string;
  pace: number;
  loudness: number;
  enable_preprocessing: boolean;
  pitch: number;
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

interface GoogleTTSVoice {
  name: string;
  languageCodes: string[];
  ssmlGender: string;
  naturalSampleRateHertz: number;
  displayName: string;
  primaryLanguage: string;
  gender: string;
}

interface GoogleTTSConfig {
  voice_name: string;
  gender?: string;
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
  // bulbul:v2
  { id: 'anushka', name: 'Anushka', language: 'Multi-lingual', gender: 'Female', style: 'Professional', accent: 'Indian', description: 'Professional business voice', compatibleModels: ['bulbul:v2'] },
  { id: 'vidya', name: 'Vidya', language: 'Multi-lingual', gender: 'Female', style: 'Conversational', accent: 'Indian', description: 'Natural conversational tone', compatibleModels: ['bulbul:v2'] },
  { id: 'manisha', name: 'Manisha', language: 'Multi-lingual', gender: 'Female', style: 'Narrative', accent: 'Indian', description: 'Perfect for narration', compatibleModels: ['bulbul:v2'] },
  { id: 'arya', name: 'Arya', language: 'Multi-lingual', gender: 'Female', style: 'Youthful', accent: 'Indian', description: 'Energetic youthful voice', compatibleModels: ['bulbul:v2'] },
  { id: 'abhilash', name: 'Abhilash', language: 'Multi-lingual', gender: 'Male', style: 'Deep', accent: 'Indian', description: 'Deep authoritative voice', compatibleModels: ['bulbul:v2'] },
  { id: 'karun', name: 'Karun', language: 'Multi-lingual', gender: 'Male', style: 'Professional', accent: 'Indian', description: 'Clear professional male voice', compatibleModels: ['bulbul:v2'] },
  { id: 'hitesh', name: 'Hitesh', language: 'Multi-lingual', gender: 'Male', style: 'Conversational', accent: 'Indian', description: 'Natural conversational male voice', compatibleModels: ['bulbul:v2'] },
  // bulbul:v3 — 39 voices from live docs
  { id: 'shubh', name: 'Shubh', language: 'Multi-lingual', gender: 'Male', style: 'Natural', accent: 'Indian', description: 'Default v3 voice', compatibleModels: ['bulbul:v3'] },
  { id: 'aditya', name: 'Aditya', language: 'Multi-lingual', gender: 'Male', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'ritu', name: 'Ritu', language: 'Multi-lingual', gender: 'Female', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'priya', name: 'Priya', language: 'Multi-lingual', gender: 'Female', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'neha', name: 'Neha', language: 'Multi-lingual', gender: 'Female', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'rahul', name: 'Rahul', language: 'Multi-lingual', gender: 'Male', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'pooja', name: 'Pooja', language: 'Multi-lingual', gender: 'Female', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'rohan', name: 'Rohan', language: 'Multi-lingual', gender: 'Male', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'simran', name: 'Simran', language: 'Multi-lingual', gender: 'Female', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'kavya', name: 'Kavya', language: 'Multi-lingual', gender: 'Female', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'amit', name: 'Amit', language: 'Multi-lingual', gender: 'Male', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'dev', name: 'Dev', language: 'Multi-lingual', gender: 'Male', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'ishita', name: 'Ishita', language: 'Multi-lingual', gender: 'Female', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'shreya', name: 'Shreya', language: 'Multi-lingual', gender: 'Female', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'ratan', name: 'Ratan', language: 'Multi-lingual', gender: 'Male', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'varun', name: 'Varun', language: 'Multi-lingual', gender: 'Male', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'manan', name: 'Manan', language: 'Multi-lingual', gender: 'Male', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'sumit', name: 'Sumit', language: 'Multi-lingual', gender: 'Male', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'roopa', name: 'Roopa', language: 'Multi-lingual', gender: 'Female', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'kabir', name: 'Kabir', language: 'Multi-lingual', gender: 'Male', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'aayan', name: 'Aayan', language: 'Multi-lingual', gender: 'Male', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'ashutosh', name: 'Ashutosh', language: 'Multi-lingual', gender: 'Male', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'advait', name: 'Advait', language: 'Multi-lingual', gender: 'Male', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'amelia', name: 'Amelia', language: 'Multi-lingual', gender: 'Female', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'sophia', name: 'Sophia', language: 'Multi-lingual', gender: 'Female', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'anand', name: 'Anand', language: 'Multi-lingual', gender: 'Male', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'tanya', name: 'Tanya', language: 'Multi-lingual', gender: 'Female', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'tarun', name: 'Tarun', language: 'Multi-lingual', gender: 'Male', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'sunny', name: 'Sunny', language: 'Multi-lingual', gender: 'Male', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'mani', name: 'Mani', language: 'Multi-lingual', gender: 'Male', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'gokul', name: 'Gokul', language: 'Multi-lingual', gender: 'Male', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'vijay', name: 'Vijay', language: 'Multi-lingual', gender: 'Male', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'shruti', name: 'Shruti', language: 'Multi-lingual', gender: 'Female', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'suhani', name: 'Suhani', language: 'Multi-lingual', gender: 'Female', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'mohit', name: 'Mohit', language: 'Multi-lingual', gender: 'Male', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'kavitha', name: 'Kavitha', language: 'Multi-lingual', gender: 'Female', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'rehan', name: 'Rehan', language: 'Multi-lingual', gender: 'Male', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'soham', name: 'Soham', language: 'Multi-lingual', gender: 'Male', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
  { id: 'rupali', name: 'Rupali', language: 'Multi-lingual', gender: 'Female', style: 'Natural', accent: 'Indian', description: '', compatibleModels: ['bulbul:v3'] },
]

// Main Component
function SelectTTS({ selectedVoice, initialProvider, initialModel, initialConfig, onVoiceSelect }: SelectTTSProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>([])
  const [isLoadingElevenLabs, setIsLoadingElevenLabs] = useState(false)
  const [elevenLabsError, setElevenLabsError] = useState<string | null>(null)
  const [elevenLabsFetched, setElevenLabsFetched] = useState(false)
  
  const [googleTTSVoices, setGoogleTTSVoices] = useState<GoogleTTSVoice[]>([])
  const [isLoadingGoogleTTS, setIsLoadingGoogleTTS] = useState(false)
  const [googleTTSError, setGoogleTTSError] = useState<string | null>(null)
  const [googleTTSFetched, setGoogleTTSFetched] = useState(false)
  
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
    if (currentProvider === 'google') return 'google'
    return 'sarvam' // Default
  })
  
  // FIX 2: sarvamConfig initial state — no v3/v2 branching, no temperature,
  // pace replaces speed, all fields always present.
  const [sarvamConfig, setSarvamConfig] = useState<SarvamConfig>(() => {
    const model = ((initialProvider === 'sarvam' || initialProvider === 'sarvam_tts') && initialModel)
      ? (initialModel === 'bulbul:v3' ? 'bulbul:v3-beta' : initialModel)
      : 'bulbul:v3-beta'
    const cfg = ((initialProvider === 'sarvam' || initialProvider === 'sarvam_tts') && initialConfig)
      ? initialConfig
      : {}
    return {
      target_language_code: cfg.target_language_code || cfg.language || 'en-IN',
      model,
      speaker: selectedVoice || '',
      pace: Math.max(0.5, Math.min(2.0, Number(cfg.pace ?? cfg.speed ?? 1.0))),
      loudness: Math.max(0.5, Math.min(2.0, Number(cfg.loudness ?? 1.0))),
      enable_preprocessing: cfg.enable_preprocessing ?? false,
      pitch: Math.max(-20.0, Math.min(20.0, Number(cfg.pitch ?? 0.0))),
    }
  })

  // Initialize ElevenLabs configuration with defaults
  const [elevenLabsConfig, setElevenLabsConfig] = useState<ElevenLabsConfig>(() => {
    if (currentProvider === 'elevenlabs' && initialConfig) {
      // Only use initialModel if provider is ElevenLabs, otherwise use default
      const model = initialProvider === 'elevenlabs' && initialModel 
        ? initialModel 
        : 'eleven_multilingual_v2'
      return {
        voiceId: selectedVoice || '',
        language: initialConfig.language || 'en',
        model: model,
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

  // Initialize Google TTS configuration with defaults
  const [googleTTSConfig, setGoogleTTSConfig] = useState<GoogleTTSConfig>(() => {
    if (currentProvider === 'google' && initialConfig) {
      return {
        voice_name: selectedVoice || initialConfig.voice_name || '',
        gender: initialConfig.gender
      }
    }
    return {
      voice_name: selectedVoice || '',
      gender: undefined
    }
  })

  const [showSettings, setShowSettings] = useState(true)

  // FIX 3: originalValues sarvamConfig — same logic as initial state above,
  // no hardcoded bulbul:v2, no temperature, pace not speed.
  const originalValues = {
    voiceId: selectedVoice || '',
    provider: initialProvider === 'sarvam_tts' ? 'sarvam' : (initialProvider || ''),
    sarvamConfig: (() => {
      const model = ((initialProvider === 'sarvam' || initialProvider === 'sarvam_tts') && initialModel)
        ? (initialModel === 'bulbul:v3' ? 'bulbul:v3-beta' : initialModel)
        : 'bulbul:v3-beta'
      const cfg = ((initialProvider === 'sarvam' || initialProvider === 'sarvam_tts') && initialConfig)
        ? initialConfig
        : {}
      return {
        target_language_code: cfg.target_language_code || cfg.language || 'en-IN',
        model,
        speaker: selectedVoice || '',
        pace: Math.max(0.5, Math.min(2.0, Number(cfg.pace ?? cfg.speed ?? 1.0))),
        loudness: Math.max(0.5, Math.min(2.0, Number(cfg.loudness ?? 1.0))),
        enable_preprocessing: cfg.enable_preprocessing ?? false,
        pitch: Math.max(-20.0, Math.min(20.0, Number(cfg.pitch ?? 0.0))),
      }
    })(),
    elevenLabsConfig: (initialProvider === 'elevenlabs' && initialConfig) ? {
      voiceId: selectedVoice || '',
      language: initialConfig.language || 'en',
      // Only use initialModel if provider is ElevenLabs, otherwise use default
      model: initialProvider === 'elevenlabs' && initialModel 
        ? initialModel 
        : 'eleven_multilingual_v2',
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
    },
    googleTTSConfig: (initialProvider === 'google' && initialConfig) ? {
      voice_name: selectedVoice || initialConfig.voice_name || '',
      gender: initialConfig.gender
    } : {
      voice_name: selectedVoice || '',
      gender: undefined
    }
  }


  const handleReset = () => {
    setCurrentVoiceId(originalValues.voiceId)
    setCurrentProvider(originalValues.provider)
    setSarvamConfig(originalValues.sarvamConfig)
    setElevenLabsConfig(originalValues.elevenLabsConfig)
    setGoogleTTSConfig(originalValues.googleTTSConfig)
    
    // Set correct tab based on original provider
    if (originalValues.provider === 'sarvam') {
      setActiveTab('sarvam')
    } else if (originalValues.provider === 'elevenlabs') {
      setActiveTab('elevenlabs')
    } else if (originalValues.provider === 'google') {
      setActiveTab('google')
    }
  }

  // Pre-load ElevenLabs voices on component mount
  useEffect(() => {
    fetchElevenLabsVoices()
  }, [])

  // Pre-load Google TTS voices on component mount
  useEffect(() => {
    fetchGoogleTTSVoices()
  }, [])

  const fetchGoogleTTSVoices = async () => {
    if (googleTTSFetched) return
    
    setIsLoadingGoogleTTS(true)
    setGoogleTTSError(null)
    try {
      const response = await fetch('/api/google-tts-voices')
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch voices')
      }
      const data = await response.json()
      setGoogleTTSVoices(data.voices || [])
      setGoogleTTSFetched(true)
    } catch (error) {
      setGoogleTTSError(error instanceof Error ? error.message : 'Failed to load voices')
    } finally {
      setIsLoadingGoogleTTS(false)
    }
  }

  // FIX 4: useEffect sync — no v3/v2 branching, pace not speed, no temperature
  useEffect(() => {
    if ((currentProvider === 'sarvam' || initialProvider === 'sarvam_tts') && initialConfig) {
      const model = ((initialProvider === 'sarvam' || initialProvider === 'sarvam_tts') && initialModel)
        ? (initialModel === 'bulbul:v3' ? 'bulbul:v3-beta' : initialModel)
        : 'bulbul:v3-beta'
      setSarvamConfig({
        target_language_code: initialConfig.target_language_code ?? initialConfig.language ?? 'en-IN',
        model,
        speaker: selectedVoice ?? '',
        pace: Math.max(0.5, Math.min(2.0, Number(initialConfig.pace ?? initialConfig.speed ?? 1.0))),
        loudness: Math.max(0.5, Math.min(2.0, Number(initialConfig.loudness ?? 1.0))),
        enable_preprocessing: initialConfig.enable_preprocessing ?? false,
        pitch: Math.max(-20.0, Math.min(20.0, Number(initialConfig.pitch ?? 0.0))),
      })
    } else if (initialProvider === 'elevenlabs' && initialConfig) {
      // Only use initialModel if provider is ElevenLabs, otherwise use default
      const model = initialProvider === 'elevenlabs' && initialModel 
        ? initialModel 
        : 'eleven_multilingual_v2'
      setElevenLabsConfig({
        voiceId: selectedVoice || initialConfig.voiceId || '',
        language: initialConfig.language ?? 'en',
        model: model,
        similarityBoost: initialConfig.similarityBoost ?? 0.75,
        stability: initialConfig.stability ?? 0.5,
        style: initialConfig.style ?? 0,
        useSpeakerBoost: initialConfig.useSpeakerBoost ?? true,
        speed: initialConfig.speed ?? 1.0
      })
    } else if (initialProvider === 'google' && initialConfig) {
      setGoogleTTSConfig({
        voice_name: selectedVoice || initialConfig.voice_name || '',
        gender: initialConfig.gender
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
      } else if (initialProvider === 'google') {
        setActiveTab('google')
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
    } else if (normalizedProvider === 'google') {
      // Auto-detect gender from selected voice
      const selectedVoice = googleTTSVoices.find(v => v.name === voiceId)
      const gender = selectedVoice?.ssmlGender 
        ? selectedVoice.ssmlGender.toLowerCase() === 'female' ? 'female'
        : selectedVoice.ssmlGender.toLowerCase() === 'male' ? 'male'
        : 'neutral'
        : undefined
      
      setGoogleTTSConfig(prev => ({ 
        ...prev, 
        voice_name: voiceId,
        gender: gender
      }))
    }
    
    // Switch tab if needed
    if ((normalizedProvider === 'sarvam' && activeTab !== 'sarvam') || 
        (normalizedProvider === 'elevenlabs' && activeTab !== 'elevenlabs') ||
        (normalizedProvider === 'google' && activeTab !== 'google')) {
      setActiveTab(normalizedProvider === 'sarvam' ? 'sarvam' : normalizedProvider === 'elevenlabs' ? 'elevenlabs' : 'google')
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
    if (currentVoiceId && onVoiceSelect) {
      // Determine provider: prioritize currentProvider, but use activeTab as definitive fallback
      // This ensures that if user is on Sarvam tab, we use Sarvam config even if currentProvider is not set
      let provider = currentProvider
      if (!provider || (activeTab === 'sarvam' && provider !== 'sarvam')) {
        provider = activeTab === 'sarvam' ? 'sarvam' : 'elevenlabs'
      }
      
      const config = provider === 'sarvam' ? sarvamConfig : provider === 'elevenlabs' ? elevenLabsConfig : googleTTSConfig
      const model = provider === 'sarvam' ? sarvamConfig.model : provider === 'elevenlabs' ? elevenLabsConfig.model : undefined
      onVoiceSelect(currentVoiceId, provider, model, config)
    }
    setIsOpen(false)
  }

  const getSelectedVoiceName = () => {
    if (selectedVoice && (!elevenLabsFetched || isLoadingElevenLabs)) {
      return (
        <div className="flex items-center gap-2">
          <Skeleton className="w-3 h-3" />
          <Skeleton className="w-16 h-3" />
        </div>
      )
    }
    
    if (!selectedVoice) return "Choose Voice"
    
    const sarvamVoice = allSarvamVoices.find(v => v.id === selectedVoice)
    if (sarvamVoice) return sarvamVoice.name
    const elevenLabsVoice = elevenLabsVoices.find(v => v.voice_id === selectedVoice)
    if (elevenLabsVoice) return elevenLabsVoice.name
    const googleTTSVoice = googleTTSVoices.find(v => v.name === selectedVoice)
    if (googleTTSVoice) return googleTTSVoice.displayName
    return "Voice Selected"
  }


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="justify-start text-xs font-normal w-full text-ellipsis overflow-hidden">
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
                googleTTSVoices={googleTTSVoices}
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
            googleTTSVoices={googleTTSVoices}
            setGoogleTTSVoices={setGoogleTTSVoices}
            isLoadingGoogleTTS={isLoadingGoogleTTS}
            googleTTSError={googleTTSError}
            googleTTSFetched={googleTTSFetched}
            onFetchGoogleTTS={fetchGoogleTTSVoices}
          />
          
          {/* Settings Panel - uses internal state */}
          {showSettings && (
            <SettingsPanel
              selectedProvider={currentProvider}
              sarvamConfig={sarvamConfig}
              setSarvamConfig={setSarvamConfig}
              elevenLabsConfig={elevenLabsConfig}
              setElevenLabsConfig={setElevenLabsConfig}
              googleTTSConfig={googleTTSConfig}
              setGoogleTTSConfig={setGoogleTTSConfig}
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