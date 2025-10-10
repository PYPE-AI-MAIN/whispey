// components/agents/AgentConfig/ConfigParents/BackgroundAudioSettings.tsx
import React from 'react'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  const [localSingleVolume, setLocalSingleVolume] = React.useState(singleVolume.toString())
  const [localAmbientVolume, setLocalAmbientVolume] = React.useState(ambientVolume.toString())
  const [localThinkingVolume, setLocalThinkingVolume] = React.useState(thinkingVolume.toString())

  const handleVolumeChange = (field: string, value: string, setter: (v: string) => void) => {
    setter(value)
    if (value === '') {
      return
    }
    const numValue = parseFloat(value)
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
      onFieldChange(field, numValue)
    }
  }
  
  const handleVolumeBlur = (field: string, value: string, setter: (v: string) => void) => {
    if (value === '') {
      onFieldChange(field, 0)
      setter('0')
      return
    }
    const numValue = parseFloat(value)
    if (isNaN(numValue) || numValue < 0) {
      onFieldChange(field, 0)
      setter('0')
    } else if (numValue > 100) {
      onFieldChange(field, 100)
      setter('100')
    }
  }

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
            <Label className="text-xs text-gray-600 dark:text-gray-400">
              Volume (0-100)
            </Label>
            <Input
              type="number"
              value={localSingleVolume}
              onChange={(e) => handleVolumeChange('advancedSettings.backgroundAudio.singleVolume', e.target.value, setLocalSingleVolume)}
              onBlur={(e) => handleVolumeBlur('advancedSettings.backgroundAudio.singleVolume', e.target.value, setLocalSingleVolume)}
              min={0}
              max={100}
              step={0.1}
              className="h-8"
            />
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
              <Label className="text-xs text-gray-600 dark:text-gray-400">
                Volume (0-100)
              </Label>
              <Input
                type="number"
                value={localAmbientVolume}
                onChange={(e) => handleVolumeChange('advancedSettings.backgroundAudio.ambientVolume', e.target.value, setLocalAmbientVolume)}
                onBlur={(e) => handleVolumeBlur('advancedSettings.backgroundAudio.ambientVolume', e.target.value, setLocalAmbientVolume)}
                min={0}
                max={100}
                step={0.1}
                className="h-8"
              />
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
              <Label className="text-xs text-gray-600 dark:text-gray-400">
                Volume (0-100)
              </Label>
              <Input
                type="number"
                value={localThinkingVolume}
                onChange={(e) => handleVolumeChange('advancedSettings.backgroundAudio.thinkingVolume', e.target.value, setLocalThinkingVolume)}
                onBlur={(e) => handleVolumeBlur('advancedSettings.backgroundAudio.thinkingVolume', e.target.value, setLocalThinkingVolume)}
                min={0}
                max={100}
                step={0.1}
                className="h-8"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}