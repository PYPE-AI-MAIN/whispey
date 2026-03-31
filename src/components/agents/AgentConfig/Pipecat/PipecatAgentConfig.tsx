'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft,
  Loader2,
  CopyIcon,
  CheckIcon,
  AlertCircle,
  History,
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import ModelSelector from '@/components/agents/AgentConfig/ModelSelector'
import SelectTTS from '@/components/agents/AgentConfig/SelectTTSDialog'
import SelectSTT from '@/components/agents/AgentConfig/SelectSTTDialog'
import PipecatAdvancedSettings from './PipecatAdvancedSettings'
import ConfigHistory from '@/components/agents/AgentConfig/ConfigHistory'

interface PipecatAgentConfigProps {
  agentId: string
  projectId: string
  pipecatAgentId: string
  agentName: string
}

interface PipecatAgent {
  id: string
  name: string
  prompt: string
  llm_model: string
  llm_provider: string
  stt_model: string
  stt_language: string
  tts_model: string
  tts_voice_id: string | null
  transfer_number: string
  tools: string[]
  custom_tools: any[]
  opening_message: string | null
  vad_confidence: number
  vad_start_secs: number
  vad_stop_secs: number
  vad_min_volume: number
  whispey_api_key: string
  whispey_agent_id: string
}

function mapLLMModelToProvider(llmModel: string, llmProvider?: string): { provider: string; model: string } {
  if (llmProvider === 'azure') return { provider: 'azure_openai', model: llmModel }
  if (llmModel.startsWith('gpt')) return { provider: 'openai', model: llmModel }
  if (llmModel.startsWith('gemini')) return { provider: 'google', model: llmModel }
  if (llmModel.startsWith('llama') || llmModel.startsWith('groq/')) return { provider: 'groq', model: llmModel }
  if (llmModel.includes('claude')) return { provider: 'anthropic', model: llmModel }
  return { provider: 'openai', model: llmModel }
}

function mapProviderToLLMProvider(provider: string): string {
  switch (provider) {
    case 'azure_openai': return 'azure'
    case 'openai': return 'openai'
    case 'google': return 'google'
    case 'groq': return 'groq'
    default: return 'openai'
  }
}

function buildSnapshot(values: {
  prompt: string
  openingMessage: string
  transferNumber: string
  selectedProvider: string
  selectedModel: string
  sttModel: string
  sttConfig: any
  ttsVoiceId: string
  ttsModel: string
  tools: string[]
  customTools: any[]
  vadConfidence: number
  vadStartSecs: number
  vadStopSecs: number
  vadMinVolume: number
}): string {
  return JSON.stringify(values)
}

