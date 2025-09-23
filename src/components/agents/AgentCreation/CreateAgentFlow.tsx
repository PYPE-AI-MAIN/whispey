"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, CheckCircle, AlertCircle, Zap, Activity, Info, Copy, ArrowRight } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface CreateAgentFlowProps {
  projectId: string
  onBack: () => void
  onClose: () => void
  onAgentCreated: (agentData: any) => void
  onLoadingChange: (loading: boolean) => void
  isPypeAgent?: boolean
}

const CreateAgentFlow: React.FC<CreateAgentFlowProps> = ({
  projectId,
  onBack,
  onClose,
  onAgentCreated,
  onLoadingChange,
  isPypeAgent
}) => {
  const [currentStep, setCurrentStep] = useState<'form' | 'creating' | 'success'>('form')
  const [selectedPlatform, setSelectedPlatform] = useState('livekit')
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })
  const [error, setError] = useState<string | null>(null)
  const [createdAgentData, setCreatedAgentData] = useState<any>(null)
  const [copiedId, setCopiedId] = useState(false)

  const fetchProjectApiKey = async (): Promise<string> => {
    try {
      const response = await fetch(`/api/projects/${projectId}/api-keys`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch API keys')
      }
      
      const data = await response.json()
      const keys = data.keys || []
      
      if (keys.length === 0) {
        throw new Error('No API key found for this project')
      }
      
      const keyToUse = keys[0]
      
      if (keyToUse.legacy) {
        throw new Error('Cannot use legacy API key. Please regenerate your API key first.')
      }
      
      if (!keyToUse.token_hash_master) {
        throw new Error('No encrypted key found for this project')
      }
      
      return keyToUse.token_hash_master
      
    } catch (error) {
      console.error('Error fetching project API key:', error)
      throw error
    }
  }
  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
  
    if (!formData.name.trim()) {
      setError('Agent name is required')
      return
    }
  
    onLoadingChange(true)
    setCurrentStep('creating')
  
    try {
      // Use the fetchProjectApiKey function you already created
      const projectApiKey = await fetchProjectApiKey()
  
      // Step 1: Create monitoring record in your backend (Whispey)
      const agentPayload = {
        name: formData.name.trim(),
        agent_type: isPypeAgent ? 'pype_agent' : selectedPlatform, // Set based on flow type
        configuration: {
          description: formData.description.trim() || null,
        },
        project_id: projectId,
        environment: 'dev',
        platform: selectedPlatform
      }
  
      const agentResponse = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentPayload),
      })
  
      if (!agentResponse.ok) {
        const errorData = await agentResponse.json()
        throw new Error(errorData.error || 'Failed to create monitoring record')
      }
  
      const localAgent = await agentResponse.json()
  
      // Step 2: Only create external agent infrastructure if it's a Pype agent
      if (isPypeAgent) {
        console.log('🔑 Debug - Project API Key:', projectApiKey) // Debug log
      
        // Encrypt the API version identifier via server
        const encryptResponse = await fetch(`/api/projects/${projectId}/api-keys/encrypt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: 'pype-api-v1' })
        })
      
        if (!encryptResponse.ok) {
          throw new Error('Failed to encrypt API key')
        }
      
        const { encrypted: encryptedApiKey } = await encryptResponse.json()
        console.log('🔐 Debug - Encrypted API Key:', encryptedApiKey) // Debug log
        
        const agent = {
          name: formData.name.trim(),
          type: 'OUTBOUND',
          assistant: [{
            name: formData.name.trim(),
            prompt: `You are a helpful ${selectedPlatform} assistant. ${formData.description || 'Assist users with their queries in a friendly and professional manner.'}`,
            variables: {},
            stt: { 
              name: selectedPlatform === 'vapi' ? 'deepgram' : 'sarvam', 
              language: selectedPlatform === 'vapi' ? 'en' : 'en-IN', 
              model: selectedPlatform === 'vapi' ? 'nova-2' : 'saarika:v2.5' 
            },
            llm: { 
              name: 'openai', 
              provider: 'openai', 
              model: 'gpt-4o-mini', 
              temperature: 0.3, 
              api_key_env: 'OPENAI_API_KEY' 
            },
            tts: {
              name: 'elevenlabs',
              voice_id: 'H8bdWZHK2OgZwTN7ponr',
              model: 'eleven_flash_v2_5',
              language: 'en',
              voice_settings: {
                similarity_boost: 1,
                stability: 0.7,
                style: 0.7,
                use_speaker_boost: false,
                speed: 1.1
              }
            },
            vad: { name: 'silero', min_silence_duration: 0.2 },
            tools: [],
            interruptions: {
              allow_interruptions: false,
              min_interruption_duration: 1.3,
              min_interruption_words: 2
            },
            first_message_mode: {
              mode: 'assistant_waits_for_user',
              first_message: 'Hello! How can I help you today?',
              allow_interruptions: false
            }
          }],
          agent_id: localAgent.id,
          whispey_key_id: projectApiKey
        }
      
        const createResponse = await fetch('/api/agents/create-agent', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-api-key': encryptedApiKey
          },
          body: JSON.stringify({ agent })
        })
      
        if (!createResponse.ok) {
          const createErrorData = await createResponse.json()
          throw new Error(createErrorData.error || createErrorData.detail || 'Failed to create agent infrastructure')
        }
      }
      
      setCreatedAgentData(localAgent)
      setCurrentStep('success')
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create agent'
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
        console.error('Failed to copy agent ID:', err)
      }
    }
  }

  const handleFinish = () => {
    onAgentCreated(createdAgentData)
    onClose()
  }

  if (currentStep === 'creating') {
    return (
      <div className="px-6 py-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-50 to-teal-50 dark:from-blue-900/20 dark:to-teal-900/20 rounded-2xl flex items-center justify-center border border-gray-100 dark:border-gray-800">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
        </div>
        
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Creating Agent
        </h3>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Setting up your new voice agent infrastructure...
        </p>

        <div className="space-y-3 max-w-xs mx-auto">
          <div className="flex items-center gap-3 text-sm text-blue-600 dark:text-blue-400">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <Loader2 className="w-3 h-3 animate-spin" />
            </div>
            <span className="font-medium">Creating Infrastructure</span>
          </div>
          
          <div className="flex items-center gap-3 text-sm text-gray-400 dark:text-gray-600">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600">
              2
            </div>
            <span>Configuring Platform</span>
          </div>
        </div>
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
            Agent Created Successfully!
          </DialogTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            "{createdAgentData?.name}" is ready for use
          </p>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                {selectedPlatform === 'vapi' ? (
                  <Zap className="w-5 h-5 text-teal-600 dark:text-teal-400" />
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
                    {selectedPlatform === 'vapi' ? 'Vapi Agent' : 'LiveKit Agent'}
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-gray-50 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700">
                    Ready
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-600 dark:text-gray-400">Agent ID</span>
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
              Create Another
            </Button>
            <Button 
              onClick={handleFinish}
              className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-medium"
            >
              View Agent
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
              <Activity className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </div>
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Create New Agent
            </DialogTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Build a voice agent from scratch
            </p>
          </div>
        </div>
      </DialogHeader>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto px-6">
        <div className="space-y-5 pb-6">
          {/* Agent Name */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                Agent Name
              </label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400">
                      <Info size={16} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>This will be the name of your voice agent</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <Input
              placeholder={selectedPlatform === 'vapi' ? "Customer Support Agent" : "Voice Assistant"}
              value={formData.name}
              autoComplete="off"
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="h-10 px-3 text-sm border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 focus:outline-none transition-all"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
              Description <span className="text-gray-500 dark:text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              placeholder="Brief description of what this agent does..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 focus:outline-none resize-none transition-all placeholder:text-gray-500 dark:placeholder:text-gray-400"
            />
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

      {/* Footer */}
      <div className="flex-shrink-0 px-6 py-4 bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800">
        <div className="flex gap-3">
          <Button 
            type="button" 
            variant="outline"
            onClick={onBack}
            className="flex-1 h-10 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Back
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!formData.name.trim()}
            className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Agent
          </Button>
        </div>
      </div>
    </>
  )
}

export default CreateAgentFlow
// pype_bfccd9fd5d891de547842dddfa2da71f459e4b1d4e4b933d0001ed2626d8086a