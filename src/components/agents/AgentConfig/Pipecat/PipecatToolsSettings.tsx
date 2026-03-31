'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, Plus, Trash2, WrenchIcon } from 'lucide-react'

interface CustomTool {
  name: string
  description: string
  url: string
  method: string
  parameters: Record<string, any>
  headers: Record<string, string>
}

interface PipecatToolsSettingsProps {
  tools: string[]
  customTools: CustomTool[]
  onToolsChange: (tools: string[]) => void
  onCustomToolsChange: (customTools: CustomTool[]) => void
}

const BUILTIN_TOOLS = ['end_call', 'transfer_call']

export default function PipecatToolsSettings({
  tools,
  customTools,
  onToolsChange,
  onCustomToolsChange
}: PipecatToolsSettingsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [expandedTool, setExpandedTool] = useState<number | null>(null)

  const toggleBuiltinTool = (tool: string) => {
    if (tools.includes(tool)) {
      onToolsChange(tools.filter(t => t !== tool))
    } else {
      onToolsChange([...tools, tool])
    }
  }

  const addCustomTool = () => {
    const newTool: CustomTool = {
      name: '',
      description: '',
      url: '',
      method: 'POST',
      parameters: {},
      headers: { 'Content-Type': 'application/json' }
    }
    onCustomToolsChange([...customTools, newTool])
    setExpandedTool(customTools.length)
  }

  const updateCustomTool = (index: number, field: keyof CustomTool, value: any) => {
    const updated = [...customTools]
    updated[index] = { ...updated[index], [field]: value }
    onCustomToolsChange(updated)
  }

  const removeCustomTool = (index: number) => {
    onCustomToolsChange(customTools.filter((_, i) => i !== index))
    if (expandedTool === index) setExpandedTool(null)
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-y-auto h-full">
      <div className="p-4 space-y-4">
        <h3 className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
          <WrenchIcon className="w-3.5 h-3.5" />
          Tools & Actions
        </h3>

        {/* Built-in tools */}
        <div className="space-y-2">
          <Label className="text-xs text-gray-500 dark:text-gray-400">Built-in Tools</Label>
          {BUILTIN_TOOLS.map(tool => (
            <div key={tool} className="flex items-center justify-between py-1.5">
              <span className="text-xs font-mono text-gray-700 dark:text-gray-300">{tool}</span>
              <Switch
                checked={tools.includes(tool)}
                onCheckedChange={() => toggleBuiltinTool(tool)}
                className="scale-75"
              />
            </div>
          ))}
        </div>

        <div className="h-px bg-gray-200 dark:bg-gray-700" />

        {/* Custom tools */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-gray-500 dark:text-gray-400">
              Custom HTTP Tools
              {customTools.length > 0 && (
                <Badge variant="outline" className="ml-2 text-xs px-1 py-0 h-4">{customTools.length}</Badge>
              )}
            </Label>
            <Button size="sm" variant="outline" onClick={addCustomTool} className="h-6 text-xs px-2">
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>

          {customTools.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic">No custom tools added</p>
          )}

          {customTools.map((tool, index) => (
            <Collapsible
              key={index}
              open={expandedTool === index}
              onOpenChange={(open) => setExpandedTool(open ? index : null)}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <WrenchIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <span className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate">
                    {tool.name || `Tool ${index + 1}`}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={e => { e.stopPropagation(); removeCustomTool(index) }}
                    className="p-1 text-red-400 hover:text-red-600 rounded"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${expandedTool === index ? 'rotate-180' : ''}`} />
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-2 ml-2 space-y-3 pr-1">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Name</Label>
                  <Input
                    value={tool.name}
                    onChange={e => updateCustomTool(index, 'name', e.target.value)}
                    placeholder="check_slot"
                    className="h-7 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Description</Label>
                  <Textarea
                    value={tool.description}
                    onChange={e => updateCustomTool(index, 'description', e.target.value)}
                    placeholder="What this tool does..."
                    className="text-xs min-h-[60px] resize-none"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-gray-500">URL</Label>
                    <Input
                      value={tool.url}
                      onChange={e => updateCustomTool(index, 'url', e.target.value)}
                      placeholder="https://api.example.com/..."
                      className="h-7 text-xs"
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-xs text-gray-500">Method</Label>
                    <Select value={tool.method} onValueChange={v => updateCustomTool(index, 'method', v)}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GET" className="text-xs">GET</SelectItem>
                        <SelectItem value="POST" className="text-xs">POST</SelectItem>
                        <SelectItem value="PUT" className="text-xs">PUT</SelectItem>
                        <SelectItem value="DELETE" className="text-xs">DELETE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Parameters (JSON)</Label>
                  <Textarea
                    value={JSON.stringify(tool.parameters, null, 2)}
                    onChange={e => {
                      try {
                        updateCustomTool(index, 'parameters', JSON.parse(e.target.value))
                      } catch {}
                    }}
                    placeholder='{"doctor_id": {"type": "string", "required": true}}'
                    className="text-xs font-mono min-h-[80px] resize-none"
                    rows={3}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Headers (JSON)</Label>
                  <Textarea
                    value={JSON.stringify(tool.headers, null, 2)}
                    onChange={e => {
                      try {
                        updateCustomTool(index, 'headers', JSON.parse(e.target.value))
                      } catch {}
                    }}
                    placeholder='{"Authorization": "Bearer TOKEN"}'
                    className="text-xs font-mono min-h-[60px] resize-none"
                    rows={2}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </div>
    </div>
  )
}
