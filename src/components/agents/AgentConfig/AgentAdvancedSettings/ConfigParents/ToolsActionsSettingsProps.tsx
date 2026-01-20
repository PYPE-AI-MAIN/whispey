// src/components/agents/AgentConfig/AgentAdvancedSettings/ConfigParents/ToolsActionsSettingsProps.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PlusIcon, EditIcon, TrashIcon, PhoneOffIcon, ArrowRightIcon, CodeIcon, PhoneForwardedIcon, Loader2, Phone, Hash, MicIcon, Voicemail } from 'lucide-react'

interface PhoneNumber {
  id: string
  phone_number: string
  trunk_id: string
  provider: string | null
  project_id: string | null
}

interface ToolParameter {
  id: string
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  required: boolean
}

interface Tool {
  id: string
  type: 'end_call' | 'handoff' | 'transfer_call' | 'ivr_navigator' | 'custom_function' | 'nearby_location_finder' | 'update_vad_options' | 'voicemail_detection'
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
    sipTrunkId?: string
    timeout?: number
    asyncExecution?: boolean
    parameters?: ToolParameter[]
    responseMapping?: string
    // IVR Navigator specific fields
    function_name?: string
    docstring?: string
    cooldown_seconds?: number
    publish_topic?: string
    publish_data?: boolean
    instruction_template?: string
    default_task?: string
    task_metadata_keys?: string[]
    // Nearby location finder fields
    max_results?: number
    hospitals_json?: string
    areas_json?: string
  }
}

interface ToolsActionsSettingsProps {
  tools: Tool[]
  onFieldChange: (field: string, value: any) => void
  projectId?: string
}

