import React, { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Settings, ChevronDown, Copy, Check } from 'lucide-react'

// IMPORTANT: field is `pace` not `speed` — matches livekit-plugins-sarvam 1.4.2 TTS.__init__
// `temperature` is NOT a valid param in 1.4.2 — removed entirely
// All params (pitch, pace, loudness, enable_preprocessing) are valid for ALL models in __init__
// The plugin internally drops pitch/loudness from the API payload for non-v2 models
// Valid ranges enforced by plugin: pace 0.5–2.0, loudness 0.5–2.0, pitch -20.0–20.0
// Model strings: "bulbul:v2" | "bulbul:v3-beta"  (NOT "bulbul:v3" — not in SarvamTTSModels)
export interface SarvamConfig {
  target_language_code: string
  model: string       // "bulbul:v2" | "bulbul:v3-beta"
  speaker: string
  pace: number        // 0.5–2.0
  loudness: number    // 0.5–2.0
  pitch: number       // -20.0–20.0
  enable_preprocessing: boolean
}

export interface ElevenLabsConfig {
  voiceId: string
  language: string
  model: string
  similarityBoost: number
  stability: number
  style: number
  useSpeakerBoost: boolean
  speed: number
}

export interface GoogleTTSConfig {
  voice_name: string
  gender?: string
}

interface SettingsPanelProps {
  selectedProvider: string
  sarvamConfig: SarvamConfig
  setSarvamConfig: React.Dispatch<React.SetStateAction<SarvamConfig>>
  elevenLabsConfig: ElevenLabsConfig
  setElevenLabsConfig: React.Dispatch<React.SetStateAction<ElevenLabsConfig>>
  googleTTSConfig: GoogleTTSConfig
  setGoogleTTSConfig: React.Dispatch<React.SetStateAction<GoogleTTSConfig>>
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

const ConfigSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-4">
    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
      {title}
    </h3>
    {children}
  </div>
)

