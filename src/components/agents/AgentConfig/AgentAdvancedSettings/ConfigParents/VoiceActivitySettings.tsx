'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface VoiceActivitySettingsProps {
  vadProvider: string
  minSilenceDuration: number
  onFieldChange: (field: string, value: any) => void
}

function VoiceActivitySettings({
  vadProvider,
  minSilenceDuration,
  onFieldChange
}: VoiceActivitySettingsProps) {
  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
        Configure voice activity detection settings
      </div>
      
      {/* VAD Provider */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          VAD Provider
        </Label>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
          Voice activity detection service (e.g., silero)
        </div>
        <Select 
          value={vadProvider} 
          onValueChange={(value) => onFieldChange('advancedSettings.vad.vadProvider', value)}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Select VAD provider..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="silero" className="text-xs">Silero</SelectItem>
            <SelectItem value="webrtc" className="text-xs">WebRTC</SelectItem>
            <SelectItem value="deepgram" className="text-xs">Deepgram</SelectItem>
            <SelectItem value="azure" className="text-xs">Azure Speech</SelectItem>
            <SelectItem value="custom" className="text-xs">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Min Silence Duration */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Min Silence Duration (seconds)
        </Label>
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
          How long to wait in silence
        </div>
        <Input
          type="number"
          min="0.1"
          max="5.0"
          step="0.1"
          value={minSilenceDuration}
          onChange={(e) => onFieldChange('advancedSettings.vad.minSilenceDuration', parseFloat(e.target.value) || 0.1)}
          className="h-7 text-xs"
        />
      </div>
    </div>
  )
}

export default VoiceActivitySettings