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
    value: 'pipecat',
    label: 'Pipecat Agent',
    description: 'Monitor your Pipecat voice agent',
    icon: Radio,
    color: 'orange'
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

type Step = 'form' | 'creating' | 'connecting' | 'success'

interface VapiState {
  apiKey: string
  availableAssistants: VapiAssistant[]
  selectedAssistantId: string
  connectLoading: boolean
}

interface RetellState {
  apiKey: string
  availableAgents: RetellAgent[]
  selectedAgentId: string
  connectLoading: boolean
}

const PLATFORM_ACCENT = {
  livekit: { border: 'border-blue-500', bg: 'bg-primary/10', icon: 'bg-blue-600 text-white', section: '', button: 'bg-blue-600 hover:bg-blue-700' },
  pipecat: { border: 'border-orange-500', bg: 'bg-warning/10', icon: 'bg-orange-600 text-white', section: '', button: 'bg-orange-600 hover:bg-orange-700' },
  vapi:    { border: 'border-teal-500', bg: 'bg-teal-50 dark:bg-teal-900/20', icon: 'bg-teal-600 text-white', section: 'bg-teal-50/50 dark:bg-teal-900/10 px-4 py-4 rounded-lg border border-teal-100 dark:border-teal-800', button: 'bg-teal-600 hover:bg-teal-700' },
  retell:  { border: 'border-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20', icon: 'bg-purple-600 text-white', section: 'bg-purple-50/50 dark:bg-purple-900/10 px-4 py-4 rounded-lg border border-purple-100 dark:border-purple-800', button: 'bg-purple-600 hover:bg-purple-700' },
}

const PLATFORM_LABEL: Record<string, string> = { vapi: 'Vapi', retell: 'Retell', pipecat: 'Pipecat' }
const NAME_PLACEHOLDER: Record<string, string> = {
  vapi: 'Support Assistant Monitor',
  retell: 'Retell Agent Monitor',
}

// ── Requests (pure async helpers, no component state) ───────────────────────

