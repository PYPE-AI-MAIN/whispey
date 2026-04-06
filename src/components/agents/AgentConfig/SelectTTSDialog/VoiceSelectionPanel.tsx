import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import toast from 'react-hot-toast'
import {
  Search,
  Loader2,
  AlertCircle,
  Plus,
  CheckCircle,
  ExternalLink,
  Mic,
  Copy,
  Check,
  Play,
  Square,
} from 'lucide-react'

// Import shared SarvamConfig type from SettingsPanel
import type { SarvamConfig } from './SettingsPanel'

interface SarvamVoice {
  id: string
  name: string
  language: string
  gender: 'Male' | 'Female'
  style: string
  accent: string
  description: string
}

interface ElevenLabsVoice {
  voice_id: string
  name: string
  category: string
  description?: string
}

interface GoogleTTSVoice {
  name: string
  languageCodes: string[]
  ssmlGender: string
  naturalSampleRateHertz: number
  displayName: string
  primaryLanguage: string
  gender: string
}

interface VoiceSelectionPanelProps {
  activeTab: string
  onTabChange: (tab: string) => void
  showSettings: boolean
  selectedVoiceId: string
  selectedProvider: string
  onVoiceSelect: (voiceId: string, provider: string) => void
  sarvamConfig: SarvamConfig
  setSarvamConfig: React.Dispatch<React.SetStateAction<SarvamConfig>>
  elevenLabsVoices: ElevenLabsVoice[]
  setElevenLabsVoices: React.Dispatch<React.SetStateAction<ElevenLabsVoice[]>>
  allSarvamVoices: (SarvamVoice & { compatibleModels: string[] })[]
  googleTTSVoices: GoogleTTSVoice[]
  setGoogleTTSVoices: React.Dispatch<React.SetStateAction<GoogleTTSVoice[]>>
  isLoadingGoogleTTS: boolean
  googleTTSError: string | null
  googleTTSFetched: boolean
  onFetchGoogleTTS: () => void
}

const CopyButton = ({ text, className = '' }: { text: string; className?: string }) => {
  const [copied, setCopied] = useState(false)
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }
  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className={`w-7 h-7 p-0 ${className}`}>
      {copied
        ? <Check className="w-3.5 h-3.5 text-green-600" />
        : <Copy className="w-3.5 h-3.5 text-gray-400" />}
    </Button>
  )
}

const SarvamVoiceCard = ({
  voice,
  isSelected,
  onClick,
  isPreviewing,
  isPreviewLoading,
  onPreview,
}: {
  voice: SarvamVoice
  isSelected: boolean
  onClick: () => void
  isPreviewing: boolean
  isPreviewLoading: boolean
  onPreview: (e: React.MouseEvent) => void
}) => (
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
          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">
            {voice.id}
          </code>
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
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPreview}
          disabled={isPreviewLoading}
          className={`w-7 h-7 p-0 transition-opacity ${isPreviewing ? 'opacity-100 text-orange-500' : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-orange-500'}`}
          title={isPreviewing ? 'Stop preview' : 'Preview voice'}
        >
          {isPreviewLoading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : isPreviewing
              ? <Square className="w-3.5 h-3.5 fill-current" />
              : <Play className="w-3.5 h-3.5 fill-current" />}
        </Button>
        <CopyButton text={voice.id} />
      </div>
    </div>
  </div>
)

