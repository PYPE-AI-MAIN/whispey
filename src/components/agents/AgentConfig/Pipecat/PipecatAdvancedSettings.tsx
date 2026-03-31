'use client'

import React, { useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDownIcon, MicIcon, WrenchIcon, PhoneIcon, Plus, Trash2, EditIcon, CodeIcon, PhoneOffIcon, PhoneForwardedIcon } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface CustomTool {
  name: string
  description: string
  url: string
  method: string
  parameters: Record<string, { type: string; description: string; required: boolean }>
  headers: Record<string, string>
}

interface PipecatAdvancedSettingsProps {
  vadConfidence: number
  vadStartSecs: number
  vadStopSecs: number
  vadMinVolume: number
  onVadChange: (field: string, value: number) => void
  transferNumber: string
  onTransferNumberChange: (value: string) => void
  builtinTools: string[]
  onBuiltinToolsChange: (tools: string[]) => void
  customTools: CustomTool[]
  onCustomToolsChange: (tools: CustomTool[]) => void
  projectId?: string
}

const BUILTIN_TOOLS = [
  { id: 'end_call', label: 'End Call', description: 'Terminates the call when the agent is done' },
  { id: 'transfer_call', label: 'Transfer Call', description: 'Transfers to the transfer number' },
]

const EMPTY_TOOL: CustomTool = {
  name: '',
  description: '',
  url: '',
  method: 'POST',
  parameters: {},
  headers: { 'Content-Type': 'application/json' }
}