async function fetchProjectApiKey(projectId: string): Promise<string> {
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

async function listVapiAssistants(apiKey: string): Promise<VapiAssistant[]> {
  const response = await fetch('https://api.vapi.ai/assistant', {
    headers: { 'Authorization': `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json' },
  })
  if (!response.ok) {
    const errorText = await response.text()
    let msg = `Failed to connect to Vapi: ${response.status}`
    try { msg = JSON.parse(errorText).message || msg } catch {}
    throw new Error(msg)
  }
  return (await response.json()) || []
}

async function listRetellAgents(apiKey: string): Promise<RetellAgent[]> {
  const response = await fetch('/api/retell/list-agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: apiKey.trim() }),
  })
  const json = await response.json()
  if (!response.ok) throw new Error(json.error || `Failed to connect to Retell: ${response.status}`)
  return json || []
}

async function requestWebhookSetup(agentId: string, platform: string) {
  const endpoint = platform === 'vapi'
    ? `/api/agents/${agentId}/vapi/setup-webhook`
    : `/api/agents/${agentId}/retell/setup-webhook`
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Failed to setup monitoring webhook')
  return data
}

interface PayloadInput {
  platform: string
  projectId: string
  formData: { name: string; description: string }
  vapi: VapiState
  retell: RetellState
}

async function buildPayload({ platform, projectId, formData, vapi, retell }: PayloadInput): Promise<any> {
  const base = { name: formData.name.trim(), project_id: projectId, environment: 'dev', platform }
  if (platform === 'livekit') {
    return { ...base, agent_type: 'livekit', configuration: { description: formData.description.trim() || null } }
  }
  if (platform === 'pipecat') {
    return { ...base, agent_type: 'pipecat_agent', configuration: { description: formData.description?.trim() || null } }
  }
  const encryptedProjectApiKey = await fetchProjectApiKey(projectId)
  if (platform === 'vapi') {
    const assistant = vapi.availableAssistants.find(a => a.id === vapi.selectedAssistantId)
    return {
      ...base,
      agent_type: 'vapi',
      configuration: {
        vapi: {
          apiKey: vapi.apiKey.trim(),
          projectApiKey: encryptedProjectApiKey,
          assistantId: vapi.selectedAssistantId,
          assistantName: assistant?.name,
          model: assistant?.model,
          voice: assistant?.voice,
        },
      },
    }
  }
  const agent = retell.availableAgents.find(a => a.agent_id === retell.selectedAgentId)
  return {
    ...base,
    agent_type: 'retell',
    configuration: {
      retell: {
        apiKey: retell.apiKey.trim(),            // will be encrypted in route.ts
        projectApiKey: encryptedProjectApiKey,   // becomes xPypeToken in route.ts
        agentId: retell.selectedAgentId,
        agentName: agent?.agent_name,
        voiceId: agent?.voice_id,
        language: agent?.language,
      },
    },
  }
}

function validateSubmit(platform: string, name: string, vapi: VapiState, retell: RetellState): string | null {
  if (!name.trim()) return 'Agent name is required'
  if (platform === 'vapi' && !vapi.selectedAssistantId) return 'Please select an assistant to monitor'
  if (platform === 'retell' && !retell.selectedAgentId) return 'Please select an agent to monitor'
  return null
}

// ── Views ───────────────────────────────────────────────────────────────────

function stepTone(active: boolean, done: boolean): string {
  if (active) return 'bg-blue-100 dark:bg-blue-900/30 text-primary dark:text-blue-400'
  if (done) return 'bg-green-100 dark:bg-green-900/30 text-success dark:text-green-400'
  return 'bg-muted text-muted-foreground'
}

function StepRow({ active, done, idleLabel, label }: Readonly<{ active: boolean; done: boolean; idleLabel: string; label: string }>) {
  return (
    <>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
        stepTone(active, done)
      }`}>
        {active ? <Loader2 className="w-3 h-3 animate-spin" /> : idleLabel}
      </div>
      <span className={active ? 'font-medium' : ''}>{label}</span>
    </>
  )
}

function ProgressView({ currentStep, selectedPlatform }: Readonly<{ currentStep: Step; selectedPlatform: string }>) {
  const creating = currentStep === 'creating'
  const hasWebhook = selectedPlatform === 'vapi' || selectedPlatform === 'retell'
  return (
    <div className="px-6 py-8 text-center">
      <div className="w-16 h-16 mx-auto mb-4 bg-linear-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/30 rounded-2xl flex items-center justify-center border border-border/60">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {creating ? 'Setting Up Monitoring' : 'Connecting Monitoring'}
      </h3>
      <p className="text-sm text-muted-foreground mb-6">
        {creating ? 'Configuring observability for your agent...' : 'Establishing monitoring connection...'}
      </p>

      {hasWebhook && (
        <div className="space-y-3 max-w-xs mx-auto">
          <div className={`flex items-center gap-3 text-sm ${creating ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
            <StepRow active={creating} done={!creating} idleLabel="✓" label="Setting Up Monitoring" />
          </div>
          <div className={`flex items-center gap-3 text-sm ${creating ? 'text-gray-400 dark:text-gray-600' : 'text-blue-600 dark:text-blue-400'}`}>
            <StepRow active={!creating} done={false} idleLabel="2" label="Connecting Webhook" />
          </div>
        </div>
      )}
    </div>
  )
}

function WebhookStatusCard({ status }: Readonly<{ status: { success: boolean; message: string } }>) {
  const ok = status.success
  return (
    <div className={`p-3 rounded-lg border mb-3 ${
      ok ? 'bg-green-50 dark:bg-green-900/20 border-success/30 dark:border-green-800' : 'bg-orange-50 dark:bg-orange-900/20 border-warning/30 dark:border-orange-800'
    }`}>
      <div className="flex items-center gap-2">
        {ok ? <CheckCircle className="w-4 h-4 text-success" /> : <LinkIcon className="w-4 h-4 text-warning" />}
        <span className={`text-sm font-medium ${ok ? 'text-green-800 dark:text-green-200' : 'text-orange-800 dark:text-orange-200'}`}>
          {ok ? 'Monitoring Active' : 'Manual Setup Required'}
        </span>
      </div>
      <p className={`text-xs mt-1 ${ok ? 'text-green-700 dark:text-green-300' : 'text-orange-700 dark:text-orange-300'}`}>
        {status.message}
      </p>
    </div>
  )
}

function SuccessView({ createdAgentData, selectedPlatform, webhookSetupStatus, copiedId, onCopy, onClose, onFinish }: Readonly<{
  createdAgentData: any
  selectedPlatform: string
  webhookSetupStatus: { success: boolean; message: string } | null
  copiedId: boolean
  onCopy: () => void
  onClose: () => void
  onFinish: () => void
}>) {
  const platformLabel = PLATFORM_LABEL[selectedPlatform] ?? 'LiveKit'
  const showWebhook = (selectedPlatform === 'vapi' || selectedPlatform === 'retell') && webhookSetupStatus
  return (
    <>
      <DialogHeader className="px-6 pt-6 pb-4 text-center border-b border-border/60">
        <div className="w-12 h-12 mx-auto mb-3 bg-success/15 rounded-full flex items-center justify-center">
          <CheckCircle className="w-6 h-6 text-success" />
        </div>
        <DialogTitle className="text-lg font-semibold text-foreground mb-1">
          Monitoring Setup Complete!
        </DialogTitle>
        <p className="text-sm text-muted-foreground">
          "{createdAgentData?.name}" is now being observed
        </p>
      </DialogHeader>

      <div className="px-6 py-5 space-y-4">
        <div className="p-4 bg-muted/50 rounded-lg border border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Eye className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-foreground truncate">{createdAgentData?.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800">
                  {platformLabel} Monitoring
                </Badge>
                <Badge variant="outline" className="text-xs bg-muted/50 text-muted-foreground border-border">
                  Development
                </Badge>
              </div>
            </div>
          </div>

          {showWebhook && <WebhookStatusCard status={webhookSetupStatus} />}

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <span className="text-sm text-muted-foreground">Monitoring ID</span>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono bg-muted px-2 py-1 rounded text-foreground">
                {createdAgentData?.id?.slice(0, 8)}...
              </code>
              <Button variant="ghost" size="sm" onClick={onCopy} className="h-6 w-6 p-0">
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>
          {copiedId && <p className="text-xs text-success text-right mt-1">Copied to clipboard</p>}
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1 h-10">Monitor Another</Button>
          <Button onClick={onFinish} className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white font-medium">
            View Integration
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </>
  )
}

function PlatformOptionLabel({ platform }: Readonly<{ platform: (typeof PLATFORM_OPTIONS)[number] }>) {
  const Icon = platform.icon
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span>{platform.label}</span>
    </div>
  )
}

function PlatformSelect({ value, onChange }: Readonly<{ value: string; onChange: (v: string) => void }>) {
  const current = PLATFORM_OPTIONS.find(o => o.value === value)
  return (
    <div className="space-y-2">
      <label htmlFor="connect-platform" className="block text-sm font-medium text-foreground">Agent Platform</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="connect-platform" className="h-10 w-full">
          <SelectValue>{current ? <PlatformOptionLabel platform={current} /> : null}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {PLATFORM_OPTIONS.map((platform) => (
            <SelectItem key={platform.value} value={platform.value}>
              <PlatformOptionLabel platform={platform} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function VapiSection({ vapiData, setVapiData, onConnect, sectionRef }: Readonly<{
  vapiData: VapiState
  setVapiData: React.Dispatch<React.SetStateAction<VapiState>>
  onConnect: () => void
  sectionRef: React.RefObject<HTMLDivElement | null>
}>) {
  return (
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
        <label htmlFor="connect-vapi-key" className="block text-sm font-medium text-foreground">
          Vapi Private Key
          <Badge variant="outline" className="ml-2 text-xs bg-teal-50 text-teal-600 border-teal-200">Secure</Badge>
        </label>
        <div className="flex gap-2">
          <Input
            id="connect-vapi-key"
            type="password"
            placeholder="Paste your Vapi private key here"
            value={vapiData.apiKey}
            onChange={(e) => setVapiData({ ...vapiData, apiKey: e.target.value })}
            disabled={vapiData.connectLoading}
            className="flex-1 h-10 font-mono text-sm"
          />
          <Button
            type="button"
            onClick={onConnect}
            disabled={vapiData.connectLoading || !vapiData.apiKey.trim()}
            className="h-10 px-4 bg-teal-600 hover:bg-teal-700 text-white"
          >
            {vapiData.connectLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Get your key from{' '}
          <a href="https://dashboard.vapi.ai" target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline font-medium">
            Vapi Dashboard
          </a>
        </p>
      </div>

      {vapiData.availableAssistants.length > 0 && (
        <div ref={sectionRef} className="space-y-2 bg-white/60 dark:bg-gray-900/30 rounded-lg p-4 border border-teal-200 dark:border-teal-800 -mx-2">
          <div className="block text-sm font-medium text-foreground">
            Select Assistant to Monitor
            <Badge variant="outline" className="ml-2 text-xs bg-success/10 text-success border-success/30">
              {vapiData.availableAssistants.length} found
            </Badge>
          </div>
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
                      {a.voice?.provider && <div className="text-xs text-muted-foreground">Voice: {a.voice.provider}</div>}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}

// Keep only the latest version per agent_id.
function latestRetellAgents(agents: RetellAgent[]): RetellAgent[] {
  const latest: Record<string, RetellAgent> = {}
  for (const a of agents) {
    if (!latest[a.agent_id] || a.version > latest[a.agent_id].version) latest[a.agent_id] = a
  }
  return Object.values(latest)
}

function RetellSection({ retellData, setRetellData, onConnect, sectionRef }: Readonly<{
  retellData: RetellState
  setRetellData: React.Dispatch<React.SetStateAction<RetellState>>
  onConnect: () => void
  sectionRef: React.RefObject<HTMLDivElement | null>
}>) {
  return (
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
        <label htmlFor="connect-retell-key" className="block text-sm font-medium text-foreground">
          Retell API Key
          <Badge variant="outline" className="ml-2 text-xs bg-purple-50 text-purple-600 border-purple-200">Secure</Badge>
        </label>
        <div className="flex gap-2">
          <Input
            id="connect-retell-key"
            type="password"
            placeholder="Paste your Retell API key here"
            value={retellData.apiKey}
            onChange={(e) => setRetellData({ ...retellData, apiKey: e.target.value })}
            disabled={retellData.connectLoading}
            className="flex-1 h-10 font-mono text-sm"
          />
          <Button
            type="button"
            onClick={onConnect}
            disabled={retellData.connectLoading || !retellData.apiKey.trim()}
            className="h-10 px-4 bg-purple-600 hover:bg-purple-700 text-white"
          >
            {retellData.connectLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Get your key from{' '}
          <a href="https://dashboard.retellai.com" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline font-medium">
            Retell Dashboard → API Keys
          </a>
        </p>
      </div>

      {retellData.availableAgents.length > 0 && (
        <div ref={sectionRef} className="space-y-2 bg-white/60 dark:bg-gray-900/30 rounded-lg p-4 border border-purple-200 dark:border-purple-800 -mx-2">
          <div className="block text-sm font-medium text-foreground">
            Select Agent to Monitor
            <Badge variant="outline" className="ml-2 text-xs bg-success/10 text-success border-success/30">
              {retellData.availableAgents.length} found
            </Badge>
          </div>
          <Select value={retellData.selectedAgentId} onValueChange={(v) => setRetellData({ ...retellData, selectedAgentId: v })}>
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="Choose an agent to monitor" />
            </SelectTrigger>
            <SelectContent>
              {latestRetellAgents(retellData.availableAgents).map((a) => (
                <SelectItem key={`${a.agent_id}-${a.version}`} value={a.agent_id}>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-purple-50 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                      <Radio className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{a.agent_name}</div>
                      {a.language && <div className="text-xs text-muted-foreground">{a.language} · {a.voice_id}</div>}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}

const EMPTY_VAPI: VapiState = { apiKey: '', availableAssistants: [], selectedAssistantId: '', connectLoading: false }
const EMPTY_RETELL: RetellState = { apiKey: '', availableAgents: [], selectedAgentId: '', connectLoading: false }

const ConnectAgentFlow: React.FC<ConnectAgentFlowProps> = ({
  projectId,
  onBack,
  onClose,
  onAgentCreated,
  onLoadingChange
}) => {
  const [currentStep, setCurrentStep] = useState<Step>('form')
  const [selectedPlatform, setSelectedPlatform] = useState('livekit')
  const assistantSectionRef = useRef<HTMLDivElement>(null)
  const [formData, setFormData] = useState({ name: '', description: '' })
  const [vapiData, setVapiData] = useState<VapiState>(EMPTY_VAPI)
  const [retellData, setRetellData] = useState<RetellState>(EMPTY_RETELL)
  const [error, setError] = useState<string | null>(null)
  const [createdAgentData, setCreatedAgentData] = useState<any>(null)
  const [copiedId, setCopiedId] = useState(false)
  const [webhookSetupStatus, setWebhookSetupStatus] = useState<{ success: boolean; message: string } | null>(null)

  // Scroll to assistant/agent section after fetch
  useEffect(() => {
    if ((vapiData.availableAssistants.length > 0 || retellData.availableAgents.length > 0) && assistantSectionRef.current) {
      setTimeout(() => {
        assistantSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 100)
    }
  }, [vapiData.availableAssistants.length, retellData.availableAgents.length])

  const handleVapiConnect = async () => {
    if (!vapiData.apiKey.trim()) { setError('Vapi API key is required'); return }
    setVapiData(prev => ({ ...prev, connectLoading: true }))
    setError(null)
    try {
      const assistants = await listVapiAssistants(vapiData.apiKey)
      setVapiData(prev => ({ ...prev, availableAssistants: assistants, connectLoading: false }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Vapi')
      setVapiData(prev => ({ ...prev, connectLoading: false }))
    }
  }

  const handleRetellConnect = async () => {
    if (!retellData.apiKey.trim()) { setError('Retell API key is required'); return }
    setRetellData(prev => ({ ...prev, connectLoading: true }))
    setError(null)
    try {
      const agents = await listRetellAgents(retellData.apiKey)
      setRetellData(prev => ({ ...prev, availableAgents: agents, connectLoading: false }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Retell')
      setRetellData(prev => ({ ...prev, connectLoading: false }))
    }
  }

  // Auto-setup webhook for Vapi and Retell
  const connectWebhook = async (agentId: string) => {
    setCurrentStep('connecting')
    setWebhookSetupStatus(null)
    try {
      await requestWebhookSetup(agentId, selectedPlatform)
      setWebhookSetupStatus({ success: true, message: 'Monitoring configured successfully! Your agent is now being observed.' })
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (webhookError) {
      console.warn('⚠️ Webhook setup failed, but agent was created:', webhookError)
      setWebhookSetupStatus({
        success: false,
        message: 'Agent created but webhook setup failed. You can configure it manually from the agent settings.',
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const invalid = validateSubmit(selectedPlatform, formData.name, vapiData, retellData)
    if (invalid) { setError(invalid); return }

    onLoadingChange(true)
    setCurrentStep('creating')
    try {
      const payload = await buildPayload({ platform: selectedPlatform, projectId, formData, vapi: vapiData, retell: retellData })
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
      if (selectedPlatform === 'vapi' || selectedPlatform === 'retell') await connectWebhook(data.id)
      setCurrentStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup monitoring')
      setCurrentStep('form')
    } finally {
      onLoadingChange(false)
    }
  }

  const handleCopyId = async () => {
    if (!createdAgentData?.id) return
    await navigator.clipboard.writeText(createdAgentData.id)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const handleFinish = () => {
    onAgentCreated(createdAgentData)
    onClose()
  }

  if (currentStep === 'creating' || currentStep === 'connecting') {
    return <ProgressView currentStep={currentStep} selectedPlatform={selectedPlatform} />
  }

  if (currentStep === 'success') {
    return (
      <SuccessView
        createdAgentData={createdAgentData}
        selectedPlatform={selectedPlatform}
        webhookSetupStatus={webhookSetupStatus}
        copiedId={copiedId}
        onCopy={handleCopyId}
        onClose={onClose}
        onFinish={handleFinish}
      />
    )
  }

  const accent = PLATFORM_ACCENT[selectedPlatform as keyof typeof PLATFORM_ACCENT]
  const connecting = vapiData.connectLoading || retellData.connectLoading
  const isSubmitDisabled = connecting || validateSubmit(selectedPlatform, formData.name, vapiData, retellData) !== null

  return (
    <>
      <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-linear-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/30 rounded-xl flex items-center justify-center border border-border/60">
            <Eye className="w-6 h-6 text-foreground" />
          </div>
          <DialogTitle className="text-lg font-semibold text-foreground mb-1">
            Connect Existing Agent
          </DialogTitle>
          <p className="text-sm text-muted-foreground">Add monitoring to your existing voice agent</p>
        </div>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto px-6">
        <div className="space-y-5 pb-6">
          <PlatformSelect value={selectedPlatform} onChange={(v) => { setSelectedPlatform(v); setError(null) }} />

          <div className={`space-y-4 transition-all duration-300 ${accent.section}`}>
            <div className="space-y-2">
              <label htmlFor="connect-agent-name" className="block text-sm font-medium text-foreground">
                Agent Name
              </label>
              <Input id="connect-agent-name"
                placeholder={NAME_PLACEHOLDER[selectedPlatform] ?? 'Customer Agent Monitor'}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-10 text-sm"
              />
            </div>

            {selectedPlatform === 'livekit' && (
              <div className="space-y-2">
                <label htmlFor="connect-notes" className="block text-sm font-medium text-foreground">
                  Notes <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea id="connect-notes"
                  placeholder="Brief description of what this agent does..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-border bg-card rounded-lg focus:outline-none resize-none"
                />
              </div>
            )}

            {selectedPlatform === 'vapi' && (
              <VapiSection vapiData={vapiData} setVapiData={setVapiData} onConnect={handleVapiConnect} sectionRef={assistantSectionRef} />
            )}
            {selectedPlatform === 'retell' && (
              <RetellSection retellData={retellData} setRetellData={setRetellData} onConnect={handleRetellConnect} sectionRef={assistantSectionRef} />
            )}
          </div>

          {error && (
            <Alert variant="destructive" className="border-destructive/30 bg-destructive/10">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      <div className="shrink-0 px-6 py-4 bg-muted/50 border-t border-border">
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onBack} disabled={connecting} className="flex-1 h-10">
            Back
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitDisabled} className={`flex-1 h-10 font-medium text-white ${accent.button}`}>
            Start Monitoring
          </Button>
        </div>
      </div>
    </>
  )
}

export default ConnectAgentFlow
