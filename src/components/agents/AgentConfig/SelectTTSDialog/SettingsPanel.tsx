import React, { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Settings, ChevronDown, Copy, Check } from 'lucide-react'

// Updated interfaces to match API format
interface SarvamConfig {
  target_language_code: string;  // Changed from targetLanguage
  model: string;
  speaker: string;
  loudness: number;
  speed: number;
  enable_preprocessing: boolean;  // Changed from enablePreprocessing
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

interface SettingsPanelProps {
  selectedProvider: string;
  sarvamConfig: SarvamConfig;
  setSarvamConfig: React.Dispatch<React.SetStateAction<SarvamConfig>>;
  elevenLabsConfig: ElevenLabsConfig;
  setElevenLabsConfig: React.Dispatch<React.SetStateAction<ElevenLabsConfig>>;
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

const ConfigSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div className="space-y-4">
    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
      {title}
    </h3>
    {children}
  </div>
)

// Language display mapping for user-friendly names
const languageDisplayMap: Record<string, string> = {
  'en-IN': 'Hindi (en-IN)',
  'hi': 'Hindi (hi)', 
  'en': 'English (en)',
  'ta': 'Tamil (ta)',
  'te': 'Telugu (te)',
  'ml': 'Malayalam (ml)',
  'kn': 'Kannada (kn)',
  'gu': 'Gujarati (gu)',
  'bn': 'Bengali (bn)',
}

const getLanguageDisplay = (code: string) => {
  return languageDisplayMap[code] || code
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  selectedProvider,
  sarvamConfig,
  setSarvamConfig,
  elevenLabsConfig,
  setElevenLabsConfig
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleModelChange = (newModel: string) => {
    setSarvamConfig(prev => ({ ...prev, model: newModel }))
  }

  const normalizedProvider = selectedProvider === 'sarvam_tts' ? 'sarvam' : selectedProvider

  return (
    <div className="w-1/2 flex flex-col">
      <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {normalizedProvider === 'sarvam' ? 'Sarvam' : normalizedProvider === 'elevenlabs' ? 'ElevenLabs' : 'TTS'} Settings
          </h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Configure speech synthesis parameters
        </p>
      </div>
      
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {normalizedProvider === 'sarvam' ? (
          <>
            <ConfigSection title="Basic Settings">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="target-language">Target Language Code</Label>
                  <Select 
                    value={sarvamConfig.target_language_code} 
                    onValueChange={(value) => 
                      setSarvamConfig(prev => ({ ...prev, target_language_code: value }))
                    }
                  >
                    <SelectTrigger id="target-language">
                      <SelectValue placeholder="Select language">
                        {getLanguageDisplay(sarvamConfig.target_language_code)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en-IN">Hindi (en-IN)</SelectItem>
                      <SelectItem value="hi">Hindi (hi)</SelectItem>
                      <SelectItem value="en">English (en)</SelectItem>
                      <SelectItem value="ta">Tamil (ta)</SelectItem>
                      <SelectItem value="te">Telugu (te)</SelectItem>
                      <SelectItem value="ml">Malayalam (ml)</SelectItem>
                      <SelectItem value="kn">Kannada (kn)</SelectItem>
                      <SelectItem value="gu">Gujarati (gu)</SelectItem>
                      <SelectItem value="bn">Bengali (bn)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </ConfigSection>
            
            <ConfigSection title="Audio Settings">
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label>Loudness: {sarvamConfig.loudness}</Label>
                  <Slider
                    value={[sarvamConfig.loudness]}
                    onValueChange={([value]) => setSarvamConfig(prev => ({ ...prev, loudness: value }))}
                    min={0.1}
                    max={2.0}
                    step={0.1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Quiet (0.1)</span>
                    <span>Loud (2.0)</span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Label>Speed: {sarvamConfig.speed}</Label>
                  <Slider
                    value={[sarvamConfig.speed]}
                    onValueChange={([value]) => setSarvamConfig(prev => ({ ...prev, speed: value }))}
                    min={0.25}
                    max={2.0}
                    step={0.05}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Slow (0.25x)</span>
                    <span>Fast (2.0x)</span>
                  </div>
                </div>
              </div>
            </ConfigSection>
            
            <ConfigSection title="Processing">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="preprocessing">Enable Preprocessing</Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Improve speech quality with text preprocessing</p>
                </div>
                <Switch
                  id="preprocessing"
                  checked={sarvamConfig.enable_preprocessing}
                  onCheckedChange={(checked) => setSarvamConfig(prev => ({ ...prev, enable_preprocessing: checked }))}
                />
              </div>
            </ConfigSection>
          </>
        ) : normalizedProvider === 'elevenlabs' ? (
          <>
            <ConfigSection title="Basic Settings">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="voice-id">Voice ID</Label>
                  <div className="flex gap-2">
                    <Input
                      id="voice-id"
                      value={elevenLabsConfig.voiceId}
                      onChange={(e) => setElevenLabsConfig(prev => ({ ...prev, voiceId: e.target.value }))}
                      placeholder="Enter voice ID or select from list"
                    />
                    <CopyButton text={elevenLabsConfig.voiceId} />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select value={elevenLabsConfig.language} onValueChange={(value) => 
                    setElevenLabsConfig(prev => ({ ...prev, language: value }))
                  }>
                    <SelectTrigger id="language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                      <SelectItem value="it">Italian</SelectItem>
                      <SelectItem value="pt">Portuguese</SelectItem>
                      <SelectItem value="hi">Hindi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="eleven-model">Model</Label>
                  <Select value={elevenLabsConfig.model} onValueChange={(value) => 
                    setElevenLabsConfig(prev => ({ ...prev, model: value }))
                  }>
                    <SelectTrigger id="eleven-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eleven_multilingual_v2">Multilingual v2</SelectItem>
                      <SelectItem value="eleven_turbo_v2_5">Turbo v2.5</SelectItem>
                      <SelectItem value="eleven_flash_v2_5">Flash v2.5</SelectItem>
                      <SelectItem value="eleven_v3">Eleven v3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </ConfigSection>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 p-2"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                <span className="text-sm font-medium">Advanced Configuration</span>
              </Button>
            </div>
            
            {showAdvanced && (
              <ConfigSection title="Advanced Settings">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label>Similarity Boost: {elevenLabsConfig.similarityBoost}</Label>
                    <Slider
                      value={[elevenLabsConfig.similarityBoost]}
                      onValueChange={([value]) => setElevenLabsConfig(prev => ({ ...prev, similarityBoost: value }))}
                      min={0}
                      max={1}
                      step={0.01}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500">How similar to the original voice (0-1)</p>
                  </div>
                  
                  <div className="space-y-3">
                    <Label>Stability: {elevenLabsConfig.stability}</Label>
                    <Slider
                      value={[elevenLabsConfig.stability]}
                      onValueChange={([value]) => setElevenLabsConfig(prev => ({ ...prev, stability: value }))}
                      min={0}
                      max={1}
                      step={0.01}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500">Voice stability (0-1, higher = more stable)</p>
                  </div>
                  
                  <div className="space-y-3">
                    <Label>Style: {elevenLabsConfig.style}</Label>
                    <Slider
                      value={[elevenLabsConfig.style]}
                      onValueChange={([value]) => setElevenLabsConfig(prev => ({ ...prev, style: value }))}
                      min={0}
                      max={1}
                      step={0.01}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500">Voice style variation (0-1)</p>
                  </div>
                  
                  <div className="space-y-3">
                    <Label>Speed: {elevenLabsConfig.speed}</Label>
                    <Slider
                      value={[elevenLabsConfig.speed]}
                      onValueChange={([value]) => setElevenLabsConfig(prev => ({ ...prev, speed: value }))}
                      min={0.25}
                      max={4.0}
                      step={0.05}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Slow (0.25x)</span>
                      <span>Fast (4.0x)</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="speaker-boost">Use Speaker Boost</Label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Enhance speaker clarity</p>
                    </div>
                    <Switch
                      id="speaker-boost"
                      checked={elevenLabsConfig.useSpeakerBoost}
                      onCheckedChange={(checked) => setElevenLabsConfig(prev => ({ ...prev, useSpeakerBoost: checked }))}
                    />
                  </div>
                </div>
              </ConfigSection>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <Settings className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto" />
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Select a Voice</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Choose a voice from the left panel to configure settings</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SettingsPanel