const ElevenLabsVoiceCard = ({
  voice,
  isSelected,
  onClick,
  isPreviewing,
  isPreviewLoading,
  onPreview,
}: {
  voice: ElevenLabsVoice
  isSelected: boolean
  onClick: () => void
  isPreviewing: boolean
  isPreviewLoading: boolean
  onPreview: (e: React.MouseEvent) => void
}) => (
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
          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">
            {voice.voice_id}
          </code>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-300">
            {voice.category === 'professional' ? 'Professional' : 'Personal'}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">Multi-language</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPreview}
          disabled={isPreviewLoading}
          className={`w-7 h-7 p-0 transition-opacity ${isPreviewing ? 'opacity-100 text-purple-500' : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-purple-500'}`}
          title={isPreviewing ? 'Stop preview' : 'Preview voice'}
        >
          {isPreviewLoading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : isPreviewing
              ? <Square className="w-3.5 h-3.5 fill-current" />
              : <Play className="w-3.5 h-3.5 fill-current" />}
        </Button>
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

const GoogleTTSVoiceCard = ({
  voice,
  isSelected,
  onClick,
}: {
  voice: GoogleTTSVoice
  isSelected: boolean
  onClick: () => void
}) => (
  <div
    onClick={onClick}
    className={`group cursor-pointer p-2 rounded-md border transition-all hover:shadow-sm ${
      isSelected
        ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/10'
        : 'border-gray-200 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/5'
    }`}
  >
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-medium text-xs flex-shrink-0">
        {voice.displayName.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-xs text-gray-900 dark:text-gray-100 truncate">{voice.displayName}</h3>
          {isSelected && <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />}
          <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">
            {voice.name}
          </code>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-300">
            {voice.gender}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{voice.primaryLanguage}</span>
          <span className="text-xs text-gray-400">•</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{voice.naturalSampleRateHertz}Hz</span>
        </div>
      </div>
      <CopyButton text={voice.name} />
    </div>
  </div>
)

const EmptyState = ({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon: React.ComponentType<any>
  title: string
  description: string
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
  allSarvamVoices,
  googleTTSVoices,
  setGoogleTTSVoices,
  isLoadingGoogleTTS,
  googleTTSError,
  googleTTSFetched,
  onFetchGoogleTTS,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoadingElevenLabs, setIsLoadingElevenLabs] = useState(false)
  const [elevenLabsError, setElevenLabsError] = useState<string | null>(null)
  const [elevenLabsFetched, setElevenLabsFetched] = useState(false)
  const sarvamListRef = useRef<HTMLDivElement>(null)
  const elevenLabsListRef = useRef<HTMLDivElement>(null)

  // ── Audio preview state ──
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null)
  const [previewLoadingVoiceId, setPreviewLoadingVoiceId] = useState<string | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  const stopPreview = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current.src = ''
      currentAudioRef.current = null
    }
    setPreviewingVoiceId(null)
  }, [])

  const handlePreview = useCallback(async (
    e: React.MouseEvent,
    voiceId: string,
    provider: 'sarvam' | 'elevenlabs' | 'google',
    extra: { speaker?: string; model?: string; languageCode?: string } = {}
  ) => {
    e.stopPropagation()

    // Toggle off if same voice is already playing
    if (previewingVoiceId === voiceId) {
      stopPreview()
      return
    }

    stopPreview()
    setPreviewLoadingVoiceId(voiceId)

    try {
      let response: Response

      if (provider === 'sarvam') {
        response = await fetch('/api/sarvam-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'Hi there! This is how I sound.',
            speaker: extra.speaker || voiceId,
            model: extra.model || sarvamConfig.model,
          }),
        })
      } else if (provider === 'elevenlabs') {
        response = await fetch('/api/elevenlabs-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'Hi there! This is how I sound.',
            voice_id: voiceId,
          }),
        })
      } else {
        response = await fetch('/api/google-tts-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'Hi there! This is how I sound.',
            voiceName: voiceId,
            languageCode: extra.languageCode,
          }),
        })
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Preview failed' }))
        throw new Error(err.error || 'Preview failed')
      }

      const blob = await response.blob()

      // Sanity-check: if the server sent JSON instead of audio (e.g. an error body
      // with the wrong status code), bail early with a useful message.
      if (blob.type.includes('json') || blob.type.includes('text')) {
        const text = await blob.text()
        let msg = 'Unexpected response from preview API'
        try { msg = JSON.parse(text)?.error || msg } catch {}
        throw new Error(msg)
      }

      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      currentAudioRef.current = audio
      setPreviewingVoiceId(voiceId)

      // Track whether playback actually started — onerror can fire spuriously
      // on some browsers even during/after successful playback (e.g. when src
      // is cleared or a benign mid-stream hiccup occurs). We only want to show
      // an error toast if the audio never played at all.
      let hasStartedPlaying = false

      audio.onplaying = () => { hasStartedPlaying = true }

      audio.onended = () => {
        setPreviewingVoiceId(null)
        URL.revokeObjectURL(url)
        currentAudioRef.current = null
      }

      audio.onerror = (e) => {
        if (hasStartedPlaying) return  // benign error after playback started — ignore
        console.error('Audio element error:', e)
        setPreviewingVoiceId(null)
        URL.revokeObjectURL(url)
        currentAudioRef.current = null
        toast.error('Failed to play audio preview')
      }

      // play() returns a Promise — catch autoplay policy rejections
      audio.play().catch((playErr) => {
        if (hasStartedPlaying) return
        console.error('Audio play() rejected:', playErr)
        setPreviewingVoiceId(null)
        URL.revokeObjectURL(url)
        currentAudioRef.current = null
        toast.error('Browser blocked audio playback — try clicking again')
      })
    } catch (err: any) {
      console.error('Preview error:', err)
      toast.error(err.message || 'Failed to preview voice')
    } finally {
      setPreviewLoadingVoiceId(null)
    }
  }, [previewingVoiceId, stopPreview, sarvamConfig.model])

  useEffect(() => {
    if (!elevenLabsFetched) fetchElevenLabsVoices()
  }, [elevenLabsFetched])

  useEffect(() => {
    if (!selectedVoiceId || !selectedProvider) return
    const scrollToSelected = () => {
      if (
        (selectedProvider === 'sarvam' && activeTab !== 'sarvam') ||
        (selectedProvider === 'elevenlabs' && activeTab !== 'elevenlabs')
      ) return

      const listRef = selectedProvider === 'sarvam' ? sarvamListRef : elevenLabsListRef
      if (listRef.current) {
        const el = listRef.current.querySelector(`[data-voice-id="${selectedVoiceId}"]`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        else setTimeout(scrollToSelected, 200)
      } else {
        setTimeout(scrollToSelected, 200)
      }
    }
    setTimeout(scrollToSelected, 300)
  }, [selectedVoiceId, selectedProvider, activeTab])

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

  // FIX: model compatibility now uses "bulbul:v3-beta" as the actual model string.
  // "bulbul:v3" in compatibleModels is treated as an alias for "bulbul:v3-beta"
  // since the plugin's SarvamTTSModels only has "bulbul:v2" | "bulbul:v3-beta".
  const getCompatibleSarvamVoices = (model: string): SarvamVoice[] => {
    const isV3 = model === 'bulbul:v3-beta' || model === 'bulbul:v3'
    const isV2 = model === 'bulbul:v2'
    return allSarvamVoices
      .filter((voice) => {
        if (isV3) return voice.compatibleModels.some((m) => m.startsWith('bulbul:v3'))
        if (isV2) return voice.compatibleModels.includes('bulbul:v2')
        return voice.compatibleModels.includes(model)
      })
      .map(({ compatibleModels, ...voice }) => voice)
  }

  const handleModelChange = (newModel: string) => {
    setSarvamConfig((prev) => ({ ...prev, model: newModel }))
    // If the currently selected voice is incompatible with the new model, deselect it
    if (selectedProvider === 'sarvam' && selectedVoiceId) {
      const compatibleVoices = getCompatibleSarvamVoices(newModel)
      if (!compatibleVoices.some((v) => v.id === selectedVoiceId)) {
        onVoiceSelect('', '')
      }
    }
  }

  const sarvamVoices = getCompatibleSarvamVoices(sarvamConfig.model)

  const filteredSarvam = sarvamVoices.filter(
    (v) =>
      v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.language.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.style.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const filteredElevenLabs = elevenLabsVoices.filter(
    (v) =>
      v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.description && v.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      v.voice_id.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const filteredGoogleTTS = googleTTSVoices.filter(
    (v) =>
      v.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.primaryLanguage.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.gender.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div
      className={`${showSettings ? 'w-1/2' : 'w-full'} transition-all duration-300 ${
        showSettings ? 'border-r border-gray-200 dark:border-gray-800' : ''
      } flex flex-col`}
    >
      <Tabs value={activeTab} onValueChange={onTabChange} className="flex flex-col flex-1 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <TabsList className="grid w-full grid-cols-3 h-10">
            <TabsTrigger value="sarvam" className="text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gradient-to-r from-orange-400 to-red-500 rounded-full" />
                Sarvam AI
                <Badge variant="secondary" className="text-xs">
                  {getCompatibleSarvamVoices(sarvamConfig.model).length}
                </Badge>
              </div>
            </TabsTrigger>
            <TabsTrigger value="elevenlabs" className="text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gradient-to-r from-purple-400 to-purple-600 rounded-full" />
                ElevenLabs
                <Badge variant="secondary" className="text-xs">
                  {elevenLabsVoices.length}
                </Badge>
              </div>
            </TabsTrigger>
            <TabsTrigger value="google" className="text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full" />
                Google TTS
                <Badge variant="secondary" className="text-xs">
                  {googleTTSVoices.length}
                </Badge>
              </div>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {/* ───── SARVAM ───── */}
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
              {/* FIX: model selector uses correct plugin model strings.
                  "bulbul:v3-beta" is the actual value accepted by livekit-plugins-sarvam 1.4.2.
                  We display it as "bulbul:v3 (beta)" for clarity. */}
              <Select value={sarvamConfig.model} onValueChange={handleModelChange}>
                <SelectTrigger className="w-44 h-10">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bulbul:v3-beta">bulbul:v3 (beta)</SelectItem>
                  <SelectItem value="bulbul:v2">bulbul:v2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div ref={sarvamListRef} className="flex-1 min-h-0 overflow-y-auto space-y-3">
              {filteredSarvam.length === 0 ? (
                <EmptyState
                  icon={Mic}
                  title="No voices found"
                  description="No Sarvam voices match your search."
                />
              ) : (
                filteredSarvam.map((voice) => {
                  const isSelected =
                    selectedVoiceId === voice.id &&
                    (selectedProvider === 'sarvam' || selectedProvider === 'sarvam_tts')
                  return (
                    <div key={voice.id} data-voice-id={voice.id}>
                      <SarvamVoiceCard
                        voice={voice}
                        isSelected={isSelected}
                        onClick={() => onVoiceSelect(voice.id, 'sarvam')}
                        isPreviewing={previewingVoiceId === voice.id}
                        isPreviewLoading={previewLoadingVoiceId === voice.id}
                        onPreview={(e) => handlePreview(e, voice.id, 'sarvam', { speaker: voice.id, model: sarvamConfig.model })}
                      />
                    </div>
                  )
                })
              )}
            </div>
          </TabsContent>

          {/* ───── ELEVENLABS ───── */}
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
                onClick={() => { setElevenLabsFetched(false); fetchElevenLabsVoices() }}
                disabled={isLoadingElevenLabs}
                className="h-10 px-4"
              >
                {isLoadingElevenLabs && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Refresh
              </Button>
            </div>

            <div className="flex-1 min-h-0">
              {isLoadingElevenLabs ? (
                <EmptyState icon={Loader2} title="Loading voices..." description="Fetching your personal voices from ElevenLabs." />
              ) : elevenLabsError ? (
                <EmptyState
                  icon={AlertCircle}
                  title="Failed to load voices"
                  description={elevenLabsError}
                  actions={
                    <Button variant="outline" onClick={() => { setElevenLabsFetched(false); fetchElevenLabsVoices() }}>
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
                          <ExternalLink className="w-4 h-4 mr-2" />Voice Lab
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <a href="https://elevenlabs.io/voice-cloning" target="_blank" rel="noopener noreferrer">
                          <Plus className="w-4 h-4 mr-2" />Clone Voice
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
                          onClick={() => onVoiceSelect(voice.voice_id, 'elevenlabs')}
                          isPreviewing={previewingVoiceId === voice.voice_id}
                          isPreviewLoading={previewLoadingVoiceId === voice.voice_id}
                          onPreview={(e) => handlePreview(e, voice.voice_id, 'elevenlabs')}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ───── GOOGLE ───── */}
          <TabsContent value="google" className="h-full p-6 mt-0 flex flex-col overflow-hidden">
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
              <Button
                variant="outline"
                onClick={onFetchGoogleTTS}
                disabled={isLoadingGoogleTTS}
                className="h-10 px-4"
              >
                {isLoadingGoogleTTS && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Refresh
              </Button>
            </div>

            <div className="flex-1 min-h-0">
              {isLoadingGoogleTTS ? (
                <EmptyState icon={Loader2} title="Loading voices..." description="Fetching voices from Google Cloud TTS." />
              ) : googleTTSError ? (
                <EmptyState
                  icon={AlertCircle}
                  title="Failed to load voices"
                  description={googleTTSError}
                  actions={<Button variant="outline" onClick={onFetchGoogleTTS}>Try Again</Button>}
                />
              ) : filteredGoogleTTS.length === 0 ? (
                <EmptyState
                  icon={Mic}
                  title="No voices found"
                  description="No Google TTS voices match your search, or voices haven't been loaded yet."
                />
              ) : (
                <div className="h-full overflow-y-auto space-y-3">
                  {filteredGoogleTTS.map((voice) => {
                    const isSelected = selectedVoiceId === voice.name && selectedProvider === 'google'
                    return (
                      <div key={voice.name} data-voice-id={voice.name}>
                        <GoogleTTSVoiceCard
                          voice={voice}
                          isSelected={isSelected}
                          onClick={() => onVoiceSelect(voice.name, 'google')}
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