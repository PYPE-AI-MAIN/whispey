"use client"

// The {{key}} → value editor for an outbound dispatch's variables — shared by
// the manual dial form (phone-call-config) and the call-logs "Call Again"
// action, so both variable lists look and behave identically.

import React from 'react'
import { Plus, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

export type DispatchVariable = { id: string; key: string; value: string }

// Pulled out of the onChange/onClick handlers below: they were closures nested
// 5 deep (component > map > handler > setVariables callback > inner map/filter).
// These take the array + index as plain params instead, dropping one level.
export function updateVariableAt(variables: DispatchVariable[], index: number, field: 'key' | 'value', value: string): DispatchVariable[] {
  return variables.map((v, j) => (j === index ? { ...v, [field]: value } : v))
}

export function removeVariableAt(variables: DispatchVariable[], index: number): DispatchVariable[] {
  return variables.filter((_, j) => j !== index)
}

export function DispatchVariablesEditor({ variables, setVariables }: Readonly<{
  variables: DispatchVariable[]
  setVariables: React.Dispatch<React.SetStateAction<DispatchVariable[]>>
}>) {
  return (
    <fieldset className="border-0 p-0 m-0">
      <legend className="w-full flex items-center justify-between mb-2 p-0 text-sm font-semibold text-gray-700 dark:text-gray-300">
        <span>Variables <span className="text-xs font-normal text-gray-400">(optional)</span></span>
        <button
          type="button"
          onClick={() => setVariables(prev => [...prev, { id: crypto.randomUUID(), key: '', value: '' }])}
          className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> Add Variable
        </button>
      </legend>
      {variables.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
          No variables. Use <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{'{{key}}'}</code> in your agent prompt.
        </p>
      ) : (
        <div className="space-y-2">
          {variables.map((v, i) => (
            <div key={v.id} className="flex gap-2 items-center">
              <Input
                placeholder="key"
                value={v.key}
                onChange={e => setVariables(prev => updateVariableAt(prev, i, 'key', e.target.value))}
                className="h-8 text-xs font-mono w-[35%] bg-white dark:bg-gray-800"
              />
              <Input
                placeholder="value"
                value={v.value}
                onChange={e => setVariables(prev => updateVariableAt(prev, i, 'value', e.target.value))}
                className="h-8 text-xs flex-1 bg-white dark:bg-gray-800"
              />
              <button
                type="button"
                onClick={() => setVariables(prev => removeVariableAt(prev, i))}
                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </fieldset>
  )
}
