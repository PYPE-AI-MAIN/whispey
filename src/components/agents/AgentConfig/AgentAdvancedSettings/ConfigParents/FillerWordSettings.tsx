'use client'

import React from 'react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { PlusIcon, XIcon } from 'lucide-react'

interface FillerWordsSettingsProps {
  enableFillerWords: boolean
  generalFillers: string[]
  conversationFillers: string[]
  conversationKeywords: string[]
  onFieldChange: (field: string, value: any) => void
}

function FillerWordsSettings({
  enableFillerWords,
  generalFillers,
  conversationFillers,
  conversationKeywords,
  onFieldChange
}: FillerWordsSettingsProps) {

  const addFiller = (category: 'general' | 'conversation' | 'keywords') => {
    const fieldMap = {
      general: 'advancedSettings.fillers.generalFillers',
      conversation: 'advancedSettings.fillers.conversationFillers',
      keywords: 'advancedSettings.fillers.conversationKeywords'
    }
    
    const currentArray = category === 'general' ? generalFillers : 
                        category === 'conversation' ? conversationFillers : 
                        conversationKeywords
    
    onFieldChange(fieldMap[category], [...currentArray, ''])
  }

  const removeFiller = (category: 'general' | 'conversation' | 'keywords', index: number) => {
    const fieldMap = {
      general: 'advancedSettings.fillers.generalFillers',
      conversation: 'advancedSettings.fillers.conversationFillers',
      keywords: 'advancedSettings.fillers.conversationKeywords'
    }
    
    const currentArray = category === 'general' ? generalFillers : 
                        category === 'conversation' ? conversationFillers : 
                        conversationKeywords
    
    const updatedArray = currentArray.filter((_, i) => i !== index)
    onFieldChange(fieldMap[category], updatedArray)
  }

  const updateFiller = (category: 'general' | 'conversation' | 'keywords', index: number, value: string) => {
    const fieldMap = {
      general: 'advancedSettings.fillers.generalFillers',
      conversation: 'advancedSettings.fillers.conversationFillers',
      keywords: 'advancedSettings.fillers.conversationKeywords'
    }
    
    const currentArray = category === 'general' ? generalFillers : 
                        category === 'conversation' ? conversationFillers : 
                        conversationKeywords
    
    const updatedArray = currentArray.map((item, i) => i === index ? value : item)
    onFieldChange(fieldMap[category], updatedArray)
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
        Configure natural speech patterns for your assistant
      </div>
      
      {/* Enable Filler Words Toggle */}
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Enable Filler Words
        </Label>
        <Switch
          checked={enableFillerWords}
          onCheckedChange={(checked) => onFieldChange('advancedSettings.fillers.enableFillerWords', checked)}
          className="scale-75"
        />
      </div>

      {enableFillerWords && (
        <>
          {/* General Fillers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  General Fillers
                </Label>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Words like "um", "uh", "you know" for natural speech
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addFiller('general')}
                className="h-6 text-xs"
              >
                <PlusIcon className="w-3 h-3 mr-1" />
                Add Filler
              </Button>
            </div>
            
            <div className="space-y-2">
              {generalFillers.map((filler, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={filler}
                    onChange={(e) => updateFiller('general', index, e.target.value)}
                    className="h-7 text-xs"
                    placeholder="e.g., uhm, okay, you know"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFiller('general', index)}
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <XIcon className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              {generalFillers.length === 0 && (
                <div className="text-xs text-gray-400 italic py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded text-center">
                  No general fillers added yet
                </div>
              )}
            </div>
          </div>

          {/* Conversation Fillers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Conversation Fillers
                </Label>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Phrases used during transitions or thinking
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addFiller('conversation')}
                className="h-6 text-xs"
              >
                <PlusIcon className="w-3 h-3 mr-1" />
                Add Filler
              </Button>
            </div>
            
            <div className="space-y-2">
              {conversationFillers.map((filler, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={filler}
                    onChange={(e) => updateFiller('conversation', index, e.target.value)}
                    className="h-7 text-xs"
                    placeholder="e.g., Let me think about that, Just a moment"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFiller('conversation', index)}
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <XIcon className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              {conversationFillers.length === 0 && (
                <div className="text-xs text-gray-400 italic py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded text-center">
                  No conversation fillers added yet
                </div>
              )}
            </div>
          </div>

          {/* Conversation Keywords */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Conversation Keywords
                </Label>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Keywords that trigger specific responses
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addFiller('keywords')}
                className="h-6 text-xs"
              >
                <PlusIcon className="w-3 h-3 mr-1" />
                Add Keyword
              </Button>
            </div>
            
            <div className="space-y-2">
              {conversationKeywords.map((keyword, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={keyword}
                    onChange={(e) => updateFiller('keywords', index, e.target.value)}
                    className="h-7 text-xs"
                    placeholder="e.g., please talk to them, transfer me"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFiller('keywords', index)}
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <XIcon className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              {conversationKeywords.length === 0 && (
                <div className="text-xs text-gray-400 italic py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded text-center">
                  No conversation keywords added yet
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default FillerWordsSettings