// components/agents/AgentConfig/ConfigParents/BackgroundAudioSettings.tsx
import React from 'react'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Volume2, VolumeX } from 'lucide-react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'


interface BackgroundAudioSettingsProps {
  mode: 'disabled' | 'single' | 'dual'
  singleType: string
  singleVolume: number
  singleTiming: 'thinking' | 'always'
  ambientType: string
  ambientVolume: number
  thinkingType: string
  thinkingVolume: number
  onFieldChange: (field: string, value: any) => void
}

const audioTypes = [
  { value: 'keyboard', label: 'Keyboard Typing' },
  { value: 'office', label: 'Office Ambience' },
]

export default function BackgroundAudioSettings({
  mode,
  singleType,
  singleVolume,
  singleTiming,
  ambientType,
  ambientVolume,
  thinkingType,
  thinkingVolume,
  onFieldChange
}: BackgroundAudioSettingsProps) {
  return (
    <div className="space-y-4">
      {/* Mode Selection */}
      <div className="space-y-3">
        <Label className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Background Audio Mode
        </Label>
        <RadioGroup 
          value={mode} 
          onValueChange={(value: 'disabled' | 'single' | 'dual') => onFieldChange('advancedSettings.backgroundAudio.mode', value)}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="disabled" id="bg-disabled" />
            <Label htmlFor="bg-disabled" className="text-sm cursor-pointer">
              Disabled
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="single" id="bg-single" />
            <Label htmlFor="bg-single" className="text-sm cursor-pointer">
              Single Audio (Legacy)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="dual" id="bg-dual" />
            <Label htmlFor="bg-dual" className="text-sm cursor-pointer">
              Dual Audio (Ambient + Thinking)
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Single Audio Settings */}
      {mode === 'single' && (
        <div className="space-y-4 ml-6">
          <div className="space-y-2">
            <Label className="text-xs text-gray-600 dark:text-gray-400">Audio Type</Label>
            <Select 
              value={singleType}
              onValueChange={(value) => onFieldChange('advancedSettings.backgroundAudio.singleType', value)}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {audioTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value} className="text-sm">
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-gray-600 dark:text-gray-400">Volume</Label>
              <span className="text-xs text-gray-500">{singleVolume}%</span>
            </div>
            <div className="flex items-center gap-2">
              <VolumeX className="w-3 h-3 text-gray-400" />
              <Slider
                value={[singleVolume]}
                onValueChange={(value) => onFieldChange('advancedSettings.backgroundAudio.singleVolume', value[0])}
                max={100}
                min={0}
                step={5}
                className="flex-1"
              />
              <Volume2 className="w-3 h-3 text-gray-400" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-gray-600 dark:text-gray-400">Play Timing</Label>
            <RadioGroup 
              value={singleTiming}
              onValueChange={(value: 'thinking' | 'always') => onFieldChange('advancedSettings.backgroundAudio.singleTiming', value)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="thinking" id="timing-thinking" />
                <Label htmlFor="timing-thinking" className="text-sm cursor-pointer">
                  During thinking only
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="always" id="timing-always" />
                <Label htmlFor="timing-always" className="text-sm cursor-pointer">
                  Always playing
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      )}

      {/* Dual Audio Settings */}
      {mode === 'dual' && (
        <div className="space-y-4 ml-6">
          {/* Ambient Audio */}
          <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">Ambient Audio</h4>
            
            <div className="space-y-2">
              <Label className="text-xs text-gray-600 dark:text-gray-400">Type</Label>
              <Select 
                value={ambientType}
                onValueChange={(value) => onFieldChange('advancedSettings.backgroundAudio.ambientType', value)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {audioTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value} className="text-sm">
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-600 dark:text-gray-400">Volume</Label>
                <span className="text-xs text-gray-500">{ambientVolume}%</span>
              </div>
              <div className="flex items-center gap-2">
                <VolumeX className="w-3 h-3 text-gray-400" />
                <Slider
                  value={[ambientVolume]}
                  onValueChange={(value) => onFieldChange('advancedSettings.backgroundAudio.ambientVolume', value[0])}
                  max={100}
                  min={0}
                  step={5}
                  className="flex-1"
                />
                <Volume2 className="w-3 h-3 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Thinking Audio */}
          <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">Thinking Audio</h4>
            
            <div className="space-y-2">
              <Label className="text-xs text-gray-600 dark:text-gray-400">Type</Label>
              <Select 
                value={thinkingType}
                onValueChange={(value) => onFieldChange('advancedSettings.backgroundAudio.thinkingType', value)}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {audioTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value} className="text-sm">
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-600 dark:text-gray-400">Volume</Label>
                <span className="text-xs text-gray-500">{thinkingVolume}%</span>
              </div>
              <div className="flex items-center gap-2">
                <VolumeX className="w-3 h-3 text-gray-400" />
                <Slider
                  value={[thinkingVolume]}
                  onValueChange={(value) => onFieldChange('advancedSettings.backgroundAudio.thinkingVolume', value[0])}
                  max={100}
                  min={0}
                  step={5}
                  className="flex-1"
                />
                <Volume2 className="w-3 h-3 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}