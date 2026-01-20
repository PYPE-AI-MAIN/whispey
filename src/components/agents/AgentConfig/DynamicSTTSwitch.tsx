// DynamicSTTSwitch.tsx - Component for configuring dynamic STT switching
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

interface DynamicSTTConfig {
  id: string
  name: string // STT provider (sarvam, deepgram, assemblyai)
  tool_name: string // Unique tool name (e.g., "switch_to_saarika")
  description: string // When to use this STT
  language: string // Language code (e.g., "hi-IN", "en-US")
  model: string // Model name (e.g., "saarika:v2.5", "saaras:v2.5")
}

interface DynamicSTTSwitchProps {
  dynamicSTTList: DynamicSTTConfig[]
  onDynamicSTTChange: (dynamicSTTList: DynamicSTTConfig[]) => void
}

// STT Models for each provider
const STT_MODELS = {
  sarvam: [
    { value: 'saarika:v2.5', label: 'Saarika v2.5 (Same-language, code-mixing)' },
    { value: 'saaras:v2.5', label: 'Saaras v2.5 (Speech→English translation)' },
  ],
  deepgram: [
    { value: 'nova-2', label: 'Nova-2 (Fast, accurate)' },
    { value: 'nova-3', label: 'Nova-3 (Latest, multilingual)' },
    { value: 'enhanced', label: 'Enhanced (High accuracy)' },
  ],
  assemblyai: [
    { value: 'best', label: 'Best (Highest accuracy)' },
    { value: 'nano', label: 'Nano (Ultra-fast)' },
  ],
}

// Language codes for each provider
const LANGUAGES = {
  sarvam: [
    { value: 'hi-IN', label: 'Hindi (hi-IN)' },
    { value: 'en-IN', label: 'English India (en-IN)' },
    { value: 'bn-IN', label: 'Bengali (bn-IN)' },
    { value: 'ta-IN', label: 'Tamil (ta-IN)' },
    { value: 'te-IN', label: 'Telugu (te-IN)' },
    { value: 'gu-IN', label: 'Gujarati (gu-IN)' },
    { value: 'kn-IN', label: 'Kannada (kn-IN)' },
    { value: 'ml-IN', label: 'Malayalam (ml-IN)' },
    { value: 'mr-IN', label: 'Marathi (mr-IN)' },
    { value: 'pa-IN', label: 'Punjabi (pa-IN)' },
    { value: 'or-IN', label: 'Odia (or-IN)' },
  ],
  deepgram: [
    { value: 'en-US', label: 'English US (en-US)' },
    { value: 'en-GB', label: 'English UK (en-GB)' },
    { value: 'en-IN', label: 'English India (en-IN)' },
    { value: 'es', label: 'Spanish (es)' },
    { value: 'fr', label: 'French (fr)' },
    { value: 'de', label: 'German (de)' },
    { value: 'multi', label: 'Multi-language (auto-detect)' },
  ],
  assemblyai: [
    { value: 'en', label: 'English (en)' },
    { value: 'es', label: 'Spanish (es)' },
    { value: 'fr', label: 'French (fr)' },
  ],
}

