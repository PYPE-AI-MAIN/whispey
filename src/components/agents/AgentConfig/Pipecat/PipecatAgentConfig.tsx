// src/components/agents/AgentConfig/Pipecat/PipecatAgentConfig.tsx
'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft, Loader2, CopyIcon, CheckIcon, AlertCircle, History, PhoneIcon, SettingsIcon,
  VariableIcon, TrashIcon, PlusIcon, ChevronDownIcon,
} from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import ModelSelector from '@/components/agents/AgentConfig/ModelSelector'
import SelectTTS from '@/components/agents/AgentConfig/SelectTTSDialog'
import SelectSTT from '@/components/agents/AgentConfig/SelectSTTDialog'
import PipecatAdvancedSettings from './PipecatAdvancedSettings/index'
import ConfigHistory from '@/components/agents/AgentConfig/ConfigHistory'
import DailyTalkToAssistant from '@/components/agents/DailyTalkToAssistant'
import CallAnalytics, { type CallAnalysisResult } from './CallAnalytics'
import { type DailyTranscript } from '@/hooks/useDailyVoiceAgent'

// ── Props ────────────────────────────────────────────────────────────────────

interface PipecatAgentConfigProps {
  agentId: string
  projectId: string
  pipecatAgentId: string
  agentName: string
}

// ── Pipecat agent shape from backend ────────────────────────────────────────

interface PipecatAgent {
  id: string
  name: string
  prompt: string
  llm_model: string
  llm_provider: string
  stt_provider: string
  stt_model: string
  stt_language: string
  tts_provider: string
  tts_model: string | null
  tts_voice_id: string | null
  transfer_number: string
  acefone_token: string | null
  tools: string[]
  tool_configs: Record<string, Record<string, unknown>>
  custom_tools: any[]
  opening_message: string | null
  vad_confidence: number
  vad_start_secs: number
  vad_stop_secs: number
  vad_min_volume: number
  smart_turn_stop_secs: number
  smart_turn_pre_speech_ms: number
  smart_turn_max_dur_secs: number
  turn_stop_timeout: number
  user_idle_timeout: number | null
  tts_stability: number | null
  tts_similarity_boost: number | null
  tts_style: number | null
  tts_speed: number
  rag_enabled: boolean
  ambient_sound_enabled: boolean
  ambient_sound_volume: number
  keyboard_sound_enabled: boolean
  keyboard_sound_volume: number
  keyboard_sound_probability: number
  keyboard_sound_on_tool_calls: boolean
  whispey_api_key: string
  whispey_agent_id: string
  timezone: string
  variables: Record<string, string>
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapLLMModelToProvider(llmModel: string, llmProvider?: string): { provider: string; model: string } {
  if (llmProvider === 'azure') return { provider: 'azure_openai', model: llmModel }
  if (llmProvider === 'groq') return { provider: 'groq', model: llmModel }
  if (llmProvider === 'cerebras') return { provider: 'cerebras', model: llmModel }
  if (llmModel.startsWith('gpt')) return { provider: 'openai', model: llmModel }
  if (llmModel.startsWith('gemini')) return { provider: 'google', model: llmModel }
  if (llmModel.startsWith('llama') || llmModel.startsWith('groq/') || llmModel.startsWith('meta-llama') || llmModel.startsWith('moonshotai') || llmModel.startsWith('openai/gpt-oss')) return { provider: 'groq', model: llmModel }
  if (llmModel.includes('claude')) return { provider: 'anthropic', model: llmModel }
  if (llmModel.startsWith('qwen') || llmModel.startsWith('zai-')) return { provider: 'cerebras', model: llmModel }
  return { provider: 'openai', model: llmModel }
}

function mapProviderToLLMProvider(provider: string): string {
  switch (provider) {
    case 'azure_openai': return 'azure'
    case 'google': return 'google'
    case 'groq': return 'groq'
    case 'cerebras': return 'cerebras'
    default: return 'openai'
  }
}

interface SnapshotValues {
  prompt: string
  openingMessage: string
  transferNumber: string
  selectedProvider: string
  selectedModel: string
  sttModel: string
  sttConfig: any
  ttsVoiceId: string
  ttsModel: string
  ttsProvider: string
  tools: string[]
  toolConfigs: Record<string, Record<string, unknown>>
  customTools: any[]
  vadConfidence: number
  vadStartSecs: number
  vadStopSecs: number
  vadMinVolume: number
  smartTurnStopSecs: number
  smartTurnPreSpeechMs: number
  smartTurnMaxDurSecs: number
  turnStopTimeout: number
  userIdleTimeout: number | null
  ttsStability: number | null
  ttsSimilarityBoost: number | null
  ttsStyle: number | null
  ttsSpeed: number
  ragEnabled: boolean
  ambientSoundEnabled: boolean
  ambientSoundVolume: number
  keyboardSoundEnabled: boolean
  keyboardSoundVolume: number
  keyboardSoundProbability: number
  keyboardSoundOnToolCalls: boolean
  timezone: string
  variables: Record<string, string>
}

function buildSnapshot(v: SnapshotValues): string {
  return JSON.stringify(v)
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PipecatAgentConfig({
  agentId, projectId, pipecatAgentId, agentName,
}: PipecatAgentConfigProps) {
  const router = useRouter()
  const { user } = useUser()

  const [agent, setAgent] = useState<PipecatAgent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isTalkOpen, setIsTalkOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isVariablesOpen, setIsVariablesOpen] = useState(true)
  const [flashEndCall, setFlashEndCall] = useState(false)
  const isTalkSessionActiveRef = useRef(false)

  // ── Call analytics ────────────────────────────────────────────────────────
  const [analyticsTranscripts, setAnalyticsTranscripts] = useState<DailyTranscript[]>([])
  const [analyticsResult, setAnalyticsResult] = useState<CallAnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)