const languageDisplayMap: Record<string, string> = {
  'hi-IN': 'Hindi (hi-IN)',
  'bn-IN': 'Bengali (bn-IN)',
  'ta-IN': 'Tamil (ta-IN)',
  'te-IN': 'Telugu (te-IN)',
  'gu-IN': 'Gujarati (gu-IN)',
  'kn-IN': 'Kannada (kn-IN)',
  'ml-IN': 'Malayalam (ml-IN)',
  'mr-IN': 'Marathi (mr-IN)',
  'pa-IN': 'Punjabi (pa-IN)',
  'od-IN': 'Odia (od-IN)',
  'en-IN': 'English (en-IN)',
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  selectedProvider,
  sarvamConfig,
  setSarvamConfig,
  elevenLabsConfig,
  setElevenLabsConfig,
  googleTTSConfig,
  setGoogleTTSConfig,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const normalizedProvider = selectedProvider === 'sarvam_tts' ? 'sarvam' : selectedProvider
  // v3-beta: pitch/loudness/enable_preprocessing are accepted by __init__ but
  // silently ignored by the Sarvam API — show them disabled with a note
  const isV3 = sarvamConfig.model === 'bulbul:v3-beta'

  return (
    <div className="w-1/2 flex flex-col">
      <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {normalizedProvider === 'sarvam'
              ? 'Sarvam'
              : normalizedProvider === 'elevenlabs'
              ? 'ElevenLabs'
              : normalizedProvider === 'google'
              ? 'Google TTS'
              : 'TTS'}{' '}
            Settings
          </h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Configure speech synthesis parameters
        </p>
      </div>

      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {/* ───── SARVAM ───── */}
        {normalizedProvider === 'sarvam' ? (
          <>
            <ConfigSection title="Basic Settings">
              <div className="space-y-2">
                <Label htmlFor="target-language">Target Language Code</Label>
                <Select
                  value={sarvamConfig.target_language_code}
                  onValueChange={(value) =>
                    setSarvamConfig((prev) => ({ ...prev, target_language_code: value }))
                  }
                >
                  <SelectTrigger id="target-language">
                    <SelectValue>
                      {languageDisplayMap[sarvamConfig.target_language_code] ??
                        sarvamConfig.target_language_code}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(languageDisplayMap).map(([code, label]) => (
                      <SelectItem key={code} value={code}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </ConfigSection>

            <ConfigSection title="Audio Settings">
              <div className="space-y-5">

                {/* Pace — 0.5–2.0, both models */}
                <div className="space-y-3">
                  <Label>Pace: {sarvamConfig.pace.toFixed(2)}</Label>
                  <Slider
                    value={[sarvamConfig.pace]}
                    onValueChange={([v]) => setSarvamConfig((prev) => ({ ...prev, pace: v }))}
                    min={0.5}
                    max={2.0}
                    step={0.05}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Slow (0.5×)</span>
                    <span>Fast (2.0×)</span>
                  </div>
                </div>

                {/* Loudness — 0.5–2.0.
                    Accepted by __init__ for all models; API ignores it for v3-beta. */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className={isV3 ? 'text-gray-400 dark:text-gray-600' : ''}>
                      Loudness: {sarvamConfig.loudness.toFixed(1)}
                    </Label>
                    {isV3 && (
                      <span className="text-xs text-amber-500 dark:text-amber-400">
                        ignored by API for v3-beta
                      </span>
                    )}
                  </div>
                  <Slider
                    value={[sarvamConfig.loudness]}
                    onValueChange={([v]) => setSarvamConfig((prev) => ({ ...prev, loudness: v }))}
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    className="w-full"
                    disabled={isV3}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Quiet (0.5)</span>
                    <span>Loud (2.0)</span>
                  </div>
                </div>

                {/* Pitch — -20 to 20.
                    Accepted by __init__ for all models; API ignores it for v3-beta. */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className={isV3 ? 'text-gray-400 dark:text-gray-600' : ''}>
                      Pitch: {sarvamConfig.pitch.toFixed(1)}
                    </Label>
                    {isV3 && (
                      <span className="text-xs text-amber-500 dark:text-amber-400">
                        ignored by API for v3-beta
                      </span>
                    )}
                  </div>
                  <Slider
                    value={[sarvamConfig.pitch]}
                    onValueChange={([v]) => setSarvamConfig((prev) => ({ ...prev, pitch: v }))}
                    min={-20.0}
                    max={20.0}
                    step={0.5}
                    className="w-full"
                    disabled={isV3}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Low (−20)</span>
                    <span>High (+20)</span>
                  </div>
                </div>

              </div>
            </ConfigSection>

            {/* Processing — enable_preprocessing is v2 only at API level */}
            <ConfigSection title="Processing">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="preprocessing"
                      className={isV3 ? 'text-gray-400 dark:text-gray-600' : ''}
                    >
                      Enable Preprocessing
                    </Label>
                    {isV3 && (
                      <span className="text-xs text-amber-500 dark:text-amber-400">
                        ignored by API for v3-beta
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Normalise numbers, dates and English words in mixed-language text
                  </p>
                </div>
                <Switch
                  id="preprocessing"
                  checked={sarvamConfig.enable_preprocessing}
                  onCheckedChange={(checked) =>
                    setSarvamConfig((prev) => ({ ...prev, enable_preprocessing: checked }))
                  }
                  disabled={isV3}
                />
              </div>
            </ConfigSection>
          </>

        ) : /* ───── ELEVENLABS ───── */ normalizedProvider === 'elevenlabs' ? (
          <>
            <ConfigSection title="Basic Settings">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="voice-id">Voice ID</Label>
                  <div className="flex gap-2">
                    <Input
                      id="voice-id"
                      value={elevenLabsConfig.voiceId}
                      onChange={(e) =>
                        setElevenLabsConfig((prev) => ({ ...prev, voiceId: e.target.value }))
                      }
                      placeholder="Enter voice ID or select from list"
                    />
                    <CopyButton text={elevenLabsConfig.voiceId} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select
                    value={elevenLabsConfig.language}
                    onValueChange={(v) => setElevenLabsConfig((prev) => ({ ...prev, language: v }))}
                  >
                    <SelectTrigger id="language"><SelectValue /></SelectTrigger>
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
                  <Select
                    value={elevenLabsConfig.model}
                    onValueChange={(v) => setElevenLabsConfig((prev) => ({ ...prev, model: v }))}
                  >
                    <SelectTrigger id="eleven-model"><SelectValue /></SelectTrigger>
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
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                />
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
                      onValueChange={([v]) =>
                        setElevenLabsConfig((prev) => ({ ...prev, similarityBoost: v }))
                      }
                      min={0} max={1} step={0.01} className="w-full"
                    />
                    <p className="text-xs text-gray-500">How similar to the original voice (0–1)</p>
                  </div>

                  <div className="space-y-3">
                    <Label>Stability: {elevenLabsConfig.stability}</Label>
                    <Slider
                      value={[elevenLabsConfig.stability]}
                      onValueChange={([v]) =>
                        setElevenLabsConfig((prev) => ({ ...prev, stability: v }))
                      }
                      min={0} max={1} step={0.01} className="w-full"
                    />
                    <p className="text-xs text-gray-500">Voice stability (0–1, higher = more stable)</p>
                  </div>

                  <div className="space-y-3">
                    <Label>Style: {elevenLabsConfig.style}</Label>
                    <Slider
                      value={[elevenLabsConfig.style]}
                      onValueChange={([v]) =>
                        setElevenLabsConfig((prev) => ({ ...prev, style: v }))
                      }
                      min={0} max={1} step={0.01} className="w-full"
                    />
                    <p className="text-xs text-gray-500">Voice style variation (0–1)</p>
                  </div>

                  <div className="space-y-3">
                    <Label>Speed: {elevenLabsConfig.speed}</Label>
                    <Slider
                      value={[elevenLabsConfig.speed]}
                      onValueChange={([v]) =>
                        setElevenLabsConfig((prev) => ({ ...prev, speed: v }))
                      }
                      min={0.25} max={4.0} step={0.05} className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Slow (0.25×)</span>
                      <span>Fast (4.0×)</span>
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
                      onCheckedChange={(checked) =>
                        setElevenLabsConfig((prev) => ({ ...prev, useSpeakerBoost: checked }))
                      }
                    />
                  </div>
                </div>
              </ConfigSection>
            )}
          </>

        ) : /* ───── GOOGLE ───── */ normalizedProvider === 'google' ? (
          <ConfigSection title="Basic Settings">
            <div className="space-y-2">
              <Label htmlFor="google-voice-name">Voice Name</Label>
              <div className="flex gap-2">
                <Input
                  id="google-voice-name"
                  value={googleTTSConfig.voice_name}
                  onChange={(e) =>
                    setGoogleTTSConfig((prev) => ({ ...prev, voice_name: e.target.value }))
                  }
                  placeholder="e.g. en-IN-Wavenet-A"
                />
                <CopyButton text={googleTTSConfig.voice_name} />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Select a voice from the list or enter the voice name manually
              </p>
            </div>
          </ConfigSection>

        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <Settings className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto" />
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Select a Voice</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Choose a voice from the left panel to configure settings
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SettingsPanel