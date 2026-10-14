import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Settings } from 'lucide-react'
import type { RayaVoice } from '@/lib/tts/raya'
import { getTtsProvider, normalizeTtsProvider } from './providers'

interface SarvamVoice {
  id: string;
  name: string;
  language: string;
  gender?: 'Male' | 'Female';
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

interface GoogleTTSVoice {
  name: string;
  displayName: string;
  languageCodes: string[];
  ssmlGender: string;
  gender: string;
}

interface HeaderVoiceDisplayProps {
  selectedVoiceId: string;
  selectedProvider: string;
  allSarvamVoices: (SarvamVoice & { compatibleModels: string[] })[];
  elevenLabsVoices: ElevenLabsVoice[];
  googleTTSVoices?: GoogleTTSVoice[];
  rayaVoices?: RayaVoice[];
  showSettings: boolean;
  onToggleSettings: () => void;
}

const VoiceAvatar = ({ name, dot }: { name: string, dot: string }) => (
  <div className={`w-4 h-4 rounded-full flex items-center justify-center text-white font-semibold text-xs bg-gradient-to-br ${dot}`}>
    {name.charAt(0).toUpperCase()}
  </div>
)

const HeaderVoiceDisplay: React.FC<HeaderVoiceDisplayProps> = ({
  selectedVoiceId,
  selectedProvider,
  allSarvamVoices,
  elevenLabsVoices,
  googleTTSVoices = [],
  rayaVoices = [],
  showSettings,
  onToggleSettings
}) => {
  if (!selectedVoiceId || !selectedProvider) return null

  // Normalize provider name for consistent comparison
  const normalizedProvider = normalizeTtsProvider(selectedProvider)
  // An unrecognised provider keeps the ElevenLabs look it has always had.
  const meta = getTtsProvider(normalizedProvider) ?? getTtsProvider('elevenlabs')!

  // Find voice name from the correct provider
  let selectedVoiceName = 'Voice'
  if (normalizedProvider === 'sarvam') {
    selectedVoiceName = allSarvamVoices.find(v => v.id === selectedVoiceId)?.name || 'Voice'
  } else if (normalizedProvider === 'elevenlabs') {
    selectedVoiceName = elevenLabsVoices.find(v => v.voice_id === selectedVoiceId)?.name || 'Voice'
  } else if (normalizedProvider === 'google') {
    selectedVoiceName = googleTTSVoices.find(v => v.name === selectedVoiceId)?.displayName || 'Voice'
  } else if (normalizedProvider === 'raya') {
    selectedVoiceName = rayaVoices.find(v => v.id === selectedVoiceId)?.name || 'Voice'
  }

  return (
    <div className="flex items-start gap-3">
      <div className={`px-3 py-2 rounded-lg border ${meta.chip}`}>
        <div className="flex items-center gap-2">
          <VoiceAvatar name={selectedVoiceName} dot={meta.dot} />
          <div className="text-xs">
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {selectedVoiceName}
            </span>
            <Badge variant="secondary" className="ml-2 text-xs">
              {meta.label}
            </Badge>
          </div>
        </div>
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onToggleSettings}
        className={`${showSettings ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-700' : ''}`}
      >
        <Settings className="w-4 h-4" />
        Settings
      </Button>
    </div>
  )
}

export default HeaderVoiceDisplay