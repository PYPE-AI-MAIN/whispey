import React, { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Settings, ChevronDown, Copy, Check } from 'lucide-react'
import { BULBUL_V4_LANGUAGE_CODES, isBulbulV4Model } from './bulbulV4Voices'
import type { RayaConfig } from '@/lib/tts/raya'
import RayaSettings from './raya/RayaSettings'
import { getTtsProvider, normalizeTtsProvider } from './providers'

// IMPORTANT: field is `pace` not `speed` — matches livekit-plugins-sarvam 1.4.2 TTS.__init__
// `temperature` is NOT a valid param in 1.4.2 — removed entirely
// All params (pitch, pace, loudness, enable_preprocessing) are valid for ALL models in __init__
// The plugin internally drops pitch/loudness from the API payload for non-v2 models
// Valid ranges enforced by plugin: pace 0.5–2.0, loudness 0.5–2.0, pitch -20.0–20.0
// Model strings: "bulbul:v2" | "bulbul:v3-beta" | "bulbul:v4-flash"
export interface SarvamConfig {
  target_language_code: string
  model: string       // "bulbul:v2" | "bulbul:v3-beta" | "bulbul:v4-flash"
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
  expressive: boolean
  audioTags: string[]
  audioTagNotes: Record<string, string>
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
  rayaConfig: RayaConfig
  setRayaConfig: React.Dispatch<React.SetStateAction<RayaConfig>>
  allowAudioTags?: boolean
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
        ? <Check className="w-3.5 h-3.5 text-success" />
        : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
    </Button>
  )
}

const ConfigSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="space-y-4">
    <h3 className="text-sm font-medium text-foreground border-b border-border pb-2">
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

const NotAppliedBadge = () => (
  <span className="text-xs text-warning">not applied for this model</span>
)

// Kept as-is for the providers that already shipped; newer providers take the registry label.
const PROVIDER_TITLES: Record<string, string> = {
  sarvam: 'Sarvam',
  elevenlabs: 'ElevenLabs',
  google: 'Google TTS',
}
const providerTitle = (provider: string): string | undefined =>
  PROVIDER_TITLES[provider] ?? getTtsProvider(provider)?.label

