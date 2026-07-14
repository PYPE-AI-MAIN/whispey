// src/app/[projectid]/agents/[agentid]/config/page.tsx
'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSupabaseQuery } from '@/hooks/useSupabase'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  CopyIcon, 
  CheckIcon, 
  SettingsIcon, 
  TypeIcon, 
  SlidersHorizontal, 
  PhoneIcon,
  Play,
  Square,
  Loader2,
  MoreVertical,
  Save,
  X,
  ArrowLeft,
  AlertCircle,
  History
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { firstMessageModes } from '@/utils/constants'
import { useFormik } from 'formik'
import ModelSelector from '@/components/agents/AgentConfig/ModelSelector'
import { SideBySideDiff } from '@/components/agents/AgentConfig/SideBySideDiff'
import { sanitizeForDiff, serializeForDiff, extractPrompt, omitPrompt } from '@/lib/configDiff'
import SelectTTS from '@/components/agents/AgentConfig/SelectTTSDialog'
import SelectSTT from '@/components/agents/AgentConfig/SelectSTTDialog'
import AgentAdvancedSettings from '@/components/agents/AgentConfig/AgentAdvancedSettings'
import PromptSettingsSheet from '@/components/agents/AgentConfig/PromptSettingsSheet'
import { usePromptSettings } from '@/hooks/usePromptSettings'
import { buildFormValuesFromAgent, getDefaultFormValues, useAgentConfig, useAgentMutations } from '@/hooks/useAgentConfig'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import TalkToAssistant from '@/components/agents/TalkToAssistant' 
import { useMultiAssistantState } from '@/hooks/useMultiAssistantState'
import { VariableTextarea } from '@/components/agents/variables/VariableTextarea'
import { VariableValidationIndicator } from '@/components/agents/variables/VariableErrorDisplay'
import { ValidationResult } from '@/utils/variableValidator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import CopyConfigDialog from '@/components/agents/AgentConfig/CopyConfigDialog'
import PasteConfigDialog from '@/components/agents/AgentConfig/PasteConfigDialog'
import { DeserializedConfig } from '@/utils/agentConfigSerializer'
import DynamicTTSSwitch from '@/components/agents/AgentConfig/DynamicTTSSwitch'
import { useUser } from '@clerk/nextjs'
import ConfigHistory from '@/components/agents/AgentConfig/ConfigHistory'
import { useMemberVisibility } from '@/hooks/useMemberVisibility'
import { canShowAgentSection } from '@/types/visibility'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { saveSupplementalSettings } from '@/lib/supplementalSettings'
import toast from 'react-hot-toast'