  const runAnalysis = useCallback(async (transcripts: DailyTranscript[]) => {
    if (transcripts.length === 0) return
    setIsAnalyzing(true)
    setAnalyticsError(null)
    setAnalyticsResult(null)
    try {
      const res = await fetch('/api/pipecat/analyze-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcripts }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      setAnalyticsResult(data)
    } catch (err) {
      setAnalyticsError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setIsAnalyzing(false)
    }
  }, [])

  const handleCallEnded = useCallback((transcripts: DailyTranscript[]) => {
    setAnalyticsTranscripts(transcripts)
    setAnalyticsResult(null)
    setAnalyticsError(null)
    runAnalysis(transcripts)
  }, [runAnalysis])

  // ── Checkpoint state (same as LiveKit) ───────────────────────────────────
  const [pendingCheckpoint, setPendingCheckpoint] = useState<{
    config: any
    userEmail: string | null
    userId: string | null
  } | null>(null)
  const [isSavingCheckpoint, setIsSavingCheckpoint] = useState(false)
  const [isCheckpointExiting, setIsCheckpointExiting] = useState(false)

  // Auto-dismiss checkpoint banner after 15 seconds
  useEffect(() => {
    if (!pendingCheckpoint) return
    setIsCheckpointExiting(false)
    const exitT = setTimeout(() => setIsCheckpointExiting(true), 14_700)
    const t = setTimeout(() => setPendingCheckpoint(null), 15_000)
    return () => { clearTimeout(exitT); clearTimeout(t) }
  }, [pendingCheckpoint])

  // Dirty tracking
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  // ── Form state ───────────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState('')
  const [openingMessage, setOpeningMessage] = useState('')
  const [transferNumber, setTransferNumber] = useState('')
  const [acefoneToken, setAcefoneToken] = useState('')
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
  const [toolConfigs, setToolConfigs] = useState<Record<string, Record<string, unknown>>>({})
  const [customTools, setCustomTools] = useState<any[]>([])

  // VAD
  const [vadConfidence, setVadConfidence] = useState(0.7)
  const [vadStartSecs, setVadStartSecs] = useState(0.2)
  const [vadStopSecs, setVadStopSecs] = useState(0.8)
  const [vadMinVolume, setVadMinVolume] = useState(0.6)

  // Smart Turn
  const [smartTurnStopSecs, setSmartTurnStopSecs] = useState(3.0)
  const [smartTurnPreSpeechMs, setSmartTurnPreSpeechMs] = useState(500)
  const [smartTurnMaxDurSecs, setSmartTurnMaxDurSecs] = useState(8.0)

  // Turn Management
  const [turnStopTimeout, setTurnStopTimeout] = useState(5.0)
  const [userIdleTimeout, setUserIdleTimeout] = useState<number | null>(null)

  // TTS Voice Character
  const [ttsStability, setTtsStability] = useState<number | null>(null)
  const [ttsSimilarityBoost, setTtsSimilarityBoost] = useState<number | null>(null)
  const [ttsStyle, setTtsStyle] = useState<number | null>(null)
  const [ttsSpeed, setTtsSpeed] = useState<number>(1.0)

  // RAG
  const [ragEnabled, setRagEnabled] = useState(true)

  // Ambient Sound
  const [ambientSoundEnabled, setAmbientSoundEnabled] = useState(false)
  const [ambientSoundVolume, setAmbientSoundVolume] = useState(0.3)

  // Keyboard Sound
  const [keyboardSoundEnabled, setKeyboardSoundEnabled] = useState(false)
  const [keyboardSoundVolume, setKeyboardSoundVolume] = useState(0.3)
  const [keyboardSoundProbability, setKeyboardSoundProbability] = useState(0.4)
  const [keyboardSoundOnToolCalls, setKeyboardSoundOnToolCalls] = useState(false)

  // Timezone
  const [timezone, setTimezone] = useState('Asia/Kolkata')

  // Variables — key/value pairs, e.g. { customer_name: 'John' }
  const [variables, setVariables] = useState<Record<string, string>>({})

  // Detect {{var_name}} placeholders in prompt + opening message
  const detectedVarNames = useMemo(() => {
    const regex = /\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g
    const names = new Set<string>()
    let m: RegExpExecArray | null
    const r1 = /\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g
    while ((m = r1.exec(prompt)) !== null) names.add(m[1])
    const r2 = /\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}/g
    while ((m = r2.exec(openingMessage)) !== null) names.add(m[1])
    return [...names]
  }, [prompt, openingMessage])

