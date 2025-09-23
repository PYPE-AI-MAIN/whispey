'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { ChevronDownIcon, PlusIcon, SettingsIcon, TrashIcon, TypeIcon, VariableIcon } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { usePromptSettings } from '@/hooks/usePromptSettings'

interface Variable {
  name: string
  value: string
  description?: string
}

interface PromptSettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prompt: string
  onPromptChange: (prompt: string) => void
  variables?: Variable[]
  onVariablesChange: (variables: Variable[]) => void
}

export default function PromptSettingsSheet({ 
  open, 
  onOpenChange, 
  prompt, 
  onPromptChange,
  variables = [],
  onVariablesChange
}: PromptSettingsSheetProps) {
  const [isVariablesOpen, setIsVariablesOpen] = useState(true)
  const [isDisplayOpen, setIsDisplayOpen] = useState(false)
  const [lastPrompt, setLastPrompt] = useState(prompt)
  
  // Use the custom hook for settings
  const { settings, setFontSize, setFontFamily } = usePromptSettings()
  
  // Auto-detect variables from prompt
  const detectedVariables = useMemo(() => {
    const matches = prompt.match(/\{\{([^}]+)\}\}/g) || []
    const variableNames = matches.map(match => match.replace(/[{}]/g, ''))
    return [...new Set(variableNames)]
  }, [prompt])

  // Memoize the callback to prevent unnecessary re-renders
  const handleVariablesChange = useCallback((newVariables: Variable[]) => {
    onVariablesChange(newVariables)
  }, [onVariablesChange])

  useEffect(() => {
    // Only run if prompt actually changed
    if (prompt !== lastPrompt) {
      setLastPrompt(prompt)
      
      const existingVariableNames = variables.map(v => v.name)
      const newVariables = detectedVariables.filter(name => !existingVariableNames.includes(name))
      
      if (newVariables.length > 0) {
        const updatedVariables = [
          ...variables,
          ...newVariables.map(name => ({ name, value: '', description: '' }))
        ]
        handleVariablesChange(updatedVariables)
      }
    }
  }, [prompt, detectedVariables, variables, handleVariablesChange, lastPrompt])

  const addVariable = () => {
    console.log('Adding new variable')
    const newVariable: Variable = {
      name: `variable_${variables.length + 1}`,
      value: '',
      description: ''
    }
    handleVariablesChange([...variables, newVariable])
  }

  const updateVariable = (index: number, field: keyof Variable, value: string) => {
    const updatedVariables = variables.map((variable, i) => 
      i === index ? { ...variable, [field]: value } : variable
    )
    handleVariablesChange(updatedVariables)
  }

  const removeVariable = (index: number) => {
    const variableToRemove = variables[index]
    const updatedVariables = variables.filter((_, i) => i !== index)
    handleVariablesChange(updatedVariables)
    
    // Remove variable references from prompt
    const updatedPrompt = prompt.replace(new RegExp(`\\{\\{${variableToRemove.name}\\}\\}`, 'g'), '')
    onPromptChange(updatedPrompt)
  }

  const insertVariableIntoPrompt = (variableName: string) => {
    const variableReference = `{{${variableName}}}`
    onPromptChange(prompt + variableReference)
  }

  const replaceVariablesInPrompt = () => {
    let updatedPrompt = prompt
    variables.forEach(variable => {
      if (variable.value) {
        const regex = new RegExp(`\\{\\{${variable.name}\\}\\}`, 'g')
        updatedPrompt = updatedPrompt.replace(regex, variable.value)
      }
    })
    onPromptChange(updatedPrompt)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[650px] p-6 sm:max-w-[500px] overflow-y-auto bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" />
            Prompt Settings
          </SheetTitle>
          <SheetDescription>
            Configure variables
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Variables Section */}
          <Collapsible open={isVariablesOpen} onOpenChange={setIsVariablesOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <div className="flex items-center gap-2">
                <VariableIcon className="w-4 h-4" />
                <span className="font-medium">Variables</span>
                {variables.length > 0 && (
                  <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-0.5 rounded-full">
                    {variables.length}
                  </span>
                )}
              </div>
              <ChevronDownIcon className={`w-4 h-4 transition-transform ${isVariablesOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            
            
            <CollapsibleContent className="space-y-4 mt-4">
              <div className="flex gap-2 mt-2">
                  <Button 
                    variant="outline" 
                    onClick={addVariable}
                    className="flex items-center gap-1 text-xs"
                  >
                    <PlusIcon className="w-3 h-3" />
                    Add Variable
                  </Button>
                  
                  {variables.length > 0 && variables.some(v => v.value) && (
                    <Button 
                      variant="secondary" 
                      onClick={replaceVariablesInPrompt}
                      className="text-xs"
                    >
                      Replace Variables in Prompt
                    </Button>
                  )}
                </div>
              <div className="space-y-3">
                {variables.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <VariableIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No variables defined</p>
                    <p className="text-xs">Use <code>{`{{variable_name}}`}</code> in your prompt to reference variables</p>
                  </div>
                ) : (
                  variables.map((variable, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
                      <div className="flex w-full items-center justify-center gap-1">
                        <div className="flex-1 w-1/2">
                          <Input
                            value={variable.name}
                            placeholder="variable_name"
                            onChange={(e) => updateVariable(index, 'name', e.target.value)}
                            className="h-8 text-xs mt-1"
                          />
                        </div>
                        <div className="w-1/2">
                          <Input
                            value={variable.value}
                            onChange={(e) => updateVariable(index, 'value', e.target.value)}
                            className="h-8 text-xs mt-1"
                            placeholder={`Value to replace`}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeVariable(index)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 flex justify-center items-center"
                        >
                          <TrashIcon className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </SheetContent>
    </Sheet>
  )
}