"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, CheckCircle, Bot, Phone, PhoneCall, Settings, ArrowRight, Copy, AlertCircle, Zap, Cpu } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface AgentCreationDialogProps {
  isOpen: boolean
  onClose: () => void
  onAgentCreated: (agentData: any) => void
  projectId: string
}

interface VapiAssistant {
  id: string;
  name: string;
  orgId: string;
  createdAt: string;
  updatedAt: string;
  model: any;
  voice: any;
  transcriber: any;
  firstMessage?: string;
  agent_type?: string;
  environment?: string;
  is_active?: boolean;
}

const PLATFORM_OPTIONS = [
  { 
    value: 'livekit', 
    label: 'Livekit',
    description: 'Build with our native platform',
    icon: Cpu,
    color: 'blue'
  },
  { 
    value: 'vapi', 
    label: 'Vapi',
    description: 'Connect existing Vapi assistants',
    icon: Zap,
    color: 'purple'
  }
]

const AGENT_TYPES = [
  { 
    value: 'inbound', 
    label: 'Inbound',
    description: 'Handle incoming calls',
    icon: Phone,
  },
  { 
    value: 'outbound', 
    label: 'Outbound',
    description: 'Make automated calls',
    icon: PhoneCall,
  },
  { 
    value: 'custom', 
    label: 'Custom',
    description: 'Specialized agent',
    icon: Settings,
  }
]