  const defaultAzureConfig = useMemo(() => ({
    endpoint: 'https://pype-azure-openai.cognitiveservices.azure.com/',
    apiVersion: '2024-12-01-preview',
  }), [])

  // ── Snapshot & dirty ─────────────────────────────────────────────────────

  const currentSnapshot = isLoaded ? buildSnapshot({
    prompt, openingMessage, transferNumber,
    selectedProvider, selectedModel,
    sttModel, sttConfig,
    ttsVoiceId, ttsModel,
    tools, toolConfigs, customTools,ttsProvider,
    vadConfidence, vadStartSecs, vadStopSecs, vadMinVolume,
    smartTurnStopSecs, smartTurnPreSpeechMs, smartTurnMaxDurSecs,
    turnStopTimeout, userIdleTimeout,
    ttsStability, ttsSimilarityBoost, ttsStyle, ttsSpeed,
    ragEnabled, ambientSoundEnabled, ambientSoundVolume,
    keyboardSoundEnabled, keyboardSoundVolume, keyboardSoundProbability, keyboardSoundOnToolCalls,
    timezone, variables,
  }) : null

  const isDirty = isLoaded && currentSnapshot !== savedSnapshot

  // ── Populate from agent ──────────────────────────────────────────────────

  const populateFromAgent = useCallback((a: PipecatAgent) => {
    setAgent(a)
    setPrompt(a.prompt || '')
    setOpeningMessage(a.opening_message || '')
    setTransferNumber(a.transfer_number || '')
    setAcefoneToken(a.acefone_token || '')
    setTools(a.tools || ['end_call', 'transfer_call'])
    setToolConfigs(a.tool_configs || {})
    setCustomTools(a.custom_tools || [])

    const { provider, model } = mapLLMModelToProvider(a.llm_model, a.llm_provider)
    setSelectedProvider(provider)
    setSelectedModel(model)

    setSttProvider((a as any).stt_provider || (a.stt_model?.startsWith('nova-') ? 'deepgram' : a.stt_model === 'whisper-1' ? 'openai' : 'sarvam'))
    setSttModel(a.stt_model || 'saarika:v2.5')
    setSttConfig({ language: a.stt_language || 'en-IN' })

    setTtsProvider((a as any).tts_provider || (a.tts_model?.startsWith('bulbul:') ? 'sarvam' : 'elevenlabs'))
    setTtsModel(a.tts_model || 'eleven_flash_v2_5')
    setTtsVoiceId(a.tts_voice_id || '')

    setVadConfidence(a.vad_confidence ?? 0.7)
    setVadStartSecs(a.vad_start_secs ?? 0.2)
    setVadStopSecs(a.vad_stop_secs ?? 0.8)
    setVadMinVolume(a.vad_min_volume ?? 0.6)

    setSmartTurnStopSecs(a.smart_turn_stop_secs ?? 3.0)
    setSmartTurnPreSpeechMs(a.smart_turn_pre_speech_ms ?? 500)
    setSmartTurnMaxDurSecs(a.smart_turn_max_dur_secs ?? 8.0)

    setTurnStopTimeout(a.turn_stop_timeout ?? 5.0)
    setUserIdleTimeout(a.user_idle_timeout ?? null)

    setRagEnabled(a.rag_enabled ?? true)
    setAmbientSoundEnabled(a.ambient_sound_enabled ?? false)
    setAmbientSoundVolume(a.ambient_sound_volume ?? 0.3)
    setKeyboardSoundEnabled(a.keyboard_sound_enabled ?? false)
    setKeyboardSoundVolume(a.keyboard_sound_volume ?? 0.3)
    setKeyboardSoundProbability(a.keyboard_sound_probability ?? 0.4)
    setKeyboardSoundOnToolCalls(a.keyboard_sound_on_tool_calls ?? false)
    setTimezone(a.timezone || 'Asia/Kolkata')
    setVariables(a.variables || {})

    setSavedSnapshot(buildSnapshot({
      prompt: a.prompt || '',
      openingMessage: a.opening_message || '',
      transferNumber: a.transfer_number || '',
      selectedProvider: provider,
      selectedModel: model,
      sttModel: a.stt_model || 'saarika:v2.5',
      sttConfig: { language: a.stt_language || 'en-IN' },
      ttsVoiceId: a.tts_voice_id || '',
      ttsModel: a.tts_model || 'eleven_flash_v2_5',
      ttsProvider: (a as any).tts_provider || (a.tts_model?.startsWith('bulbul:') ? 'sarvam' : 'elevenlabs'),
      tools: a.tools || ['end_call', 'transfer_call'],
      toolConfigs: a.tool_configs || {},
      customTools: a.custom_tools || [],
      vadConfidence: a.vad_confidence ?? 0.7,
      vadStartSecs: a.vad_start_secs ?? 0.2,
      vadStopSecs: a.vad_stop_secs ?? 0.8,
      vadMinVolume: a.vad_min_volume ?? 0.6,
      smartTurnStopSecs: a.smart_turn_stop_secs ?? 3.0,
      smartTurnPreSpeechMs: a.smart_turn_pre_speech_ms ?? 500,
      smartTurnMaxDurSecs: a.smart_turn_max_dur_secs ?? 8.0,
      turnStopTimeout: a.turn_stop_timeout ?? 5.0,
      userIdleTimeout: a.user_idle_timeout ?? null,
      ragEnabled: a.rag_enabled ?? true,
      ambientSoundEnabled: a.ambient_sound_enabled ?? false,
      ambientSoundVolume: a.ambient_sound_volume ?? 0.3,
      keyboardSoundEnabled: a.keyboard_sound_enabled ?? false,
      keyboardSoundVolume: a.keyboard_sound_volume ?? 0.3,
      keyboardSoundProbability: a.keyboard_sound_probability ?? 0.4,
      keyboardSoundOnToolCalls: a.keyboard_sound_on_tool_calls ?? false,
      timezone: a.timezone || 'Asia/Kolkata',
      variables: a.variables || {},
    }))
    setIsLoaded(true)
  }, [])

