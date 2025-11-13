'use client'

import React from 'react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { PlusIcon, XIcon, InfoIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

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
              <div className="flex items-center gap-1.5">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Fillers
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <InfoIcon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="text-xs">Words like "um", "uh", "you know" for natural speech. These will be inserted randomly, after each user conversation turn ends.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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

        </>
      )}
    </div>
  )
}

export default FillerWordsSettings