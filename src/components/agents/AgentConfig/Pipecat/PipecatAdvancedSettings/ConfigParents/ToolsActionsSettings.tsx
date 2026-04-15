// src/components/agents/AgentConfig/Pipecat/PipecatAdvancedSettings/ConfigParents/ToolsActionsSettings.tsx
'use client'

import React, { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Plus, Trash2, EditIcon, CodeIcon,
  PhoneOffIcon, PhoneForwardedIcon, PhoneIcon,
  Volume2Icon, LanguagesIcon, WrenchIcon, RefreshCwIcon,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CustomTool {
  name: string
  description: string
  url: string
  method: string
  parameters: Record<string, { type: string; description: string; required: boolean }>
  headers: Record<string, string>
}

interface BackendTool {
  name: string
  description: string
  config_schema: Record<string, {
    type: 'multiselect' | 'select' | 'text' | 'number'
    label: string
    hint?: string
    placeholder?: string
    options?: { value: string; label: string }[]
    default?: unknown
    min?: number
    max?: number
  }>
  prompt_hint: string
}

interface ToolsActionsSettingsProps {
  builtinTools: string[]
  onBuiltinToolsChange: (tools: string[]) => void
  toolConfigs: Record<string, Record<string, unknown>>
  onToolConfigsChange: (configs: Record<string, Record<string, unknown>>) => void
  customTools: CustomTool[]
  onCustomToolsChange: (tools: CustomTool[]) => void
  transferNumber: string
  onTransferNumberChange: (value: string) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EMPTY_TOOL: CustomTool = {
  name: '', description: '', url: '', method: 'POST',
  parameters: {}, headers: { 'Content-Type': 'application/json' },
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  end_call: <PhoneOffIcon className="w-3 h-3 text-gray-400" />,
  transfer_call: <PhoneForwardedIcon className="w-3 h-3 text-gray-400" />,
  switch_stt_model: <LanguagesIcon className="w-3 h-3 text-gray-400" />,
  switch_tts_model: <Volume2Icon className="w-3 h-3 text-gray-400" />,
}

// ── Tool Config Editor ────────────────────────────────────────────────────────

function ToolConfigEditor({
  tool,
  config,
  onChange,
}: {
  tool: BackendTool
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
}) {
  if (!tool.config_schema || Object.keys(tool.config_schema).length === 0) return null

  return (
    <div className="mt-2 ml-5 space-y-3 pb-2">
      {Object.entries(tool.config_schema).map(([key, schema]) => {
        const currentValue = config[key] ?? schema.default

        if (schema.type === 'multiselect' && schema.options) {
          const selected = (currentValue as string[]) ?? []
          return (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs text-gray-600 dark:text-gray-400">{schema.label}</Label>
              <div className="space-y-1">
                {schema.options.map(opt => (
                  <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                    <Checkbox
                      checked={selected.includes(opt.value)}
                      onCheckedChange={checked => {
                        const next = checked
                          ? [...selected, opt.value]
                          : selected.filter(v => v !== opt.value)
                        onChange({ ...config, [key]: next })
                      }}
                      className="h-3 w-3 mt-0.5 flex-shrink-0"
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-400 font-mono leading-tight">
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
              {schema.hint && <p className="text-xs text-gray-400">{schema.hint}</p>}
            </div>
          )
        }

        if (schema.type === 'select' && schema.options) {
          return (
            <div key={key} className="space-y-1">
              <Label className="text-xs text-gray-600 dark:text-gray-400">{schema.label}</Label>
              <Select
                value={(currentValue as string) ?? ''}
                onValueChange={v => onChange({ ...config, [key]: v })}
              >
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {schema.options.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {schema.hint && <p className="text-xs text-gray-400">{schema.hint}</p>}
            </div>
          )
        }

        if (schema.type === 'text') {
          return (
            <div key={key} className="space-y-1">
              <Label className="text-xs text-gray-600 dark:text-gray-400">{schema.label}</Label>
              <Input
                value={(currentValue as string) ?? ''}
                onChange={e => onChange({ ...config, [key]: e.target.value })}
                placeholder={schema.placeholder ?? ''}
                className="h-7 text-xs"
              />
              {schema.hint && <p className="text-xs text-gray-400">{schema.hint}</p>}
            </div>
          )
        }

        if (schema.type === 'number') {
          return (
            <div key={key} className="space-y-1">
              <Label className="text-xs text-gray-600 dark:text-gray-400">{schema.label}</Label>
              <Input
                type="number"
                value={(currentValue as number) ?? ''}
                min={schema.min}
                max={schema.max}
                onChange={e => onChange({ ...config, [key]: parseFloat(e.target.value) })}
                className="h-7 text-xs"
              />
              {schema.hint && <p className="text-xs text-gray-400">{schema.hint}</p>}
            </div>
          )
        }

        return null
      })}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ToolsActionsSettings({
  builtinTools,
  onBuiltinToolsChange,
  toolConfigs,
  onToolConfigsChange,
  customTools,
  onCustomToolsChange,
  transferNumber,
  onTransferNumberChange,
}: ToolsActionsSettingsProps) {
  const [backendTools, setBackendTools] = useState<BackendTool[]>([])
  const [toolsLoading, setToolsLoading] = useState(false)

  // Custom tool dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingTool, setEditingTool] = useState<CustomTool>(EMPTY_TOOL)
  const [parametersJson, setParametersJson] = useState('{}')
  const [headersJson, setHeadersJson] = useState('{"Content-Type": "application/json"}')
  const [jsonError, setJsonError] = useState('')

  // Fetch builtin tools from backend
  useEffect(() => {
    setToolsLoading(true)
    fetch('/api/pipecat/tools')
      .then(r => r.json())
      .then((data: BackendTool[]) => {
        if (Array.isArray(data)) setBackendTools(data)
      })
      .catch(() => {})
      .finally(() => setToolsLoading(false))
  }, [])

  const toggleBuiltin = (toolName: string) => {
    if (builtinTools.includes(toolName)) {
      onBuiltinToolsChange(builtinTools.filter(t => t !== toolName))
      const { [toolName]: _, ...rest } = toolConfigs
      onToolConfigsChange(rest)
    } else {
      onBuiltinToolsChange([...builtinTools, toolName])
      const tool = backendTools.find(t => t.name === toolName)
      if (tool && Object.keys(tool.config_schema).length > 0) {
        const defaults: Record<string, unknown> = {}
        Object.entries(tool.config_schema).forEach(([k, s]) => {
          if (s.default !== undefined) defaults[k] = s.default
        })
        onToolConfigsChange({ ...toolConfigs, [toolName]: defaults })
      }
    }
  }

  const updateToolConfig = (toolName: string, config: Record<string, unknown>) => {
    onToolConfigsChange({ ...toolConfigs, [toolName]: config })
  }

  const isTransferCallEnabled = builtinTools.includes('transfer_call')

  // Custom tool dialog handlers
  const openAddDialog = () => {
    setEditingIndex(null)
    setEditingTool(EMPTY_TOOL)
    setParametersJson('{}')
    setHeadersJson('{"Content-Type": "application/json"}')
    setJsonError('')
    setIsDialogOpen(true)
  }

  const openEditDialog = (index: number) => {
    const tool = customTools[index]
    setEditingIndex(index)
    setEditingTool({ ...tool })
    setParametersJson(JSON.stringify(tool.parameters || {}, null, 2))
    setHeadersJson(JSON.stringify(tool.headers || {}, null, 2))
    setJsonError('')
    setIsDialogOpen(true)
  }

  const handleSave = () => {
    setJsonError('')
    let parsedParams: Record<string, unknown> = {}
    let parsedHeaders: Record<string, string> = {}
    try { parsedParams = JSON.parse(parametersJson || '{}') } catch { setJsonError('Invalid parameters JSON'); return }
    try { parsedHeaders = JSON.parse(headersJson || '{}') } catch { setJsonError('Invalid headers JSON'); return }
    const saved: CustomTool = { ...editingTool, parameters: parsedParams as any, headers: parsedHeaders }
    if (editingIndex !== null) {
      const updated = [...customTools]; updated[editingIndex] = saved
      onCustomToolsChange(updated)
    } else {
      onCustomToolsChange([...customTools, saved])
    }
    setIsDialogOpen(false)
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Configure actions your assistant can perform during conversations.
      </p>

      {/* ── Built-in Tools ──────────────────────────────────────────────── */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-2">
          <Label className="text-xs text-gray-500 dark:text-gray-400">Built-in Tools</Label>
          {toolsLoading && <RefreshCwIcon className="w-3 h-3 text-gray-400 animate-spin" />}
        </div>

        {backendTools.length === 0 && !toolsLoading && (
          <p className="text-xs text-gray-400 italic">No tools available</p>
        )}

        {backendTools.map(tool => {
          const enabled = builtinTools.includes(tool.name)
          const hasConfig = Object.keys(tool.config_schema).length > 0
          const isTransferTool = tool.name === 'transfer_call'

          return (
            <div key={tool.name}>
              {/* Tool row */}
              <div className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  {TOOL_ICONS[tool.name] ?? <WrenchIcon className="w-3 h-3 text-gray-400" />}
                  <div>
                    <span className="text-xs font-mono text-gray-700 dark:text-gray-300">
                      {tool.name}
                    </span>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{tool.description}</p>
                  </div>
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={() => toggleBuiltin(tool.name)}
                  className="scale-75"
                />
              </div>

              {/* Transfer number — inline when transfer_call is enabled */}
              {isTransferTool && enabled && (
                <div className="ml-5 mt-1 mb-3 space-y-1.5">
                  <Label className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                    <PhoneIcon className="w-3 h-3" />
                    Transfer Number
                  </Label>
                  <Input
                    value={transferNumber}
                    onChange={e => onTransferNumberChange(e.target.value)}
                    placeholder="+91XXXXXXXXXX"
                    className="h-7 text-xs border-gray-200 dark:border-gray-700"
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Default number to transfer calls to when this tool fires.
                  </p>
                </div>
              )}

              {/* Config schema fields */}
              {enabled && hasConfig && (
                <ToolConfigEditor
                  tool={tool}
                  config={(toolConfigs[tool.name] as Record<string, unknown>) ?? {}}
                  onChange={config => updateToolConfig(tool.name, config)}
                />
              )}

              {/* Prompt hint */}
              {enabled && tool.prompt_hint && (
                <div className="ml-5 mt-1 mb-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded text-xs text-amber-700 dark:text-amber-400">
                  <p className="font-medium mb-0.5">Prompt hint</p>
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
                    {tool.prompt_hint}
                  </pre>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="h-px bg-gray-100 dark:bg-gray-700" />

      {/* ── Custom HTTP Tools ───────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-gray-500 dark:text-gray-400">
            Custom HTTP Tools
            {customTools.length > 0 && (
              <Badge variant="outline" className="ml-2 text-xs px-1 py-0 h-4">
                {customTools.length}
              </Badge>
            )}
          </Label>
          <Button size="sm" variant="outline" onClick={openAddDialog} className="h-6 text-xs px-2">
            <Plus className="w-3 h-3 mr-1" />Add
          </Button>
        </div>

        {customTools.length === 0 && (
          <div className="text-xs text-gray-400 text-center py-3 bg-gray-50 dark:bg-gray-900 rounded border border-dashed border-gray-300 dark:border-gray-700">
            No custom tools configured
          </div>
        )}

        {customTools.map((tool, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <CodeIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate block">
                  {tool.name || 'unnamed'}
                </span>
                <span className="text-xs text-gray-400 truncate block">{tool.url}</span>
              </div>
              <Badge variant="outline" className="text-xs px-1 py-0 h-4 flex-shrink-0">
                {tool.method}
              </Badge>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost" size="sm"
                onClick={() => openEditDialog(i)}
                className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
              >
                <EditIcon className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost" size="sm"
                onClick={() => onCustomToolsChange(customTools.filter((_, j) => j !== i))}
                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Custom Tool Dialog ──────────────────────────────────────────── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {editingIndex !== null ? 'Edit' : 'Add'} Custom HTTP Tool
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1">
              <Label className="text-xs">Tool Name</Label>
              <Input
                value={editingTool.name}
                onChange={e => setEditingTool(p => ({ ...p, name: e.target.value }))}
                placeholder="check_slot"
                className="h-7 text-xs font-mono"
              />
              <p className="text-xs text-gray-500">snake_case name — the LLM calls it by this name</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={editingTool.description}
                onChange={e => setEditingTool(p => ({ ...p, description: e.target.value }))}
                placeholder="Check available appointment slots."
                className="text-xs min-h-[60px] resize-none"
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">URL</Label>
                <Input
                  value={editingTool.url}
                  onChange={e => setEditingTool(p => ({ ...p, url: e.target.value }))}
                  placeholder="https://your-api.com/slots"
                  className="h-7 text-xs"
                />
              </div>
              <div className="w-24 space-y-1">
                <Label className="text-xs">Method</Label>
                <Select
                  value={editingTool.method}
                  onValueChange={v => setEditingTool(p => ({ ...p, method: v }))}
                >
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['GET', 'POST', 'PUT', 'DELETE'].map(m => (
                      <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Parameters (JSON)</Label>
              <Textarea
                value={parametersJson}
                onChange={e => setParametersJson(e.target.value)}
                placeholder={`{\n  "doctor_id": { "type": "string", "description": "Doctor ID", "required": true }\n}`}
                className="text-xs font-mono min-h-[100px] resize-none"
                rows={4}
              />
              <p className="text-xs text-gray-500">GET → query string. POST → JSON body.</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Headers (JSON)</Label>
              <Textarea
                value={headersJson}
                onChange={e => setHeadersJson(e.target.value)}
                placeholder={`{ "Authorization": "Bearer YOUR_TOKEN" }`}
                className="text-xs font-mono min-h-[60px] resize-none"
                rows={2}
              />
            </div>
            {jsonError && <p className="text-xs text-red-500">{jsonError}</p>}
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              className="flex-1 h-7 text-xs"
            >
              Cancel
            </Button>
            <Button onClick={handleSave} className="flex-1 h-7 text-xs">
              {editingIndex !== null ? 'Update' : 'Add'} Tool
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}