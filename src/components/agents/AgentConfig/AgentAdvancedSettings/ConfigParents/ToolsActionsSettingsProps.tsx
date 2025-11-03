'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PlusIcon, EditIcon, TrashIcon, PhoneOffIcon, ArrowRightIcon, CodeIcon, PhoneForwardedIcon } from 'lucide-react'

interface ToolParameter {
  id: string
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  required: boolean
}

interface Tool {
  id: string
  type: 'end_call' | 'handoff' | 'transfer_call' | 'custom_function'
  name: string
  config: {
    description?: string
    endpoint?: string
    method?: string
    headers?: Record<string, string>
    body?: string
    targetAgent?: string
    handoffMessage?: string
    transferNumber?: string
    timeout?: number
    asyncExecution?: boolean
    parameters?: ToolParameter[]
    responseMapping?: string
  }
}

interface ToolsActionsSettingsProps {
  tools: Tool[]
  onFieldChange: (field: string, value: any) => void
}

function ToolsActionsSettings({ tools, onFieldChange }: ToolsActionsSettingsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedToolType, setSelectedToolType] = useState<'end_call' | 'handoff' | 'transfer_call' | 'custom_function' | null>(null)
  const [editingTool, setEditingTool] = useState<Tool | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    endpoint: '',
    method: 'POST',
    headers: {},
    body: '',
    targetAgent: '',
    handoffMessage: '',
    transferNumber: '',
    timeout: 10,
    asyncExecution: false,
    parameters: [] as ToolParameter[],
    responseMapping: '{}'
  })

  const handleAddTool = (toolType: 'end_call' | 'handoff' | 'transfer_call' | 'custom_function') => {
    setSelectedToolType(toolType)
    setEditingTool(null)
    
    if (toolType === 'end_call') {
      setFormData({ 
        name: 'End Call', 
        description: 'Allow assistant to end the conversation', 
        endpoint: '', 
        method: 'POST', 
        headers: {}, 
        body: '',
        targetAgent: '',
        handoffMessage: '',
        transferNumber: '',
        timeout: 10,
        asyncExecution: false,
        parameters: [],
        responseMapping: '{}'
      })
    } else if (toolType === 'handoff') {
      setFormData({ 
        name: 'Handoff Agent', 
        description: 'Transfer conversation to another agent', 
        endpoint: '', 
        method: 'POST', 
        headers: {}, 
        body: '',
        targetAgent: '',
        handoffMessage: 'Transferring you to another agent...',
        transferNumber: '',
        timeout: 10,
        asyncExecution: false,
        parameters: [],
        responseMapping: '{}'
      })
    } else if (toolType === 'transfer_call') {
      setFormData({ 
        name: 'Transfer Call', 
        description: 'Transfer the call by creating a conference with another party', 
        endpoint: '', 
        method: 'POST', 
        headers: {}, 
        body: '',
        targetAgent: '',
        handoffMessage: '',
        transferNumber: '',
        timeout: 10,
        asyncExecution: false,
        parameters: [],
        responseMapping: '{}'
      })
    } else {
      setFormData({ 
        name: '', 
        description: '', 
        endpoint: '', 
        method: 'GET', 
        headers: {}, 
        body: '',
        targetAgent: '',
        handoffMessage: '',
        transferNumber: '',
        timeout: 10,
        asyncExecution: false,
        parameters: [],
        responseMapping: '{}'
      })
    }
    
    setIsDialogOpen(true)
  }

  const handleEditTool = (tool: Tool) => {
    setEditingTool(tool)
    setSelectedToolType(tool.type)
    setFormData({
      name: tool.name,
      description: tool.config.description || '',
      endpoint: tool.config.endpoint || '',
      method: tool.config.method || 'POST',
      headers: tool.config.headers || {},
      body: tool.config.body || '',
      targetAgent: tool.config.targetAgent || '',
      handoffMessage: tool.config.handoffMessage || '',
      transferNumber: tool.config.transferNumber || '',
      timeout: tool.config.timeout || 10,
      asyncExecution: tool.config.asyncExecution || false,
      parameters: tool.config.parameters || [],
      responseMapping: tool.config.responseMapping || '{}'
    })
    setIsDialogOpen(true)
  }

  const handleSaveTool = () => {
    const newTool: Tool = {
      id: editingTool?.id || `tool_${Date.now()}`,
      type: selectedToolType!,
      name: formData.name,
      config: {
        description: formData.description,
        endpoint: formData.endpoint,
        method: formData.method,
        headers: formData.headers,
        body: formData.body,
        targetAgent: formData.targetAgent,
        handoffMessage: formData.handoffMessage,
        transferNumber: formData.transferNumber,
        timeout: formData.timeout,
        asyncExecution: formData.asyncExecution,
        parameters: formData.parameters,
        responseMapping: formData.responseMapping
      }
    }

    let updatedTools
    if (editingTool) {
      updatedTools = tools.map(tool => tool.id === editingTool.id ? newTool : tool)
    } else {
      updatedTools = [...tools, newTool]
    }

    onFieldChange('advancedSettings.tools.tools', updatedTools)
    setIsDialogOpen(false)
  }

  const handleDeleteTool = (toolId: string) => {
    const updatedTools = tools.filter(tool => tool.id !== toolId)
    onFieldChange('advancedSettings.tools.tools', updatedTools)
  }

  const handleAddParameter = () => {
    const newParameter: ToolParameter = {
      id: `param_${Date.now()}`,
      name: '',
      type: 'string',
      description: '',
      required: false
    }
    setFormData(prev => ({
      ...prev,
      parameters: [...prev.parameters, newParameter]
    }))
  }

  const handleUpdateParameter = (id: string, field: keyof ToolParameter, value: any) => {
    setFormData(prev => ({
      ...prev,
      parameters: prev.parameters.map(param =>
        param.id === id ? { ...param, [field]: value } : param
      )
    }))
  }

  const handleRemoveParameter = (id: string) => {
    setFormData(prev => ({
      ...prev,
      parameters: prev.parameters.filter(param => param.id !== id)
    }))
  }

  const getToolIcon = (type: string) => {
    switch (type) {
      case 'end_call': return <PhoneOffIcon className="w-3 h-3" />
      case 'handoff': return <ArrowRightIcon className="w-3 h-3" />
      case 'transfer_call': return <PhoneForwardedIcon className="w-3 h-3" />
      case 'custom_function': return <CodeIcon className="w-3 h-3" />
      default: return <CodeIcon className="w-3 h-3" />
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
        Configure actions your assistant can perform during conversations
      </div>

      {/* Add Tool Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="w-full h-7 text-xs">
            <PlusIcon className="w-3 h-3 mr-1" />
            Add Tool
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48">
          <DropdownMenuItem onClick={() => handleAddTool('end_call')} className="text-xs">
            <PhoneOffIcon className="w-3 h-3 mr-2" />
            End Call
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAddTool('handoff')} className="text-xs">
            <ArrowRightIcon className="w-3 h-3 mr-2" />
            Handoff Agent
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAddTool('transfer_call')} className="text-xs">
            <PhoneForwardedIcon className="w-3 h-3 mr-2" />
            Transfer Call
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAddTool('custom_function')} className="text-xs">
            <CodeIcon className="w-3 h-3 mr-2" />
            Custom Tool
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Tools List */}
      <div className="space-y-2">
        {tools.length === 0 ? (
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-4 bg-gray-50 dark:bg-gray-900 rounded">
            No tools configured
          </div>
        ) : (
          tools.map((tool) => (
            <div key={tool.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                {getToolIcon(tool.type)}
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {tool.name}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditTool(tool)}
                  className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
                >
                  <EditIcon className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteTool(tool.id)}
                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                >
                  <TrashIcon className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Tool Configuration Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-sm text-gray-900 dark:text-gray-100">
              {editingTool ? 'Edit' : 'Add'} {selectedToolType === 'end_call' ? 'End Call' : selectedToolType === 'handoff' ? 'Handoff Agent' : selectedToolType === 'transfer_call' ? 'Transfer Call' : 'Custom Tool'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 mt-4">
            {/* Tool Name */}
            <div>
              <Label className="text-xs text-gray-700 dark:text-gray-300">Tool Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="h-7 text-xs mt-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                placeholder={selectedToolType === 'custom_function' ? 'e.g., get_weather' : 'Enter tool name...'}
              />
            </div>

            {/* Description */}
            <div>
              <Label className="text-xs text-gray-700 dark:text-gray-300">Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="text-xs mt-1 min-h-[60px] resize-none bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                placeholder={selectedToolType === 'custom_function' ? 'e.g., Get current weather in' : 'Describe what this tool does...'}
              />
            </div>

            {/* Handoff Agent specific fields */}
            {selectedToolType === 'handoff' && (
              <>
                <div>
                  <Label className="text-xs text-gray-700 dark:text-gray-300">Target Agent</Label>
                  <Input
                    value={formData.targetAgent}
                    onChange={(e) => setFormData(prev => ({ ...prev, targetAgent: e.target.value }))}
                    className="h-7 text-xs mt-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Name of the agent to transfer to"
                  />
                </div>

                <div>
                  <Label className="text-xs text-gray-700 dark:text-gray-300">Handoff Message</Label>
                  <Textarea
                    value={formData.handoffMessage}
                    onChange={(e) => setFormData(prev => ({ ...prev, handoffMessage: e.target.value }))}
                    className="text-xs mt-1 min-h-[60px] resize-none bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Message to display during transfer"
                  />
                </div>
              </>
            )}

            {/* Transfer Call specific fields */}
            {selectedToolType === 'transfer_call' && (
              <>
                <div>
                  <Label className="text-xs text-gray-700 dark:text-gray-300">Transfer Number</Label>
                  <Input
                    value={formData.transferNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, transferNumber: e.target.value }))}
                    className="h-7 text-xs mt-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="e.g., +1234567890"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    The phone number to transfer the call to. The call will be transferred to this number in a conference.
                  </p>
                </div>
              </>
            )}

            {/* Custom Tool specific fields */}
            {selectedToolType === 'custom_function' && (
              <>
                <div>
                  <Label className="text-xs text-gray-700 dark:text-gray-300">API URL</Label>
                  <Input
                    value={formData.endpoint}
                    onChange={(e) => setFormData(prev => ({ ...prev, endpoint: e.target.value }))}
                    className="h-7 text-xs mt-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="e.g., https://api.example.com/weather"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-700 dark:text-gray-300">HTTP Method</Label>
                    <Select
                      value={formData.method}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, method: value }))}
                    >
                      <SelectTrigger className="h-7 text-xs mt-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-gray-700 dark:text-gray-300">Timeout (seconds)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="120"
                      value={formData.timeout}
                      onChange={(e) => setFormData(prev => ({ ...prev, timeout: parseInt(e.target.value) || 10 }))}
                      className="h-7 text-xs mt-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                      placeholder="10"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs text-gray-700 dark:text-gray-300">Async Execution</Label>
                  <Switch
                    checked={formData.asyncExecution}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, asyncExecution: checked }))}
                    className="scale-75"
                  />
                </div>

                {/* Custom Payload */}
                {formData.method !== 'GET' && (
                  <div>
                    <Label className="text-xs text-gray-700 dark:text-gray-300">Custom Payload (JSON Template)</Label>
                    <Textarea
                      value={formData.body}
                      onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
                      className="text-xs mt-1 min-h-[80px] resize-none font-mono bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder='e.g., {"order": {"customer_id": customer_id, "items": items, "timestamp": "{{timestamp}}"}}'
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Use parameter names as variables and {`{{timestamp}}`} for current timestamp
                    </p>
                  </div>
                )}

                {/* Headers Configuration */}
                <div>
                  <Label className="text-xs text-gray-700 dark:text-gray-300">Headers (JSON)</Label>
                  <Textarea
                    value={JSON.stringify(formData.headers, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value)
                        setFormData(prev => ({ ...prev, headers: parsed }))
                      } catch (err) {
                        // Allow invalid JSON while typing
                        setFormData(prev => ({ ...prev, headers: {} }))
                      }
                    }}
                    className="text-xs mt-1 min-h-[80px] resize-none font-mono bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder={`{
                  "Content-Type": "application/json",
                  "Authorization": "Bearer YOUR_TOKEN",
                  "X-Custom-Header": "value"
                }`}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Add custom HTTP headers as JSON key-value pairs
                  </p>
                </div>

                {/* Parameters Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-gray-700 dark:text-gray-300">Parameters</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddParameter}
                      className="h-6 text-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <PlusIcon className="w-3 h-3 mr-1" />
                      Add Parameter
                    </Button>
                  </div>

                  {formData.parameters.length === 0 ? (
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-3 bg-gray-50 dark:bg-gray-900 rounded border border-dashed border-gray-300 dark:border-gray-700">
                      No parameters defined. Click "Add Parameter" to add one.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {formData.parameters.map((param, index) => (
                        <div key={param.id} className="p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 space-y-2">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              Parameter #{index + 1}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveParameter(param.id)}
                              className="h-5 w-5 p-0 text-red-500 hover:text-red-700"
                            >
                              <TrashIcon className="w-3 h-3" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs text-gray-700 dark:text-gray-300">Name</Label>
                              <Input
                                value={param.name}
                                onChange={(e) => handleUpdateParameter(param.id, 'name', e.target.value)}
                                className="h-6 text-xs mt-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                                placeholder="e.g., location"
                              />
                            </div>

                            <div>
                              <Label className="text-xs text-gray-700 dark:text-gray-300">Type</Label>
                              <Select
                                value={param.type}
                                onValueChange={(value) => handleUpdateParameter(param.id, 'type', value)}
                              >
                                <SelectTrigger className="h-6 text-xs mt-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                  <SelectItem value="string">string</SelectItem>
                                  <SelectItem value="number">number</SelectItem>
                                  <SelectItem value="boolean">boolean</SelectItem>
                                  <SelectItem value="array">array</SelectItem>
                                  <SelectItem value="object">object</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs text-gray-700 dark:text-gray-300">Description</Label>
                            <Input
                              value={param.description}
                              onChange={(e) => handleUpdateParameter(param.id, 'description', e.target.value)}
                              className="h-6 text-xs mt-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                              placeholder="Describe this parameter"
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-gray-700 dark:text-gray-300">Required</Label>
                            <Switch
                              checked={param.required}
                              onCheckedChange={(checked) => handleUpdateParameter(param.id, 'required', checked)}
                              className="scale-75"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Response Mapping */}
                <div>
                  <Label className="text-xs text-gray-700 dark:text-gray-300">Response Mapping (JSON)</Label>
                  <Textarea
                    value={formData.responseMapping}
                    onChange={(e) => setFormData(prev => ({ ...prev, responseMapping: e.target.value }))}
                    className="text-xs mt-1 min-h-[80px] resize-none font-mono bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="{}"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Map API response fields to tool response using dot notation (e.g., "data.user.name")
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2 mt-6">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1 h-7 text-xs bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
              Cancel
            </Button>
            <Button onClick={handleSaveTool} className="flex-1 h-7 text-xs">
              {editingTool ? 'Update' : 'Add'} Tool
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ToolsActionsSettings