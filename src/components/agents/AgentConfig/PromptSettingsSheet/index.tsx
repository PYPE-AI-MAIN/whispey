'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronDownIcon, PlusIcon, SettingsIcon, TrashIcon, VariableIcon, AlertCircleIcon } from 'lucide-react'
import { extractValidVariables } from '@/utils/variableValidator'

interface Variable {
  name: string
  value: string
  description?: string
}

// Predefined system variables that are automatically available
const PREDEFINED_VARIABLES = [
  {
    name: 'wcalling_number',
    description: 'The phone number (if provided)',
    isSystem: true
  },
  {
    name: 'wcurrent_time',
    description: 'Current time (IST)',
    isSystem: true
  },
  {
    name: 'wcurrent_date',
    description: 'Current date in timezone',
    isSystem: true
  },
  {
    name: 'wcontext_dropoff',
    description: 'Context summary for drop-off calls (generated from context drop-off prompt)',
    isSystem: true
  }
] as const

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
  
  // Detect variables in prompt
  const detectedVariables = useMemo(() => {
    return extractValidVariables(prompt)
  }, [prompt])

  // Filter out predefined variables from custom variables - these should NEVER appear in Custom Variables
  const customVariables = useMemo(() => {
    const predefinedNames = new Set<string>(['wcalling_number', 'wcurrent_time', 'wcurrent_date', 'wcontext_dropoff'])
    return variables.filter(v => !predefinedNames.has(v.name.toLowerCase().trim()))
  }, [variables])

  // Remove predefined variables from the variables array if they exist (run whenever variables change or sheet opens)
  useEffect(() => {
    if (!open) return // Only clean when sheet is open
    
    const predefinedNames = new Set<string>(['wcalling_number', 'wcurrent_time', 'wcurrent_date', 'wcontext_dropoff'])
    const filteredVariables = variables.filter(v => !predefinedNames.has(v.name.toLowerCase().trim()))
    
    if (filteredVariables.length !== variables.length) {
      onVariablesChange(filteredVariables)
    }
  }, [variables, onVariablesChange, open])

  // Find unmapped variables (excluding predefined system variables)
  // IMPORTANT: Predefined variables should NEVER appear as unmapped
  const unmappedVariables = useMemo(() => {
    // Get predefined variable names from the constant (case-insensitive comparison)
    const predefinedNamesSet = new Set<string>(
      PREDEFINED_VARIABLES.map(v => v.name.toLowerCase().trim())
    )
    
    const existingNames = new Set(variables.map(v => v.name.toLowerCase().trim()))
    
    const filtered = detectedVariables.filter(name => {
      // Normalize the detected variable name
      const normalized = String(name || '').toLowerCase().trim()
      
      // Skip empty or invalid names
      if (!normalized) return false
      
      // ALWAYS exclude predefined system variables - they should never be unmapped
      // Check against both the constant and hardcoded list for safety
      if (predefinedNamesSet.has(normalized) || 
          normalized === 'wcalling_number' || 
          normalized === 'wcurrent_time' || 
          normalized === 'wcurrent_date' ||
          normalized === 'wcontext_dropoff') {
        return false
      }
      
      // Exclude if already exists in variables array
      if (existingNames.has(normalized)) {
        return false
      }
      
      // Only include if it's not predefined and not already mapped
      return true
    })
    
    return filtered
  }, [detectedVariables, variables])

  const addVariable = (name?: string) => {
    const predefinedNames = new Set(PREDEFINED_VARIABLES.map(v => v.name.toLowerCase()) as string[])
    const variableName = name || `variable_${variables.length + 1}`
    
    // Don't allow adding predefined variables
    if (predefinedNames.has(variableName.toLowerCase())) {
      return
    }
    
    const newVariable: Variable = {
      name: variableName,
      value: '',
      description: ''
    }
    onVariablesChange([...variables, newVariable])
  }

  const addAllUnmapped = () => {
    const newVariables = unmappedVariables.map(name => ({
      name,
      value: '',
      description: ''
    }))
    onVariablesChange([...variables, ...newVariables])
  }

  const updateVariable = (index: number, field: keyof Variable, value: string) => {
    const predefinedNames = new Set(PREDEFINED_VARIABLES.map(v => v.name.toLowerCase()) as string[])
    const variableToUpdate = customVariables[index]
    
    // Don't allow editing predefined variables
    if (predefinedNames.has(variableToUpdate.name.toLowerCase())) {
      return
    }
    
    // Find the actual index in the full variables array
    const actualIndex = variables.findIndex(v => v.name === variableToUpdate.name)
    if (actualIndex === -1) return
    
    const updatedVariables = variables.map((variable, i) => 
      i === actualIndex ? { ...variable, [field]: value } : variable
    )
    onVariablesChange(updatedVariables)
  }

  const removeVariable = (index: number) => {
    const predefinedNames = new Set(PREDEFINED_VARIABLES.map(v => v.name.toLowerCase()) as string[])
    const variableToRemove = customVariables[index]
    
    // Don't allow removing predefined variables
    if (predefinedNames.has(variableToRemove.name.toLowerCase())) {
      return
    }
    
    const updatedVariables = variables.filter(v => v.name !== variableToRemove.name)
    onVariablesChange(updatedVariables)
    
    // Remove variable references from prompt
    const updatedPrompt = prompt.replace(new RegExp(`\\{\\{${variableToRemove.name}\\}\\}`, 'g'), '')
    onPromptChange(updatedPrompt)
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
            Configure variables detected in your prompt
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Unmapped Variables Warning */}
          {unmappedVariables.length > 0 && (
            <div 
              className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              onClick={addAllUnmapped}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1">
                  <AlertCircleIcon className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-red-800 dark:text-red-200">
                    <p className="font-medium mb-1">{unmappedVariables.length} unmapped variable{unmappedVariables.length > 1 ? 's' : ''} - click to configure</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {unmappedVariables.map(name => (
                        <code key={name} className="bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded text-red-900 dark:text-red-200">
                          {name}
                        </code>
                      ))}
                    </div>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation()
                    addAllUnmapped()
                  }}
                  className="h-7 text-xs flex-shrink-0 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30"
                >
                  Map All
                </Button>
              </div>
            </div>
          )}

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
              {/* Predefined System Variables */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Predefined System Variables</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">(Automatically available)</span>
                </div>
                <div className="space-y-2">
                  {PREDEFINED_VARIABLES.map((predefinedVar) => (
                    <div 
                      key={predefinedVar.name} 
                      className="border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded text-blue-900 dark:text-blue-200">
                          {`{{${predefinedVar.name}}}`}
                        </code>
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {predefinedVar.description}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* User Variables */}
              <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Custom Variables</span>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => addVariable()}
                    className="flex items-center gap-1 text-xs"
                  >
                    <PlusIcon className="w-3 h-3" />
                    Add Variable
                  </Button>
                  
                  {customVariables.length > 0 && customVariables.some(v => v.value) && (
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
                  {customVariables.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                      <VariableIcon className="w-6 h-6 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">No custom variables mapped</p>
                      <p className="text-[10px] mt-1">Use <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{`{{variable_name}}`}</code> in your prompt</p>
                    </div>
                  ) : (
                    customVariables.map((variable, index) => (
                      <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
                        <div className="flex w-full items-center justify-center gap-1">
                          <div className="flex-1 w-1/2 space-y-1">
                            <Input
                              value={variable.name}
                              placeholder="variable_name"
                              onChange={(e) => {
                                let value = e.target.value
                                
                                // Replace spaces with underscores
                                value = value.replace(/\s/g, '_')
                                
                                // Only allow alphanumeric and underscores
                                value = value.replace(/[^a-zA-Z0-9_]/g, '')
                                
                                // Convert to lowercase
                                value = value.toLowerCase()
                                
                                // Max 32 characters
                                value = value.slice(0, 16)
                                
                                updateVariable(index, 'name', value)
                              }}
                              className={`h-8 text-xs ${
                                variable.name && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable.name)
                                  ? 'border-red-300 dark:border-red-700'
                                  : ''
                              }`}
                            />
                            {variable.name && /^\d/.test(variable.name) && (
                              <p className="text-[10px] text-red-600 dark:text-red-400">
                                Cannot start with a number
                              </p>
                            )}
                          </div>
                          <div className="w-1/2">
                            <Input
                              value={variable.value}
                              onChange={(e) => updateVariable(index, 'value', e.target.value)}
                              className="h-8 text-xs"
                              placeholder="Default value"
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
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </SheetContent>
    </Sheet>
  )
}