// Agent status service
const agentStatusService = {
  checkAgentStatus: async (agentName: string): Promise<AgentStatus> => {
    try {
      if (!agentName) {
        console.warn('⚠️ Agent name is empty or undefined')
        return { status: 'error' as const, error: 'Agent name is required' }
      }

      const response = await fetch(`/api/agents/status/${encodeURIComponent(agentName)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.backend_unavailable) {
          return {
            status: 'stopped' as const,
            error: 'Voice backend unreachable',
            raw: data,
          }
        }
        const status: AgentStatus['status'] = data.is_active && data.worker_running ? 'running' : 'stopped'
        
        const mappedStatus: AgentStatus = {
          status,
          pid: data.worker_pid,
          error: !data.is_active ? 'Agent not active' : 
                 !data.worker_running ? 'Worker not running' : 
                 !data.inbound_ready ? 'Inbound not ready' : undefined,
          raw: data
        }
        
        return mappedStatus
      }
      
      console.error('❌ Agent status request failed:', response.status, response.statusText)
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      return { 
        status: 'error' as const, 
        error: errorData.error || `Failed to check status: ${response.status}` 
      }
    } catch (error) {
      console.error('❌ Agent status connection error:', error)
      return { status: 'error' as const, error: 'Connection error' }
    }
  },
  
  startAgent: async (agentName: string): Promise<AgentStatus> => {
    try {
      if (!agentName) {
        return { status: 'error' as const, error: 'Agent name is required' }
      }

      console.log('🚀 Starting agent via API:', agentName)
      
      const response = await fetch('/api/agents/start_agent', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ agent_name: agentName })
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('✅ Start agent response:', data)
        
        return {
          status: 'starting' as const,
          message: data.message || 'Agent start initiated',
          raw: data
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        return { 
          status: 'error' as const, 
          error: errorData.error || `Failed to start agent: ${response.status}` 
        }
      }
    } catch (error) {
      console.error('❌ Start agent error:', error)
      return { status: 'error' as const, error: 'Failed to start agent' }
    }
  },
  
  stopAgent: async (agentName: string): Promise<AgentStatus> => {
    try {
      if (!agentName) {
        return { status: 'error' as const, error: 'Agent name is required' }
      }

      console.log('🛑 Stopping agent via API:', agentName)
      
      const response = await fetch('/api/agents/stop_agent', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ agent_name: agentName })
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('✅ Stop agent response:', data)
        
        return {
          status: 'stopping' as const,
          message: data.message || 'Agent stop initiated',
          raw: data
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        return { 
          status: 'error' as const, 
          error: errorData.error || `Failed to stop agent: ${response.status}` 
        }
      }
    } catch (error) {
      console.error('❌ Stop agent error:', error)
      return { status: 'error' as const, error: 'Failed to stop agent' }
    }
  }
}

interface AzureConfig {
  endpoint: string
  apiVersion: string
}

interface AgentStatus {
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error'
  pid?: number
  error?: string
  message?: string
  raw?: any
}

export default function AgentConfig() {
  const params = useParams()
  const router = useRouter()
  const agentid = Array.isArray(params.agentid) ? params.agentid[0] : params.agentid || ''
  const projectId = Array.isArray(params.projectid) ? params.projectid[0] : params.projectid || ''
  const { user } = useUser()
  
  const { isOwnerOrAdmin, visibility, isLoading: roleLoading } = useMemberVisibility(projectId || undefined)

  useEffect(() => {
    if (roleLoading || !projectId || !agentid) return
    const allowed = isOwnerOrAdmin || canShowAgentSection(visibility, 'agentConfig')
    if (!allowed) {
      router.replace(`/${projectId}/agents/${agentid}`)
    }
  }, [isOwnerOrAdmin, visibility, roleLoading, projectId, agentid, router])

  const [isCopied, setIsCopied] = useState(false)
  const [isPromptSettingsOpen, setIsPromptSettingsOpen] = useState(false)
  const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false)
  const [isTalkToAssistantOpen, setIsTalkToAssistantOpen] = useState(false)
  const [isDynamicTTSDialogOpen, setIsDynamicTTSDialogOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  const [isCopyConfigDialogOpen, setIsCopyConfigDialogOpen] = useState(false)
  const [isPasteConfigDialogOpen, setIsPasteConfigDialogOpen] = useState(false)

  const [pendingCheckpoint, setPendingCheckpoint] = useState<{ config: any; userEmail: string | null; userId: string | null } | null>(null)
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [isSavingVersion, setIsSavingVersion] = useState(false)
  const [versionSaveError, setVersionSaveError] = useState<string | null>(null)
  const [showMergePrompt, setShowMergePrompt] = useState(false)
  const [publishedSnapshot, setPublishedSnapshot] = useState<any>(null)
  const [isDiffLoading, setIsDiffLoading] = useState(false)
  const promptDiffRef = useRef<HTMLDivElement>(null)
  const settingsDiffRef = useRef<HTMLDivElement>(null)

  const [flashEndCall, setFlashEndCall] = useState(false)
  const isTalkToAssistantSessionActiveRef = useRef(false)
  
  // Agent status state
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({ status: 'stopped' })
  const [isAgentLoading, setIsAgentLoading] = useState(false)

  // Variable validation state
  const [promptValidation, setPromptValidation] = useState<ValidationResult>({
    isValid: true,
    errors: [],
    validVariables: new Set()
  })

  const { getTextareaStyles, settings, setFontSize } = usePromptSettings()

  // Azure config state for ModelSelector
  const [azureConfig, setAzureConfig] = useState<AzureConfig>({
    endpoint: '',
    apiVersion: ''
  })

  const [fallbackAzureConfig, setFallbackAzureConfig] = useState<AzureConfig>({
    endpoint: '',
    apiVersion: ''
  })

  const [hasExternalChanges, setHasExternalChanges] = useState(false)

  const [ttsConfig, setTtsConfig] = useState({
    provider: '',
    model: '',
    config: {}
  })

  const [sttConfig, setSTTConfig] = useState({
    provider: '',
    model: '',
    config: {}
  })

  // Get agent data from Supabase
  const { data: agentDataResponse, isLoading: agentLoading } = useSupabaseQuery("pype_voice_agents", {
    select: "id, name, agent_type, configuration, vapi_api_key_encrypted, vapi_project_key_encrypted, environment",
    filters: [{ column: "id", operator: "eq", value: agentid }],
    limit: 1,
    auth: agentid ? { agentId: agentid } : undefined,
  })

  const agentNameWithId = useMemo(() => {
    if (!agentDataResponse?.[0]?.name || !agentid) {
      return ''
    }
    
    const sanitizedAgentId = agentid.replace(/-/g, '_')
    return `${agentDataResponse[0].name}_${sanitizedAgentId}`
  }, [agentDataResponse, agentid])

  const agentNameHeader = agentDataResponse?.[0]?.name || ''
  const agentNameLegacy = agentDataResponse?.[0]?.name || ''
  const isProd = agentDataResponse?.[0]?.environment === 'prod'
  const [prodAuthorized, setProdAuthorized] = useState(false)
  const isProdLocked = isProd && !prodAuthorized

  const [resolvedAgentName, setResolvedAgentName] = useState<string>('')

  // Use React Query for agent config
  const { 
    data: agentConfigData, 
    isLoading: isConfigLoading, 
    isError: isConfigError,
    isFetching: isConfigFetching,
    refetch: refetchConfig 
  } = useAgentConfig(agentNameWithId, agentNameLegacy)

  useEffect(() => {
    fetch('/api/agents/prod-authorized')
      .then(r => r.ok ? r.json() : { authorized: false })
      .then(d => setProdAuthorized(d.authorized === true))
      .catch(() => setProdAuthorized(false))
  }, [])

  useEffect(() => {
    if (agentConfigData && !isConfigLoading) {
      const usedName = agentConfigData._usedAgentName || agentNameWithId
      setResolvedAgentName(usedName)
    }
  }, [agentConfigData, isConfigLoading, agentNameWithId])

  const activeAgentName = useMemo(() => {
    if (agentLoading || !agentDataResponse?.[0]?.name) {
      return ''
    }
    
    return resolvedAgentName || agentNameWithId
  }, [resolvedAgentName, agentNameWithId, agentLoading, agentDataResponse])
  
  // Use mutations for save operations
  const { saveAndDeploy } = useAgentMutations(activeAgentName)

  const checkAgentStatus = useCallback(async () => {
    if (!activeAgentName) return
    
    const status = await agentStatusService.checkAgentStatus(activeAgentName)
    setAgentStatus(status)
  }, [activeAgentName])

  // Check agent status on load
  useEffect(() => {
    if (!activeAgentName || agentLoading || activeAgentName.startsWith('undefined_')) {
      return
    }
    
    checkAgentStatus()
  }, [activeAgentName, agentLoading, checkAgentStatus])

  const startAgent = async () => {
    if (!activeAgentName) return
    
    setIsAgentLoading(true)
    setAgentStatus({ status: 'starting' } as AgentStatus)
    
    try {
      // Step 1: Initiate agent start
      const startStatus = await agentStatusService.startAgent(activeAgentName)
      
      if (startStatus.status === 'error') {
        setAgentStatus(startStatus)
        setIsAgentLoading(false)
        return
      }
      
      // Step 2: Poll agent status until it's running or timeout
      const maxAttempts = 30 // Poll for up to 30 seconds (30 attempts * 1 second)
      let attempts = 0
      let isRunning = false
      
      while (attempts < maxAttempts && !isRunning) {
        await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second between checks
        
        const status = await agentStatusService.checkAgentStatus(activeAgentName)
        setAgentStatus(status)
        
        if (status.status === 'running') {
          isRunning = true
          break
        } else if (status.status === 'error') {
          // Agent failed to start
          break
        }
        
        attempts++
      }
      
      // Final status check
      if (!isRunning) {
        const finalStatus = await agentStatusService.checkAgentStatus(activeAgentName)
        setAgentStatus(finalStatus)
      }
    } catch (error) {
      console.error('Error starting agent:', error)
      setAgentStatus({ status: 'error' as const, error: 'Failed to start agent' })
    } finally {
      setIsAgentLoading(false)
    }
  }
  
  const stopAgent = async () => {
    if (!activeAgentName) return
    
    setIsAgentLoading(true)
    setAgentStatus({ status: 'stopping' } as AgentStatus)
    
    try {
      const status = await agentStatusService.stopAgent(activeAgentName)
      
      if (status.status !== 'error') {
        setAgentStatus({ status: 'stopped' })
      } else {
        setAgentStatus(status)
      }
    } finally {
      setIsAgentLoading(false)
    }
  }

  const copyToClipboard = async () => {
    const text = formik.values.prompt
    if (!text) return
    let success = false
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text)
        success = true
      } catch {
        // fall through to execCommand fallback
      }
    }
    if (!success) {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.top = '0'
        ta.style.left = '0'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        success = true
      } catch (err) {
        console.error('Failed to copy text: ', err)
      }
    }
    if (success) {
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }
  }

  // Formik form state management
  const formik = useFormik({
    initialValues: useMemo(() => {
      if (agentConfigData?.agent?.assistant?.[0]) {
        return buildFormValuesFromAgent(agentConfigData.agent.assistant[0])
      }
      return getDefaultFormValues()
    }, [agentConfigData]),
    enableReinitialize: true,
    onSubmit: (values) => {
      console.log('Form submitted:', values)
    }
  })

  // Webhook/dropoff/callback settings sections are collapsible and only fetch their own
  // saved config the first time they're expanded — which can happen *after* a paste has
  // already set these fields. Without a guard, that late fetch overwrites pasted values
  // with the target agent's own stale saved settings. First load per field wins; a paste
  // also counts as establishing the field so a later section-expand can't clobber it.
  const supplementalEstablishedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    supplementalEstablishedRef.current.clear()
  }, [agentid])

  const loadSupplementalSetting = (field: 'webhook' | 'dropoff' | 'callbackScheduling', data: any) => {
    if (supplementalEstablishedRef.current.has(field)) return
    supplementalEstablishedRef.current.add(field)
    formik.resetForm({
      values: {
        ...formik.values,
        advancedSettings: { ...formik.values.advancedSettings, [field]: data }
      }
    })
  }

  const {
    buildSavePayload,
    hasUnsavedChanges: hasMultiAssistantChanges,
    resetUnsavedChanges,
  } = useMultiAssistantState({
    initialAssistants: agentConfigData?.agent?.assistant || [],
    agentId: agentid as string,
    agentName: activeAgentName || '',
    agentType: agentDataResponse?.[0]?.agent_type,
    currentFormik: formik,
    currentTtsConfig: ttsConfig,
    currentSttConfig: sttConfig,
    currentAzureConfig: azureConfig,
    fallbackAzureConfig: fallbackAzureConfig
  })

  // useEffect(() => {
  //   const validVariables = Array.from(promptValidation.validVariables)
  //   const variablesArray = validVariables.map(name => ({ name, value: '', description: '' }))
    
  //   // Only update if different to avoid infinite loops
  //   if (JSON.stringify(formik.values.variables) !== JSON.stringify(variablesArray)) {
  //     formik.setFieldValue('variables', variablesArray)
  //   }
  // }, [promptValidation.validVariables])

  // Handle the agent config data when it loads
  useEffect(() => {
    if (agentConfigData?.agent?.assistant?.[0]) {
      const assistant = agentConfigData.agent.assistant[0]
      
      const formValues = buildFormValuesFromAgent(assistant)
      
      setTtsConfig({
        provider: formValues.ttsProvider,
        model: formValues.ttsModel,
        config: formValues.ttsVoiceConfig
      })
      
      setSTTConfig({
        provider: assistant.stt?.name || assistant.stt?.provider || 'openai',
        model: assistant.stt?.model || 'whisper-1',
        config: formValues.sttConfig || { language: assistant.stt?.language || 'en' }
      })
      
      const llmConfig = assistant.llm || {}
      const providerValue = llmConfig.provider || llmConfig.name || 'openai'
      let mappedProvider = providerValue
      if (providerValue === 'groq') {
        mappedProvider = 'groq'
      } else if (providerValue === 'azure') {
        mappedProvider = 'azure_openai' 
      } else if (llmConfig.model?.includes('claude')) {
        mappedProvider = 'anthropic'
      } else if (llmConfig.model?.includes('cerebras')) {
        mappedProvider = 'cerebras'
      }
      
      if (mappedProvider === 'azure_openai' && assistant.llm) {
        setAzureConfig({
          endpoint: assistant.llm.azure_endpoint || '',
          apiVersion: assistant.llm.api_version || ''
        })
      }

      if (assistant.llm?.fallback) {
        const fbProvider = assistant.llm.fallback.provider || assistant.llm.fallback.name || ''
        if (fbProvider === 'azure') {
          setFallbackAzureConfig({
            endpoint: assistant.llm.fallback.azure_endpoint || '',
            apiVersion: assistant.llm.fallback.api_version || ''
          })
        }
      }

    }
  }, [agentConfigData])

  useEffect(() => {
    if (saveAndDeploy.isSuccess) {
      setHasExternalChanges(false)
      resetUnsavedChanges()
      setIsFallbackView(false)
      // Rebase the dirty-check baseline to the just-saved values (resetForm's `values`
      // option updates initialValues too, unlike setValues which only touches values).
      formik.resetForm({ values: formik.values })
    }
  }, [saveAndDeploy.isSuccess, resetUnsavedChanges])

  const handleApplyPastedConfig = (config: DeserializedConfig) => {
    console.log('📋 Applying pasted configuration:', config)

    // Apply formik values
    formik.setValues(config.formikValues, false) // false = don't validate immediately

    // If the pasted config specifies webhook/dropoff/callback settings, lock them in as
    // established so a section expanded later (which fetches its own saved settings on
    // first mount) doesn't overwrite the pasted values with the target agent's old ones.
    const pastedAdvanced = config.formikValues.advancedSettings
    for (const field of ['webhook', 'dropoff', 'callbackScheduling'] as const) {
      if (pastedAdvanced?.[field] !== undefined) supplementalEstablishedRef.current.add(field)
    }

    // Apply external state
    setTtsConfig(config.ttsConfig)
    setSTTConfig(config.sttConfig)
    setAzureConfig(config.azureConfig)
    if (config.fallbackAzureConfig) {
      setFallbackAzureConfig(config.fallbackAzureConfig)
    }

    // Mark form as dirty to enable save
    setHasExternalChanges(true)

    console.log('✅ Configuration applied successfully')
  }


  // Opens commit modal, capturing the current config first.
  // Deploy only happens after the commit message is entered — no skip path.
  const handleOpenCommitModal = () => {
    if (!promptValidation.isValid) {
      console.error('❌ Cannot save: Variable validation errors exist')
      return
    }

    const payload = buildSavePayload()

    const validVariables = Array.from(promptValidation.validVariables)
    const validVariablesArray = validVariables.map((name: string) => {
      const existing = formik.values.variables?.find((v: any) => v.name === name)
      return {
        name,
        value: existing?.value || '',
        description: existing?.description || '',
      }
    })

    if (payload.agent?.assistant?.[0]) {
      payload.agent.assistant[0].variables = validVariablesArray.reduce((acc: any, v: any) => {
        acc[v.name] = v.value
        return acc
      }, {})
    }

    const userEmail = user?.primaryEmailAddress?.emailAddress ?? null
    const userId = user?.id ?? null
    setPendingCheckpoint({ config: payload, userEmail, userId })
    setCommitMessage('')
    setVersionSaveError(null)
    setPublishedSnapshot(null)
    setIsCommitModalOpen(true)

    setIsDiffLoading(true)
    fetch(`/api/agents/${agentid}/history?page=1&limit=1`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        const latest = data?.history?.[0]
        if (!latest?.id) return null
        return fetch(`/api/agents/${agentid}/history/${latest.id}`).then(r => (r.ok ? r.json() : null))
      })
      .then(detail => setPublishedSnapshot(detail?.entry?.config_snapshot ?? null))
      .catch(() => setPublishedSnapshot(null))
      .finally(() => setIsDiffLoading(false))
  }

  const handleSaveVersion = async () => {
    if (!pendingCheckpoint || !commitMessage.trim()) return
    setIsSavingVersion(true)
    setVersionSaveError(null)
    try {
      // Step 1: Deploy config to backend
      await saveAndDeploy.mutateAsync(pendingCheckpoint.config)
      // Step 1b: Save supplemental settings (webhook, drop-off, callback) — non-blocking
      try {
        const advSettings = formik.values.advancedSettings as any
        await saveSupplementalSettings(agentid as string, projectId, {
          webhook: advSettings?.webhook
            ? {
                webhookUrl: advSettings.webhook.webhookUrl,
                httpMethod: advSettings.webhook.httpMethod,
                headers: advSettings.webhook.headers,
                isActive: advSettings.webhook.isActive,
              }
            : undefined,
          dropoff: advSettings?.dropoff,
          callbackScheduling: advSettings?.callbackScheduling,
        })
      } catch (suppErr: any) {
        console.warn('Supplemental settings save failed (config deployed):', suppErr)
        toast.error(`Config deployed. ${suppErr?.message ?? 'Some settings failed to save.'}`)
      }
      // Step 2: Save version checkpoint
      const res = await fetch(`/api/agents/${agentid}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pendingCheckpoint, commit_message: commitMessage.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        setVersionSaveError(err.message ?? 'Failed to save version')
        return
      }
      const data = await res.json()
      setIsCommitModalOpen(false)
      setCommitMessage('')
      setPendingCheckpoint(null)
      setShowMergePrompt(true)
    } catch (err: any) {
      setVersionSaveError(err.message ?? 'Save failed')
    } finally {
      setIsSavingVersion(false)
    }
  }

  const renderDiffContent = () => {
    if (isDiffLoading) {
      return (
        <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading diff...
        </div>
      )
    }
    if (!pendingCheckpoint) return null

    const publishedFull = publishedSnapshot ? sanitizeForDiff(publishedSnapshot) : {}
    const currentFull = sanitizeForDiff(pendingCheckpoint.config)
    const publishedAdvanced = formik.initialValues.advancedSettings as any
    const currentAdvanced = formik.values.advancedSettings as any
    const publishedSettings = {
      ...omitPrompt(publishedFull),
      webhook: publishedAdvanced?.webhook ?? null,
      dropoff: publishedAdvanced?.dropoff ?? null,
      callbackScheduling: publishedAdvanced?.callbackScheduling ?? null,
    }
    const currentSettings = {
      ...omitPrompt(currentFull),
      webhook: currentAdvanced?.webhook ?? null,
      dropoff: currentAdvanced?.dropoff ?? null,
      callbackScheduling: currentAdvanced?.callbackScheduling ?? null,
    }

    return (
      <div className="space-y-3">
        <div className="flex gap-2 sticky top-0 z-10 bg-background pb-1">
          <Button
            type="button" variant="outline" size="sm" className="h-7 text-xs"
            onClick={() => promptDiffRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            Prompt
          </Button>
          <Button
            type="button" variant="outline" size="sm" className="h-7 text-xs"
            onClick={() => settingsDiffRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            Settings
          </Button>
        </div>

        <div ref={promptDiffRef}>
          <p className="text-[11px] font-medium text-muted-foreground mb-1">Prompt</p>
          <SideBySideDiff
            oldText={extractPrompt(publishedFull)}
            newText={extractPrompt(currentFull)}
          />
        </div>

        <div ref={settingsDiffRef}>
          <p className="text-[11px] font-medium text-muted-foreground mb-1">Settings</p>
          <SideBySideDiff
            oldText={serializeForDiff(publishedSettings)}
            newText={serializeForDiff(currentSettings)}
          />
        </div>
      </div>
    )
  }

  const handleCancel = () => {
    formik.resetForm()
    setHasExternalChanges(false)
    resetUnsavedChanges()
  }

  const handleVoiceSelect = (voiceId: string, provider: string, model?: string, config?: any) => {
    formik.setFieldValue('selectedVoice', voiceId)
    formik.setFieldValue('ttsProvider', provider)
    formik.setFieldValue('ttsModel', model || '')
    formik.setFieldValue('ttsVoiceConfig', config || {})
    
    setTtsConfig({
      provider: provider,
      model: model || '',
      config: config || {}
    })    
  }

  const handleSTTSelect = (provider: string, model: string, config: any) => {
    formik.setFieldValue('sttProvider', provider)
    formik.setFieldValue('sttModel', model)
    formik.setFieldValue('sttConfig', config)

    setSTTConfig({ provider, model, config })
    setHasExternalChanges(true)
  }

  const handleFallbackSTTSelect = (provider: string, model: string, config: any) => {
    formik.setFieldValue('fallbackSttProvider', provider)
    formik.setFieldValue('fallbackSttModel', model)
    formik.setFieldValue('fallbackSttConfig', config)
  }

  const handleFallbackVoiceSelect = (voiceId: string, provider: string, model?: string, config?: any) => {
    formik.setFieldValue('fallbackTtsVoiceId', voiceId)
    formik.setFieldValue('fallbackTtsProvider', provider)
    formik.setFieldValue('fallbackTtsModel', model || '')
    formik.setFieldValue('fallbackTtsVoiceConfig', config || {})
  }

  const handleProviderChange = (provider: string) => {
    formik.setFieldValue('selectedProvider', provider)
  }

  const handleModelChange = (model: string) => {
    formik.setFieldValue('selectedModel', model)
  }

  const handleTemperatureChange = (temperature: number) => {
    formik.setFieldValue('temperature', temperature)
  }

  const handleAzureConfigChange = (config: AzureConfig) => {
    setAzureConfig(config)
    setHasExternalChanges(true)
  }

  const handleFallbackProviderChange = (provider: string) => {
    formik.setFieldValue('fallbackLlmProvider', provider)
  }

  const handleFallbackModelChange = (model: string) => {
    formik.setFieldValue('fallbackLlmModel', model)
  }

  const handleFallbackTemperatureChange = (temperature: number) => {
    formik.setFieldValue('fallbackLlmTemperature', temperature)
  }

  const handleFallbackAzureConfigChange = (config: AzureConfig) => {
    setFallbackAzureConfig(config)
    setHasExternalChanges(true)
  }

  const getAgentStatusColor = () => {
    switch (agentStatus.status) {
      case 'running': return 'bg-green-500'
      case 'starting': return 'bg-yellow-500'
      case 'stopping': return 'bg-orange-500'
      case 'stopped': return 'bg-gray-500'
      case 'error': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getAgentStatusText = () => {
    switch (agentStatus.status) {
      case 'running': return 'Agent Running'
      case 'starting': return 'Starting...'
      case 'stopping': return 'Stopping...'
      case 'stopped': return 'Agent Stopped'
      case 'error': return 'Agent Error'
      default: return 'Unknown'
    }
  }

  const getMobileAgentStatusText = () => {
    switch (agentStatus.status) {
      case 'running': return 'Running'
      case 'starting': return 'Starting...'
      case 'stopping': return 'Stopping...'
      case 'stopped': return 'Stopped'
      case 'error': return 'Error'
      default: return 'Unknown'
    }
  }

// Predefined system variables (same as PromptSettingsSheet). These are always "mapped" by the
// system, so we must never count them as unmapped—otherwise the Settings indicator stays red.
const PREDEFINED_VARIABLE_NAMES = new Set(['wcalling_number', 'wcurrent_time', 'wcurrent_date', 'wcontext_dropoff'])

/**
 * Count of prompt variables that are not yet in the variables list (used for Settings red badge).
 * Previous bug: (1) Comparison was case-sensitive. validVariables keeps prompt case (e.g. "A"),
 * while variable names in the sheet are stored lowercased—so "A" was never considered mapped.
 * (2) Predefined vars like wcurrent_time are not in formik.values.variables, so they were
 * counted as unmapped and the indicator stayed red. Fix: normalize both sides to lowercase and
 * exclude predefined names. useMemo ensures we only recompute when deps change (React best practice).
 */
const unmappedVariablesCount = useMemo(() => {
  const validVars = Array.from(promptValidation?.validVariables ?? [])
  const variablesList = Array.isArray(formik.values.variables) ? formik.values.variables : []
  const mappedVars = new Set(
    variablesList.map((v: any) => String(v?.name ?? '').toLowerCase().trim())
  )
  const unmapped = validVars.filter(name => {
    const normalized = String(name ?? '').toLowerCase().trim()
    if (!normalized || PREDEFINED_VARIABLE_NAMES.has(normalized)) return false
    return !mappedVars.has(normalized)
  })
  return unmapped.length
}, [promptValidation.validVariables, formik.values.variables])

  // View-only toggle: controls which selectors are displayed.
  // NEVER clears the fallbackXxxEnabled Formik flags — that was the root bug:
  // clicking "Primary" would set all flags false and the next Save would silently
  // erase all configured fallbacks from the backend config.
  const [isFallbackView, setIsFallbackView] = useState(false)

  // showFallback = which panel is currently displayed (alias for readability below)
  const showFallback = isFallbackView

  const enterPrimaryMode = () => setIsFallbackView(false)

  const enterFallbackMode = () => {
    setIsFallbackView(true)
  }

  const isFormDirty = formik.dirty || hasExternalChanges || hasMultiAssistantChanges 
  const isBackendUnavailable = !!agentConfigData?.backendUnavailable

  // Loading state
  if (agentLoading || isConfigLoading) {
    return (
      <div className="h-screen bg-gray-50 dark:bg-gray-950 p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  if (isConfigError) {
    return (
      <div className="h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center shadow-lg">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
  
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Agent Not Found in Command Center
            </h3>
  
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
              This agent exists in your organisation but couldn't be found in the current command center environment. 
              It might be deployed to a different environment or needs to be created.
            </p>
  
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 mb-6 text-left">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">Current Environment:</span>
                <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-700 dark:text-gray-300">
                  {process.env.NODE_ENV === 'development' ? 'Development' : 'Production'}
                </code>
              </div>
            </div>
  
            <div className="space-y-3">
              <Button 
                onClick={() => refetchConfig()} 
                variant="outline"
                className="w-full"
              >
                Try Again
              </Button>
              <Button 
                onClick={() => window.history.back()} 
                variant="ghost"
                size="sm"
                className="w-full text-gray-600 dark:text-gray-400"
              >
                Go Back
              </Button>
            </div>
  
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
              Need help? Check if the agent was deployed to the correct environment.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {isProdLocked && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 shrink-0">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            <span className="font-semibold">Production agent — read only.</span>{' '}
            Edit the dev agent and use Merge to Prod to update this prompt.
          </p>
        </div>
      )}
      {agentConfigData?.backendUnavailable && (
        <Alert className="rounded-none border-x-0 border-t-0 shrink-0 border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <AlertCircle className="text-amber-600 dark:text-amber-400" />
          <AlertTitle>Voice backend unreachable</AlertTitle>
          <AlertDescription>
            {agentConfigData.backendUnavailableMessage ??
              'Set PYPEAI_API_URL to a URL your machine can reach (e.g. http://127.0.0.1:8000 if the API runs locally), or fix NEXT_PUBLIC_PYPEAI_API_URL, restart next dev, and refresh.'}
          </AlertDescription>
        </Alert>
      )}
      {/* Mobile Header */}
      <div className="lg:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push(`/${projectId}/agents/${agentid}`)}
              className="w-8 h-8 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getAgentStatusColor()}`}></div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {agentNameHeader || 'Loading...'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {getMobileAgentStatusText()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {agentStatus.status === 'stopped' || agentStatus.status === 'error' ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={startAgent}
                disabled={isAgentLoading || !activeAgentName}
              >
                {isAgentLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </Button>
            ) : agentStatus.status === 'running' ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={stopAgent}
                disabled={isAgentLoading}
              >
                {isAgentLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled
              >
                <Loader2 className="w-4 h-4 animate-spin" />
              </Button>
            )}

            {isFormDirty && (
              <Button
                size="sm"
                className="h-8 px-3"
                onClick={handleOpenCommitModal}
                disabled={isSavingVersion || isConfigFetching || !promptValidation.isValid || isBackendUnavailable || isProdLocked}
                title={isProdLocked ? 'Production agent — read only' : isBackendUnavailable ? 'Voice backend unreachable — cannot save' : undefined}
              >
                <Save className="w-4 h-4" />
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 gap-1.5"
              onClick={() => setIsHistoryOpen(true)}
            >
              <History className="w-3.5 h-3.5" />
              <span className="text-xs">History</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuItem 
                    onSelect={() => setIsTalkToAssistantOpen(true)}
                    disabled={!activeAgentName || !promptValidation.isValid}
                  >
                    <PhoneIcon className="w-4 h-4 mr-2" />
                    Talk to Assistant
                  </DropdownMenuItem>

                  <DropdownMenuItem onSelect={() => setIsAdvancedSettingsOpen(true)}>
                    <SlidersHorizontal className="w-4 h-4 mr-2" />
                    Advanced Settings
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onSelect={() => setIsCopyConfigDialogOpen(true)}>
                    <CopyIcon className="w-4 h-4 mr-2" />
                    Copy Configuration
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onSelect={() => setIsPasteConfigDialogOpen(true)}
                    disabled={isFormDirty}
                  >
                    <svg 
                      className="w-4 h-4 mr-2" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" 
                      />
                    </svg>
                    Paste Configuration
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                {isFormDirty && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem onSelect={handleCancel}>
                        <X className="w-4 h-4 mr-2" />
                        Cancel Changes
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden lg:block bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/${projectId}/agents/${agentid}`)}
              className="w-9 h-9 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all duration-200"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className={`w-2 h-2 rounded-full ${getAgentStatusColor()}`}></div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {agentNameHeader || 'Loading...'}
              </span>
              <span className="text-xs text-gray-500">
                {getAgentStatusText()}
                {agentStatus.pid && ` (PID: ${agentStatus.pid})`}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {agentStatus.status === 'stopped' || agentStatus.status === 'error' ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={startAgent}
                disabled={isAgentLoading || !activeAgentName}
              >
                {isAgentLoading ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Play className="w-3 h-3 mr-1" />
                )}
                Start Agent
              </Button>
            ) : agentStatus.status === 'running' ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={stopAgent}
                disabled={isAgentLoading}
              >
                {isAgentLoading ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Square className="w-3 h-3 mr-1" />
                )}
                Stop Agent
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled
              >
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                {agentStatus.status === 'starting' ? 'Starting...' : 'Stopping...'}
              </Button>
            )}

            <Sheet
              open={isTalkToAssistantOpen}
              onOpenChange={(open) => {
                if (!open && isTalkToAssistantSessionActiveRef.current) {
                  setFlashEndCall(true)
                  return
                }
                setIsTalkToAssistantOpen(open)
              }}
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Talk to Assistant</SheetTitle>
              </SheetHeader>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={!activeAgentName || !promptValidation.isValid}
                >
                  <PhoneIcon className="w-3 h-3 mr-1" />
                  Talk to Assistant
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-full sm:w-96 p-0"
                onInteractOutside={(e) => {
                  if (isTalkToAssistantSessionActiveRef.current) {
                    e.preventDefault()
                    setFlashEndCall(true)
                    // Refocus the input after blocking the outside click
                    setTimeout(() => {
                      const input = document.querySelector('[data-talk-input]') as HTMLInputElement
                      input?.focus()
                    }, 0)
                  }
                }}
                onEscapeKeyDown={(e) => {
                  if (isTalkToAssistantSessionActiveRef.current) {
                    e.preventDefault()
                    setFlashEndCall(true)
                  }
                }}
              >
                <TalkToAssistant
                  agentName={activeAgentName || ''}
                  isOpen={isTalkToAssistantOpen}
                  onClose={() => setIsTalkToAssistantOpen(false)}
                  agentStatus={agentStatus}
                  onAgentStatusChange={checkAgentStatus}
                  flashEndCall={flashEndCall}
                  onFlashEndCallDone={() => setFlashEndCall(false)}
                  onSessionActiveChange={(active) => { isTalkToAssistantSessionActiveRef.current = active }}
                />
              </SheetContent>
            </Sheet>

            {isFormDirty && (
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleCancel}>
                Discard Changes
              </Button>
            )}
            
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={handleOpenCommitModal}
              disabled={isSavingVersion || isConfigFetching || !isFormDirty || !promptValidation.isValid || isBackendUnavailable || isProdLocked}
              title={isProdLocked ? 'Production agent — read only' : isBackendUnavailable ? 'Voice backend unreachable — cannot save' : undefined}
            >
              Update Config
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuItem onSelect={() => setIsCopyConfigDialogOpen(true)}>
                    <CopyIcon className="w-4 h-4 mr-2" />
                    Copy Configuration
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onSelect={() => setIsPasteConfigDialogOpen(true)}
                    disabled={isFormDirty}
                  >
                    <svg 
                      className="w-4 h-4 mr-2" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" 
                      />
                    </svg>
                    Paste Configuration
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 max-w-7xl mx-auto w-full p-4">
        <div className="h-full flex gap-4">
          
          {/* Left Side */}
          <div className="flex-1 min-w-0 flex flex-col space-y-3">
            
            {/* Quick Setup Row */}
            <div className="flex-shrink-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
              {/* Pipeline mode toggle */}
              <div className="flex items-center justify-between">

                <div className="flex items-center bg-gray-100 dark:bg-gray-900 rounded-lg p-0.5 gap-0.5">
                  <button
                    type="button"
                    onClick={enterPrimaryMode}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-150 ${
                      !showFallback
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    Primary
                  </button>
                  <button
                    type="button"
                    onClick={enterFallbackMode}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-150 ${
                      showFallback
                        ? 'bg-yellow-100 text-black shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    Fallback
                  </button>
                </div>

                {/* Global fallback on/off — only visible in fallback panel */}
                {showFallback && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Enable Fallback</span>
                    <Switch
                      checked={!!formik.values.fallbackGlobalEnabled}
                      onCheckedChange={(checked) => formik.setFieldValue('fallbackGlobalEnabled', checked)}
                    />
                  </div>
                )}
              </div>

              {/* Selectors */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 min-w-0">
                  {!showFallback ? (
                    <ModelSelector
                      selectedProvider={formik.values.selectedProvider}
                      selectedModel={formik.values.selectedModel}
                      temperature={formik.values.temperature}
                      onProviderChange={handleProviderChange}
                      onModelChange={handleModelChange}
                      onTemperatureChange={handleTemperatureChange}
                      azureConfig={azureConfig}
                      onAzureConfigChange={handleAzureConfigChange}
                    />
                  ) : (
                    <ModelSelector
                      selectedProvider={formik.values.fallbackLlmProvider}
                      selectedModel={formik.values.fallbackLlmModel}
                      temperature={formik.values.fallbackLlmTemperature}
                      onProviderChange={handleFallbackProviderChange}
                      onModelChange={handleFallbackModelChange}
                      onTemperatureChange={handleFallbackTemperatureChange}
                      azureConfig={fallbackAzureConfig}
                      onAzureConfigChange={handleFallbackAzureConfigChange}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {!showFallback ? (
                    <SelectSTT
                      selectedProvider={formik.values.sttProvider}
                      selectedModel={formik.values.sttModel}
                      selectedLanguage={formik.values.sttConfig?.language}
                      initialConfig={formik.values.sttConfig}
                      onSTTSelect={handleSTTSelect}
                    />
                  ) : (
                    <SelectSTT
                      selectedProvider={formik.values.fallbackSttProvider}
                      selectedModel={formik.values.fallbackSttModel}
                      selectedLanguage={formik.values.fallbackSttConfig?.language}
                      initialConfig={formik.values.fallbackSttConfig}
                      onSTTSelect={handleFallbackSTTSelect}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {!showFallback ? (
                    <SelectTTS
                      selectedVoice={formik.values.selectedVoice}
                      initialProvider={formik.values.ttsProvider}
                      initialModel={formik.values.ttsModel}
                      initialConfig={formik.values.ttsVoiceConfig}
                      onVoiceSelect={handleVoiceSelect}
                    />
                  ) : (
                    <SelectTTS
                      selectedVoice={formik.values.fallbackTtsVoiceId}
                      initialProvider={formik.values.fallbackTtsProvider}
                      initialModel={formik.values.fallbackTtsModel}
                      initialConfig={formik.values.fallbackTtsVoiceConfig}
                      onVoiceSelect={handleFallbackVoiceSelect}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Conversation Flow */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3 flex-shrink-0">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Conversation Start
                </label>
                <Select 
                  value={formik.values.firstMessageMode?.mode || formik.values.firstMessageMode} 
                  onValueChange={(value) => {
                    if (typeof formik.values.firstMessageMode === 'object') {
                      formik.setFieldValue('firstMessageMode', {
                        ...formik.values.firstMessageMode,
                        mode: value
                      })
                    } else {
                      formik.setFieldValue('firstMessageMode', {
                        mode: value,
                        allow_interruptions: true,
                        first_message: formik.values.customFirstMessage || ''
                      })
                    }
                  }}
                >
                  <SelectTrigger className="h-8 text-sm w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {firstMessageModes.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value} className="text-sm">
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {((typeof formik.values.firstMessageMode === 'object' && formik.values.firstMessageMode.mode === 'assistant_speaks_first') ||
                (typeof formik.values.firstMessageMode === 'string' && formik.values.firstMessageMode === 'assistant_speaks_first')) && (
                <Textarea
                  placeholder="Enter the first message..."
                  value={
                    typeof formik.values.firstMessageMode === 'object' 
                      ? formik.values.firstMessageMode.first_message 
                      : formik.values.customFirstMessage
                  }
                  onChange={(e) => {
                    if (typeof formik.values.firstMessageMode === 'object') {
                      formik.setFieldValue('firstMessageMode', {
                        ...formik.values.firstMessageMode,
                        first_message: e.target.value
                      })
                    } else {
                      formik.setFieldValue('customFirstMessage', e.target.value)
                      formik.setFieldValue('firstMessageMode', {
                        mode: formik.values.firstMessageMode || 'assistant_speaks_first',
                        allow_interruptions: true,
                        first_message: e.target.value
                      })
                    }
                  }}
                  className="text-xs resize-none border-gray-200 dark:border-gray-700 overflow-y-auto"
                  style={{ fieldSizing: 'fixed' as any, height: '60px' }}
                />
              )}
            </div>

            {/* System Prompt */}
            <div className="flex-1 min-h-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">System Prompt</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                        <TypeIcon className="w-3 h-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-3" align="start">
                      <div className="space-y-2">
                        <Label className="text-xs">Font Size</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs">{settings.fontSize}px</span>
                          <Slider
                            value={[settings.fontSize]}
                            onValueChange={(value) => setFontSize(value[0])}
                            min={8}
                            max={18}
                            step={1}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex gap-2">
                 <TooltipProvider>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setIsPromptSettingsOpen(true)}
                          className={`flex items-center gap-1 text-xs transition-colors ${
                            unmappedVariablesCount > 0
                              ? 'text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300' 
                              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                          }`}
                        >
                          <SettingsIcon className="w-4 h-4" />
                          <span>Settings</span>
                          {unmappedVariablesCount > 0 && (
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">
                          {unmappedVariablesCount > 0
                            ? `${unmappedVariablesCount} unmapped variable${unmappedVariablesCount > 1 ? 's' : ''} - click to configure`
                            : 'Prompt settings'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>


                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer transition-colors"
                    disabled={!formik.values.prompt}
                  >
                    {isCopied ? (
                      <>
                        <CheckIcon className="w-4 h-4 text-green-500" />
                        <span className="text-green-500">Copied!</span>
                      </>
                    ) : (
                      <>
                        <CopyIcon className="w-4 h-4" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {/* Variable Textarea - NO overlay, just validation */}
              <VariableTextarea
                value={formik.values.prompt}
                onChange={(value) => { if (!isProdLocked) formik.setFieldValue('prompt', value) }}
                onValidationChange={setPromptValidation}
                placeholder="Define your agent's behavior and personality... Use {{variable_name}} for dynamic values."
                className={`flex-1 min-h-0 font-mono resize-none leading-relaxed border-gray-200 dark:border-gray-700 ${isProdLocked ? 'opacity-70 cursor-not-allowed' : ''}`}
                style={getTextareaStyles()}
                disabled={isProdLocked}
              />
              
              {/* Compact Validation Indicator */}
              <div className="mt-2 flex justify-between items-center flex-shrink-0">
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {formik.values.prompt.length.toLocaleString()} chars
                </span>
                
                <VariableValidationIndicator
                  errors={promptValidation.errors}
                  validVariables={Array.from(promptValidation.validVariables)}
                />
              </div>
            </div>
          </div>

          {/* Right Side - Desktop Only */}
          <div className=" lg:block w-80 flex-shrink-0 min-h-0 flex flex-col gap-3">
            <AgentAdvancedSettings
              advancedSettings={formik.values.advancedSettings}
              onFieldChange={formik.setFieldValue}
              onWebhookDataLoaded={(data) => loadSupplementalSetting('webhook', data)}
              onDropoffDataLoaded={(data) => loadSupplementalSetting('dropoff', data)}
              onCallbackDataLoaded={(data) => loadSupplementalSetting('callbackScheduling', data)}
              projectId={projectId}
              agentId={agentid}
              dynamicTTSList={formik.values.dynamic_tts || []}
              onDynamicTTSChange={(dynamicTTSList) => {
                formik.setFieldValue('dynamic_tts', dynamicTTSList)
              }}
            />
          </div>

        </div>
      </div>

      {/* Mobile Sheets */}
      <Sheet
        open={isTalkToAssistantOpen}
        onOpenChange={(open) => {
          if (!open && isTalkToAssistantSessionActiveRef.current) {
            setFlashEndCall(true)
            return
          }
          setIsTalkToAssistantOpen(open)
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:w-96 p-0"
          onInteractOutside={(e) => {
            if (isTalkToAssistantSessionActiveRef.current) {
              e.preventDefault()
              setFlashEndCall(true)
              // Refocus the input after blocking the outside click
              setTimeout(() => {
                const input = document.querySelector('[data-talk-input]') as HTMLInputElement
                input?.focus()
              }, 0)
            }
          }}
          onEscapeKeyDown={(e) => {
            if (isTalkToAssistantSessionActiveRef.current) {
              e.preventDefault()
              setFlashEndCall(true)
            }
          }}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Talk to Assistant</SheetTitle>
          </SheetHeader>
          <TalkToAssistant
            agentName={activeAgentName || ''}
            isOpen={isTalkToAssistantOpen}
            onClose={() => setIsTalkToAssistantOpen(false)}
            agentStatus={agentStatus}
            onAgentStatusChange={checkAgentStatus}
            flashEndCall={flashEndCall}
            onFlashEndCallDone={() => setFlashEndCall(false)}
            onSessionActiveChange={(active) => { isTalkToAssistantSessionActiveRef.current = active }}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={isAdvancedSettingsOpen} onOpenChange={setIsAdvancedSettingsOpen}>
        <SheetContent side="right" className="w-full sm:w-96 p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="text-sm">Advanced Settings</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            <AgentAdvancedSettings
              advancedSettings={formik.values.advancedSettings}
              onFieldChange={formik.setFieldValue}
              onWebhookDataLoaded={(data) => loadSupplementalSetting('webhook', data)}
              onDropoffDataLoaded={(data) => loadSupplementalSetting('dropoff', data)}
              onCallbackDataLoaded={(data) => loadSupplementalSetting('callbackScheduling', data)}
              projectId={projectId}
              agentId={agentid}
              dynamicTTSList={formik.values.dynamic_tts || []}
              onDynamicTTSChange={(dynamicTTSList) => {
                formik.setFieldValue('dynamic_tts', dynamicTTSList)
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <PromptSettingsSheet
        open={isPromptSettingsOpen}
        onOpenChange={setIsPromptSettingsOpen}
        prompt={formik.values.prompt}
        onPromptChange={(newPrompt) => formik.setFieldValue('prompt', newPrompt)}
        variables={formik.values.variables}
        onVariablesChange={(newVariables) => formik.setFieldValue('variables', newVariables)}
      />

      {/* Dynamic TTS Dialog */}
      <Sheet open={isDynamicTTSDialogOpen} onOpenChange={setIsDynamicTTSDialogOpen}>
        <SheetContent side="right" className="w-full sm:w-[500px] p-0 overflow-y-auto">
          <SheetHeader className="px-4 py-3 border-b sticky top-0 bg-white dark:bg-gray-800 z-10">
            <SheetTitle className="text-sm">Dynamic TTS Switch</SheetTitle>
          </SheetHeader>
          <div className="p-4">
            <DynamicTTSSwitch
              dynamicTTSList={formik.values.dynamic_tts || []}
              onDynamicTTSChange={(dynamicTTSList) => {
                formik.setFieldValue('dynamic_tts', dynamicTTSList)
              }}
            />
          </div>
        </SheetContent>
      </Sheet>


      <CopyConfigDialog
        open={isCopyConfigDialogOpen}
        onOpenChange={setIsCopyConfigDialogOpen}
        formikValues={formik.values}
        ttsConfig={ttsConfig}
        sttConfig={sttConfig}
        azureConfig={azureConfig}
        fallbackAzureConfig={fallbackAzureConfig}
      />

      <PasteConfigDialog
        open={isPasteConfigDialogOpen}
        onOpenChange={setIsPasteConfigDialogOpen}
        onApplyConfig={handleApplyPastedConfig}
        isFormDirty={isFormDirty}
      />

      <ConfigHistory
        open={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        agentId={agentid}
        projectId={projectId}
        agentEnvironment={agentDataResponse?.[0]?.environment ?? 'dev'}
      />

      {/* Review changes / commit dialog */}
      <Dialog open={isCommitModalOpen} onOpenChange={v => { if (!v && !isSavingVersion) setIsCommitModalOpen(false) }}>
        <DialogContent className="sm:max-w-5xl max-w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Review Changes</DialogTitle>
          </DialogHeader>
          <p className="px-3 py-1.5 text-[11px] font-medium text-amber-600 bg-amber-500/15 rounded-md">
            Seeing changes you didn't make? Refresh the page and try again.
          </p>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label htmlFor="commit-message" className="text-xs font-medium text-foreground">Commit message</label>
              <Textarea
                id="commit-message"
                placeholder="e.g. Fixed greeting for missed calls"
                value={commitMessage}
                onChange={e => setCommitMessage(e.target.value)}
                className="text-sm resize-none"
                rows={2}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveVersion() }}
              />
              <p className="text-[11px] text-muted-foreground">Press ⌘↵ to publish quickly.</p>
            </div>

            {renderDiffContent()}

            {!isDiffLoading && !publishedSnapshot && (
              <p className="text-[11px] text-muted-foreground">No prior published version — this will be the first version.</p>
            )}

            {versionSaveError && <p className="text-xs text-destructive">{versionSaveError}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline" size="sm" className="h-8 text-xs"
              onClick={() => setIsCommitModalOpen(false)}
              disabled={isSavingVersion}
            >
              Cancel
            </Button>
            <Button
              size="sm" className="h-8 text-xs"
              onClick={handleSaveVersion}
              disabled={isSavingVersion || !commitMessage.trim()}
            >
              {isSavingVersion
                ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Publishing...</>
                : 'Publish'
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Post-save merge suggestion */}
      {showMergePrompt && (
        <Dialog open={showMergePrompt} onOpenChange={v => { if (!v) setShowMergePrompt(false) }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm font-semibold">Version saved! Merge to prod?</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground py-2">
              Your version was committed. Do you want to merge this to a production agent now?
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowMergePrompt(false)}>
                Not now
              </Button>
              <Button
                size="sm" className="h-8 text-xs"
                onClick={() => { setShowMergePrompt(false); setIsHistoryOpen(true) }}
              >
                Open History & Merge
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

    </div>
  )
}