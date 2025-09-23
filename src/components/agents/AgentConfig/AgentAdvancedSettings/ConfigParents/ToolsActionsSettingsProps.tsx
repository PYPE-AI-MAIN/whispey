'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { PlusIcon, EditIcon, TrashIcon, PhoneOffIcon, ArrowRightIcon, CodeIcon } from 'lucide-react'

interface Tool {
  id: string
  type: 'end_call' | 'handoff' | 'custom_function'
  name: string
  config: any
}

interface ToolsActionsSettingsProps {
  tools: Tool[]
  onFieldChange: (field: string, value: any) => void
}

function ToolsActionsSettings({ tools, onFieldChange }: ToolsActionsSettingsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedToolType, setSelectedToolType] = useState<'end_call' | 'handoff' | 'custom_function' | null>(null)
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
    timeout: 10,
    asyncExecution: false
  })

  const handleAddTool = (toolType: 'end_call' | 'handoff' | 'custom_function') => {
    setSelectedToolType(toolType)
    setEditingTool(null)
    
    // Set default form data based on tool type
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
        timeout: 10,
        asyncExecution: false
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
        timeout: 10,
        asyncExecution: false
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
        timeout: 10,
        asyncExecution: false
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
      timeout: tool.config.timeout || 10,
      asyncExecution: tool.config.asyncExecution || false
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
        body: formData.body
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

  const getToolIcon = (type: string) => {
    switch (type) {
      case 'end_call': return <PhoneOffIcon className="w-3 h-3" />
      case 'handoff': return <ArrowRightIcon className="w-3 h-3" />
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {editingTool ? 'Edit' : 'Add'} {selectedToolType === 'end_call' ? 'End Call' : selectedToolType === 'handoff' ? 'Handoff Agent' : 'Custom Tool'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 mt-4">
            {/* Tool Name */}
            <div>
              <Label className="text-xs">Tool Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="h-7 text-xs mt-1"
                placeholder={selectedToolType === 'custom_function' ? 'e.g., get_weather' : 'Enter tool name...'}
              />
            </div>

            {/* Description */}
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="text-xs mt-1 min-h-[60px] resize-none"
                placeholder={selectedToolType === 'custom_function' ? 'e.g., Get current weather information' : 'Describe what this tool does...'}
              />
            </div>

            {/* Handoff Agent specific fields */}
            {selectedToolType === 'handoff' && (
              <>
                <div>
                  <Label className="text-xs">Target Agent</Label>
                  <Input
                    value={formData.targetAgent}
                    onChange={(e) => setFormData(prev => ({ ...prev, targetAgent: e.target.value }))}
                    className="h-7 text-xs mt-1"
                    placeholder="Name of the agent to transfer to"
                  />
                </div>

                <div>
                  <Label className="text-xs">Handoff Message</Label>
                  <Textarea
                    value={formData.handoffMessage}
                    onChange={(e) => setFormData(prev => ({ ...prev, handoffMessage: e.target.value }))}
                    className="text-xs mt-1 min-h-[60px] resize-none"
                    placeholder="Message to display during transfer"
                  />
                </div>
              </>
            )}

            {/* Custom Tool specific fields */}
            {selectedToolType === 'custom_function' && (
              <>
                <div>
                  <Label className="text-xs">Function Name</Label>
                  <Input
                    value={formData.endpoint}
                    onChange={(e) => setFormData(prev => ({ ...prev, endpoint: e.target.value }))}
                    className="h-7 text-xs mt-1"
                    placeholder="e.g., https://api.example.com/weather"
                  />
                </div>

                <div>
                  <Label className="text-xs">HTTP Method</Label>
                  <select
                    value={formData.method}
                    onChange={(e) => setFormData(prev => ({ ...prev, method: e.target.value }))}
                    className="w-full h-7 text-xs mt-1 border border-gray-200 dark:border-gray-700 rounded px-2 bg-white dark:bg-gray-800"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs">Timeout (seconds)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="120"
                    value={formData.timeout}
                    onChange={(e) => setFormData(prev => ({ ...prev, timeout: parseInt(e.target.value) || 10 }))}
                    className="h-7 text-xs mt-1"
                    placeholder="10"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-xs">Async Execution</Label>
                  <Switch
                    checked={formData.asyncExecution}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, asyncExecution: checked }))}
                    className="scale-75"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2 mt-6">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1 h-7 text-xs">
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