const AgentCreationDialog: React.FC<AgentCreationDialogProps> = ({ 
  isOpen, 
  onClose, 
  onAgentCreated,
  projectId
}) => {
  const [currentStep, setCurrentStep] = useState<'form' | 'success'>('form')
  const [selectedPlatform, setSelectedPlatform] = useState('livekit')
  const assistantSectionRef = useRef<HTMLDivElement>(null)
  
  // Livekit (regular) agent fields
  const [formData, setFormData] = useState({
    name: '',
    agent_type: 'inbound',
    description: ''
  })

  // Vapi agent fields
  const [vapiData, setVapiData] = useState<{
    apiKey: string;
    projectApiKey: string;
    availableAssistants: VapiAssistant[];
    selectedAssistantId: string;
    connectLoading: boolean;
  }>({
    apiKey: '',
    projectApiKey: '',
    availableAssistants: [],
    selectedAssistantId: '',
    connectLoading: false
  });

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdAgentData, setCreatedAgentData] = useState<any>(null)
  const [copiedId, setCopiedId] = useState(false)

  const selectedAgentType = AGENT_TYPES.find(type => type.value === formData.agent_type)

  // Scroll to assistant section after successful connection
  useEffect(() => {
    if (vapiData.availableAssistants.length > 0 && assistantSectionRef.current) {
      setTimeout(() => {
        assistantSectionRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest' 
        })
      }, 100)
    }
  }, [vapiData.availableAssistants.length])

  const handleVapiConnect = async () => {
    if (!vapiData.apiKey.trim()) {
      setError('Vapi API key is required')
      return
    }

    setVapiData(prev => ({ ...prev, connectLoading: true }))
    setError(null)

    try {
      console.log('🔑 Connecting directly to Vapi API with key:', vapiData.apiKey.slice(0, 10) + '...')
      
      // Call Vapi API directly - keeping original functionality
      const response = await fetch('https://api.vapi.ai/assistant', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${vapiData.apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Vapi API error:', errorText)
        
        // Parse error message if possible
        let errorMessage = `Failed to connect to Vapi: ${response.status}`
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.message || errorData.error || errorMessage
        } catch (e) {
          if (errorText) errorMessage = errorText
        }
        
        throw new Error(errorMessage)
      }

      const assistants = await response.json()
      console.log('✅ Vapi assistants fetched directly:', assistants)
      
      setVapiData(prev => ({
        ...prev,
        availableAssistants: assistants || [],
        connectLoading: false
      }))
      
    } catch (err) {
      console.error('💥 Error connecting to Vapi:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect to Vapi')
      setVapiData(prev => ({ ...prev, connectLoading: false }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (selectedPlatform === 'livekit') {
      if (!formData.name.trim()) {
        setError('Agent name is required')
        return
      }
    } else if (selectedPlatform === 'vapi') {
      if (!formData.name.trim()) {
        setError('Agent name is required')
        return
      }
      if (!vapiData.selectedAssistantId) {
        setError('Please select an assistant')
        return
      }
      if (!vapiData.projectApiKey.trim()) {
        setError('Project API key is required')
        return
      }
    }

    setLoading(true)

    try {
      let payload

      if (selectedPlatform === 'livekit') {
        payload = {
          name: formData.name.trim(),
          agent_type: formData.agent_type,
          configuration: {
            description: formData.description.trim() || null,
          },
          project_id: projectId,
          environment: 'dev',
          platform: 'livekit'
        }
      } else {
        const selectedAssistant = vapiData.availableAssistants.find((a: VapiAssistant) => a.id === vapiData.selectedAssistantId)
        payload = {
          name: formData.name.trim(), // Use user-provided name, not assistant name
          agent_type: 'vapi',
          configuration: {
            vapi: {
              apiKey: vapiData.apiKey.trim(),
              projectApiKey: vapiData.projectApiKey.trim(),
              assistantId: vapiData.selectedAssistantId,
              assistantName: selectedAssistant?.name, // Keep assistant name for reference
              model: selectedAssistant?.model,
              voice: selectedAssistant?.voice
            }
          },
          project_id: projectId,
          environment: 'dev',
          platform: 'vapi'
        }
      }

      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create agent')
      }

      const data = await response.json()
      console.log('✅ Agent created successfully:', data)
      
      setCreatedAgentData(data)
      setCurrentStep('success')
      
    } catch (err: unknown) {
      console.error('💥 Error creating agent:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to create agent'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading && !vapiData.connectLoading) {
      setCurrentStep('form')
      setSelectedPlatform('livekit')
      setFormData({ name: '', agent_type: 'inbound', description: '' })
      setVapiData({ apiKey: '', projectApiKey: '', availableAssistants: [], selectedAssistantId: '', connectLoading: false })
      setError(null)
      setCreatedAgentData(null)
      setCopiedId(false)
      onClose()
    }
  }

  const handleFinish = () => {
    onAgentCreated(createdAgentData)
    handleClose()
  }

  const handleCopyId = async () => {
    if (createdAgentData?.id) {
      try {
        await navigator.clipboard.writeText(createdAgentData.id)
        setCopiedId(true)
        setTimeout(() => setCopiedId(false), 2000)
      } catch (err) {
        console.error('Failed to copy agent ID:', err)
      }
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg w-[90vw] sm:w-full p-0 gap-0 rounded-xl border border-gray-200 shadow-2xl bg-white max-h-[90vh] flex flex-col">
        {currentStep === 'form' ? (
          <>
            {/* Header */}
            <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl flex items-center justify-center border border-gray-100">
                  <Bot className="w-6 h-6 text-gray-700" />
                </div>
                <DialogTitle className="text-lg font-semibold text-gray-900 mb-1">
                  Create New Agent
                </DialogTitle>
                <p className="text-sm text-gray-600">
                  Choose your platform and configure your AI agent
                </p>
              </div>
            </DialogHeader>

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto px-6">
              <div className="space-y-5 pb-6">
                {/* Platform Selection - Compact Style */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-900">
                    Select Platform
                  </label>
                  <div className="flex gap-2">
                    {PLATFORM_OPTIONS.map((platform) => {
                      const Icon = platform.icon
                      const isSelected = selectedPlatform === platform.value
                      
                      return (
                        <div
                          key={platform.value}
                          className={`relative flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200 flex-1 ${
                            isSelected 
                              ? platform.color === 'purple'
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                          onClick={() => setSelectedPlatform(platform.value)}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isSelected 
                              ? platform.color === 'purple'
                                ? 'bg-purple-600 text-white'
                                : 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 text-sm">{platform.label}</div>
                            <div className="text-xs text-gray-500 leading-tight">{platform.description}</div>
                          </div>
                          <input
                            type="radio"
                            name="platform"
                            value={platform.value}
                            checked={isSelected}
                            onChange={() => setSelectedPlatform(platform.value)}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            disabled={loading}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Platform-specific Content */}
                <div className={`space-y-4 transition-all duration-300 ${
                  selectedPlatform === 'vapi' ? 'bg-purple-50/50 -mx-6 px-6 py-4 rounded-lg border border-purple-100' : ''
                }`}>
                  
                  {/* Agent Name - Always shown */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-900">
                      Agent Name
                    </label>
                    <Input
                      placeholder={selectedPlatform === 'vapi' ? "My Vapi Agent" : "Customer Support Bot"}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      disabled={loading}
                      className="h-10 px-3 text-sm border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                    />
                    {selectedPlatform === 'vapi' && (
                      <p className="text-xs text-purple-600">
                        This name is for your dashboard (independent of Vapi assistant name)
                      </p>
                    )}
                  </div>

                  {/* Livekit Fields */}
                  {selectedPlatform === 'livekit' && (
                    <>
                      {/* Agent Type Selection */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-900">
                          Agent Type
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {AGENT_TYPES.map((type) => {
                            const Icon = type.icon
                            const isSelected = formData.agent_type === type.value
                            
                            return (
                              <div
                                key={type.value}
                                className={`relative p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                                  isSelected 
                                    ? 'border-blue-500 bg-blue-50 shadow-sm' 
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                                onClick={() => setFormData({ ...formData, agent_type: type.value })}
                              >
                                <div className="text-center">
                                  <div className={`w-8 h-8 mx-auto mb-2 rounded-lg flex items-center justify-center ${
                                    isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <div className="text-xs font-medium text-gray-900 mb-0.5">{type.label}</div>
                                  <div className="text-xs text-gray-500 leading-tight">{type.description}</div>
                                </div>
                                <input
                                  type="radio"
                                  name="agent_type"
                                  value={type.value}
                                  checked={isSelected}
                                  onChange={() => setFormData({ ...formData, agent_type: type.value })}
                                  className="absolute inset-0 opacity-0 cursor-pointer"
                                  disabled={loading}
                                />
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Description */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-900">
                          Description <span className="text-gray-500 font-normal">(optional)</span>
                        </label>
                        <textarea
                          placeholder="Brief description of your agent..."
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          disabled={loading}
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none transition-all placeholder:text-gray-500"
                        />
                      </div>
                    </>
                  )}

                  {/* Vapi Fields */}
                  {selectedPlatform === 'vapi' && (
                    <div className="space-y-4">
                      {/* Step indicator for Vapi flow */}
                      <div className="flex items-center text-xs text-purple-600 bg-white/60 rounded-lg p-3 border border-purple-200">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-purple-600 text-white rounded-full flex items-center justify-center font-medium">1</div>
                          <span className="font-medium">Connect Vapi Account</span>
                        </div>
                        {vapiData.availableAssistants.length > 0 && (
                          <>
                            <ArrowRight className="w-3 h-3 mx-3 text-purple-400" />
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 bg-purple-600 text-white rounded-full flex items-center justify-center font-medium">2</div>
                              <span className="font-medium">Select Assistant</span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Vapi API Key */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-900">
                          <span className="flex items-center gap-2">
                            Vapi Private Key
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                              Secure
                            </Badge>
                          </span>
                        </label>
                        <div className="flex gap-2">
                          <Input
                            type="password"
                            placeholder="sk-..."
                            value={vapiData.apiKey}
                            onChange={(e) => setVapiData({ ...vapiData, apiKey: e.target.value })}
                            disabled={loading || vapiData.connectLoading}
                            className="flex-1 h-10 font-mono text-sm bg-white border-purple-200 focus:border-purple-500 focus:ring-purple-500/20"
                          />
                          <Button
                            type="button"
                            onClick={handleVapiConnect}
                            disabled={loading || vapiData.connectLoading || !vapiData.apiKey.trim()}
                            className="h-10 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium"
                          >
                            {vapiData.connectLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              'Connect'
                            )}
                          </Button>
                        </div>
                        <p className="text-xs text-gray-600">
                          Get your private key from{' '}
                          <a 
                            href="https://dashboard.vapi.ai" 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-purple-600 hover:underline font-medium"
                          >
                            Vapi Dashboard
                          </a>
                        </p>
                      </div>

                      {/* Assistant Selection - Full Width */}
                      {vapiData.availableAssistants.length > 0 && (
                        <div ref={assistantSectionRef} className="space-y-2 bg-white/60 rounded-lg p-4 border border-purple-200 -mx-2">
                          <label className="block text-sm font-medium text-gray-900">
                            Select Assistant
                            <Badge variant="outline" className="ml-2 text-xs bg-green-50 text-green-700 border-green-200">
                              {vapiData.availableAssistants.length} found
                            </Badge>
                          </label>
                          <Select 
                            value={vapiData.selectedAssistantId} 
                            onValueChange={(value) => setVapiData({ ...vapiData, selectedAssistantId: value })}
                          >
                            <SelectTrigger className="h-10 bg-white border-purple-200 focus:border-purple-500 w-full">
                              <SelectValue placeholder="Choose an assistant">
                                {vapiData.selectedAssistantId && (
                                  <div className="flex items-center gap-2">
                                    <Bot className="w-4 h-4 text-purple-500" />
                                    <span>{vapiData.availableAssistants.find((a: VapiAssistant) => a.id === vapiData.selectedAssistantId)?.name}</span>
                                  </div>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="w-full">
                              {vapiData.availableAssistants.map((assistant: VapiAssistant) => (
                                <SelectItem key={assistant.id} value={assistant.id}>
                                  <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                                        <Bot className="w-4 h-4 text-purple-600" />
                                      </div>
                                      <div>
                                        <div className="font-medium text-gray-900">{assistant.name}</div>
                                        {assistant.voice?.provider && (
                                          <div className="text-xs text-gray-500">
                                            Voice: {assistant.voice.provider}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Project API Key */}
                      {vapiData.selectedAssistantId && (
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-900">
                            Project API Key
                          </label>
                          <Input
                            type="password"
                            placeholder="Your project API key..."
                            value={vapiData.projectApiKey}
                            onChange={(e) => setVapiData({ ...vapiData, projectApiKey: e.target.value })}
                            disabled={loading}
                            className="h-10 font-mono bg-white border-purple-200 focus:border-purple-500 focus:ring-purple-500/20"
                          />
                          <p className="text-xs text-gray-600">
                            Your internal project API key for this integration
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Error Message */}
                {error && (
                  <Alert variant="destructive" className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">{error}</AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            {/* Sticky Footer with Actions */}
            <div className="flex-shrink-0 px-6 py-4 bg-gray-50/50 border-t border-gray-200">
              <div className="flex gap-3">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={handleClose}
                  disabled={loading || vapiData.connectLoading}
                  className="flex-1 h-10 text-gray-700 border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={
                    loading || 
                    vapiData.connectLoading ||
                    (selectedPlatform === 'livekit' && !formData.name.trim()) ||
                    (selectedPlatform === 'vapi' && (!formData.name.trim() || !vapiData.selectedAssistantId || !vapiData.projectApiKey.trim()))
                  }
                  className={`flex-1 h-10 font-medium text-white ${
                    selectedPlatform === 'vapi' 
                      ? 'bg-purple-600 hover:bg-purple-700' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    'Create Agent'
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Success Screen */}
            <DialogHeader className="px-6 pt-6 pb-4 text-center border-b border-gray-100">
              <div className="w-12 h-12 mx-auto mb-3 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <DialogTitle className="text-lg font-semibold text-gray-900 mb-1">
                Agent Created
              </DialogTitle>
              <p className="text-sm text-gray-600">
                "{createdAgentData?.name}" is ready to use
              </p>
            </DialogHeader>

            <div className="px-6 py-5 space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                    {selectedPlatform === 'vapi' ? (
                      <Bot className="w-5 h-5 text-purple-600" />
                    ) : (
                      selectedAgentType && <selectedAgentType.icon className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {createdAgentData?.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={`text-xs ${
                        selectedPlatform === 'vapi' 
                          ? 'bg-purple-50 text-purple-700 border-purple-200' 
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {selectedPlatform === 'vapi' ? 'Vapi Connected' : selectedAgentType?.label}
                      </Badge>
                      <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200">
                        Development
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                  <span className="text-sm text-gray-600">Agent ID</span>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-800">
                      {createdAgentData?.id?.slice(0, 8)}...
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyId}
                      className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {copiedId && (
                  <p className="text-xs text-green-600 text-right mt-1">
                    Copied to clipboard
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button 
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1 h-10 text-gray-700 border-gray-300 hover:bg-gray-50"
                >
                  Create Another
                </Button>
                <Button 
                  onClick={handleFinish}
                  className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  Configure
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default AgentCreationDialog