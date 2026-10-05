import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CardDescription } from '@/components/ui/card'
import { Plus, Trash2, Edit2, Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import SelectTTS from '../SelectTTSDialog'
import { Badge } from '@/components/ui/badge'
import { RAYA_PROVIDER, rayaConfigFromTts, rayaTtsPayload } from '@/lib/tts/raya'

interface DynamicTTSConfig {
  tool_name: string
  name: string
  description: string
  voice_id?: string
  language?: string
  model?: string
  voice_settings?: any
  voice_name?: string
  gender?: string
  // All other TTS config fields
  [key: string]: any
}

interface DynamicTTSSwitchProps {
  dynamicTTSList?: DynamicTTSConfig[]
  onDynamicTTSChange?: (dynamicTTSList: DynamicTTSConfig[]) => void
}

type TtsFields = Partial<DynamicTTSConfig>

// Per-provider shape of a saved dynamic-TTS entry. Kept out of the component so adding a
// provider is one function and one map entry rather than another branch in handleSave.
const formatSarvam = (c: TtsFields): TtsFields => {
  // `temperature` is not a valid livekit-plugins-sarvam param. pace/loudness/enable_preprocessing
  // are passed for ALL models; the plugin drops what a model doesn't take.
  const vs = c.voice_settings || {}
  return {
    voice_id: c.voice_id || c.speaker || '',
    speaker: c.speaker || c.voice_id || '',
    model: c.model || 'bulbul:v2',
    language: c.language || 'en-IN',
    ...(c.voice_settings && {
      voice_settings: {
        target_language_code: vs.target_language_code || c.language || 'en-IN',
        pace: Math.min(2.0, Math.max(0.5, vs.pace || vs.speed || 1.0)),
        loudness: Math.min(2.0, Math.max(0.5, vs.loudness || 1.0)),
        enable_preprocessing: vs.enable_preprocessing !== undefined ? vs.enable_preprocessing : false,
      },
    }),
  }
}

const formatElevenLabs = (c: TtsFields): TtsFields => ({
  voice_id: c.voice_id || '',
  model: c.model || 'eleven_multilingual_v2',
  language: c.language || 'en',
  ...(c.voice_settings && {
    voice_settings: {
      similarity_boost: c.voice_settings.similarity_boost || 0.75,
      stability: c.voice_settings.stability || 0.5,
      style: c.voice_settings.style || 0,
      use_speaker_boost: c.voice_settings.use_speaker_boost !== undefined ? c.voice_settings.use_speaker_boost : true,
      speed: c.voice_settings.speed || 1.0,
    },
  }),
})

// Normalised so a stale or hand-edited entry can't ship an unsupported language or rate
const formatRaya = (c: TtsFields): TtsFields => {
  const { name: _name, ...payload } = rayaTtsPayload(c.voice_id || '', c.model, rayaConfigFromTts(c))
  return payload
}

const formatGoogle = (c: TtsFields): TtsFields => ({
  voice_name: c.voice_name || c.voice_id || '',
  ...(c.gender && { gender: c.gender }),
})

// Any other provider: keep whatever fields are set
const formatGeneric = (c: TtsFields): TtsFields => ({
  ...(c.voice_id && { voice_id: c.voice_id }),
  ...(c.language && { language: c.language }),
  ...(c.model && { model: c.model }),
  ...(c.voice_settings && { voice_settings: c.voice_settings }),
  ...(c.voice_name && { voice_name: c.voice_name }),
  ...(c.gender && { gender: c.gender }),
})

const SAVE_FORMATTERS: Record<string, (c: TtsFields) => TtsFields> = {
  sarvam: formatSarvam,
  elevenlabs: formatElevenLabs,
  [RAYA_PROVIDER]: formatRaya,
  google: formatGoogle,
}

// voice_settings to keep on the draft after a pick in the voice dialog
function draftVoiceSettings(provider: string, voiceId: string, model: string | undefined, config: any, prev: any) {
  switch (provider) {
    case RAYA_PROVIDER:
      return rayaTtsPayload(voiceId, model, config).voice_settings
    case 'elevenlabs':
      return {
        similarity_boost: config?.similarityBoost || 0.75,
        stability: config?.stability || 0.5,
        style: config?.style || 0,
        use_speaker_boost: config?.useSpeakerBoost !== undefined ? config.useSpeakerBoost : true,
        speed: config?.speed || 1.0,
      }
    case 'sarvam':
      // SelectTTS sends `pace` (not `speed`); every param is valid for __init__ on all models.
      return {
        target_language_code: config?.target_language_code || config?.language || 'en-IN',
        pace: Math.min(2.0, Math.max(0.5, config?.pace || config?.speed || 1.0)),
        loudness: Math.min(2.0, Math.max(0.5, config?.loudness || 1.0)),
        enable_preprocessing: config?.enable_preprocessing !== undefined ? config.enable_preprocessing : false,
      }
    default:
      return prev
  }
}

const DynamicTTSSwitch: React.FC<Readonly<DynamicTTSSwitchProps>> = ({
  dynamicTTSList = [],
  onDynamicTTSChange
}) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [toolNameError, setToolNameError] = useState<string | null>(null)
  const [currentConfig, setCurrentConfig] = useState<Partial<DynamicTTSConfig>>({
    tool_name: '',
    description: '',
    name: '',
    voice_id: '',
    language: 'en',
    model: ''
  })

  const handleAddNew = () => {
    setCurrentConfig({
      tool_name: '',
      description: '',
      name: '',
      voice_id: '',
      language: 'en',
      model: ''
    })
    setEditingIndex(null)
    setIsAddDialogOpen(true)
  }

  const handleEdit = (index: number) => {
    const config = dynamicTTSList[index]
    // Prepare config for editing - ensure all fields are properly set
    setCurrentConfig({
      ...config,
      tool_name: config.tool_name || '',
      description: config.description || '',
      name: config.name || '',
      voice_id: config.voice_id || config.speaker || config.voice_name || '',
      speaker: config.speaker || config.voice_id || '', // For Sarvam
      voice_name: config.voice_name || config.voice_id || '', // For Google
      language: config.language || 'en',
      model: config.model || '',
      voice_settings: config.voice_settings || {},
      gender: config.gender
    })
    setEditingIndex(index)
    setIsAddDialogOpen(true)
  }

  const handleDelete = (index: number) => {
    const newList = dynamicTTSList.filter((_, i) => i !== index)
    onDynamicTTSChange?.(newList)
  }

  const handleSave = () => {
    if (!currentConfig.tool_name || !currentConfig.description || !currentConfig.name) {
      return
    }
    const name = currentConfig.tool_name
    if (name.length > 30) { setToolNameError('Tool name must be 30 characters or less'); return }
    if (!/^[A-Za-z]\w*$/.test(name)) { setToolNameError('Must be snake_case (letters, digits, underscores, no spaces)'); return }
    const dupe = dynamicTTSList.findIndex((c, i) => i !== editingIndex && c.tool_name === name)
    if (dupe !== -1) { setToolNameError(`"${name}" tool already exists`); return }
    setToolNameError(null)

    // Format the config based on provider type
    const normalizedProvider = currentConfig.name === 'sarvam_tts' ? 'sarvam' : currentConfig.name
    const formatProvider = SAVE_FORMATTERS[normalizedProvider] ?? formatGeneric
    const configToSave: DynamicTTSConfig = {
      tool_name: currentConfig.tool_name,
      description: currentConfig.description,
      name: normalizedProvider,
      ...formatProvider(currentConfig),
    }

    if (editingIndex !== null) {
      // Update existing
      const newList = [...dynamicTTSList]
      newList[editingIndex] = configToSave
      onDynamicTTSChange?.(newList)
    } else {
      // Add new
      onDynamicTTSChange?.([...dynamicTTSList, configToSave])
    }

    setIsAddDialogOpen(false)
    setCurrentConfig({
      tool_name: '',
      description: '',
      name: '',
      voice_id: '',
      language: 'en',
      model: ''
    })
    setEditingIndex(null)
  }

  const handleVoiceSelect = (voiceId: string, provider: string, model?: string, config?: any) => {
    const normalizedProvider = provider === 'sarvam_tts' ? 'sarvam' : provider
    setCurrentConfig(prev => ({
      ...prev,
      name: normalizedProvider,
      voice_id: normalizedProvider === 'google' ? undefined : (voiceId || prev.voice_id),
      speaker: normalizedProvider === 'sarvam' ? (voiceId || prev.speaker) : prev.speaker, // Sarvam uses speaker
      voice_name: normalizedProvider === 'google' ? voiceId : prev.voice_name,
      model: model || prev.model,
      language: config?.language || config?.target_language_code || prev.language,
      voice_settings: draftVoiceSettings(normalizedProvider, voiceId, model, config, prev.voice_settings),
      gender: normalizedProvider === 'google' ? config?.gender : prev.gender
    }))
  }

  const getProviderDisplayName = (name: string) => {
    if (name === 'sarvam' || name === 'sarvam_tts') return 'Sarvam'
    if (name === 'elevenlabs') return 'ElevenLabs'
    if (name === 'google') return 'Google TTS'
    if (name === RAYA_PROVIDER) return 'Raya'
    return name
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex flex-col gap-2">
        <CardDescription className="text-xs text-gray-600 dark:text-gray-400">
          Add TTS providers that can be switched during conversation
        </CardDescription>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddNew}
          className="h-8 px-3 w-full text-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add
        </Button>
      </div>
      <div className="space-y-2">
        {dynamicTTSList.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
            <Sparkles className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p>No dynamic TTS configurations</p>
            <p className="text-xs mt-1">Click "Add" to create a new TTS switch</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dynamicTTSList.map((config, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {config.tool_name}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {getProviderDisplayName(config.name)}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                    {config.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(index)}
                    className="h-7 w-7 p-0"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(index)}
                    className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={(v) => { setIsAddDialogOpen(v); if (!v) setToolNameError(null) }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-gray-100">
                {editingIndex !== null ? 'Edit Dynamic TTS' : 'Add Dynamic TTS'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Tool Name */}
              <div className="space-y-2">
                <Label htmlFor="tool-name" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Tool Name <span className="text-red-500">*</span>
                </Label>
                <input
                  id="tool-name"
                  type="text"
                  value={currentConfig.tool_name || ''}
                  maxLength={30}
                  onChange={(e) => { setCurrentConfig(prev => ({ ...prev, tool_name: e.target.value.replaceAll(/\s/g, '_') })); setToolNameError(null) }}
                  placeholder="e.g., switch_to_hindi"
                  className={`w-full px-3 py-2 text-sm border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 ${toolNameError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                />
                {toolNameError
                  ? <p className="text-xs text-red-500">{toolNameError}</p>
                  : <p className="text-xs text-gray-500 dark:text-gray-400">Unique identifier for this TTS switch (used as tool name)</p>
                }
              </div>

              {/* When to Switch - Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  When to Switch <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="description"
                  value={currentConfig.description || ''}
                  onChange={(e) => setCurrentConfig(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g., Switch to Hindi voice when user speaks in Hindi or requests Hindi"
                  className="min-h-[80px] text-sm resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Describe when the agent should switch to this TTS provider. This will be used as the tool description for the LLM.
                </p>
              </div>

              {/* TTS Configuration */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  TTS Configuration <span className="text-red-500">*</span>
                </Label>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <SelectTTS
                    selectedVoice={currentConfig.voice_id || currentConfig.speaker || currentConfig.voice_name || ''}
                    initialProvider={currentConfig.name}
                    initialModel={currentConfig.model}
                    initialConfig={(() => {
                      // Format config for SelectTTS component
                      if (currentConfig.name === 'sarvam' || currentConfig.name === 'sarvam_tts') {
                        return {
                          target_language_code: currentConfig.voice_settings?.target_language_code || currentConfig.language || 'en-IN',
                          // FIX: pass `pace` (not `speed`) — SelectTTS/SettingsPanel reads `pace`
                          // FIX: `temperature` removed — not a valid livekit-plugins-sarvam 1.4.2 param
                          pace: currentConfig.voice_settings?.pace || currentConfig.voice_settings?.speed || 1.0,
                          loudness: currentConfig.voice_settings?.loudness || 1.0,
                          enable_preprocessing: currentConfig.voice_settings?.enable_preprocessing !== undefined
                            ? currentConfig.voice_settings.enable_preprocessing
                            : false,
                          pitch: currentConfig.voice_settings?.pitch || 0.0,
                        }
                      } else if (currentConfig.name === 'elevenlabs') {
                        return {
                          language: currentConfig.language || 'en',
                          similarityBoost: currentConfig.voice_settings?.similarity_boost || 0.75,
                          stability: currentConfig.voice_settings?.stability || 0.5,
                          style: currentConfig.voice_settings?.style || 0,
                          useSpeakerBoost: currentConfig.voice_settings?.use_speaker_boost !== undefined 
                            ? currentConfig.voice_settings.use_speaker_boost 
                            : true,
                          speed: currentConfig.voice_settings?.speed || 1.0
                        }
                      } else if (currentConfig.name === 'google') {
                        return {
                          voice_name: currentConfig.voice_name || '',
                          gender: currentConfig.gender
                        }
                      } else if (currentConfig.name === RAYA_PROVIDER) {
                        return rayaConfigFromTts(currentConfig)
                      }
                      return currentConfig.voice_settings || currentConfig
                    })()}
                    onVoiceSelect={handleVoiceSelect}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Configure the TTS provider, voice, and settings for this dynamic switch
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!currentConfig.tool_name || !currentConfig.description || !currentConfig.name}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {editingIndex !== null ? 'Update' : 'Add'} TTS Switch
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  )
}

export default DynamicTTSSwitch