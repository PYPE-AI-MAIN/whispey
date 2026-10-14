'use client'

import React from 'react'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { PlusIcon, XIcon } from 'lucide-react'

interface BugReportSettingsProps {
  enableBugReport: boolean
  bugStartCommands: string[]
  bugEndCommands: string[]
  initialResponse: string
  collectionPrompt: string
  onFieldChange: (field: string, value: any) => void
}

function BugReportSettings({
  enableBugReport,
  bugStartCommands,
  bugEndCommands,
  initialResponse,
  collectionPrompt,
  onFieldChange
}: BugReportSettingsProps) {

  const addCommand = (type: 'start' | 'end') => {
    const field = type === 'start' ? 
      'advancedSettings.bugs.bugStartCommands' : 
      'advancedSettings.bugs.bugEndCommands'
    
    const currentArray = type === 'start' ? bugStartCommands : bugEndCommands
    onFieldChange(field, [...currentArray, ''])
  }

  const removeCommand = (type: 'start' | 'end', index: number) => {
    const field = type === 'start' ? 
      'advancedSettings.bugs.bugStartCommands' : 
      'advancedSettings.bugs.bugEndCommands'
    
    const currentArray = type === 'start' ? bugStartCommands : bugEndCommands
    const updatedArray = currentArray.filter((_, i) => i !== index)
    onFieldChange(field, updatedArray)
  }

  const updateCommand = (type: 'start' | 'end', index: number, value: string) => {
    const field = type === 'start' ? 
      'advancedSettings.bugs.bugStartCommands' : 
      'advancedSettings.bugs.bugEndCommands'
    
    const currentArray = type === 'start' ? bugStartCommands : bugEndCommands
    const updatedArray = currentArray.map((item, i) => i === index ? value : item)
    onFieldChange(field, updatedArray)
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
        Configure bug reporting functionality for your assistant
      </div>
      
      {/* Enable Bug Report System Toggle */}
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Enable Bug Report System
        </Label>
        <Switch
          checked={enableBugReport}
          onCheckedChange={(checked) => onFieldChange('advancedSettings.bugs.enableBugReport', checked)}
          className="scale-75"
        />
      </div>

      {enableBugReport && (
        <>
          {/* Bug Start Commands */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Bug Start Commands
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addCommand('start')}
                className="h-6 text-xs"
              >
                <PlusIcon className="w-3 h-3 mr-1" />
                Add Command
              </Button>
            </div>
            
            <div className="space-y-2">
              {bugStartCommands.map((command, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={command}
                    onChange={(e) => updateCommand('start', index, e.target.value)}
                    className="h-7 text-xs"
                    placeholder="e.g., report bug, start bug report"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCommand('start', index)}
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <XIcon className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              {bugStartCommands.length === 0 && (
                <div className="text-xs text-gray-400 italic py-2 text-center">
                  No start commands added yet
                </div>
              )}
            </div>
          </div>

          {/* Bug End Commands */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Bug End Commands
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addCommand('end')}
                className="h-6 text-xs"
              >
                <PlusIcon className="w-3 h-3 mr-1" />
                Add Command
              </Button>
            </div>
            
            <div className="space-y-2">
              {bugEndCommands.map((command, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={command}
                    onChange={(e) => updateCommand('end', index, e.target.value)}
                    className="h-7 text-xs"
                    placeholder="e.g., end bug report, stop reporting"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCommand('end', index)}
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <XIcon className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              {bugEndCommands.length === 0 && (
                <div className="text-xs text-gray-400 italic py-2 text-center">
                  No end commands added yet
                </div>
              )}
            </div>
          </div>

          {/* Initial Response */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Initial Response
            </Label>
            <Textarea
              value={initialResponse}
              onChange={(e) => onFieldChange('advancedSettings.bugs.initialResponse', e.target.value)}
              className="text-xs min-h-[60px] resize-none"
              placeholder="What the assistant says when bug reporting starts..."
            />
          </div>

          {/* Collection Prompt */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Collection Prompt
            </Label>
            <Textarea
              value={collectionPrompt}
              onChange={(e) => onFieldChange('advancedSettings.bugs.collectionPrompt', e.target.value)}
              className="text-xs min-h-[60px] resize-none"
              placeholder="Follow-up message to collect additional information..."
            />
          </div>
        </>
      )}
    </div>
  )
}

export default BugReportSettings