const SarvamSettings = ({
  sarvamConfig,
  setSarvamConfig,
}: Pick<SettingsPanelProps, 'sarvamConfig' | 'setSarvamConfig'>) => {
  // The LiveKit plugin only sends pitch/loudness/enable_preprocessing for
  // bulbul:v2, so for every other model show them disabled with a note
  const v2OnlyControlsIgnored = sarvamConfig.model !== 'bulbul:v2'
  const mutedClass = v2OnlyControlsIgnored ? 'text-muted-foreground' : ''
  const isV4 = isBulbulV4Model(sarvamConfig.model)
  const languageOptions = Object.entries(languageDisplayMap).filter(
    ([code]) => !isV4 || BULBUL_V4_LANGUAGE_CODES.includes(code),
  )

  return (
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
              {languageOptions.map(([code, label]) => (
                <SelectItem key={code} value={code}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isV4 && (
            <p className="text-xs text-muted-foreground">
              Set from the selected v4 voice. Only change it if you&apos;ve auditioned the voice in that language.
            </p>
          )}
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
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Slow (0.5×)</span>
              <span>Fast (2.0×)</span>
            </div>
          </div>

          {/* Loudness — 0.5–2.0.
              Only sent to Sarvam for bulbul:v2. */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className={mutedClass}>
                Loudness: {sarvamConfig.loudness.toFixed(1)}
              </Label>
              {v2OnlyControlsIgnored && <NotAppliedBadge />}
            </div>
            <Slider
              value={[sarvamConfig.loudness]}
              onValueChange={([v]) => setSarvamConfig((prev) => ({ ...prev, loudness: v }))}
              min={0.5}
              max={2.0}
              step={0.1}
              className="w-full"
              disabled={v2OnlyControlsIgnored}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Quiet (0.5)</span>
              <span>Loud (2.0)</span>
            </div>
          </div>

          {/* Pitch — -20 to 20.
              Only sent to Sarvam for bulbul:v2. */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className={mutedClass}>
                Pitch: {sarvamConfig.pitch.toFixed(1)}
              </Label>
              {v2OnlyControlsIgnored && <NotAppliedBadge />}
            </div>
            <Slider
              value={[sarvamConfig.pitch]}
              onValueChange={([v]) => setSarvamConfig((prev) => ({ ...prev, pitch: v }))}
              min={-20.0}
              max={20.0}
              step={0.5}
              className="w-full"
              disabled={v2OnlyControlsIgnored}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
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
                className={mutedClass}
              >
                Enable Preprocessing
              </Label>
              {v2OnlyControlsIgnored && <NotAppliedBadge />}
            </div>
            <p className="text-xs text-muted-foreground">
              Normalise numbers, dates and English words in mixed-language text
            </p>
          </div>
          <Switch
            id="preprocessing"
            checked={sarvamConfig.enable_preprocessing}
            onCheckedChange={(checked) =>
              setSarvamConfig((prev) => ({ ...prev, enable_preprocessing: checked }))
            }
            disabled={v2OnlyControlsIgnored}
          />
        </div>
      </ConfigSection>
    </>
  )
}

// Audio tags ("[warmly] ...") are understood by the ElevenLabs v3 and v4 families only.
const supportsAudioTags = (model: string) => /^eleven_v[34]/.test(model)

const SUGGESTED_AUDIO_TAGS = [
  'empathetically', 'warmly', 'patiently', 'confidently', 'excitedly', 'enthusiastically',
  'seriously', 'chuckles', 'laughing', 'sighs',
]
const MAX_AUDIO_TAGS = 20

const ExpressiveSettings = ({ config, setConfig }: {
  config: ElevenLabsConfig
  setConfig: React.Dispatch<React.SetStateAction<ElevenLabsConfig>>
}) => {
  const [custom, setCustom] = useState('')
  const tags = config.audioTags
  const setTags = (next: string[]) => setConfig((prev) => ({ ...prev, audioTags: next }))
  const setNote = (tag: string, note: string) =>
    setConfig((prev) => ({ ...prev, audioTagNotes: { ...prev.audioTagNotes, [tag]: note } }))
  const toggle = (tag: string) => setTags(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag].slice(0, MAX_AUDIO_TAGS))
  const addCustom = () => {
    const tag = custom.trim().replaceAll(/^\[|\]$/g, '').toLowerCase()
    if (/^[a-z][a-z '-]{0,30}$/.test(tag) && !tags.includes(tag)) setTags([...tags, tag].slice(0, MAX_AUDIO_TAGS))
    setCustom('')
  }
  const options = [...SUGGESTED_AUDIO_TAGS, ...tags.filter((t) => !SUGGESTED_AUDIO_TAGS.includes(t))]

  return (
    <ConfigSection title="Expressive mode">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="expressive-mode">Let the agent use audio tags</Label>
            <p className="text-xs text-muted-foreground">
              The prompt tells the model to open sentences with tags like [warmly]. They are spoken as delivery, never read aloud, and are hidden from transcripts. SSML pauses do not work on v4.
            </p>
          </div>
          <Switch
            id="expressive-mode"
            checked={config.expressive}
            onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, expressive: checked }))}
          />
        </div>

        {config.expressive && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Suggested audio tags</Label>
              <span className="text-xs text-muted-foreground">{tags.length}/{MAX_AUDIO_TAGS}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {options.map((tag) => (
                <Button
                  key={tag}
                  type="button"
                  size="sm"
                  variant={tags.includes(tag) ? 'default' : 'outline'}
                  className="h-7 text-xs"
                  onClick={() => toggle(tag)}
                >
                  {tags.includes(tag) ? '' : '+ '}{tag}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
                placeholder="Add your own, e.g. whispers"
              />
              <Button type="button" variant="outline" onClick={addCustom}>Add</Button>
            </div>
            {tags.length === 0 && (
              <p className="text-xs text-muted-foreground">No tags picked: the agent uses empathetically, warmly and patiently.</p>
            )}
            {tags.length > 0 && (
              <div className="space-y-2">
                <Label>When to use each tag (optional)</Label>
                {tags.map((tag) => (
                  <div key={tag} className="flex items-center gap-2">
                    <span className="w-32 shrink-0 truncate text-xs font-medium">[{tag}]</span>
                    <Input
                      value={config.audioTagNotes[tag] ?? ''}
                      maxLength={200}
                      onChange={(e) => setNote(tag, e.target.value)}
                      placeholder="e.g. throughout the call"
                    />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Added to the end of the prompt as "- [tag]: when to use it".</p>
              </div>
            )}
          </div>
        )}
      </div>
    </ConfigSection>
  )
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  selectedProvider,
  sarvamConfig,
  setSarvamConfig,
  elevenLabsConfig,
  setElevenLabsConfig,
  googleTTSConfig,
  setGoogleTTSConfig,
  rayaConfig,
  setRayaConfig,
  allowAudioTags = false,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const normalizedProvider = normalizeTtsProvider(selectedProvider)

  return (
    <div className="w-1/2 flex flex-col">
      <div className="p-6 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">
            {providerTitle(normalizedProvider) ?? 'TTS'}{' '}
            Settings
          </h3>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Configure speech synthesis parameters
        </p>
      </div>

      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {/* ───── SARVAM ───── */}
        {normalizedProvider === 'sarvam' && (
          <SarvamSettings sarvamConfig={sarvamConfig} setSarvamConfig={setSarvamConfig} />
        )}

        {/* ───── ELEVENLABS ───── */}
        {normalizedProvider === 'elevenlabs' && (
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
                      {(allowAudioTags || supportsAudioTags(elevenLabsConfig.model)) && (
                        <>
                          <SelectItem value="eleven_v4_turbo">Eleven v4 Turbo (real-time)</SelectItem>
                          <SelectItem value="eleven_v4">Eleven v4</SelectItem>
                        </>
                      )}
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

            {allowAudioTags && supportsAudioTags(elevenLabsConfig.model) && (
              <ExpressiveSettings config={elevenLabsConfig} setConfig={setElevenLabsConfig} />
            )}

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
                    <p className="text-xs text-muted-foreground">How similar to the original voice (0–1)</p>
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
                    <p className="text-xs text-muted-foreground">Voice stability (0–1, higher = more stable)</p>
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
                    <p className="text-xs text-muted-foreground">Voice style variation (0–1)</p>
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
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Slow (0.25×)</span>
                      <span>Fast (4.0×)</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="speaker-boost">Use Speaker Boost</Label>
                      <p className="text-xs text-muted-foreground">Enhance speaker clarity</p>
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

        )}

        {/* ───── RAYA ───── */}
        {normalizedProvider === 'raya' && <RayaSettings config={rayaConfig} setConfig={setRayaConfig} />}

        {/* ───── GOOGLE ───── */}
        {normalizedProvider === 'google' && (
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
              <p className="text-xs text-muted-foreground">
                Select a voice from the list or enter the voice name manually
              </p>
            </div>
          </ConfigSection>
        )}

        {!providerTitle(normalizedProvider) && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <Settings className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto" />
              <h3 className="text-sm font-medium text-foreground">Select a Voice</h3>
              <p className="text-xs text-muted-foreground">
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