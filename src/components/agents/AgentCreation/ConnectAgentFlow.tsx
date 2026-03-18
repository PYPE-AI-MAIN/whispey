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
import { Loader2, CheckCircle, Bot, ArrowRight, Copy, AlertCircle, Zap, Link as LinkIcon, Eye, Activity, Radio } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ConnectAgentFlowProps {
  projectId: string
  onBack: () => void
  onClose: () => void
  onAgentCreated: (agentData: any) => void
  onLoadingChange: (loading: boolean) => void
}

interface VapiAssistant {
  id: string
  name: string
  orgId: string
  createdAt: string
  updatedAt: string
  model: any
  voice: any
  transcriber: any
  firstMessage?: string
}

interface RetellAgent {
  agent_id: string
  agent_name: string
  voice_id: string
  language: string
  version: number
  response_engine: {
    type: string
    llm_id?: string
  }
  last_modification_timestamp: number
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
  },
  {
    value: 'retell',
    label: 'Retell Agent',
    description: 'Monitor your Retell voice agent',
    icon: Radio,
    color: 'purple'
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

  const [formData, setFormData] = useState({ name: '', description: '' })

  const [vapiData, setVapiData] = useState<{
    apiKey: string
    availableAssistants: VapiAssistant[]
    selectedAssistantId: string
    connectLoading: boolean
  }>({
    apiKey: '',
    availableAssistants: [],
    selectedAssistantId: '',
    connectLoading: false,
  })

  const [retellData, setRetellData] = useState<{
    apiKey: string
    availableAgents: RetellAgent[]
    selectedAgentId: string
    connectLoading: boolean
  }>({
    apiKey: '',
    availableAgents: [],
    selectedAgentId: '',
    connectLoading: false,
  })

  const [error, setError] = useState<string | null>(null)
  const [createdAgentData, setCreatedAgentData] = useState<any>(null)
  const [copiedId, setCopiedId] = useState(false)
  const [webhookSetupStatus, setWebhookSetupStatus] = useState<{
    success: boolean
    message: string
  } | null>(null)

  // Scroll to assistant/agent section after fetch
  useEffect(() => {
    if (
      (vapiData.availableAssistants.length > 0 || retellData.availableAgents.length > 0) &&
      assistantSectionRef.current
    ) {
      setTimeout(() => {
        assistantSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 100)
    }
  }, [vapiData.availableAssistants.length, retellData.availableAgents.length])

  const fetchProjectApiKey = async (): Promise<string> => {
    const response = await fetch(`/api/projects/${projectId}/api-keys`)
    if (!response.ok) throw new Error('Failed to fetch API keys')
    const data = await response.json()
    const keys = data.keys || []
    if (keys.length === 0) throw new Error('No API key found for this project')
    const keyToUse = keys[0]
    if (keyToUse.legacy) throw new Error('Cannot use legacy API key. Please regenerate your API key first.')
    if (!keyToUse.token_hash_master) throw new Error('No encrypted key found for this project')
    return keyToUse.token_hash_master
  }

  // ── Vapi connect ────────────────────────────────────────────────────────────
  const handleVapiConnect = async () => {
    if (!vapiData.apiKey.trim()) { setError('Vapi API key is required'); return }
    setVapiData(prev => ({ ...prev, connectLoading: true }))
    setError(null)
    try {
      const response = await fetch('https://api.vapi.ai/assistant', {
        headers: { 'Authorization': `Bearer ${vapiData.apiKey.trim()}`, 'Content-Type': 'application/json' },
      })
      if (!response.ok) {
        const errorText = await response.text()
        let msg = `Failed to connect to Vapi: ${response.status}`
        try { msg = JSON.parse(errorText).message || msg } catch {}
        throw new Error(msg)
      }
      const assistants = await response.json()
      setVapiData(prev => ({ ...prev, availableAssistants: assistants || [], connectLoading: false }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Vapi')
      setVapiData(prev => ({ ...prev, connectLoading: false }))
    }
  }

  // ── Retell connect ──────────────────────────────────────────────────────────
  const handleRetellConnect = async () => {
    if (!retellData.apiKey.trim()) { setError('Retell API key is required'); return }
    setRetellData(prev => ({ ...prev, connectLoading: true }))
    setError(null)
    try {
      const response = await fetch('/api/retell/list-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: retellData.apiKey.trim() }),
      })
      const json = await response.json()
      if (!response.ok) {
        throw new Error(json.error || `Failed to connect to Retell: ${response.status}`)
      }
      const agents: RetellAgent[] = json
      setRetellData(prev => ({ ...prev, availableAgents: agents || [], connectLoading: false }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Retell')
      setRetellData(prev => ({ ...prev, connectLoading: false }))
    }
  }

  // ── Webhook setup ───────────────────────────────────────────────────────────
  const setupWebhook = async (agentId: string, platform: string) => {
    const endpoint = platform === 'vapi'
      ? `/api/agents/${agentId}/vapi/setup-webhook`
      : `/api/agents/${agentId}/retell/setup-webhook`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Failed to setup monitoring webhook')

    setWebhookSetupStatus({
      success: true,
      message: 'Monitoring configured successfully! Your agent is now being observed.',
    })
    return data
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.name.trim()) { setError('Agent name is required'); return }
    if (selectedPlatform === 'vapi' && !vapiData.selectedAssistantId) {
      setError('Please select an assistant to monitor'); return
    }
    if (selectedPlatform === 'retell' && !retellData.selectedAgentId) {
      setError('Please select an agent to monitor'); return
    }

    onLoadingChange(true)
    setCurrentStep('creating')

    try {
      let payload: any

      if (selectedPlatform === 'livekit') {
        payload = {
          name: formData.name.trim(),
          agent_type: 'livekit',
          configuration: { description: formData.description.trim() || null },
          project_id: projectId,
          environment: 'dev',
          platform: 'livekit',
        }

      } else if (selectedPlatform === 'vapi') {
        const encryptedProjectApiKey = await fetchProjectApiKey()
        const selectedAssistant = vapiData.availableAssistants.find(a => a.id === vapiData.selectedAssistantId)
        payload = {
          name: formData.name.trim(),
          agent_type: 'vapi',
          configuration: {
            vapi: {
              apiKey: vapiData.apiKey.trim(),
              projectApiKey: encryptedProjectApiKey,
              assistantId: vapiData.selectedAssistantId,
              assistantName: selectedAssistant?.name,
              model: selectedAssistant?.model,
              voice: selectedAssistant?.voice,
            },
          },
          project_id: projectId,
          environment: 'dev',
          platform: 'vapi',
        }

      } else if (selectedPlatform === 'retell') {
        const encryptedProjectApiKey = await fetchProjectApiKey()
        const selectedAgent = retellData.availableAgents.find(a => a.agent_id === retellData.selectedAgentId)
        payload = {
          name: formData.name.trim(),
          agent_type: 'retell',
          configuration: {
            retell: {
              apiKey: retellData.apiKey.trim(),       // will be encrypted in route.ts
              projectApiKey: encryptedProjectApiKey,  // becomes xPypeToken in route.ts
              agentId: retellData.selectedAgentId,
              agentName: selectedAgent?.agent_name,
              voiceId: selectedAgent?.voice_id,
              language: selectedAgent?.language,
            },
          },
          project_id: projectId,
          environment: 'dev',
          platform: 'retell',
        }
      }

      const response = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to setup monitoring')
      }

      const data = await response.json()
      setCreatedAgentData(data)

      // Auto-setup webhook for Vapi and Retell
      if (selectedPlatform === 'vapi' || selectedPlatform === 'retell') {
        setCurrentStep('connecting')
        setWebhookSetupStatus(null)
        try {
          await setupWebhook(data.id, selectedPlatform)
          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (webhookError) {
          console.warn('⚠️ Webhook setup failed, but agent was created:', webhookError)
          setWebhookSetupStatus({
            success: false,
            message: 'Agent created but webhook setup failed. You can configure it manually from the agent settings.',
          })
        }
      }

      setCurrentStep('success')

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup monitoring')
      setCurrentStep('form')
    } finally {
      onLoadingChange(false)
    }
  }

  const handleCopyId = async () => {
    if (createdAgentData?.id) {
      await navigator.clipboard.writeText(createdAgentData.id)
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2000)
    }
  }

  const handleFinish = () => {
    onAgentCreated(createdAgentData)
    onClose()
  }

  // ── Loading state ───────────────────────────────────────────────────────────
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
          {currentStep === 'creating' ? 'Configuring observability for your agent...' : 'Establishing monitoring connection...'}
        </p>

        {(selectedPlatform === 'vapi' || selectedPlatform === 'retell') && (
          <div className="space-y-3 max-w-xs mx-auto">
            <div className={`flex items-center gap-3 text-sm ${currentStep === 'creating' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                currentStep === 'creating'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
              }`}>
                {currentStep === 'creating' ? <Loader2 className="w-3 h-3 animate-spin" /> : '✓'}
              </div>
              <span className={currentStep === 'creating' ? 'font-medium' : ''}>Setting Up Monitoring</span>
            </div>
            <div className={`flex items-center gap-3 text-sm ${currentStep === 'connecting' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-600'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                currentStep === 'connecting'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'
              }`}>
                {currentStep === 'connecting' ? <Loader2 className="w-3 h-3 animate-spin" /> : '2'}
              </div>
              <span className={currentStep === 'connecting' ? 'font-medium' : ''}>Connecting Webhook</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Success state ───────────────────────────────────────────────────────────
  if (currentStep === 'success') {
    const platformLabel = selectedPlatform === 'vapi' ? 'Vapi' : selectedPlatform === 'retell' ? 'Retell' : 'LiveKit'
    return (
      <>
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
                <Eye className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">{createdAgentData?.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800">
                    {platformLabel} Monitoring
                  </Badge>
                  <Badge variant="outline" className="text-xs bg-gray-50 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700">
                    Development
                  </Badge>
                </div>
              </div>
            </div>

            {/* Webhook status for Vapi / Retell */}
            {(selectedPlatform === 'vapi' || selectedPlatform === 'retell') && webhookSetupStatus && (
              <div className={`p-3 rounded-lg border mb-3 ${
                webhookSetupStatus.success
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
              }`}>
                <div className="flex items-center gap-2">
                  {webhookSetupStatus.success
                    ? <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    : <LinkIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" />}
                  <span className={`text-sm font-medium ${webhookSetupStatus.success ? 'text-green-800 dark:text-green-200' : 'text-orange-800 dark:text-orange-200'}`}>
                    {webhookSetupStatus.success ? 'Monitoring Active' : 'Manual Setup Required'}
                  </span>
                </div>
                <p className={`text-xs mt-1 ${webhookSetupStatus.success ? 'text-green-700 dark:text-green-300' : 'text-orange-700 dark:text-orange-300'}`}>
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
                <Button variant="ghost" size="sm" onClick={handleCopyId} className="h-6 w-6 p-0">
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
            {copiedId && <p className="text-xs text-green-600 dark:text-green-400 text-right mt-1">Copied to clipboard</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1 h-10">Monitor Another</Button>
            <Button onClick={handleFinish} className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium">
              View Integration
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </>
    )
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  const platformAccentClass = {
    livekit: { border: 'border-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', icon: 'bg-blue-600 text-white', section: '', button: 'bg-blue-600 hover:bg-blue-700' },
    vapi:    { border: 'border-teal-500', bg: 'bg-teal-50 dark:bg-teal-900/20', icon: 'bg-teal-600 text-white', section: 'bg-teal-50/50 dark:bg-teal-900/10 px-4 py-4 rounded-lg border border-teal-100 dark:border-teal-800', button: 'bg-teal-600 hover:bg-teal-700' },
    retell:  { border: 'border-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20', icon: 'bg-purple-600 text-white', section: 'bg-purple-50/50 dark:bg-purple-900/10 px-4 py-4 rounded-lg border border-purple-100 dark:border-purple-800', button: 'bg-purple-600 hover:bg-purple-700' },
  }
  const accent = platformAccentClass[selectedPlatform as keyof typeof platformAccentClass]

  const isSubmitDisabled =
    vapiData.connectLoading ||
    retellData.connectLoading ||
    !formData.name.trim() ||
    (selectedPlatform === 'vapi' && !vapiData.selectedAssistantId) ||
    (selectedPlatform === 'retell' && !retellData.selectedAgentId)

  return (
    <>
      <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-blue-50 to-teal-50 dark:from-blue-900/20 dark:to-teal-900/20 rounded-xl flex items-center justify-center border border-gray-100 dark:border-gray-800">
            <Eye className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          </div>
          <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Connect Existing Agent
          </DialogTitle>
          <p className="text-sm text-gray-600 dark:text-gray-400">Add monitoring to your existing voice agent</p>
        </div>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto px-6">
        <div className="space-y-5 pb-6">

          {/* Platform Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">Agent Platform</label>
            <Select
              value={selectedPlatform}
              onValueChange={(v) => { setSelectedPlatform(v); setError(null) }}
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue>
                  {(() => {
                    const p = PLATFORM_OPTIONS.find(o => o.value === selectedPlatform)
                    if (!p) return null
                    const Icon = p.icon
                    return (
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        <span>{p.label}</span>
                      </div>
                    )
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PLATFORM_OPTIONS.map((platform) => {
                  const Icon = platform.icon
                  return (
                    <SelectItem key={platform.value} value={platform.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        <span>{platform.label}</span>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Platform-specific section */}
          <div className={`space-y-4 transition-all duration-300 ${accent.section}`}>

            {/* Agent name — always shown */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                Agent Name
              </label>
              <Input
                placeholder={
                  selectedPlatform === 'vapi' ? 'Support Assistant Monitor' :
                  selectedPlatform === 'retell' ? 'Retell Agent Monitor' :
                  'Customer Agent Monitor'
                }
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-10 text-sm"
              />
            </div>

            {/* LiveKit notes */}
            {selectedPlatform === 'livekit' && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                  Notes <span className="text-gray-500 font-normal">(optional)</span>
                </label>
                <textarea
                  placeholder="Brief description of what this agent does..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-lg focus:outline-none resize-none"
                />
              </div>
            )}

            {/* ── Vapi fields ──────────────────────────────────────────────── */}
            {selectedPlatform === 'vapi' && (
              <div className="space-y-4">
                <div className="flex items-center text-xs text-teal-600 dark:text-teal-400 bg-white/60 dark:bg-gray-900/30 rounded-lg p-3 border border-teal-200 dark:border-teal-800">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-teal-600 text-white rounded-full flex items-center justify-center font-medium">1</div>
                    <span className="font-medium">Connect Vapi Account</span>
                  </div>
                  {vapiData.availableAssistants.length > 0 && (
                    <>
                      <ArrowRight className="w-3 h-3 mx-3 text-teal-400" />
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-teal-600 text-white rounded-full flex items-center justify-center font-medium">2</div>
                        <span className="font-medium">Select Assistant</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                    Vapi Private Key
                    <Badge variant="outline" className="ml-2 text-xs bg-teal-50 text-teal-600 border-teal-200">Secure</Badge>
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="Paste your Vapi private key here"
                      value={vapiData.apiKey}
                      onChange={(e) => setVapiData({ ...vapiData, apiKey: e.target.value })}
                      disabled={vapiData.connectLoading}
                      className="flex-1 h-10 font-mono text-sm"
                    />
                    <Button
                      type="button"
                      onClick={handleVapiConnect}
                      disabled={vapiData.connectLoading || !vapiData.apiKey.trim()}
                      className="h-10 px-4 bg-teal-600 hover:bg-teal-700 text-white"
                    >
                      {vapiData.connectLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Get your key from{' '}
                    <a href="https://dashboard.vapi.ai" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline font-medium">
                      Vapi Dashboard
                    </a>
                  </p>
                </div>

                {vapiData.availableAssistants.length > 0 && (
                  <div ref={assistantSectionRef} className="space-y-2 bg-white/60 dark:bg-gray-900/30 rounded-lg p-4 border border-teal-200 dark:border-teal-800 -mx-2">
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                      Select Assistant to Monitor
                      <Badge variant="outline" className="ml-2 text-xs bg-green-50 text-green-700 border-green-200">
                        {vapiData.availableAssistants.length} found
                      </Badge>
                    </label>
                    <Select value={vapiData.selectedAssistantId} onValueChange={(v) => setVapiData({ ...vapiData, selectedAssistantId: v })}>
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder="Choose an assistant to monitor" />
                      </SelectTrigger>
                      <SelectContent>
                        {vapiData.availableAssistants.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 bg-teal-50 dark:bg-teal-900/30 rounded-lg flex items-center justify-center">
                                <Bot className="w-4 h-4 text-teal-600" />
                              </div>
                              <div>
                                <div className="font-medium text-sm">{a.name}</div>
                                {a.voice?.provider && <div className="text-xs text-gray-500">Voice: {a.voice.provider}</div>}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* ── Retell fields ─────────────────────────────────────────────── */}
            {selectedPlatform === 'retell' && (
              <div className="space-y-4">
                <div className="flex items-center text-xs text-purple-600 dark:text-purple-400 bg-white/60 dark:bg-gray-900/30 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-purple-600 text-white rounded-full flex items-center justify-center font-medium">1</div>
                    <span className="font-medium">Connect Retell Account</span>
                  </div>
                  {retellData.availableAgents.length > 0 && (
                    <>
                      <ArrowRight className="w-3 h-3 mx-3 text-purple-400" />
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-purple-600 text-white rounded-full flex items-center justify-center font-medium">2</div>
                        <span className="font-medium">Select Agent</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                    Retell API Key
                    <Badge variant="outline" className="ml-2 text-xs bg-purple-50 text-purple-600 border-purple-200">Secure</Badge>
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="Paste your Retell API key here"
                      value={retellData.apiKey}
                      onChange={(e) => setRetellData({ ...retellData, apiKey: e.target.value })}
                      disabled={retellData.connectLoading}
                      className="flex-1 h-10 font-mono text-sm"
                    />
                    <Button
                      type="button"
                      onClick={handleRetellConnect}
                      disabled={retellData.connectLoading || !retellData.apiKey.trim()}
                      className="h-10 px-4 bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {retellData.connectLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Get your key from{' '}
                    <a href="https://dashboard.retellai.com" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline font-medium">
                      Retell Dashboard → API Keys
                    </a>
                  </p>
                </div>

                {retellData.availableAgents.length > 0 && (
                  <div ref={assistantSectionRef} className="space-y-2 bg-white/60 dark:bg-gray-900/30 rounded-lg p-4 border border-purple-200 dark:border-purple-800 -mx-2">
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                      Select Agent to Monitor
                      <Badge variant="outline" className="ml-2 text-xs bg-green-50 text-green-700 border-green-200">
                        {retellData.availableAgents.length} found
                      </Badge>
                    </label>
                    <Select value={retellData.selectedAgentId} onValueChange={(v) => setRetellData({ ...retellData, selectedAgentId: v })}>
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder="Choose an agent to monitor" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Deduplicate — keep only the latest version per agent_id */}
                        {Object.values(
                          retellData.availableAgents.reduce((acc, a) => {
                            if (!acc[a.agent_id] || a.version > acc[a.agent_id].version) {
                              acc[a.agent_id] = a
                            }
                            return acc
                          }, {} as Record<string, RetellAgent>)
                        ).map((a) => (
                          <SelectItem key={`${a.agent_id}-${a.version}`} value={a.agent_id}>
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 bg-purple-50 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                                <Radio className="w-4 h-4 text-purple-600" />
                              </div>
                              <div>
                                <div className="font-medium text-sm">{a.agent_name}</div>
                                {a.language && <div className="text-xs text-gray-500">{a.language} · {a.voice_id}</div>}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive" className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
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
            disabled={vapiData.connectLoading || retellData.connectLoading}
            className="flex-1 h-10"
          >
            Back
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            className={`flex-1 h-10 font-medium text-white ${accent.button}`}
          >
            Start Monitoring
          </Button>
        </div>
      </div>
    </>
  )
}

export default ConnectAgentFlow