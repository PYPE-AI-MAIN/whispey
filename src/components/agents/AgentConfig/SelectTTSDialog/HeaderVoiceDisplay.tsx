import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Settings } from 'lucide-react'

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

interface HeaderVoiceDisplayProps {
  selectedVoiceId: string;
  selectedProvider: string;
  allSarvamVoices: (SarvamVoice & { compatibleModels: string[] })[];
  elevenLabsVoices: ElevenLabsVoice[];
  showSettings: boolean;
  onToggleSettings: () => void;
}

const VoiceAvatar = ({ name, variant = 'default' }: { name: string, variant?: 'sarvam' | 'elevenlabs' | 'default' }) => {
  const getGradient = () => {
    if (variant === 'sarvam') return 'bg-gradient-to-br from-orange-400 to-red-500'
    if (variant === 'elevenlabs') return 'bg-gradient-to-br from-purple-400 to-purple-600'
    return 'bg-gradient-to-br from-blue-400 to-blue-600'
  }

  return (
    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-white font-semibold text-xs ${getGradient()}`}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

const HeaderVoiceDisplay: React.FC<HeaderVoiceDisplayProps> = ({
  selectedVoiceId,
  selectedProvider,
  allSarvamVoices,
  elevenLabsVoices,
  showSettings,
  onToggleSettings
}) => {
  if (!selectedVoiceId || !selectedProvider) return null

  // Normalize provider name for consistent comparison
  const normalizedProvider = selectedProvider === 'sarvam_tts' ? 'sarvam' : selectedProvider

  // Find voice name from the correct provider
  let selectedVoiceName = 'Voice'
  if (normalizedProvider === 'sarvam') {
    selectedVoiceName = allSarvamVoices.find(v => v.id === selectedVoiceId)?.name || 'Voice'
  } else if (normalizedProvider === 'elevenlabs') {
    selectedVoiceName = elevenLabsVoices.find(v => v.voice_id === selectedVoiceId)?.name || 'Voice'
  }

  return (
    <div className="flex items-start gap-3">
      <div className={`px-3 py-2 rounded-lg border ${
        normalizedProvider === 'sarvam' 
          ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800' 
          : 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800'
      }`}>
        <div className="flex items-center gap-2">
          <VoiceAvatar 
            name={selectedVoiceName} 
            variant={normalizedProvider === 'sarvam' ? 'sarvam' : 'elevenlabs'} 
          />
          <div className="text-xs">
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {selectedVoiceName}
            </span>
            <Badge variant="secondary" className="ml-2 text-xs">
              {normalizedProvider === 'sarvam' ? 'Sarvam' : 'ElevenLabs'}
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