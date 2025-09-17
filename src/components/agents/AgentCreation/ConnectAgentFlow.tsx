"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, CheckCircle, Bot, ArrowRight, Copy, AlertCircle, Zap, Link as LinkIcon, Eye, Activity, Info, ArrowLeft } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface ConnectAgentFlowProps {
  projectId: string
  onBack: () => void
  onClose: () => void
  onAgentCreated: (agentData: any) => void
  onLoadingChange: (loading: boolean) => void
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
    label: 'LiveKit Agent',
    description: 'Monitor your LiveKit voice agent',
    icon: Activity,
    color: 'blue'
  },
  { 
    value: 'vapi', 
    label: 'Vapi Assistant',
    description: 'Monitor your Vapi assistant calls',
    icon: Zap,
    color: 'green'
  }
]

const ConnectAgentFlow: React.FC<ConnectAgentFlowProps> = ({
  projectId,
  onBack,
  onClose,
  onAgentCreated,
  onLoadingChange
}) => {
  const [currentStep, setCurrentStep] = useState<'form' | 'creating' | 'connecting' | 'success'>('form')
  const [selectedPlatform, setSelectedPlatform] = useState('livekit')
  const assistantSectionRef = useRef<HTMLDivElement>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })

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

  const [error, setError] = useState<string | null>(null)
  const [createdAgentData, setCreatedAgentData] = useState<any>(null)
  const [copiedId, setCopiedId] = useState(false)
  const [webhookSetupStatus, setWebhookSetupStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null)

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
      console.log('🔑 Connecting to Vapi to fetch assistants:', vapiData.apiKey.slice(0, 10) + '...')
      
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
      console.log('✅ Vapi assistants fetched:', assistants)
      
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

  const setupVapiWebhook = async (agentId: string) => {
    try {      
      const response = await fetch(`/api/agents/${agentId}/vapi/setup-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to setup monitoring webhook')
      }
      
      setWebhookSetupStatus({
        success: true,
        message: 'Monitoring configured successfully! Your assistant is now being observed.'
      })
      
      return data
      
    } catch (error) {
      setWebhookSetupStatus({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to setup monitoring webhook'
      })
      throw error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (selectedPlatform === 'livekit') {
      if (!formData.name.trim()) {
        setError('Monitoring label is required')
        return
      }
    } else if (selectedPlatform === 'vapi') {
      if (!formData.name.trim()) {
        setError('Monitoring label is required')
        return
      }
      if (!vapiData.selectedAssistantId) {
        setError('Please select an assistant to monitor')
        return
      }
      if (!vapiData.projectApiKey.trim()) {
        setError('Project API key is required')
        return
      }
    }

    onLoadingChange(true)
    setCurrentStep('creating')

    try {
      let payload

      if (selectedPlatform === 'livekit') {
        payload = {
          name: formData.name.trim(),
          agent_type: 'livekit',
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
          name: formData.name.trim(),
          agent_type: 'vapi',
          configuration: {
            vapi: {
              apiKey: vapiData.apiKey.trim(),
              projectApiKey: vapiData.projectApiKey.trim(),
              assistantId: vapiData.selectedAssistantId,
              assistantName: selectedAssistant?.name,
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
        throw new Error(errorData.error || 'Failed to setup monitoring')
      }

      const data = await response.json()
      
      setCreatedAgentData(data)

      if (selectedPlatform === 'vapi') {
        setCurrentStep('connecting')
        setWebhookSetupStatus(null)
        
        try {
          await setupVapiWebhook(data.id)
          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (webhookError) {
          console.warn('⚠️ Monitoring webhook setup failed, but connection was created')
        }
      }
      
      setCurrentStep('success')
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to setup monitoring'
      setError(errorMessage)
      setCurrentStep('form')
    } finally {
      onLoadingChange(false)
    }
  }

  const handleCopyId = async () => {
    if (createdAgentData?.id) {
      try {
        await navigator.clipboard.writeText(createdAgentData.id)
        setCopiedId(true)
        setTimeout(() => setCopiedId(false), 2000)
      } catch (err) {
        console.error('Failed to copy monitoring ID:', err)
      }
    }
  }

  const handleFinish = () => {
    onAgentCreated(createdAgentData)
    onClose()
  }

  if (currentStep === 'creating' || currentStep === 'connecting') {
    return (
      <div className="px-6 py-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-50 to-teal-50 dark:from-blue-900/20 dark:to-teal-900/20 rounded-2xl flex items-center justify-center border border-gray-100 dark:border-gray-800">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
        </div>
        
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {currentStep === 'creating' ? 'Setting Up Monitoring' : 'Connecting Monitoring'}
        </h3>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          {currentStep === 'creating' 
            ? 'Configuring observability for your agent...' 
            : 'Establishing monitoring connection...'}
        </p>

        {selectedPlatform === 'vapi' && (
          <div className="space-y-3 max-w-xs mx-auto">
            <div className={`flex items-center gap-3 text-sm ${
              currentStep === 'creating' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                currentStep === 'creating' 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                  : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
              }`}>
                {currentStep === 'creating' ? <Loader2 className="w-3 h-3 animate-spin" /> : '✓'}
              </div>
              <span className={currentStep === 'creating' ? 'font-medium' : ''}>
                Setting Up Monitoring
              </span>
            </div>
            
            <div className={`flex items-center gap-3 text-sm ${
              currentStep === 'connecting' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-600'
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                currentStep === 'connecting' 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'
              }`}>
                {currentStep === 'connecting' ? <Loader2 className="w-3 h-3 animate-spin" /> : '2'}
              </div>
              <span className={currentStep === 'connecting' ? 'font-medium' : ''}>
                Connecting Webhook
              </span>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (currentStep === 'success') {
    return (
      <>
        {/* Success Header */}
        <DialogHeader className="px-6 pt-6 pb-4 text-center border-b border-gray-100 dark:border-gray-800">
          <div className="w-12 h-12 mx-auto mb-3 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Monitoring Setup Complete!
          </DialogTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            "{createdAgentData?.name}" is now being observed
          </p>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                {selectedPlatform === 'vapi' ? (
                  <Eye className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                ) : (
                  <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {createdAgentData?.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={`text-xs ${
                    selectedPlatform === 'vapi' 
                      ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800' 
                      : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                  }`}>
                    {selectedPlatform === 'vapi' ? 'Vapi Monitoring' : 'LiveKit Monitoring'}
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-gray-50 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700">
                    Development
                  </Badge>
                </div>
              </div>
            </div>

            {/* Webhook Status for Vapi */}
            {selectedPlatform === 'vapi' && webhookSetupStatus && (
              <div className={`p-3 rounded-lg border mb-3 ${
                webhookSetupStatus.success 
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                  : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
              }`}>
                <div className="flex items-center gap-2">
                  {webhookSetupStatus.success ? (
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <LinkIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  )}
                  <span className={`text-sm font-medium ${
                    webhookSetupStatus.success ? 'text-green-800 dark:text-green-200' : 'text-orange-800 dark:text-orange-200'
                  }`}>
                    {webhookSetupStatus.success ? 'Monitoring Active' : 'Manual Setup Required'}
                  </span>
                </div>
                <p className={`text-xs mt-1 ${
                  webhookSetupStatus.success ? 'text-green-700 dark:text-green-300' : 'text-orange-700 dark:text-orange-300'
                }`}>
                  {webhookSetupStatus.message}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">Monitoring ID</span>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-800 dark:text-gray-200">
                  {createdAgentData?.id?.slice(0, 8)}...
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyId}
                  className="h-6 w-6 p-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
            {copiedId && (
              <p className="text-xs text-green-600 dark:text-green-400 text-right mt-1">
                Copied to clipboard
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button 
              variant="outline"
              onClick={onClose}
              className="flex-1 h-10 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Monitor Another
            </Button>
            <Button 
              onClick={handleFinish}
              className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-medium"
            >
              View Integration
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Header */}
      <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="text-center flex-1">
            <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-blue-50 to-teal-50 dark:from-blue-900/20 dark:to-teal-900/20 rounded-xl flex items-center justify-center border border-gray-100 dark:border-gray-800">
              <Eye className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </div>
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Connect Existing Agent
            </DialogTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Add monitoring to your existing voice agent
            </p>
          </div>
        </div>
      </DialogHeader>

      {/* Scrollable Form Content */}
      <div className="flex-1 overflow-y-auto px-6">
        <div className="space-y-5 pb-6">
          {/* Platform Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
              Agent Platform
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
                        ? platform.color === 'green'
                          ? 'border-teal-500 dark:border-teal-600 bg-teal-50 dark:bg-teal-900/20'
                          : 'border-blue-500 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                    onClick={() => setSelectedPlatform(platform.value)}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isSelected 
                        ? platform.color === 'green'
                          ? 'bg-teal-600 dark:bg-teal-600 text-white'
                          : 'bg-blue-600 dark:bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">{platform.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{platform.description}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Platform-specific Content */}
          <div className={`space-y-4 transition-all duration-300 ${
            selectedPlatform === 'vapi' ? 'bg-teal-50/50 dark:bg-teal-900/10 px-4 py-4 rounded-lg border border-teal-100 dark:border-teal-800' : ''
          }`}>
            
            {/* Monitoring Label - Always shown */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Agent Name (Monitoring Label)
                </label>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400">
                        <Info size={16} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>This is how you'll identify this monitoring setup in your dashboard</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              
              <Input
                placeholder={selectedPlatform === 'vapi' ? "Support Assistant Monitor" : "Customer Agent Monitor"}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-10 px-3 text-sm border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 focus:outline-none transition-all"
              />
            </div>

            {/* LiveKit Fields */}
            {selectedPlatform === 'livekit' && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Notes <span className="text-gray-500 dark:text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  placeholder="Brief description of what this agent does..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 focus:outline-none resize-none transition-all placeholder:text-gray-500 dark:placeholder:text-gray-400"
                />
              </div>
            )}

            {/* Vapi Fields */}
            {selectedPlatform === 'vapi' && (
              <div className="space-y-4">
                {/* Step indicator for Vapi flow */}
                <div className="flex items-center text-xs text-teal-600 dark:text-teal-400 bg-white/60 dark:bg-gray-900/30 rounded-lg p-3 border border-teal-200 dark:border-teal-800">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-teal-600 dark:bg-teal-600 text-white rounded-full flex items-center justify-center font-medium">1</div>
                    <span className="font-medium">Connect Vapi Account</span>
                  </div>
                  {vapiData.availableAssistants.length > 0 && (
                    <>
                      <ArrowRight className="w-3 h-3 mx-3 text-teal-400 dark:text-teal-500" />
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-teal-600 dark:bg-teal-600 text-white rounded-full flex items-center justify-center font-medium">2</div>
                        <span className="font-medium">Select Assistant</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Vapi API Key */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                    <span className="flex items-center gap-2">
                      Vapi Private Key
                      <Badge variant="outline" className="text-xs bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800">
                        Secure
                      </Badge>
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="Paste your Vapi private key here"
                      value={vapiData.apiKey}
                      onChange={(e) => setVapiData({ ...vapiData, apiKey: e.target.value })}
                      disabled={vapiData.connectLoading}
                      className="flex-1 h-10 font-mono text-sm bg-white dark:bg-gray-900 border-teal-200 dark:border-teal-800 focus:border-teal-600 dark:focus:border-teal-400 focus:ring-teal-600/20 dark:focus:ring-teal-400/20"
                    />
                    <Button
                      type="button"
                      onClick={handleVapiConnect}
                      disabled={vapiData.connectLoading || !vapiData.apiKey.trim()}
                      className="h-10 px-4 bg-teal-600 hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-700 text-white font-medium"
                    >
                      {vapiData.connectLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Connect'
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Get your private key from{' '}
                    <a 
                      href="https://dashboard.vapi.ai" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-teal-600 dark:text-teal-400 hover:underline font-medium"
                    >
                      Vapi Dashboard
                    </a>
                  </p>
                </div>

                {/* Assistant Selection */}
                {vapiData.availableAssistants.length > 0 && (
                  <div ref={assistantSectionRef} className="space-y-2 bg-white/60 dark:bg-gray-900/30 rounded-lg p-4 border border-teal-200 dark:border-teal-800 -mx-2">
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                      Select Assistant to Monitor
                      <Badge variant="outline" className="ml-2 text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                        {vapiData.availableAssistants.length} found
                      </Badge>
                    </label>
                    <Select 
                      value={vapiData.selectedAssistantId} 
                      onValueChange={(value) => setVapiData({ ...vapiData, selectedAssistantId: value })}
                    >
                      <SelectTrigger className="h-10 bg-white dark:bg-gray-900 border-teal-200 dark:border-teal-800 focus:border-teal-600 dark:focus:border-teal-400 w-full">
                        <SelectValue placeholder="Choose an assistant to monitor">
                          {vapiData.selectedAssistantId && (
                            <div className="flex items-center gap-2">
                              <Eye className="w-4 h-4 text-teal-600 dark:text-teal-400" />
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
                                <div className="w-8 h-8 bg-teal-50 dark:bg-teal-900/30 rounded-lg flex items-center justify-center">
                                  <Bot className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-gray-100">{assistant.name}</div>
                                  {assistant.voice?.provider && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
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
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                      Project API Key
                    </label>
                    <Input
                      type="password"
                      placeholder="Your project API key..."
                      value={vapiData.projectApiKey}
                      onChange={(e) => setVapiData({ ...vapiData, projectApiKey: e.target.value })}
                      className="h-10 font-mono bg-white dark:bg-gray-900 border-teal-200 dark:border-teal-800 focus:border-teal-600 dark:focus:border-teal-400 focus:ring-teal-600/20 dark:focus:ring-teal-400/20"
                    />
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Your internal project API key for this monitoring setup
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive" className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <AlertDescription className="text-red-800 dark:text-red-200">{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      {/* Sticky Footer with Actions */}
      <div className="flex-shrink-0 px-6 py-4 bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800">
        <div className="flex gap-3">
          <Button 
            type="button" 
            variant="outline"
            onClick={onBack}
            disabled={vapiData.connectLoading}
            className="flex-1 h-10 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Back
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={
              vapiData.connectLoading ||
              (selectedPlatform === 'livekit' && !formData.name.trim()) ||
              (selectedPlatform === 'vapi' && (!formData.name.trim() || !vapiData.selectedAssistantId || !vapiData.projectApiKey.trim()))
            }
            className={`flex-1 h-10 font-medium text-white ${
              selectedPlatform === 'vapi' 
                ? 'bg-teal-600 hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-700' 
                : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700'
            }`}
          >
            Start Monitoring
          </Button>
        </div>
      </div>
    </>
  )
}

export default ConnectAgentFlow