export default function PipecatAgentConfig({
  agentId,
  projectId,
  pipecatAgentId,
  agentName,
}: PipecatAgentConfigProps) {
  const router = useRouter()

  const [agent, setAgent] = useState<PipecatAgent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  // Dirty tracking via snapshot comparison
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  // Form state
  const [prompt, setPrompt] = useState('')
  const [openingMessage, setOpeningMessage] = useState('')
  const [transferNumber, setTransferNumber] = useState('')
  const [selectedProvider, setSelectedProvider] = useState('openai')
  const [selectedModel, setSelectedModel] = useState('gpt-4.1-mini')
  const [sttProvider, setSttProvider] = useState('sarvam')
  const [sttModel, setSttModel] = useState('saarika:v2.5')
  const [sttConfig, setSttConfig] = useState<any>({ language: 'en-IN' })
  const [ttsVoiceId, setTtsVoiceId] = useState('')
  const [ttsProvider, setTtsProvider] = useState('elevenlabs')
  const [ttsModel, setTtsModel] = useState('eleven_flash_v2_5')
  const [ttsConfig, setTtsConfig] = useState<any>({})
  const [tools, setTools] = useState<string[]>(['end_call', 'transfer_call'])
  const [customTools, setCustomTools] = useState<any[]>([])

  // VAD state
  const [vadConfidence, setVadConfidence] = useState(0.7)
  const [vadStartSecs, setVadStartSecs] = useState(0.2)
  const [vadStopSecs, setVadStopSecs] = useState(0.8)
  const [vadMinVolume, setVadMinVolume] = useState(0.6)

  const defaultAzureConfig = useMemo(() => ({
    endpoint: 'https://pype-azure-openai.cognitiveservices.azure.com/',
    apiVersion: '2024-12-01-preview',
  }), [])

  // Derived dirty state — no useEffect needed, no race conditions
  const currentSnapshot = isLoaded ? buildSnapshot({
    prompt, openingMessage, transferNumber,
    selectedProvider, selectedModel,
    sttModel, sttConfig,
    ttsVoiceId, ttsModel,
    tools, customTools,
    vadConfidence, vadStartSecs, vadStopSecs, vadMinVolume,
  }) : null

  const isDirty = isLoaded && currentSnapshot !== savedSnapshot

  // ── Helper to populate state + snapshot from a PipecatAgent object ──────────
  const populateFromAgent = useCallback((a: PipecatAgent) => {
    setAgent(a)
    setPrompt(a.prompt || '')
    setOpeningMessage(a.opening_message || '')
    setTransferNumber(a.transfer_number || '')
    setTools(a.tools || ['end_call', 'transfer_call'])
    setCustomTools(a.custom_tools || [])

    const { provider, model } = mapLLMModelToProvider(a.llm_model, a.llm_provider)
    setSelectedProvider(provider)
    setSelectedModel(model)

    setSttProvider('sarvam')
    setSttModel(a.stt_model || 'saarika:v2.5')
    setSttConfig({ language: a.stt_language || 'en-IN' })

    setTtsProvider('elevenlabs')
    setTtsModel(a.tts_model || 'eleven_flash_v2_5')
    setTtsVoiceId(a.tts_voice_id || '')

    setVadConfidence(a.vad_confidence ?? 0.7)
    setVadStartSecs(a.vad_start_secs ?? 0.2)
    setVadStopSecs(a.vad_stop_secs ?? 0.8)
    setVadMinVolume(a.vad_min_volume ?? 0.6)

    const snap = buildSnapshot({
      prompt: a.prompt || '',
      openingMessage: a.opening_message || '',
      transferNumber: a.transfer_number || '',
      selectedProvider: provider,
      selectedModel: model,
      sttModel: a.stt_model || 'saarika:v2.5',
      sttConfig: { language: a.stt_language || 'en-IN' },
      ttsVoiceId: a.tts_voice_id || '',
      ttsModel: a.tts_model || 'eleven_flash_v2_5',
      tools: a.tools || ['end_call', 'transfer_call'],
      customTools: a.custom_tools || [],
      vadConfidence: a.vad_confidence ?? 0.7,
      vadStartSecs: a.vad_start_secs ?? 0.2,
      vadStopSecs: a.vad_stop_secs ?? 0.8,
      vadMinVolume: a.vad_min_volume ?? 0.6,
    })
    setSavedSnapshot(snap)
    setIsLoaded(true)
  }, [])

  // ── Initial fetch ────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchAgent = async () => {
      setIsLoaded(false)
      setSavedSnapshot(null)
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/pipecat/agents/${pipecatAgentId}`)
        if (!response.ok) throw new Error(`Failed to fetch agent: ${response.status}`)
        const data = await response.json()
        populateFromAgent(data.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load agent')
      } finally {
        setIsLoading(false)
      }
    }

    fetchAgent()
  }, [pipecatAgentId, populateFromAgent])

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!agent) return
    setIsSaving(true)
    setSaveError(null)

    try {
      const updatePayload: any = {
        prompt,
        opening_message: openingMessage || null,
        llm_model: selectedModel,
        llm_provider: mapProviderToLLMProvider(selectedProvider),
        stt_model: sttModel,
        stt_language: sttConfig?.language || 'en-IN',
        tts_model: ttsModel,
        tts_voice_id: ttsVoiceId || null,
        transfer_number: transferNumber,
        tools,
        custom_tools: customTools,
        vad_confidence: vadConfidence,
        vad_start_secs: vadStartSecs,
        vad_stop_secs: vadStopSecs,
        vad_min_volume: vadMinVolume,
        whispey_api_key: agent.whispey_api_key,
        whispey_agent_id: agent.whispey_agent_id,
      }

      const response = await fetch(`/api/pipecat/agents/${pipecatAgentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save agent')
      }

      // Update saved snapshot so dirty resets
      setSavedSnapshot(buildSnapshot({
        prompt, openingMessage, transferNumber,
        selectedProvider, selectedModel,
        sttModel, sttConfig,
        ttsVoiceId, ttsModel,
        tools, customTools,
        vadConfidence, vadStartSecs, vadStopSecs, vadMinVolume,
      }))

      // Save history checkpoint — fire-and-forget
      const { whispey_api_key, ...snapshotPayload } = updatePayload
      fetch(`/api/agents/${agentId}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: { platform: 'pipecat', agent: snapshotPayload },
          userEmail: null,
          userId: null,
        }),
      }).catch(err => console.warn('[history] Failed to save checkpoint:', err))

    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save agent')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Discard ──────────────────────────────────────────────────────────────────
  const handleDiscard = () => {
    setIsLoaded(false)
    setSavedSnapshot(null)
    setIsLoading(true)
    fetch(`/api/pipecat/agents/${pipecatAgentId}`)
      .then(r => r.json())
      .then(data => populateFromAgent(data.data))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to reload agent'))
      .finally(() => setIsLoading(false))
  }

  // ── STT / TTS handlers ───────────────────────────────────────────────────────
  const handleSTTSelect = (provider: string, model: string, config: any) => {
    setSttProvider(provider)
    setSttModel(model)
    setSttConfig(config)
  }

  const handleVoiceSelect = (voiceId: string, provider: string, model?: string, config?: any) => {
    setTtsVoiceId(voiceId)
    setTtsProvider(provider)
    if (model) setTtsModel(model)
    if (config) setTtsConfig(config)
  }

  const copyPrompt = async () => {
    if (!prompt) return
    try {
      await navigator.clipboard.writeText(prompt)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch {}
  }

  // ── Loading / error states ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-64"></div>
          <div className="h-96 bg-gray-200 dark:bg-gray-800 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Failed to load Pipecat agent</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <Button onClick={() => router.back()} variant="outline" className="w-full">Go Back</Button>
        </div>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">

      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/${projectId}/agents/${agentId}`)}
              className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              <div className="flex flex-col">
                <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                  {agentName}
                  <span className="text-xs px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded font-medium">
                    Pipecat
                  </span>
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-500">Agent Configuration</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isDirty && (
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleDiscard}>
                Discard Changes
              </Button>
            )}
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={handleSave}
              disabled={isSaving || !isDirty}
            >
              {isSaving ? (
                <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Saving...</>
              ) : (
                'Update Config'
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => setIsHistoryOpen(true)}
            >
              <History className="w-3.5 h-3.5" />
              History
            </Button>
          </div>
        </div>
      </div>

      {/* Save error */}
      {saveError && (
        <div className="px-6 py-2 flex-shrink-0">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-h-0 max-w-7xl mx-auto w-full p-4">
        <div className="h-full flex gap-4">

          {/* Left — main config */}
          <div className="flex-1 min-w-0 flex flex-col space-y-3">

            {/* Model / STT / TTS row */}
            <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
              <div className="flex-1 min-w-0">
                <ModelSelector
                  selectedProvider={selectedProvider}
                  selectedModel={selectedModel}
                  onProviderChange={setSelectedProvider}
                  onModelChange={setSelectedModel}
                  azureConfig={defaultAzureConfig}
                />
              </div>
              <div className="flex-1 min-w-0">
                <SelectSTT
                  selectedProvider={sttProvider}
                  selectedModel={sttModel}
                  selectedLanguage={sttConfig?.language}
                  initialConfig={sttConfig}
                  onSTTSelect={handleSTTSelect}
                />
              </div>
              <div className="flex-1 min-w-0">
                <SelectTTS
                  selectedVoice={ttsVoiceId}
                  initialProvider={ttsProvider}
                  initialModel={ttsModel}
                  initialConfig={ttsConfig}
                  onVoiceSelect={handleVoiceSelect}
                />
              </div>
            </div>

            {/* Opening Message */}
            <div className="flex-shrink-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-1.5">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Opening Message</label>
              <Input
                value={openingMessage}
                onChange={e => setOpeningMessage(e.target.value)}
                placeholder="नमस्ते! बताइए..."
                className="h-8 text-sm border-gray-200 dark:border-gray-700"
              />
            </div>

            {/* System Prompt */}
            <div className="flex-1 min-h-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">System Prompt</span>
                <button
                  onClick={copyPrompt}
                  className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  disabled={!prompt}
                >
                  {isCopied ? (
                    <><CheckIcon className="w-4 h-4 text-green-500" /><span className="text-green-500">Copied!</span></>
                  ) : (
                    <><CopyIcon className="w-4 h-4" /><span>Copy</span></>
                  )}
                </button>
              </div>
              <Textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Define your agent's behavior and personality..."
                className="flex-1 min-h-0 font-mono text-sm resize-none border-gray-200 dark:border-gray-700 leading-relaxed"
              />
              <div className="mt-2 flex justify-end flex-shrink-0">
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {prompt.length.toLocaleString()} chars
                </span>
              </div>
            </div>
          </div>

          {/* Right — Pipecat advanced settings */}
          <div className="w-80 flex-shrink-0 min-h-0 flex flex-col gap-3">
            <PipecatAdvancedSettings
              vadConfidence={vadConfidence}
              vadStartSecs={vadStartSecs}
              vadStopSecs={vadStopSecs}
              vadMinVolume={vadMinVolume}
              onVadChange={(field, value) => {
                if (field === 'confidence') setVadConfidence(value)
                else if (field === 'startSecs') setVadStartSecs(value)
                else if (field === 'stopSecs') setVadStopSecs(value)
                else if (field === 'minVolume') setVadMinVolume(value)
              }}
              transferNumber={transferNumber}
              onTransferNumberChange={setTransferNumber}
              builtinTools={tools ?? []}
              onBuiltinToolsChange={setTools}
              customTools={customTools ?? []}
              onCustomToolsChange={setCustomTools}
              projectId={projectId}
            />
          </div>

        </div>
      </div>

      <ConfigHistory
        open={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        agentId={agentId}
      />
    </div>
  )
}