export default function DynamicSTTSwitch({ dynamicSTTList, onDynamicSTTChange }: DynamicSTTSwitchProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const handleAddSTT = () => {
    const newSTT: DynamicSTTConfig = {
      id: `stt_${Date.now()}`,
      name: 'sarvam',
      tool_name: '',
      description: '',
      language: 'hi-IN',
      model: 'saarika:v2.5',
    }
    onDynamicSTTChange([...dynamicSTTList, newSTT])
    setEditingIndex(dynamicSTTList.length)
  }

  const handleRemoveSTT = (index: number) => {
    const updated = dynamicSTTList.filter((_, i) => i !== index)
    onDynamicSTTChange(updated)
    if (editingIndex === index) setEditingIndex(null)
  }

  const handleUpdateSTT = (index: number, field: keyof DynamicSTTConfig, value: string) => {
    const updated = [...dynamicSTTList]
    updated[index] = { ...updated[index], [field]: value }
    
    // If provider changes, reset language and model to defaults
    if (field === 'name') {
      updated[index].language = LANGUAGES[value as keyof typeof LANGUAGES]?.[0]?.value || 'en-US'
      updated[index].model = STT_MODELS[value as keyof typeof STT_MODELS]?.[0]?.value || 'nova-2'
    }
    
    // If model changes to Saaras, set language to auto-detect placeholder
    if (field === 'model' && value === 'saaras:v2.5') {
      updated[index].language = 'auto' // Saaras auto-detects language
    }
    
    onDynamicSTTChange(updated)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Dynamic STT Switching</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Add multiple STT configurations to switch between during conversation
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddSTT}
          className="h-7 text-xs"
        >
          <PlusIcon className="w-3 h-3 mr-1" />
          Add STT
        </Button>
      </div>

      {dynamicSTTList.length === 0 ? (
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-900 rounded border border-dashed">
          No dynamic STT configurations. Click "Add STT" to create one.
        </div>
      ) : (
        <div className="space-y-2">
          {dynamicSTTList.map((stt, index) => (
            <div
              key={stt.id}
              className="p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  STT Config #{index + 1}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingIndex(editingIndex === index ? null : index)}
                    className="h-6 px-2 text-xs"
                  >
                    {editingIndex === index ? 'Collapse' : 'Edit'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveSTT(index)}
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                  >
                    <TrashIcon className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {editingIndex === index && (
                <div className="space-y-2 mt-3">
                  {/* Tool Name */}
                  <div>
                    <Label className="text-xs text-gray-700 dark:text-gray-300">
                      Tool Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      value={stt.tool_name}
                      onChange={(e) => handleUpdateSTT(index, 'tool_name', e.target.value)}
                      className="h-7 text-xs mt-1"
                      placeholder="e.g., switch_to_hindi_stt"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Unique identifier for this STT configuration
                    </p>
                  </div>

                  {/* Provider */}
                  <div>
                    <Label className="text-xs text-gray-700 dark:text-gray-300">Provider</Label>
                    <Select
                      value={stt.name}
                      onValueChange={(value) => handleUpdateSTT(index, 'name', value)}
                    >
                      <SelectTrigger className="h-7 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        <SelectItem value="sarvam">Sarvam AI</SelectItem>
                        <SelectItem value="deepgram">Deepgram</SelectItem>
                        <SelectItem value="assemblyai">AssemblyAI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Language - Only show for models that need it (not Saaras) */}
                  {stt.model !== 'saaras:v2.5' && (
                    <div>
                      <Label className="text-xs text-gray-700 dark:text-gray-300">Language</Label>
                      <Select
                        value={stt.language}
                        onValueChange={(value) => handleUpdateSTT(index, 'language', value)}
                      >
                        <SelectTrigger className="h-7 text-xs mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="max-h-[300px] overflow-y-auto">
                          {LANGUAGES[stt.name as keyof typeof LANGUAGES]?.map((lang) => (
                            <SelectItem key={lang.value} value={lang.value}>
                              {lang.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {/* Show auto-detect message for Saaras */}
                  {stt.model === 'saaras:v2.5' && (
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        🌐 <strong>Auto-detects language:</strong> Saaras automatically detects the input language and translates to English
                      </p>
                    </div>
                  )}

                  {/* Model */}
                  <div>
                    <Label className="text-xs text-gray-700 dark:text-gray-300">Model</Label>
                    <Select
                      value={stt.model}
                      onValueChange={(value) => handleUpdateSTT(index, 'model', value)}
                    >
                      <SelectTrigger className="h-7 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4} className="max-h-[300px] overflow-y-auto">
                        {STT_MODELS[stt.name as keyof typeof STT_MODELS]?.map((model) => (
                          <SelectItem key={model.value} value={model.value}>
                            {model.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Description */}
                  <div>
                    <Label className="text-xs text-gray-700 dark:text-gray-300">
                      Description <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      value={stt.description}
                      onChange={(e) => handleUpdateSTT(index, 'description', e.target.value)}
                      className="text-xs mt-1 min-h-[60px]"
                      placeholder="e.g., Switch to Hindi speech recognition when user speaks Hindi"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      When should the agent use this STT?
                      {stt.model === 'saaras:v2.5' && (
                        <span className="block mt-1 text-blue-600 dark:text-blue-400">
                          💡 Saaras translates speech to English (great for multilingual support)
                        </span>
                      )}
                      {stt.model === 'saarika:v2.5' && (
                        <span className="block mt-1 text-green-600 dark:text-green-400">
                          💡 Saarika transcribes in the same language (supports code-mixing)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {editingIndex !== index && (
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  <div><strong>Tool:</strong> {stt.tool_name || <span className="text-red-500">Not set</span>}</div>
                  <div><strong>Provider:</strong> {stt.name}</div>
                  <div><strong>Model:</strong> {stt.model} ({stt.language})</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