function ToolsActionsSettings({ tools, onFieldChange, projectId }: ToolsActionsSettingsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedToolType, setSelectedToolType] = useState<'end_call' | 'handoff' | 'transfer_call' | 'ivr_navigator' | 'custom_function' | 'nearby_location_finder' | 'update_vad_options' | 'voicemail_detection' | null>(null)
  const [editingTool, setEditingTool] = useState<Tool | null>(null)
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [loadingPhoneNumbers, setLoadingPhoneNumbers] = useState(false)
  const [headersJsonString, setHeadersJsonString] = useState<string>('{}')

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    endpoint: '',
    method: 'POST',
    headers: {},
    body: '',
    targetAgent: '',
    handoffMessage: '',
    selectedPhoneId: '',
    transferNumber: '',
    sipTrunkId: '',
    timeout: 10,
    asyncExecution: false,
    parameters: [] as ToolParameter[],
    responseMapping: '{}',
    // IVR Navigator fields
    function_name: 'send_dtmf_code',
    docstring: '',
    cooldown_seconds: 3,
    publish_topic: 'dtmf_code',
    publish_data: true,
    instruction_template: '',
    default_task: 'Reach a live support representative',
    task_metadata_keys: ['ivr_task', 'navigator_task', 'task'],
    // Nearby location finder fields (stored as JSON strings in UI)
    max_results: 3,
    hospitals_json: '[]',
    areas_json: '{}'
  })

  // Fetch phone numbers when component mounts
  useEffect(() => {
    const fetchPhoneNumbers = async () => {
      try {
        setLoadingPhoneNumbers(true)
        const response = await fetch(`/api/calls/phone-numbers/?limit=50`)
        
        if (response.ok) {
          const data: PhoneNumber[] = await response.json()
          
          const filteredNumbers = projectId 
            ? data.filter(phone => phone.project_id === projectId)
            : data
          
          setPhoneNumbers(filteredNumbers)
        }
      } catch (error) {
        console.error('Error fetching phone numbers:', error)
      } finally {
        setLoadingPhoneNumbers(false)
      }
    }

    if (projectId) {
      fetchPhoneNumbers()
    }
  }, [projectId])

  const handleAddTool = (toolType: 'end_call' | 'handoff' | 'transfer_call' | 'ivr_navigator' | 'custom_function' | 'nearby_location_finder' | 'update_vad_options' | 'voicemail_detection') => {
    setSelectedToolType(toolType)
    setEditingTool(null)
    setHeadersJsonString('{}')
    
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
        selectedPhoneId: '',
        transferNumber: '',
        sipTrunkId: '',
        timeout: 10,
        asyncExecution: false,
        parameters: [],
        responseMapping: '{}',
        function_name: 'send_dtmf_code',
        docstring: '',
        cooldown_seconds: 3,
        publish_topic: 'dtmf_code',
        publish_data: true,
        instruction_template: '',
        default_task: 'Reach a live support representative',
        task_metadata_keys: ['ivr_task', 'navigator_task', 'task'],
        max_results: 3,
        hospitals_json: '[]',
        areas_json: '{}'
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
        selectedPhoneId: '',
        transferNumber: '',
        sipTrunkId: '',
        timeout: 10,
        asyncExecution: false,
        parameters: [],
        responseMapping: '{}',
        function_name: 'send_dtmf_code',
        docstring: '',
        cooldown_seconds: 3,
        publish_topic: 'dtmf_code',
        publish_data: true,
        instruction_template: '',
        default_task: 'Reach a live support representative',
        task_metadata_keys: ['ivr_task', 'navigator_task', 'task'],
        max_results: 3,
        hospitals_json: '[]',
        areas_json: '{}'
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
        selectedPhoneId: '',
        transferNumber: '',
        sipTrunkId: '',
        timeout: 10,
        asyncExecution: false,
        parameters: [],
        responseMapping: '{}',
        function_name: 'send_dtmf_code',
        docstring: '',
        cooldown_seconds: 3,
        publish_topic: 'dtmf_code',
        publish_data: true,
        instruction_template: '',
        default_task: 'Reach a live support representative',
        task_metadata_keys: ['ivr_task', 'navigator_task', 'task'],
        max_results: 3,
        hospitals_json: '[]',
        areas_json: '{}'
      })
    } else if (toolType === 'ivr_navigator') {
      setFormData({ 
        name: 'Send DTMF', 
        description: 'Send a DTMF tone to pick IVR menu options',
        endpoint: '', 
        method: 'POST', 
        headers: {}, 
        body: '',
        targetAgent: '',
        handoffMessage: '',
        selectedPhoneId: '',
        transferNumber: '',
        sipTrunkId: '',
        timeout: 10,
        asyncExecution: false,
        parameters: [],
        responseMapping: '{}',
        function_name: 'send_dtmf_code',
        docstring: 'Emit a DTMF digit when the IVR menu requests an input.',
        cooldown_seconds: 3,
        publish_topic: 'dtmf_code',
        publish_data: true,
        instruction_template: 'Listen carefully and press the most relevant option to accomplish: {task}.',
        default_task: 'Reach a live support representative',
        task_metadata_keys: ['ivr_task', 'navigator_task', 'task'],
        max_results: 3,
        hospitals_json: '[]',
        areas_json: '{}'
      })
    } else if (toolType === 'nearby_location_finder') {
      setFormData({
        name: 'Nearby Hospital Finder',
        description: 'Find the nearest hospital locations based on the patient area (supports geocoding fallback in backend)',
        endpoint: '',
        method: 'POST',
        headers: {},
        body: '',
        targetAgent: '',
        handoffMessage: '',
        selectedPhoneId: '',
        transferNumber: '',
        sipTrunkId: '',
        timeout: 10,
        asyncExecution: false,
        parameters: [],
        responseMapping: '{}',
        function_name: 'send_dtmf_code',
        docstring: '',
        cooldown_seconds: 3,
        publish_topic: 'dtmf_code',
        publish_data: true,
        instruction_template: '',
        default_task: 'Reach a live support representative',
        task_metadata_keys: ['ivr_task', 'navigator_task', 'task'],
        max_results: 3,
        hospitals_json: '[]',
        areas_json: '{}'
      })
    } else if (toolType === 'update_vad_options') {
      setFormData({ 
        name: 'Update VAD Options', 
        description: 'Update Voice Activity Detection (VAD) options dynamically during the conversation',
        endpoint: '', 
        method: 'POST', 
        headers: {}, 
        body: '',
        targetAgent: '',
        handoffMessage: '',
        selectedPhoneId: '',
        transferNumber: '',
        sipTrunkId: '',
        timeout: 10,
        asyncExecution: false,
        parameters: [],
        responseMapping: '{}',
        function_name: 'send_dtmf_code',
        docstring: '',
        cooldown_seconds: 3,
        publish_topic: 'dtmf_code',
        publish_data: true,
        instruction_template: '',
        default_task: 'Reach a live support representative',
        task_metadata_keys: ['ivr_task', 'navigator_task', 'task'],
        max_results: 3,
        hospitals_json: '[]',
        areas_json: '{}'
      })
    } else if (toolType === 'voicemail_detection') {
      setFormData({ 
        name: 'Voicemail Detection', 
        description: 'Detect voicemail systems and leave a message',
        endpoint: '', 
        method: 'POST', 
        headers: {}, 
        body: '',
        targetAgent: '',
        handoffMessage: '',
        selectedPhoneId: '',
        transferNumber: '',
        sipTrunkId: '',
        timeout: 10,
        asyncExecution: false,
        parameters: [],
        responseMapping: '{}',
        function_name: 'send_dtmf_code',
        docstring: '',
        cooldown_seconds: 3,
        publish_topic: 'dtmf_code',
        publish_data: true,
        instruction_template: '',
        default_task: 'Reach a live support representative',
        task_metadata_keys: ['ivr_task', 'navigator_task', 'task'],
        max_results: 3,
        hospitals_json: '[]',
        areas_json: '{}'
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
        selectedPhoneId: '',
        transferNumber: '',
        sipTrunkId: '',
        timeout: 10,
        asyncExecution: false,
        parameters: [],
        responseMapping: '{}',
        function_name: 'send_dtmf_code',
        docstring: '',
        cooldown_seconds: 3,
        publish_topic: 'dtmf_code',
        publish_data: true,
        instruction_template: '',
        default_task: 'Reach a live support representative',
        task_metadata_keys: ['ivr_task', 'navigator_task', 'task'],
        max_results: 3,
        hospitals_json: '[]',
        areas_json: '{}'
      })
    }
    
    setIsDialogOpen(true)
  }

  const handleEditTool = (tool: Tool) => {
    setEditingTool(tool)
    setSelectedToolType(tool.type)
    
    let selectedPhoneId = ''
    if (tool.config.sipTrunkId) {
      const matchingPhone = phoneNumbers.find(p => p.trunk_id === tool.config.sipTrunkId)
      selectedPhoneId = matchingPhone?.id || ''
    }
    
    const headers = tool.config.headers || {}
    setHeadersJsonString(JSON.stringify(headers, null, 2))
    
    setFormData({
      name: tool.name,
      description: tool.config.description || '',
      endpoint: tool.config.endpoint || '',
      method: tool.config.method || 'POST',
      headers: headers,
      body: tool.config.body || '',
      targetAgent: tool.config.targetAgent || '',
      handoffMessage: tool.config.handoffMessage || '',
      selectedPhoneId: selectedPhoneId,
      transferNumber: tool.config.transferNumber || '',
      sipTrunkId: tool.config.sipTrunkId || '',
      timeout: tool.config.timeout || 10,
      asyncExecution: tool.config.asyncExecution || false,
      parameters: tool.config.parameters || [],
      responseMapping: tool.config.responseMapping || '{}',
      function_name: tool.config.function_name || 'send_dtmf_code',
      docstring: tool.config.docstring || '',
      cooldown_seconds: tool.config.cooldown_seconds || 3,
      publish_topic: tool.config.publish_topic || 'dtmf_code',
      publish_data: tool.config.publish_data ?? true,
      instruction_template: tool.config.instruction_template || '',
      default_task: tool.config.default_task || 'Reach a live support representative',
      task_metadata_keys: tool.config.task_metadata_keys || ['ivr_task', 'navigator_task', 'task'],
      max_results: tool.config.max_results ?? 3,
      hospitals_json: tool.config.hospitals_json ?? '[]',
      areas_json: tool.config.areas_json ?? '{}'
    })
    setIsDialogOpen(true)
  }

  const handleSaveTool = () => {
    // Try to parse headersJsonString one more time before saving
    let finalHeaders = formData.headers
    try {
      const parsed = JSON.parse(headersJsonString)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        finalHeaders = parsed
      }
    } catch (err) {
      // If invalid JSON, use existing formData.headers
    }
    
    const newTool: Tool = {
      id: editingTool?.id || `tool_${Date.now()}`,
      type: selectedToolType!,
      name: formData.name,
      config: {
        description: formData.description,
        endpoint: formData.endpoint,
        method: formData.method,
        headers: finalHeaders,
        body: formData.body,
        targetAgent: formData.targetAgent,
        handoffMessage: formData.handoffMessage,
        transferNumber: formData.transferNumber,
        sipTrunkId: formData.sipTrunkId,
        timeout: formData.timeout,
        asyncExecution: formData.asyncExecution,
        parameters: formData.parameters,
        responseMapping: formData.responseMapping,
        ...(selectedToolType === 'ivr_navigator' && {
          function_name: formData.function_name,
          docstring: formData.docstring,
          cooldown_seconds: formData.cooldown_seconds,
          publish_topic: formData.publish_topic,
          publish_data: formData.publish_data,
          instruction_template: formData.instruction_template,
          default_task: formData.default_task,
          task_metadata_keys: formData.task_metadata_keys
        }),
        ...(selectedToolType === 'nearby_location_finder' && {
          max_results: formData.max_results,
          hospitals_json: formData.hospitals_json,
          areas_json: formData.areas_json
        })
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

  const handleAddMetadataKey = () => {
    setFormData(prev => ({
      ...prev,
      task_metadata_keys: [...prev.task_metadata_keys, '']
    }))
  }

  const handleUpdateMetadataKey = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      task_metadata_keys: prev.task_metadata_keys.map((key, i) => i === index ? value : key)
    }))
  }

  const handleRemoveMetadataKey = (index: number) => {
    setFormData(prev => ({
      ...prev,
      task_metadata_keys: prev.task_metadata_keys.filter((_, i) => i !== index)
    }))
  }

  const getToolIcon = (type: string) => {
    switch (type) {
      case 'end_call': return <PhoneOffIcon className="w-3 h-3" />
      case 'handoff': return <ArrowRightIcon className="w-3 h-3" />
      case 'transfer_call': return <PhoneForwardedIcon className="w-3 h-3" />
      case 'ivr_navigator': return <Hash className="w-3 h-3" />
      case 'custom_function': return <CodeIcon className="w-3 h-3" />
      case 'nearby_location_finder': return <Phone className="w-3 h-3" />
      case 'update_vad_options': return <MicIcon className="w-3 h-3" />
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
          <DropdownMenuItem onClick={() => handleAddTool('ivr_navigator')} className="text-xs">
            <Hash className="w-3 h-3 mr-2" />
            IVR Navigator (DTMF)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAddTool('custom_function')} className="text-xs">
            <CodeIcon className="w-3 h-3 mr-2" />
            Custom Tool
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAddTool('nearby_location_finder')} className="text-xs">
            <Phone className="w-3 h-3 mr-2" />
            Nearby Hospital Finder
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAddTool('update_vad_options')} className="text-xs">
            <MicIcon className="w-3 h-3 mr-2" />
            Update VAD Options
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
            <div key={tool.id} className="flex items-center justify-between gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {getToolIcon(tool.type)}
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
                  {tool.name}
                </span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
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
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open)
        if (!open) {
          // Reset headers JSON string when dialog closes
          setHeadersJsonString('{}')
        }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-sm text-gray-900 dark:text-gray-100">
              {editingTool ? 'Edit' : 'Add'} {
                selectedToolType === 'end_call' ? 'End Call' : 
                selectedToolType === 'handoff' ? 'Handoff Agent' : 
                selectedToolType === 'transfer_call' ? 'Transfer Call' : 
                selectedToolType === 'ivr_navigator' ? 'IVR Navigator' :
                selectedToolType === 'update_vad_options' ? 'Update VAD Options' :
                selectedToolType === 'nearby_location_finder' ? 'Nearby Hospital Finder' :
                'Custom Tool'
              }
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
                placeholder={selectedToolType === 'ivr_navigator' ? 'Send DTMF' : 'Enter tool name...'}
              />
            </div>

            {/* Description */}
            <div>
              <Label className="text-xs text-gray-700 dark:text-gray-300">Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="text-xs mt-1 min-h-[60px] resize-none bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                placeholder={selectedToolType === 'ivr_navigator' ? 'Send a DTMF tone to pick IVR menu options' : 'Describe what this tool does...'}
              />
            </div>

            {/* IVR Navigator specific fields */}
            {selectedToolType === 'ivr_navigator' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-700 dark:text-gray-300">Function Name</Label>
                    <Input
                      value={formData.function_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, function_name: e.target.value }))}
                      className="h-7 text-xs mt-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="send_dtmf_code"
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-gray-700 dark:text-gray-300">Cooldown (seconds)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="60"
                      value={formData.cooldown_seconds}
                      onChange={(e) => setFormData(prev => ({ ...prev, cooldown_seconds: parseInt(e.target.value) || 3 }))}
                      className="h-7 text-xs mt-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                      placeholder="3"
                    />
                  </div>
                </div>
              </>
            )}

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
                <div>
                  <Label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3 h-3" />
                    SIP Trunk
                  </Label>
                  {loadingPhoneNumbers ? (
                    <div className="w-full h-8 flex items-center justify-center border border-gray-300 dark:border-gray-700 rounded-lg">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    </div>
                  ) : phoneNumbers.length === 0 ? (
                    <div className="w-full h-8 flex items-center px-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {projectId ? 'No phone numbers available for this project' : 'No phone numbers available for outbound calls'}
                      </span>
                    </div>
                  ) : (
                    <Select
                      value={formData.selectedPhoneId}
                      onValueChange={(phoneId) => {
                        const selectedPhone = phoneNumbers.find(p => p.id === phoneId)
                        if (selectedPhone) {
                          setFormData(prev => ({
                            ...prev,
                            selectedPhoneId: phoneId,
                            sipTrunkId: selectedPhone.trunk_id
                          }))
                        }
                      }}
                    >
                      <SelectTrigger className="w-full h-8 text-sm">
                        <SelectValue placeholder="Select phone number" />
                      </SelectTrigger>
                      <SelectContent>
                        {phoneNumbers.map((phone) => (
                          <SelectItem key={phone.id} value={phone.id}>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs">{phone.phone_number}</span>
                              {phone.provider && (
                                <span className="text-gray-500 text-xs">({phone.provider})</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Select a phone number to use its SIP trunk for the transfer. The trunk ID will be automatically used.
                  </p>
                  {formData.sipTrunkId && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      Selected SIP Trunk: <span className="font-mono">{formData.sipTrunkId}</span>
                    </p>
                  )}
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

                {/* Headers Configuration */}
                <div>
                  <Label className="text-xs text-gray-700 dark:text-gray-300">Headers (JSON)</Label>
                  <Textarea
                    value={headersJsonString}
                    onChange={(e) => {
                      const newValue = e.target.value
                      setHeadersJsonString(newValue)
                      // Only update formData.headers if JSON is valid
                      try {
                        const parsed = JSON.parse(newValue)
                        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                          setFormData(prev => ({ ...prev, headers: parsed }))
                        }
                      } catch (err) {
                        // Allow invalid JSON while typing - don't update formData.headers
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

            {/* Nearby location finder fields */}
            {selectedToolType === 'nearby_location_finder' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-gray-700 dark:text-gray-300">Max Results</Label>
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      value={formData.max_results}
                      onChange={(e) => setFormData(prev => ({ ...prev, max_results: parseInt(e.target.value) || 3 }))}
                      className="h-7 text-xs mt-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                      placeholder="3"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-gray-700 dark:text-gray-300">Hospitals (JSON array)</Label>
                  <Textarea
                    value={formData.hospitals_json}
                    onChange={(e) => setFormData(prev => ({ ...prev, hospitals_json: e.target.value }))}
                    className="text-xs mt-1 min-h-[120px] resize-none font-mono bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder='[{"name":"Sparsh Hospital","location":"Koramangala","address":"...","phone":"+91...","latitude":12.93,"longitude":77.62}]'
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Must include latitude/longitude for each hospital.
                  </p>
                </div>

                <div>
                  <Label className="text-xs text-gray-700 dark:text-gray-300">Areas (JSON object)</Label>
                  <Textarea
                    value={formData.areas_json}
                    onChange={(e) => setFormData(prev => ({ ...prev, areas_json: e.target.value }))}
                    className="text-xs mt-1 min-h-[120px] resize-none font-mono bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder='{"koramangala":[12.9352,77.6245],"jayanagar":[12.9250,77.5937]}'
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Keys should be lowercase area names. Values are [lat, lng].
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