export default function PipecatAdvancedSettings({
  vadConfidence, vadStartSecs, vadStopSecs, vadMinVolume, onVadChange,
  transferNumber, onTransferNumberChange,
  builtinTools, onBuiltinToolsChange,
  customTools, onCustomToolsChange,
  projectId
}: PipecatAdvancedSettingsProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    vad: false, transfer: false, tools: false,
  })
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingTool, setEditingTool] = useState<CustomTool>(EMPTY_TOOL)
  const [parametersJson, setParametersJson] = useState('{}')
  const [headersJson, setHeadersJson] = useState('{"Content-Type": "application/json"}')
  const [jsonError, setJsonError] = useState('')

  const toggleSection = (s: string) => setOpenSections(prev => ({ ...prev, [s]: !prev[s] }))

  const toggleBuiltin = (tool: string) => {
    if (builtinTools.includes(tool)) {
      onBuiltinToolsChange(builtinTools.filter(t => t !== tool))
    } else {
      onBuiltinToolsChange([...builtinTools, tool])
    }
  }

  const openAddDialog = () => {
    setEditingIndex(null)
    setEditingTool(EMPTY_TOOL)
    setParametersJson('{}')
    setHeadrsJson('{"Content-Type": "application/json"}')
    setJsonError('')
    setIsDialogOpen(true)
  }

  const openEditDialog = (index: number) => {
    const tool = customTools[index]
    setEditingIndex(index)
    setEditingTool({ ...tool })
    setParametersJson(JSON.stringify(tool.parameters || {}, null, 2))
    setHeadrsJson(JSON.stringify(tool.headers || {}, null, 2))
    setJsonError('')
    setIsDialogOpen(true)
  }

  // helper to avoid typo — sets headersJson
  const setHeadrsJson = setHeadersJson

  const handleSave = () => {
    setJsonError('')
    let parsedParams: Record<string, any> = {}
    let parsedHeaders: Record<string, string> = {}
    try { parsedParams = JSON.parse(parametersJson || '{}') } catch { setJsonError('Invalid parameters JSON'); return }
    try { parsedHeaders = JSON.parse(headersJson || '{}') } catch { setJsonError('Invalid headers JSON'); return }

    const saved: CustomTool = { ...editingTool, parameters: parsedParams, headers: parsedHeaders }

    if (editingIndex !== null) {
      const updated = [...customTools]
      updated[editingIndex] = saved
      onCustomToolsChange(updated)
    } else {
      onCustomToolsChange([...customTools, saved])
    }
    setIsDialogOpen(false)
  }

  const handleDelete = (index: number) => {
    onCustomToolsChange(customTools.filter((_, i) => i !== index))
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg h-full overflow-y-auto">
      <div className="p-4 space-y-3">

        {/* VAD */}
        <Collapsible open={openSections.vad} onOpenChange={() => toggleSection('vad')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors">
            <div className="flex items-center gap-2">
              <MicIcon className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Voice Activity Detection</span>
            </div>
            <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${openSections.vad ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 ml-5 space-y-4">
            <div className="text-xs text-gray-600 dark:text-gray-400">Configure voice activity detection settings</div>
            {[
              { label: 'Confidence', field: 'confidence', value: vadConfidence, min: 0, max: 1, step: 0.05 },
              { label: 'Start Secs', field: 'startSecs', value: vadStartSecs, min: 0, max: 2, step: 0.05, unit: 's' },
              { label: 'Stop Secs', field: 'stopSecs', value: vadStopSecs, min: 0, max: 3, step: 0.05, unit: 's' },
              { label: 'Min Volume', field: 'minVolume', value: vadMinVolume, min: 0, max: 1, step: 0.05 },
            ].map(({ label, field, value, min, max, step, unit }) => (
              <div key={field} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</Label>
                  <span className="text-xs font-mono text-gray-500">{value.toFixed(2)}{unit || ''}</span>
                </div>
                <Slider value={[value]} onValueChange={v => onVadChange(field, v[0])} min={min} max={max} step={step} />
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>

        <div className="h-px bg-gray-200 dark:bg-gray-700" />

        {/* Transfer Number */}
        <Collapsible open={openSections.transfer} onOpenChange={() => toggleSection('transfer')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors">
            <div className="flex items-center gap-2">
              <PhoneIcon className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Transfer Number</span>
            </div>
            <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${openSections.transfer ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 ml-5 space-y-3">
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Default number to transfer calls to when transfer_call tool fires
            </div>
            <Input
              value={transferNumber}
              onChange={e => onTransferNumberChange(e.target.value)}
              placeholder="+91XXXXXXXXXX"
              className="h-8 text-sm border-gray-200 dark:border-gray-700"
            />
          </CollapsibleContent>
        </Collapsible>

        <div className="h-px bg-gray-200 dark:bg-gray-700" />

        {/* Tools */}
        <Collapsible open={openSections.tools} onOpenChange={() => toggleSection('tools')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors">
            <div className="flex items-center gap-2">
              <WrenchIcon className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tools & Actions</span>
            </div>
            <ChevronDownIcon className={`w-3.5 h-3.5 text-gray-400 transition-transform ${openSections.tools ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 ml-5 space-y-3">
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Configure actions your assistant can perform during conversations
            </div>

            {/* Built-in tools */}
            <div className="space-y-2">
              <Label className="text-xs text-gray-500 dark:text-gray-400">Built-in Tools</Label>
              {BUILTIN_TOOLS.map(tool => (
                <div key={tool.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    {tool.id === 'end_call' ? <PhoneOffIcon className="w-3 h-3 text-gray-400" /> : <PhoneForwardedIcon className="w-3 h-3 text-gray-400" />}
                    <div>
                      <span className="text-xs font-mono text-gray-700 dark:text-gray-300">{tool.id}</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{tool.description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={builtinTools.includes(tool.id)}
                    onCheckedChange={() => toggleBuiltin(tool.id)}
                    className="scale-75"
                  />
                </div>
              ))}
            </div>

            <div className="h-px bg-gray-100 dark:bg-gray-700" />

            {/* Custom HTTP tools */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-gray-500 dark:text-gray-400">
                  Custom HTTP Tools
                  {customTools.length > 0 && (
                    <Badge variant="outline" className="ml-2 text-xs px-1 py-0 h-4">{customTools.length}</Badge>
                  )}
                </Label>
                <Button size="sm" variant="outline" onClick={openAddDialog} className="h-6 text-xs px-2">
                  <Plus className="w-3 h-3 mr-1" />Add
                </Button>
              </div>

              {customTools.length === 0 && (
                <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-4 bg-gray-50 dark:bg-gray-900 rounded border border-dashed border-gray-300 dark:border-gray-700">
                  No custom tools configured
                </div>
              )}

              {customTools.map((tool, i) => (
                <div key={i} className="flex items-center justify-between gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <CodeIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate block">{tool.name || 'unnamed'}</span>
                      <span className="text-xs text-gray-400 truncate block">{tool.url}</span>
                    </div>
                    <Badge variant="outline" className="text-xs px-1 py-0 h-4 flex-shrink-0">{tool.method}</Badge>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(i)} className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700">
                      <EditIcon className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(i)} className="h-6 w-6 p-0 text-red-500 hover:text-red-700">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="h-px bg-gray-200 dark:bg-gray-700" />

      </div>

      {/* Custom Tool Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-sm">{editingIndex !== null ? 'Edit' : 'Add'} Custom HTTP Tool</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <div className="space-y-1">
              <Label className="text-xs text-gray-700 dark:text-gray-300">Tool Name</Label>
              <Input
                value={editingTool.name}
                onChange={e => setEditingTool(prev => ({ ...prev, name: e.target.value }))}
                placeholder="check_slot"
                className="h-7 text-xs font-mono"
              />
              <p className="text-xs text-gray-500">snake_case name — the LLM calls it by this name</p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-700 dark:text-gray-300">Description</Label>
              <Textarea
                value={editingTool.description}
                onChange={e => setEditingTool(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Check available appointment slots. The LLM uses this to decide when to call it."
                className="text-xs min-h-[60px] resize-none"
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-gray-700 dark:text-gray-300">URL</Label>
                <Input
                  value={editingTool.url}
                  onChange={e => setEditingTool(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://your-api.com/slots"
                  className="h-7 text-xs"
                />
              </div>
              <div className="w-24 space-y-1">
                <Label className="text-xs text-gray-700 dark:text-gray-300">Method</Label>
                <Select value={editingTool.method} onValueChange={v => setEditingTool(prev => ({ ...prev, method: v }))}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
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
              <Label className="text-xs text-gray-700 dark:text-gray-300">Parameters (JSON)</Label>
              <Textarea
                value={parametersJson}
                onChange={e => setParametersJson(e.target.value)}
                placeholder={`{\n  "doctor_id": { "type": "string", "description": "Doctor ID", "required": true }\n}`}
                className="text-xs font-mono min-h-[100px] resize-none"
                rows={4}
              />
              <p className="text-xs text-gray-500">GET → sent as query string. POST → sent as JSON body.</p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-700 dark:text-gray-300">Headers (JSON)</Label>
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
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1 h-7 text-xs">Cancel</Button>
            <Button onClick={handleSave} className="flex-1 h-7 text-xs">{editingIndex !== null ? 'Update' : 'Add'} Tool</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}