  // ── Fetch ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchAgent = async () => {
      setIsLoaded(false); setSavedSnapshot(null)
      setIsLoading(true); setError(null)
      try {
        const res = await fetch(`/api/pipecat/agents/${pipecatAgentId}`)
        if (!res.ok) throw new Error(`Failed to fetch agent: ${res.status}`)
        const data = await res.json()
        populateFromAgent(data.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load agent')
      } finally {
        setIsLoading(false)
      }
    }
    fetchAgent()
  }, [pipecatAgentId, populateFromAgent])

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!agent) return
    setIsSaving(true); setSaveError(null)
    try {
      const updatePayload: any = {
        prompt,
        opening_message: openingMessage || null,
        llm_model: selectedModel,
        llm_provider: mapProviderToLLMProvider(selectedProvider),
        stt_provider: sttProvider,
        stt_model: sttModel,
        stt_language: sttConfig?.language || 'en-IN',
        tts_provider: ttsProvider,
        tts_model: ttsModel || null,
        tts_voice_id: ttsVoiceId || null,
        transfer_number: transferNumber,
        acefone_token: acefoneToken || null,
        tools,
        tool_configs: toolConfigs,
        custom_tools: customTools,
        vad_confidence: vadConfidence,
        vad_start_secs: vadStartSecs,
        vad_stop_secs: vadStopSecs,
        vad_min_volume: vadMinVolume,
        smart_turn_stop_secs: smartTurnStopSecs,
        smart_turn_pre_speech_ms: smartTurnPreSpeechMs,
        smart_turn_max_dur_secs: smartTurnMaxDurSecs,
        turn_stop_timeout: turnStopTimeout,
        user_idle_timeout: userIdleTimeout,
        rag_enabled: ragEnabled,
        ambient_sound_enabled: ambientSoundEnabled,
        ambient_sound_volume: ambientSoundVolume,
        keyboard_sound_enabled: keyboardSoundEnabled,
        keyboard_sound_volume: keyboardSoundVolume,
        keyboard_sound_probability: keyboardSoundProbability,
        keyboard_sound_on_tool_calls: keyboardSoundOnToolCalls,
        timezone,
        variables,
        whispey_api_key: agent.whispey_api_key,
        whispey_agent_id: agent.whispey_agent_id,
      }

      const res = await fetch(`/api/pipecat/agents/${pipecatAgentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to save agent')
      }

      setSavedSnapshot(buildSnapshot({
        prompt, openingMessage, transferNumber,
        selectedProvider, selectedModel,
        sttModel, sttConfig, ttsVoiceId, ttsModel,
        tools, toolConfigs, customTools,ttsProvider, 
        vadConfidence, vadStartSecs, vadStopSecs, vadMinVolume,
        smartTurnStopSecs, smartTurnPreSpeechMs, smartTurnMaxDurSecs,
        turnStopTimeout, userIdleTimeout,
        ttsStability, ttsSimilarityBoost, ttsStyle, ttsSpeed,
        ragEnabled, ambientSoundEnabled, ambientSoundVolume,
        keyboardSoundEnabled, keyboardSoundVolume, keyboardSoundProbability, keyboardSoundOnToolCalls,
        timezone, variables,
      }))

      // Show checkpoint banner — identical to LiveKit flow
      const { whispey_api_key, ...snapshotPayload } = updatePayload
      setPendingCheckpoint({
        config: { platform: 'pipecat', agent: snapshotPayload },
        userEmail: user?.primaryEmailAddress?.emailAddress ?? null,
        userId: user?.id ?? null,
      })

    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save agent')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Checkpoint save ──────────────────────────────────────────────────────

  const handleSaveCheckpoint = async () => {
    if (!pendingCheckpoint) return
    setIsSavingCheckpoint(true)
    try {
      const res = await fetch(`/api/agents/${agentId}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pendingCheckpoint),
      })
      if (!res.ok) {
        const err = await res.json()
        console.error('[checkpoint] Save failed:', err.message)
      }
    } catch (err) {
      console.error('[checkpoint] Unexpected error:', err)
    } finally {
      setIsSavingCheckpoint(false)
      setPendingCheckpoint(null)
    }
  }

  // ── Discard ──────────────────────────────────────────────────────────────

  const handleDiscard = () => {
    setIsLoaded(false); setSavedSnapshot(null); setIsLoading(true)
    fetch(`/api/pipecat/agents/${pipecatAgentId}`)
      .then(r => r.json())
      .then(data => populateFromAgent(data.data))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to reload'))
      .finally(() => setIsLoading(false))
  }

  // ── STT / TTS handlers ───────────────────────────────────────────────────

  const handleSTTSelect = (provider: string, model: string, config: any) => {
    setSttProvider(provider); setSttModel(model); setSttConfig(config)
  }

  const handleVoiceSelect = (voiceId: string, provider: string, model?: string, config?: any) => {
    setTtsVoiceId(voiceId); setTtsProvider(provider)
    if (model) setTtsModel(model)
    if (config) setTtsConfig(config)
  }

  // ── VAD / Smart Turn / Turn / TTS Char handlers ──────────────────────────

  const handleVadChange = (field: string, value: number) => {
    if (field === 'confidence') setVadConfidence(value)
    else if (field === 'startSecs') setVadStartSecs(value)
    else if (field === 'stopSecs') setVadStopSecs(value)
    else if (field === 'minVolume') setVadMinVolume(value)
  }

  const handleSmartTurnChange = (field: string, value: number) => {
    if (field === 'stopSecs') setSmartTurnStopSecs(value)
    else if (field === 'preSpeechMs') setSmartTurnPreSpeechMs(value)
    else if (field === 'maxDurSecs') setSmartTurnMaxDurSecs(value)
  }

  const handleTurnChange = (field: string, value: number | null) => {
    if (field === 'turnStopTimeout') setTurnStopTimeout(value as number)
    else if (field === 'userIdleTimeout') setUserIdleTimeout(value)
  }

  const copyPrompt = async () => {
    if (!prompt) return
    try {
      await navigator.clipboard.writeText(prompt)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch {}
  }

  // ── Loading / error ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-64" />
          <div className="h-96 bg-gray-200 dark:bg-gray-800 rounded" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Failed to load Pipecat agent
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <Button onClick={() => router.back()} variant="outline" className="w-full">Go Back</Button>
        </div>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────

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
              <div className="w-2 h-2 rounded-full bg-orange-500" />
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
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => setIsTalkOpen(true)}
            >
              <PhoneIcon className="w-3 h-3" />
              Talk to Agent
            </Button>
            {isDirty && (
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleDiscard}>
                Discard
              </Button>
            )}
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={handleSave}
              disabled={isSaving || !isDirty}
            >
              {isSaving
                ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Saving...</>
                : 'Update Config'
              }
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
          <div className="flex-1 min-w-0 flex flex-col space-y-3 overflow-y-auto">

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

            {/* Opening Message + Timezone row */}
            <div className="flex gap-3 flex-shrink-0">
              <div className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Opening Message</label>
                <Input
                  value={openingMessage}
                  onChange={e => setOpeningMessage(e.target.value)}
                  placeholder="नमस्ते! बताइए... or Hello {{customer_name}}!"
                  className="h-8 text-sm border-gray-200 dark:border-gray-700"
                />
              </div>
              <div className="w-52 flex-shrink-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Timezone</label>
                <select
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  className="w-full h-8 px-2 text-xs rounded-md border border-gray-200 dark:border-gray-700
                             bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                             focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[
                    'Asia/Kolkata','Asia/Dubai','Asia/Singapore','Asia/Tokyo',
                    'Asia/Shanghai','Asia/Jakarta','Asia/Karachi','Asia/Dhaka',
                    'Europe/London','Europe/Paris','Europe/Berlin','Europe/Moscow',
                    'America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
                    'America/Sao_Paulo','Africa/Cairo','Africa/Lagos',
                    'Australia/Sydney','Pacific/Auckland',
                  ].map(tz => (
                    <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* System Prompt */}
            <div className={`${analyticsTranscripts.length === 0 ? 'flex-1 min-h-0' : 'min-h-[280px]'} bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col`}>
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">System Prompt</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className={`flex items-center gap-1 text-xs transition-colors ${
                      detectedVarNames.some(n => !(n in variables))
                        ? 'text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    <SettingsIcon className="w-4 h-4" />
                    <span>Settings</span>
                    {detectedVarNames.some(n => !(n in variables)) && (
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    )}
                  </button>
                  <button
                    onClick={copyPrompt}
                    className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    disabled={!prompt}
                  >
                    {isCopied
                      ? <><CheckIcon className="w-4 h-4 text-green-500" /><span className="text-green-500">Copied!</span></>
                      : <><CopyIcon className="w-4 h-4" /><span>Copy</span></>
                    }
                  </button>
                </div>
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

            {/* Call Analytics — shown after a web call ends */}
            {analyticsTranscripts.length > 0 && (
              <CallAnalytics
                transcripts={analyticsTranscripts}
                analysis={analyticsResult}
                isAnalyzing={isAnalyzing}
                error={analyticsError}
                onRetry={() => runAnalysis(analyticsTranscripts)}
                onDismiss={() => {
                  setAnalyticsTranscripts([])
                  setAnalyticsResult(null)
                  setAnalyticsError(null)
                }}
              />
            )}

          </div>

          {/* Right — advanced settings */}
          <div className="w-80 flex-shrink-0 min-h-0">
            <PipecatAdvancedSettings
              vadConfidence={vadConfidence}
              vadStartSecs={vadStartSecs}
              vadStopSecs={vadStopSecs}
              vadMinVolume={vadMinVolume}
              onVadChange={handleVadChange}
              transferNumber={transferNumber}
              onTransferNumberChange={setTransferNumber}
              acefoneToken={acefoneToken}
              onAcefoneTokenChange={setAcefoneToken}
              builtinTools={tools}
              onBuiltinToolsChange={setTools}
              toolConfigs={toolConfigs}
              onToolConfigsChange={setToolConfigs}
              customTools={customTools}
              onCustomToolsChange={setCustomTools}
              smartTurnStopSecs={smartTurnStopSecs}
              smartTurnPreSpeechMs={smartTurnPreSpeechMs}
              smartTurnMaxDurSecs={smartTurnMaxDurSecs}
              onSmartTurnChange={handleSmartTurnChange}
              turnStopTimeout={turnStopTimeout}
              userIdleTimeout={userIdleTimeout}
              onTurnChange={handleTurnChange}
              ragEnabled={ragEnabled}
              onRagEnabledChange={setRagEnabled}
              ambientSoundEnabled={ambientSoundEnabled}
              ambientSoundVolume={ambientSoundVolume}
              onAmbientSoundEnabledChange={setAmbientSoundEnabled}
              onAmbientSoundVolumeChange={setAmbientSoundVolume}
              keyboardSoundEnabled={keyboardSoundEnabled}
              keyboardSoundVolume={keyboardSoundVolume}
              keyboardSoundProbability={keyboardSoundProbability}
              keyboardSoundOnToolCalls={keyboardSoundOnToolCalls}
              onKeyboardSoundEnabledChange={setKeyboardSoundEnabled}
              onKeyboardSoundVolumeChange={setKeyboardSoundVolume}
              onKeyboardSoundProbabilityChange={setKeyboardSoundProbability}
              onKeyboardSoundOnToolCallsChange={setKeyboardSoundOnToolCalls}
              projectId={projectId}
              agentId={agentId}
            />
          </div>

        </div>
      </div>

      <ConfigHistory
        open={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        agentId={agentId}
      />

      {/* Prompt Settings Sheet — variables (same approach as LiveKit) */}
      <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px] p-6 overflow-y-auto bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <SettingsIcon className="w-4 h-4" />
              Prompt Settings
            </SheetTitle>
            <SheetDescription>
              Configure variables detected in your prompt and greeting
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            {/* Unmapped variable warning */}
            {detectedVarNames.filter(n => !(n in variables)).length > 0 && (
              <div
                className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                onClick={() => {
                  const unmapped = detectedVarNames.filter(n => !(n in variables))
                  setVariables(v => {
                    const next = { ...v }
                    unmapped.forEach(n => { if (!(n in next)) next[n] = '' })
                    return next
                  })
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-red-800 dark:text-red-200">
                      <p className="font-medium mb-1">
                        {detectedVarNames.filter(n => !(n in variables)).length} unmapped variable{detectedVarNames.filter(n => !(n in variables)).length > 1 ? 's' : ''} — click to configure
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {detectedVarNames.filter(n => !(n in variables)).map(name => (
                          <code key={name} className="bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded text-red-900 dark:text-red-200">
                            {`{{${name}}}`}
                          </code>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      const unmapped = detectedVarNames.filter(n => !(n in variables))
                      setVariables(v => {
                        const next = { ...v }
                        unmapped.forEach(n => { if (!(n in next)) next[n] = '' })
                        return next
                      })
                    }}
                    className="h-7 text-xs flex-shrink-0 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30"
                  >
                    Map All
                  </Button>
                </div>
              </div>
            )}

            {/* Variables collapsible */}
            <Collapsible open={isVariablesOpen} onOpenChange={setIsVariablesOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-center gap-2">
                  <VariableIcon className="w-4 h-4" />
                  <span className="font-medium text-sm">Variables</span>
                  {Object.keys(variables).length > 0 && (
                    <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-0.5 rounded-full">
                      {Object.keys(variables).length}
                    </span>
                  )}
                </div>
                <ChevronDownIcon className={`w-4 h-4 transition-transform ${isVariablesOpen ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>

              <CollapsibleContent className="space-y-4 mt-4">
                {/* Detected vars from prompt/greeting */}
                {detectedVarNames.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Detected in prompt / greeting</p>
                    <div className="space-y-2">
                      {detectedVarNames.map(name => (
                        <div key={name} className="flex items-center gap-2">
                          <code className="font-mono text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded w-36 flex-shrink-0 truncate">
                            {`{{${name}}}`}
                          </code>
                          <Input
                            value={variables[name] ?? ''}
                            onChange={e => setVariables(v => ({ ...v, [name]: e.target.value }))}
                            placeholder="default value…"
                            className="h-8 text-xs flex-1 border-gray-200 dark:border-gray-700"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extra (manually added) vars */}
                <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Custom Variables</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => {
                        const name = `variable_${Object.keys(variables).length + 1}`
                        setVariables(v => ({ ...v, [name]: '' }))
                      }}
                    >
                      <PlusIcon className="w-3 h-3" />
                      Add
                    </Button>
                  </div>

                  {Object.keys(variables).filter(k => !detectedVarNames.includes(k)).length === 0 ? (
                    <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                      <VariableIcon className="w-6 h-6 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">No custom variables</p>
                      <p className="text-[10px] mt-1">
                        Use <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{`{{variable_name}}`}</code> in your prompt
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {Object.keys(variables)
                        .filter(k => !detectedVarNames.includes(k))
                        .map(name => (
                          <div key={name} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 w-1/2">
                                <Input
                                  value={name}
                                  onChange={e => {
                                    let newName = e.target.value.replace(/\s/g, '_').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32)
                                    if (newName === name) return
                                    setVariables(v => {
                                      const next: Record<string, string> = {}
                                      Object.keys(v).forEach(k => { next[k === name ? newName : k] = v[k] })
                                      return next
                                    })
                                  }}
                                  placeholder="variable_name"
                                  className="h-8 text-xs border-gray-200 dark:border-gray-700"
                                />
                              </div>
                              <div className="w-1/2">
                                <Input
                                  value={variables[name] ?? ''}
                                  onChange={e => setVariables(v => ({ ...v, [name]: e.target.value }))}
                                  placeholder="Default value"
                                  className="h-8 text-xs border-gray-200 dark:border-gray-700"
                                />
                              </div>
                              <button
                                onClick={() => setVariables(v => { const n = { ...v }; delete n[name]; return n })}
                                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded"
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={isTalkOpen}
        onOpenChange={(open) => {
          if (!open && isTalkSessionActiveRef.current) { setFlashEndCall(true); return }
          setIsTalkOpen(open)
        }}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Talk to Agent</SheetTitle>
        </SheetHeader>
        <SheetContent
          side="right"
          className="w-full sm:w-96 p-0"
          onInteractOutside={(e) => {
            if (isTalkSessionActiveRef.current) { e.preventDefault(); setFlashEndCall(true) }
          }}
          onEscapeKeyDown={(e) => {
            if (isTalkSessionActiveRef.current) { e.preventDefault(); setFlashEndCall(true) }
          }}
        >
          <DailyTalkToAssistant
            agentName={agent?.name || agentName}
            isOpen={isTalkOpen}
            onClose={() => setIsTalkOpen(false)}
            agentStatus={{ status: 'running' }}
            flashEndCall={flashEndCall}
            onFlashEndCallDone={() => setFlashEndCall(false)}
            onSessionActiveChange={(active) => { isTalkSessionActiveRef.current = active }}
            sessionEndpoint="/api/pipecat/start-web-session"
            onCallEnded={handleCallEnded}
          />
        </SheetContent>
      </Sheet>

      {/* Checkpoint banner — identical to LiveKit */}
      {pendingCheckpoint && (
        <div className="fixed top-[10px] left-1/2 -translate-x-1/2 z-50">
          <div className={`relative bg-background border shadow-lg rounded-xl overflow-hidden whitespace-nowrap ${
            isCheckpointExiting
              ? 'animate-out slide-out-to-top-4 fade-out duration-300 fill-mode-forwards'
              : 'animate-in slide-in-from-top-4 duration-300'
          }`}>
            {/* Progress bar */}
            <div className="absolute inset-x-0 top-0 h-[3px] bg-muted/50">
              <div
                className="h-full bg-primary"
                style={{ animation: 'version-progress 15s linear forwards' }}
              />
            </div>
            {/* Content */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-3 text-sm">
              <CheckIcon className="w-4 h-4 text-green-500 shrink-0" />
              <span className="text-foreground text-xs">Config saved. Save as a version?</span>
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs"
                onClick={handleSaveCheckpoint}
                disabled={isSavingCheckpoint}
              >
                {isSavingCheckpoint ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save version'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => { setIsCheckpointExiting(true); setTimeout(() => setPendingCheckpoint(null), 300) }}
                disabled={isSavingCheckpoint}
              >
                Skip
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}