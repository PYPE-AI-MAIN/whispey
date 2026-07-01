// hooks/useMultiAssistantState.ts
import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { FormikProps } from 'formik'
import { getFallback } from '@/config/agentDefaults'

function serializeSarvamLanguageSwitchSTT(stt: any): any {
  const out: any = { name: stt.name, language: stt.language, model: stt.model }
  if (stt.adaptive_stt) out.adaptive_stt = true
  if (stt.mode) out.mode = stt.mode
  out.flush_signal = stt.flush_signal ?? true
  return out
}

function applyDeepgramFluxFields(stt: any, out: any): void {
  if (stt.eot_threshold != null) out.eot_threshold = stt.eot_threshold
  if (stt.eager_eot_threshold != null) out.eager_eot_threshold = stt.eager_eot_threshold
  if (stt.eot_timeout_ms != null) out.eot_timeout_ms = stt.eot_timeout_ms
}

function applyDeepgramNovaFields(stt: any, out: any): void {
  if (stt.endpointing_ms != null) out.endpointing_ms = stt.endpointing_ms
  if (stt.punctuate != null) out.punctuate = stt.punctuate
  if (stt.smart_format != null) out.smart_format = stt.smart_format
  if (stt.profanity_filter != null) out.profanity_filter = stt.profanity_filter
  if (stt.numerals != null) out.numerals = stt.numerals
  if (stt.keyterm?.length) out.keyterm = stt.keyterm
}

function serializeDeepgramLanguageSwitchSTT(stt: any): any {
  const out: any = { name: stt.name, language: stt.language, model: stt.model }
  if (stt.model?.startsWith('flux-general')) {
    applyDeepgramFluxFields(stt, out)
  } else {
    applyDeepgramNovaFields(stt, out)
  }
  return out
}

function serializeGoogleLanguageSwitchSTT(stt: any): any {
  const out: any = { name: stt.name, language: stt.language }
  if (stt.model) out.model = stt.model
  return out
}

function serializeLanguageSwitchSTT(stt: any): any {
  if (!stt) return {}
  if (stt.name === 'sarvam') return serializeSarvamLanguageSwitchSTT(stt)
  if (stt.name === 'deepgram') return serializeDeepgramLanguageSwitchSTT(stt)
  if (stt.name === 'google') return serializeGoogleLanguageSwitchSTT(stt)
  return { name: stt.name }
}

function serializeSarvamLanguageSwitchTTS(tts: any): any {
  const out: any = {
    name: tts.name,
    language: tts.language,
    model: tts.model || 'bulbul:v3-beta',
    speaker: tts.speaker || tts.voice_id || '',
  }
  if (tts.voice_settings) {
    out.voice_settings = {
      pace: tts.voice_settings.pace ?? 1,
      loudness: tts.voice_settings.loudness ?? 1,
      pitch: tts.voice_settings.pitch ?? 0,
      enable_preprocessing: tts.voice_settings.enable_preprocessing ?? false,
    }
  }
  return out
}

function serializeElevenlabsLanguageSwitchTTS(tts: any): any {
  const out: any = {
    name: tts.name,
    voice_id: tts.voice_id || '',
    model: tts.model || 'eleven_multilingual_v2',
  }
  if (tts.language) out.language = tts.language
  if (tts.voice_settings) {
    out.voice_settings = {
      similarity_boost: tts.voice_settings.similarity_boost ?? 0.75,
      stability: tts.voice_settings.stability ?? 0.5,
      style: tts.voice_settings.style ?? 0,
      use_speaker_boost: tts.voice_settings.use_speaker_boost ?? true,
      speed: tts.voice_settings.speed ?? 1,
    }
  }
  return out
}

function serializeGoogleLanguageSwitchTTS(tts: any): any {
  const out: any = { name: tts.name, voice_name: tts.voice_name || '' }
  if (tts.gender) out.gender = tts.gender
  return out
}

function serializeLanguageSwitchTTS(tts: any): any {
  if (!tts) return {}
  if (tts.name === 'sarvam') return serializeSarvamLanguageSwitchTTS(tts)
  if (tts.name === 'elevenlabs') return serializeElevenlabsLanguageSwitchTTS(tts)
  if (tts.name === 'google') return serializeGoogleLanguageSwitchTTS(tts)
  return { name: tts.name }
}

export function buildAgentEnvelope(name: string, type: string, assistant: any[], agentId?: string) {
  return { agent: { name, type, ...(agentId ? { agent_id: agentId } : {}), assistant } }
}

function buildFallbackTtsPayload(formValues: any) {
  const provider = formValues.fallbackTtsProvider
  // cfg is either already normalized (camelCase from SelectTTS) or raw (snake_case from backend).
  // All lookups try the normalized key first, then fall back to voice_settings nested format.
  const cfg = formValues.fallbackTtsVoiceConfig || {}

  if (provider === 'sarvam' || provider === 'sarvam_tts') {
    return {
      name: provider,
      voice_id: formValues.fallbackTtsVoiceId,
      model: formValues.fallbackTtsModel,
      language: cfg.target_language_code || cfg.language || 'en-IN',
      voice_settings: {
        similarity_boost: 1,
        stability: 0.8,
        style: 1,
        use_speaker_boost: true,
        // SelectTTS uses `pace`; saved backend config uses `voice_settings.speed`
        speed: cfg.pace ?? cfg.speed ?? cfg.voice_settings?.pace ?? cfg.voice_settings?.speed ?? 1.0,
        loudness: cfg.loudness ?? cfg.voice_settings?.loudness ?? 1.0,
        enable_preprocessing: cfg.enable_preprocessing ?? cfg.voice_settings?.enable_preprocessing ?? true,
        pitch: cfg.pitch ?? cfg.voice_settings?.pitch ?? 0.0,
      },
    }
  } else if (provider === 'google') {
    const result: any = {
      name: 'google',
      voice_name: formValues.fallbackTtsVoiceId || cfg.voice_name,
    }
    if (cfg.gender && cfg.gender !== 'none') {
      result.gender = cfg.gender.toLowerCase()
    }
    return result
  } else {
    // ElevenLabs or any other provider
    // Normalized keys (camelCase) are tried first; raw voice_settings keys are tried as fallback
    return {
      name: provider,
      voice_id: formValues.fallbackTtsVoiceId,
      model: formValues.fallbackTtsModel,
      language: cfg.language || 'en',
      voice_settings: {
        similarity_boost: cfg.similarityBoost ?? cfg.voice_settings?.similarity_boost ?? 0.75,
        stability: cfg.stability ?? cfg.voice_settings?.stability ?? 0.5,
        style: cfg.style ?? cfg.voice_settings?.style ?? 0,
        use_speaker_boost: cfg.useSpeakerBoost ?? cfg.voice_settings?.use_speaker_boost ?? true,
        speed: cfg.speed ?? cfg.voice_settings?.speed ?? 1.0,
      },
    }
  }
}

function buildSingleAssistantSttPayload(formValues: any, currentSttConfig: any): any {
  const rawConfig = formValues.sttConfig || currentSttConfig?.config || {}
  const { language: _l, mode: _m, model: _mo, tier: _t, version: _v,
          redact: _r, diarize: _d, utterances: _u, detect_language: _dl,
          ...extraConfig } = rawConfig
  return {
    name: currentSttConfig?.provider || formValues.sttProvider || getFallback(null, 'stt.name'),
    language: currentSttConfig?.config?.language || formValues.sttConfig?.language || getFallback(null, 'stt.language'),
    model: currentSttConfig?.model || formValues.sttModel || getFallback(null, 'stt.model'),
    ...((currentSttConfig?.config?.mode || formValues.sttConfig?.mode) && {
      mode: currentSttConfig?.config?.mode || formValues.sttConfig?.mode
    }),
    ...extraConfig,
    ...(formValues.fallbackSttProvider && {
      fallback: {
        name: formValues.fallbackSttProvider,
        language: formValues.fallbackSttConfig?.language || formValues.sttConfig?.language || getFallback(null, 'stt.language'),
        model: formValues.fallbackSttModel,
        ...(formValues.fallbackSttConfig?.mode && { mode: formValues.fallbackSttConfig.mode }),
      }
    }),
  }
}

function buildSingleAssistantLlmPayload(formValues: any, currentAzureConfig: any, fallbackAzureConfig: any): any {
  return {
    name: formValues.selectedProvider || getFallback(null, 'llm.name'),
    provider: formValues.selectedProvider === 'azure_openai' ? 'azure' : formValues.selectedProvider || getFallback(null, 'llm.provider'),
    model: formValues.selectedModel || getFallback(null, 'llm.model'),
    temperature: formValues.temperature ?? getFallback(null, 'llm.temperature'),
    ...(formValues.selectedProvider === 'azure_openai' && currentAzureConfig && {
      azure_deployment: getFallback(null, 'llm.azure_deployment'),
      azure_endpoint: currentAzureConfig.endpoint || getFallback(null, 'llm.azure_endpoint'),
      api_version: currentAzureConfig.apiVersion || getFallback(null, 'llm.api_version'),
      api_key_env: getFallback(null, 'llm.api_key_env')
    }),
    ...(formValues.selectedProvider === 'openai' && { api_key_env: 'OPENAI_API_KEY' }),
    ...(formValues.selectedProvider === 'groq' && { api_key_env: 'GROQ_API_KEY' }),
    ...(formValues.selectedProvider === 'cerebras' && { api_key_env: 'CEREBRAS_API_KEY' }),
    ...(formValues.fallbackLlmProvider && {
      fallback: {
        name: formValues.fallbackLlmProvider,
        provider: formValues.fallbackLlmProvider === 'azure_openai' ? 'azure' : formValues.fallbackLlmProvider,
        model: formValues.fallbackLlmModel || getFallback(null, 'llm.model'),
        temperature: formValues.fallbackLlmTemperature ?? getFallback(null, 'llm.temperature'),
        ...(formValues.fallbackLlmProvider === 'azure_openai' && fallbackAzureConfig && {
          azure_deployment: getFallback(null, 'llm.azure_deployment'),
          azure_endpoint: fallbackAzureConfig.endpoint || getFallback(null, 'llm.azure_endpoint'),
          api_version: fallbackAzureConfig.apiVersion || getFallback(null, 'llm.api_version'),
          api_key_env: getFallback(null, 'llm.api_key_env')
        }),
        ...(formValues.fallbackLlmProvider === 'openai' && { api_key_env: 'OPENAI_API_KEY' }),
        ...(formValues.fallbackLlmProvider === 'groq' && { api_key_env: 'GROQ_API_KEY' }),
        ...(formValues.fallbackLlmProvider === 'cerebras' && { api_key_env: 'CEREBRAS_API_KEY' }),
      }
    }),
  }
}

function buildSingleAssistantTtsPayload(formValues: any, currentTtsConfig: any): any {
  const ttsProvider = currentTtsConfig?.provider || formValues.ttsProvider || getFallback(null, 'tts.name')
  const isSarvam = ttsProvider === 'sarvam' || ttsProvider === 'sarvam_tts'
  const isGoogle = ttsProvider === 'google'

  const fallbackTtsPayload = formValues.fallbackTtsProvider && formValues.fallbackTtsVoiceId
    ? { fallback: buildFallbackTtsPayload(formValues) }
    : {}

  if (isSarvam) {
    // Sarvam TTS configuration - using ElevenLabs format
    const targetLanguageCode = currentTtsConfig?.config?.target_language_code || formValues.ttsVoiceConfig?.target_language_code || 'en-IN'
    const sarvamSpeed = currentTtsConfig?.config?.speed ?? formValues.ttsVoiceConfig?.speed ?? 1
    const sarvamLoudness = currentTtsConfig?.config?.loudness ?? formValues.ttsVoiceConfig?.loudness ?? 1

    return {
      name: ttsProvider,
      voice_id: formValues.selectedVoice || getFallback(null, 'tts.voice_id'),
      model: currentTtsConfig?.model || formValues.ttsModel || getFallback(null, 'tts.model'),
      language: targetLanguageCode,
      voice_settings: {
        similarity_boost: 1,
        stability: 0.8,
        style: 1,
        use_speaker_boost: true,
        speed: sarvamSpeed,
        loudness: sarvamLoudness,
        enable_preprocessing: currentTtsConfig?.config?.enable_preprocessing ?? formValues.ttsVoiceConfig?.enable_preprocessing ?? true
      },
      ...fallbackTtsPayload,
    }
  }

  if (isGoogle) {
    // Google TTS configuration - only send voice_name and gender (lowercase)
    const googleConfig = currentTtsConfig?.config || formValues.ttsVoiceConfig || {}
    const result: any = {
      name: 'google',
      voice_name: formValues.selectedVoice || googleConfig.voice_name || getFallback(null, 'tts.voice_name'),
      ...fallbackTtsPayload,
    }

    // Only add gender if it's specified, and convert to lowercase
    if (googleConfig.gender && googleConfig.gender !== 'none') {
      result.gender = googleConfig.gender.toLowerCase()
    }

    return result
  }

  // ElevenLabs or other TTS configuration
  return {
    name: ttsProvider,
    voice_id: formValues.selectedVoice || getFallback(null, 'tts.voice_id'),
    model: currentTtsConfig?.model || formValues.ttsModel || getFallback(null, 'tts.model'),
    language: currentTtsConfig?.config?.language || formValues.ttsVoiceConfig?.language || getFallback(null, 'tts.language'),
    voice_settings: {
      similarity_boost: currentTtsConfig?.config?.similarityBoost ?? formValues.ttsVoiceConfig?.similarityBoost ?? getFallback(null, 'tts.voice_settings.similarity_boost'),
      stability: currentTtsConfig?.config?.stability ?? formValues.ttsVoiceConfig?.stability ?? getFallback(null, 'tts.voice_settings.stability'),
      style: currentTtsConfig?.config?.style ?? formValues.ttsVoiceConfig?.style ?? getFallback(null, 'tts.voice_settings.style'),
      use_speaker_boost: currentTtsConfig?.config?.useSpeakerBoost ?? formValues.ttsVoiceConfig?.useSpeakerBoost ?? getFallback(null, 'tts.voice_settings.use_speaker_boost'),
      speed: currentTtsConfig?.config?.speed ?? formValues.ttsVoiceConfig?.speed ?? getFallback(null, 'tts.voice_settings.speed')
    },
    ...fallbackTtsPayload,
  }
}

// Merges the Knowledge Base (RAG) tool and language_switch tools into the
// already-serialized tools array. Used only by the single-assistant save path.
function mergeToolsWithKbAndLanguageSwitch(formValues: any, mappedTools: any[]): any[] {
  const kb = formValues.advancedSettings?.knowledgeBase
  const toolsArray = Array.isArray(mappedTools) ? [...mappedTools] : []

  // Filter out knowledge_search tool if RAG is disabled
  const filteredTools = kb?.enabled === false
    ? toolsArray.filter((t: any) => t?.type !== 'knowledge_search')
    : toolsArray

  if (kb?.enabled) {
    const topK = typeof kb.topK === 'number' && kb.topK >= 1 ? Math.min(50, kb.topK) : 5
    const existingIdx = filteredTools.findIndex((t: any) => t?.type === 'knowledge_search')
    const kbEntry = {
      type: 'knowledge_search' as const,
      top_k: topK,
      knowledge_search_options: { top_k: topK }
    }
    if (existingIdx >= 0) {
      filteredTools[existingIdx] = { ...filteredTools[existingIdx], ...kbEntry }
    } else {
      filteredTools.push(kbEntry)
    }
  }

  // Merge language_switch tools into the tools array
  const lsTools: any[] = formValues.advancedSettings?.tools?.languageSwitchTools || []
  lsTools.forEach((ls: any) => {
    const entry: any = {
      type: 'language_switch',
      tool_name: ls.tool_name,
      description: ls.description,
      language_code: ls.language_code,
      system_message: ls.system_message,
      allow_interruptions: ls.allow_interruptions,
      switch_stt: ls.switch_stt ?? true,
      switch_tts: ls.switch_tts ?? true,
      stt: serializeLanguageSwitchSTT(ls.stt),
      tts: serializeLanguageSwitchTTS(ls.tts),
    }
    if (ls.allow_interruptions) {
      entry.interruption = ls.interruption ?? true
    }
    filteredTools.push(entry)
  })

  return filteredTools
}

// Used by the single-assistant save path. Includes acefone_token / pre-transfer
// webhook fields for transfer_call — kept separate from serializeAssistantToolBasic
// because the multi-assistant path does not (and historically never did) emit these.
function serializeAssistantToolFull(tool: any): any {
  const baseToolConfig = {
    type: tool.type
  }

  if (tool.type === 'end_call') {
    return baseToolConfig
  }

  const commonFields = {
    name: tool.name,
    description: tool.config?.description || ''
  }

  if (tool.type === 'custom_function') {
    let responseMappingObject = {}
    try {
      if (tool.config?.responseMapping) {
        responseMappingObject = JSON.parse(tool.config.responseMapping)
      }
    } catch (e) {
      console.warn('Failed to parse response mapping:', e)
    }

    return {
      ...baseToolConfig,
      ...commonFields,
      api_url: tool.config?.endpoint || '',
      http_method: tool.config?.method || 'GET',
      timeout: tool.config?.timeout || 10,
      async: tool.config?.asyncExecution || false,
      headers: tool.config?.headers || {},
      parameters: tool.config?.parameters?.map((param: any) => ({
        name: param.name,
        type: param.type,
        description: param.description,
        required: param.required
      })) || [],
      custom_payload: tool.config?.body || '',
      response_mapping: responseMappingObject,
      response_mapping_raw: tool.config?.responseMapping || '{}',
      filler_config: tool.config?.filler_config ?? null,
    }
  }

  if (tool.type === 'handoff') {
    return {
      ...baseToolConfig,
      ...commonFields,
      target_agent: tool.config?.targetAgent || '',
      handoff_message: tool.config?.handoffMessage || ''
    }
  }

  if (tool.type === 'transfer_call') {
    return {
      ...baseToolConfig,
      ...commonFields,
      transfer_number: tool.config?.transferNumber || '',
      sip_outbound_trunk: tool.config?.sipTrunkId || '',
      acefone_token: tool.config?.acefoneToken || null,
      pre_transfer_webhook_url: tool.config?.preTransferWebhookUrl || null,
      pre_transfer_webhook_fields: tool.config?.preTransferWebhookFields || null,
      // Trigger-mode flags. Defaults preserve current behavior.
      enable_as_tool: tool.config?.enableAsTool !== false,
      enable_as_tag: tool.config?.enableAsTag === true,
    }
  }

  if (tool.type === 'ivr_navigator') {
    return {
      ...baseToolConfig,
      ...commonFields,
      function_name: tool.config?.function_name || 'send_dtmf_code',
      docstring: tool.config?.docstring || 'Emit a DTMF digit when the IVR menu requests an input.',
      cooldown_seconds: tool.config?.cooldown_seconds || 3,
      publish_topic: tool.config?.publish_topic || 'dtmf_code',
      publish_data: tool.config?.publish_data ?? true,
      instruction_template: tool.config?.instruction_template || 'Listen carefully and press the most relevant option to accomplish: {task}.',
      default_task: tool.config?.default_task || 'Reach a live support representative',
      task_metadata_keys: tool.config?.task_metadata_keys || ['ivr_task', 'navigator_task', 'task']
    }
  }

  if (tool.type === 'nearby_location_finder') {
    let hospitals: any[] = []
    let areas: Record<string, any> = {}
    try {
      hospitals = tool.config?.hospitals_json ? JSON.parse(tool.config.hospitals_json) : []
    } catch (e) {
      console.warn('Failed to parse hospitals_json:', e)
    }
    try {
      areas = tool.config?.areas_json ? JSON.parse(tool.config.areas_json) : {}
    } catch (e) {
      console.warn('Failed to parse areas_json:', e)
    }

    const maxResults = (() => {
      const v = tool.config?.max_results
      const n = typeof v === 'string' ? parseInt(v, 10) : v
      return Number.isFinite(n) && n > 0 ? n : 3
    })()

    return {
      ...baseToolConfig,
      ...commonFields,
      max_results: maxResults,
      hospitals,
      areas
    }
  }

  return baseToolConfig
}

// Used by the multi-assistant save path. Intentionally omits acefone_token / webhook
// fields for transfer_call — mirrors the pre-existing behavior at this call site.
function serializeAssistantToolBasic(tool: any): any {
  const baseToolConfig = {
    type: tool.type
  }

  if (tool.type === 'end_call') {
    return baseToolConfig
  }

  const commonFields = {
    name: tool.name,
    description: tool.config?.description || ''
  }

  if (tool.type === 'custom_function') {
    let responseMappingObject = {}
    try {
      if (tool.config?.responseMapping) {
        responseMappingObject = JSON.parse(tool.config.responseMapping)
      }
    } catch (e) {
      console.warn('Failed to parse response mapping:', e)
    }

    return {
      ...baseToolConfig,
      ...commonFields,
      api_url: tool.config?.endpoint || '',
      http_method: tool.config?.method || 'GET',
      timeout: tool.config?.timeout || 10,
      async: tool.config?.asyncExecution || false,
      headers: tool.config?.headers || {},
      parameters: tool.config?.parameters?.map((param: any) => ({
        name: param.name,
        type: param.type,
        description: param.description,
        required: param.required
      })) || [],
      custom_payload: tool.config?.body || '',
      response_mapping: responseMappingObject,
      response_mapping_raw: tool.config?.responseMapping || '{}',
      filler_config: tool.config?.filler_config ?? null,
    }
  }

  if (tool.type === 'handoff') {
    return {
      ...baseToolConfig,
      ...commonFields,
      target_agent: tool.config?.targetAgent || '',
      handoff_message: tool.config?.handoffMessage || ''
    }
  }

  if (tool.type === 'transfer_call') {
    return {
      ...baseToolConfig,
      ...commonFields,
      transfer_number: tool.config?.transferNumber || '',
      sip_outbound_trunk: tool.config?.sipTrunkId || '',
      // Trigger-mode flags. Defaults preserve current behavior.
      enable_as_tool: tool.config?.enableAsTool !== false,
      enable_as_tag: tool.config?.enableAsTag === true,
    }
  }

  if (tool.type === 'ivr_navigator') {
    return {
      ...baseToolConfig,
      ...commonFields,
      function_name: tool.config?.function_name || 'send_dtmf_code',
      docstring: tool.config?.docstring || 'Emit a DTMF digit when the IVR menu requests an input.',
      cooldown_seconds: tool.config?.cooldown_seconds || 3,
      publish_topic: tool.config?.publish_topic || 'dtmf_code',
      publish_data: tool.config?.publish_data ?? true,
      instruction_template: tool.config?.instruction_template || 'Listen carefully and press the most relevant option to accomplish: {task}.',
      default_task: tool.config?.default_task || 'Reach a live support representative',
      task_metadata_keys: tool.config?.task_metadata_keys || ['ivr_task', 'navigator_task', 'task']
    }
  }

  if (tool.type === 'nearby_location_finder') {
    let hospitals: any[] = []
    let areas: Record<string, any> = {}
    try {
      hospitals = tool.config?.hospitals_json ? JSON.parse(tool.config.hospitals_json) : []
    } catch (e) {
      console.warn('Failed to parse hospitals_json:', e)
    }
    try {
      areas = tool.config?.areas_json ? JSON.parse(tool.config.areas_json) : {}
    } catch (e) {
      console.warn('Failed to parse areas_json:', e)
    }

    const maxResults = (() => {
      const v = tool.config?.max_results
      const n = typeof v === 'string' ? parseInt(v, 10) : v
      return Number.isFinite(n) && n > 0 ? n : 3
    })()

    return {
      ...baseToolConfig,
      ...commonFields,
      max_results: maxResults,
      hospitals,
      areas
    }
  }

  return baseToolConfig
}

interface AssistantFormData {
  name: string
  formikRef?: FormikProps<any> | null
  ttsConfig: any
  sttConfig: any
  azureConfig: any
  hasUnsavedChanges: boolean
  isConfigured: boolean
}

interface UseMultiAssistantStateProps {
  initialAssistants: any[]
  agentId: string
  agentName: string
  agentType?: string
  currentFormik?: FormikProps<any>
  currentTtsConfig?: any
  currentSttConfig?: any
  currentAzureConfig?: any
  fallbackAzureConfig?: any
}

export function useMultiAssistantState({
  initialAssistants,
  agentId,
  agentName,
  agentType = 'OUTBOUND',
  currentFormik,
  currentTtsConfig,
  currentSttConfig,
  currentAzureConfig,
  fallbackAzureConfig
}: UseMultiAssistantStateProps) { // NOSONAR javascript:S3776
  
  const [assistantNames, setAssistantNames] = useState<string[]>(() => {
    return initialAssistants.map(a => a.name)
  })

  const [assistantsData, setAssistantsData] = useState<Map<string, AssistantFormData>>(() => {
    const map = new Map()
    if (initialAssistants.length > 0) {
      initialAssistants.forEach(assistant => {
        map.set(assistant.name, {
          name: assistant.name,
          formikRef: null,
          ttsConfig: assistant.tts || {},
          sttConfig: assistant.stt || {},
          azureConfig: {},
          hasUnsavedChanges: false,
          isConfigured: true
        })
      })
    } else {
      map.set(agentName, {
        name: agentName,
        formikRef: null,
        ttsConfig: {},
        sttConfig: {},
        azureConfig: {},
        hasUnsavedChanges: false,
        isConfigured: false
      })
    }
    return map
  })

  // Sync assistantNames when agentConfigData loads after initial render
  const initializedRef = useRef(false)
  useEffect(() => {
    if (initialAssistants.length === 0 || initializedRef.current) return
    initializedRef.current = true
    setAssistantNames(initialAssistants.map(a => a.name))
    setAssistantsData(prev => {
      const map = new Map(prev)
      initialAssistants.forEach(assistant => {
        if (!map.has(assistant.name)) {
          map.set(assistant.name, {
            name: assistant.name,
            formikRef: null,
            ttsConfig: assistant.tts || {},
            sttConfig: assistant.stt || {},
            azureConfig: {},
            hasUnsavedChanges: false,
            isConfigured: true,
          })
        }
      })
      return map
    })
  }, [initialAssistants])

  const getAssistantData = useCallback((name: string): AssistantFormData => {
    return assistantsData.get(name) || {
      name,
      formikRef: null,
      ttsConfig: {},
      sttConfig: {},
      azureConfig: {},
      hasUnsavedChanges: false,
      isConfigured: false
    }
  }, [assistantsData])

  const updateAssistantData = useCallback((name: string, updates: Partial<AssistantFormData>) => {
    setAssistantsData(prev => {
      const newMap = new Map(prev)
      const currentData = getAssistantData(name)
      newMap.set(name, { ...currentData, ...updates })
      return newMap
    })
  }, [getAssistantData])

  const buildSavePayload = useCallback(() => {
    if (currentFormik && assistantNames.length <= 1) {
      const formValues = currentFormik.values
      
      const variablesObject = Array.isArray(formValues.variables)
        ? formValues.variables.reduce((acc: any, v: any) => {
            acc[v.name] = v.value
            return acc
          }, {})
        : formValues.variables || {}

      const firstMessageModeConfig = typeof formValues.firstMessageMode === 'object'
        ? {
            mode: formValues.firstMessageMode.mode,
            first_message: formValues.firstMessageMode.first_message || '',
            allow_interruptions: formValues.firstMessageMode.allow_interruptions ?? getFallback(null, 'first_message_mode.allow_interruptions')
          }
        : {
            mode: formValues.firstMessageMode || getFallback(null, 'first_message_mode.mode'),
            first_message: formValues.customFirstMessage || getFallback(null, 'first_message_mode.first_message'),
            allow_interruptions: getFallback(null, 'first_message_mode.allow_interruptions')
          }

      const assistant = {
        name: agentName,
        prompt: formValues.prompt || '',
        variables: variablesObject,
        stt: buildSingleAssistantSttPayload(formValues, currentSttConfig),
        llm: buildSingleAssistantLlmPayload(formValues, currentAzureConfig, fallbackAzureConfig),
        tts: buildSingleAssistantTtsPayload(formValues, currentTtsConfig),
        vad: {
          name: formValues.advancedSettings?.vad?.vadProvider || getFallback(null, 'vad.name'),
          ...(formValues.advancedSettings?.vad?.minSilenceDuration !== undefined && {
            min_silence_duration: formValues.advancedSettings.vad.minSilenceDuration
          }),
          ...(formValues.advancedSettings?.vad?.minSpeechDuration !== undefined && {
            min_speech_duration: formValues.advancedSettings.vad.minSpeechDuration
          }),
          ...(formValues.advancedSettings?.vad?.prefixPaddingDuration !== undefined && {
            prefix_padding_duration: formValues.advancedSettings.vad.prefixPaddingDuration
          }),
          ...(formValues.advancedSettings?.vad?.maxBufferedSpeech !== undefined && {
            max_buffered_speech: formValues.advancedSettings.vad.maxBufferedSpeech
          }),
          ...(formValues.advancedSettings?.vad?.activationThreshold !== undefined && {
            activation_threshold: formValues.advancedSettings.vad.activationThreshold
          }),
          ...(formValues.advancedSettings?.vad?.sampleRate !== undefined && {
            sample_rate: formValues.advancedSettings.vad.sampleRate
          }),
          ...(formValues.advancedSettings?.vad?.forceCpu !== undefined && {
            force_cpu: formValues.advancedSettings.vad.forceCpu
          })
        },
        tools: (() => {
          const mappedTools = formValues.advancedSettings?.tools?.tools?.map(serializeAssistantToolFull) || getFallback(null, 'tools') || []
          const filteredTools = mergeToolsWithKbAndLanguageSwitch(formValues, mappedTools)
          return filteredTools.length > 0 ? filteredTools : getFallback(null, 'tools')
        })(),
        filler_words: {
          enabled: (formValues.advancedSettings?.fillers?.enableFillerWords ?? false) && [
            ...(formValues.advancedSettings?.fillers?.generalFillers ?? []),
            ...(formValues.advancedSettings?.fillers?.questionFillers ?? []),
            ...(formValues.advancedSettings?.fillers?.ambiguousFillers ?? []),
          ].some((w: string) => w !== ''),
          language: formValues.advancedSettings?.fillers?.language ?? 'auto',
          question_keywords: formValues.advancedSettings?.fillers?.questionKeywords?.filter((f: string) => f !== '') ?? [],
          question_fillers: formValues.advancedSettings?.fillers?.questionFillers?.filter((f: string) => f !== '') ?? [],
          ambiguous_keywords: formValues.advancedSettings?.fillers?.ambiguousKeywords?.filter((f: string) => f !== '') ?? [],
          ambiguous_fillers: formValues.advancedSettings?.fillers?.ambiguousFillers?.filter((f: string) => f !== '') ?? [],
          general_fillers: formValues.advancedSettings?.fillers?.generalFillers?.filter((f: string) => f !== '') ?? [],
          typing_probability: formValues.advancedSettings?.backgroundAudio?.thinkingProbability ?? 0.10,
          filler_cooldown_sec: formValues.advancedSettings?.fillers?.fillerCooldownSec ?? 4.0,
          latency_threshold: formValues.advancedSettings?.fillers?.latencyThreshold ?? 1.2,
          conversation_fillers: formValues.advancedSettings?.fillers?.conversationFillers?.filter((f: string) => f !== '') ?? [],
          conversation_keywords: formValues.advancedSettings?.fillers?.conversationKeywords?.filter((f: string) => f !== '') ?? [],
        },
        bug_reports: {
          enable: formValues.advancedSettings?.bugs?.enableBugReport ?? getFallback(null, 'bug_reports.enable'),
          bug_start_command: formValues.advancedSettings?.bugs?.bugStartCommands || getFallback(null, 'bug_reports.bug_start_command'),
          bug_end_command: formValues.advancedSettings?.bugs?.bugEndCommands || getFallback(null, 'bug_reports.bug_end_command'),
          response: formValues.advancedSettings?.bugs?.initialResponse || getFallback(null, 'bug_reports.response'),
          collection_prompt: formValues.advancedSettings?.bugs?.collectionPrompt || getFallback(null, 'bug_reports.collection_prompt')
        },
        context_memory: {
          enabled: formValues.advancedSettings?.contextMemory?.enabled ?? false
        },
        interruptions: {
          allow_interruptions: formValues.advancedSettings?.interruption?.allowInterruptions ?? getFallback(null, 'interruptions.allow_interruptions'),
          min_interruption_duration: formValues.advancedSettings?.interruption?.minInterruptionDuration ?? getFallback(null, 'interruptions.min_interruption_duration'),
          min_interruption_words: formValues.advancedSettings?.interruption?.minInterruptionWords ?? getFallback(null, 'interruptions.min_interruption_words'),
          drop_filler_words: formValues.advancedSettings?.interruption?.dropFillerWords ?? false,
          filler_drop_list: formValues.advancedSettings?.interruption?.fillerDropList ?? [],
        },
        interruption_mode: formValues.advancedSettings?.session?.interruption_mode ?? null,
        adaptive_stt: formValues.advancedSettings?.session?.interruption_mode === 'adaptive',
        ...(formValues.advancedSettings?.session?.interruption_mode === 'adaptive' && {
          adaptive_min_duration: formValues.advancedSettings.interruption?.adaptiveMinDuration ?? 0.8,
          adaptive_min_words: formValues.advancedSettings.interruption?.adaptiveMinWords ?? 0,
          adaptive_discard_audio_if_uninterruptible: formValues.advancedSettings.interruption?.adaptiveDiscardAudioIfUninterruptible ?? true,
          adaptive_resume_false_interruption: formValues.advancedSettings.interruption?.adaptiveResumeFalseInterruption ?? true,
          adaptive_false_interruption_timeout: formValues.advancedSettings.interruption?.adaptiveFalseInterruptionTimeout ?? 0.5,
          adaptive_backchannel_boundary_start: formValues.advancedSettings.interruption?.adaptiveBackchannelBoundaryStart ?? 0.1,
          adaptive_backchannel_boundary_end: formValues.advancedSettings.interruption?.adaptiveBackchannelBoundaryEnd ?? 2,
        }),
        first_message_mode: firstMessageModeConfig,
        first_message: firstMessageModeConfig.first_message,
        turn_detection: formValues.advancedSettings?.session?.turn_detection || getFallback(null, 'session_behavior.turn_detection'),
        session_behavior: {
          preemptive_generation: formValues.advancedSettings?.session?.preemptiveGeneration || getFallback(null, 'session_behavior.preemptive_generation'),
          turn_detection: formValues.advancedSettings?.session?.turn_detection || getFallback(null, 'session_behavior.turn_detection'),
          unlikely_threshold: formValues.advancedSettings?.session?.unlikely_threshold ?? getFallback(null, 'session_behavior.unlikely_threshold'),
          min_endpointing_delay: formValues.advancedSettings?.session?.min_endpointing_delay ?? getFallback(null, 'session_behavior.min_endpointing_delay'),
          max_endpointing_delay: formValues.advancedSettings?.session?.max_endpointing_delay ?? getFallback(null, 'session_behavior.max_endpointing_delay'),
          ...(formValues.advancedSettings?.session?.endpointing_mode && {
            endpointing_mode: formValues.advancedSettings.session.endpointing_mode
          }),
          ...(formValues.advancedSettings?.session?.interruption_mode && {
            interruption_mode: formValues.advancedSettings.session.interruption_mode
          }),
          ...(formValues.advancedSettings?.session?.user_away_timeout !== undefined && {
            user_away_timeout: formValues.advancedSettings.session.user_away_timeout
          }),
          ...(formValues.advancedSettings?.session?.user_away_timeout_message !== undefined && formValues.advancedSettings.session.user_away_timeout_message !== null && {
            user_away_timeout_message: formValues.advancedSettings.session.user_away_timeout_message
          }),
          ...(formValues.advancedSettings?.session?.user_away_timeout_max_count !== undefined && {
            user_away_timeout_max_count: formValues.advancedSettings.session.user_away_timeout_max_count
          }),
          ...(formValues.advancedSettings?.session?.user_away_timeout_end_message !== undefined && formValues.advancedSettings.session.user_away_timeout_end_message !== null && formValues.advancedSettings.session.user_away_timeout_end_message !== '' && {
            user_away_timeout_end_message: formValues.advancedSettings.session.user_away_timeout_end_message
          })
        },
        background_audio: {
          enabled: formValues.advancedSettings?.backgroundAudio?.mode !== 'disabled',
          thinking_probability: formValues.advancedSettings?.backgroundAudio?.thinkingProbability ?? 1.0,
          tool_call_typing_config: {
            enabled: formValues.advancedSettings?.backgroundAudio?.toolCallTyping ?? false,
            volume: formValues.advancedSettings?.backgroundAudio?.toolCallVolume ?? 0.8
          },
          ...(formValues.advancedSettings?.backgroundAudio?.mode === 'single' && {
            type: formValues.advancedSettings.backgroundAudio.singleType || 'keyboard',
            volume: formValues.advancedSettings.backgroundAudio.singleVolume ?? 0.5,
            timing: formValues.advancedSettings.backgroundAudio.singleTiming || 'thinking'
          }),
          ...(formValues.advancedSettings?.backgroundAudio?.mode === 'dual' && {
            ambient: {
              type: formValues.advancedSettings.backgroundAudio.ambientType || getFallback(null, 'background_audio.ambient.type'),
              volume: formValues.advancedSettings.backgroundAudio.ambientVolume ?? getFallback(null, 'background_audio.ambient.volume')
            },
            thinking: {
              type: formValues.advancedSettings.backgroundAudio.thinkingType || getFallback(null, 'background_audio.thinking.type'),
              volume: formValues.advancedSettings.backgroundAudio.thinkingVolume ?? getFallback(null, 'background_audio.thinking.volume')
            }
          })
        },
        ...(formValues.dynamic_tts && formValues.dynamic_tts.length > 0 && {
          dynamic_tts: formValues.dynamic_tts
        }),
        fallback_global_enabled: !!formValues.fallbackGlobalEnabled,
      }

      return buildAgentEnvelope(agentName, agentType, [assistant], agentId)
    }

    // For multiple assistants (future implementation)
    const assistants = assistantNames.map(name => {
      const data = assistantsData.get(name) || getAssistantData(name)
      const formValues = data.formikRef?.values || {}
      
      const variablesObject = Array.isArray(formValues.variables)
        ? formValues.variables.reduce((acc: any, v: any) => {
            acc[v.name] = v.value
            return acc
          }, {})
        : formValues.variables || {}

      const firstMessageModeConfig = typeof formValues.firstMessageMode === 'object'
        ? {
            mode: formValues.firstMessageMode.mode,
            first_message: formValues.firstMessageMode.first_message || '',
            allow_interruptions: formValues.firstMessageMode.allow_interruptions ?? getFallback(null, 'first_message_mode.allow_interruptions')
          }
        : {
            mode: formValues.firstMessageMode || getFallback(null, 'first_message_mode.mode'),
            first_message: formValues.customFirstMessage || getFallback(null, 'first_message_mode.first_message'),
            allow_interruptions: getFallback(null, 'first_message_mode.allow_interruptions')
          }
      
      return {
        name: name,
        prompt: formValues.prompt || '',
        variables: variablesObject,
        stt: {
          name: data.sttConfig?.name || formValues.sttProvider || getFallback(null, 'stt.name'),
          language: data.sttConfig?.language || formValues.sttConfig?.language || getFallback(null, 'stt.language'),
          model: data.sttConfig?.model || formValues.sttModel || getFallback(null, 'stt.model'),
          ...((data.sttConfig?.mode || formValues.sttConfig?.mode) && {
            mode: data.sttConfig?.mode || formValues.sttConfig?.mode
          }),
        },
        llm: {
          name: formValues.selectedProvider || getFallback(null, 'llm.name'),
          provider: formValues.selectedProvider === 'azure_openai' ? 'azure' : formValues.selectedProvider || getFallback(null, 'llm.provider'),
          model: formValues.selectedModel || getFallback(null, 'llm.model'),
          temperature: formValues.temperature ?? getFallback(null, 'llm.temperature'),
          ...(formValues.selectedProvider === 'azure_openai' && currentAzureConfig && {
            azure_deployment: getFallback(null, 'llm.azure_deployment'),
            azure_endpoint: currentAzureConfig.endpoint || getFallback(null, 'llm.azure_endpoint'),
            api_version: currentAzureConfig.apiVersion || getFallback(null, 'llm.api_version'),
            api_key_env: getFallback(null, 'llm.api_key_env')
          }),
          ...(formValues.selectedProvider === 'openai' && { api_key_env: 'OPENAI_API_KEY' }),
          ...(formValues.selectedProvider === 'groq' && { api_key_env: 'GROQ_API_KEY' }),
          ...(formValues.selectedProvider === 'cerebras' && { api_key_env: 'CEREBRAS_API_KEY' }),
          ...(formValues.fallbackLlmProvider && {
            fallback: {
              name: formValues.fallbackLlmProvider,
              provider: formValues.fallbackLlmProvider === 'azure_openai' ? 'azure' : formValues.fallbackLlmProvider,
              model: formValues.fallbackLlmModel || getFallback(null, 'llm.model'),
              temperature: formValues.fallbackLlmTemperature ?? getFallback(null, 'llm.temperature'),
              ...(formValues.fallbackLlmProvider === 'azure_openai' && fallbackAzureConfig && {
                azure_deployment: getFallback(null, 'llm.azure_deployment'),
                azure_endpoint: fallbackAzureConfig.endpoint || getFallback(null, 'llm.azure_endpoint'),
                api_version: fallbackAzureConfig.apiVersion || getFallback(null, 'llm.api_version'),
                api_key_env: getFallback(null, 'llm.api_key_env')
              }),
              ...(formValues.fallbackLlmProvider === 'openai' && { api_key_env: 'OPENAI_API_KEY' }),
              ...(formValues.fallbackLlmProvider === 'groq' && { api_key_env: 'GROQ_API_KEY' }),
              ...(formValues.fallbackLlmProvider === 'cerebras' && { api_key_env: 'CEREBRAS_API_KEY' }),
            }
          }),
        },
        tts: {
          name: data.ttsConfig?.name || formValues.ttsProvider || getFallback(null, 'tts.name'),
          voice_id: data.ttsConfig?.voice_id || formValues.selectedVoice || getFallback(null, 'tts.voice_id'),
          model: data.ttsConfig?.model || formValues.ttsModel || getFallback(null, 'tts.model'),
          language: data.ttsConfig?.language || formValues.ttsVoiceConfig?.language || getFallback(null, 'tts.language'),
          voice_settings: {
            similarity_boost: data.ttsConfig?.voice_settings?.similarity_boost ?? formValues.ttsVoiceConfig?.similarityBoost ?? getFallback(null, 'tts.voice_settings.similarity_boost'),
            stability: data.ttsConfig?.voice_settings?.stability ?? formValues.ttsVoiceConfig?.stability ?? getFallback(null, 'tts.voice_settings.stability'),
            style: data.ttsConfig?.voice_settings?.style ?? formValues.ttsVoiceConfig?.style ?? getFallback(null, 'tts.voice_settings.style'),
            use_speaker_boost: data.ttsConfig?.voice_settings?.use_speaker_boost ?? formValues.ttsVoiceConfig?.useSpeakerBoost ?? getFallback(null, 'tts.voice_settings.use_speaker_boost'),
            speed: data.ttsConfig?.voice_settings?.speed ?? formValues.ttsVoiceConfig?.speed ?? getFallback(null, 'tts.voice_settings.speed')
          }
        },
        vad: {
          name: formValues.advancedSettings?.vad?.vadProvider || getFallback(null, 'vad.name'),
          ...(formValues.advancedSettings?.vad?.minSilenceDuration !== undefined && {
            min_silence_duration: formValues.advancedSettings.vad.minSilenceDuration
          }),
          ...(formValues.advancedSettings?.vad?.minSpeechDuration !== undefined && {
            min_speech_duration: formValues.advancedSettings.vad.minSpeechDuration
          }),
          ...(formValues.advancedSettings?.vad?.prefixPaddingDuration !== undefined && {
            prefix_padding_duration: formValues.advancedSettings.vad.prefixPaddingDuration
          }),
          ...(formValues.advancedSettings?.vad?.maxBufferedSpeech !== undefined && {
            max_buffered_speech: formValues.advancedSettings.vad.maxBufferedSpeech
          }),
          ...(formValues.advancedSettings?.vad?.activationThreshold !== undefined && {
            activation_threshold: formValues.advancedSettings.vad.activationThreshold
          }),
          ...(formValues.advancedSettings?.vad?.sampleRate !== undefined && {
            sample_rate: formValues.advancedSettings.vad.sampleRate
          }),
          ...(formValues.advancedSettings?.vad?.forceCpu !== undefined && {
            force_cpu: formValues.advancedSettings.vad.forceCpu
          })
        },
        tools: formValues.advancedSettings?.tools?.tools?.map(serializeAssistantToolBasic) || getFallback(null, 'tools'),
        filler_words: {
          enabled: (formValues.advancedSettings?.fillers?.enableFillerWords ?? false) && [
            ...(formValues.advancedSettings?.fillers?.generalFillers ?? []),
            ...(formValues.advancedSettings?.fillers?.questionFillers ?? []),
            ...(formValues.advancedSettings?.fillers?.ambiguousFillers ?? []),
          ].some((w: string) => w !== ''),
          language: formValues.advancedSettings?.fillers?.language ?? 'auto',
          question_keywords: formValues.advancedSettings?.fillers?.questionKeywords?.filter((f: string) => f !== '') ?? [],
          question_fillers: formValues.advancedSettings?.fillers?.questionFillers?.filter((f: string) => f !== '') ?? [],
          ambiguous_keywords: formValues.advancedSettings?.fillers?.ambiguousKeywords?.filter((f: string) => f !== '') ?? [],
          ambiguous_fillers: formValues.advancedSettings?.fillers?.ambiguousFillers?.filter((f: string) => f !== '') ?? [],
          general_fillers: formValues.advancedSettings?.fillers?.generalFillers?.filter((f: string) => f !== '') ?? [],
          typing_probability: formValues.advancedSettings?.backgroundAudio?.thinkingProbability ?? 0.10,
          filler_cooldown_sec: formValues.advancedSettings?.fillers?.fillerCooldownSec ?? 4.0,
          latency_threshold: formValues.advancedSettings?.fillers?.latencyThreshold ?? 1.2,
          conversation_fillers: formValues.advancedSettings?.fillers?.conversationFillers?.filter((f: string) => f !== '') ?? [],
          conversation_keywords: formValues.advancedSettings?.fillers?.conversationKeywords?.filter((f: string) => f !== '') ?? [],
        },
        bug_reports: {
          enable: formValues.advancedSettings?.bugs?.enableBugReport ?? getFallback(null, 'bug_reports.enable'),
          bug_start_command: formValues.advancedSettings?.bugs?.bugStartCommands || getFallback(null, 'bug_reports.bug_start_command'),
          bug_end_command: formValues.advancedSettings?.bugs?.bugEndCommands || getFallback(null, 'bug_reports.bug_end_command'),
          response: formValues.advancedSettings?.bugs?.initialResponse || getFallback(null, 'bug_reports.response'),
          collection_prompt: formValues.advancedSettings?.bugs?.collectionPrompt || getFallback(null, 'bug_reports.collection_prompt')
        },
        context_memory: {
          enabled: formValues.advancedSettings?.contextMemory?.enabled ?? false
        },
        interruptions: {
          allow_interruptions: formValues.advancedSettings?.interruption?.allowInterruptions ?? getFallback(null, 'interruptions.allow_interruptions'),
          min_interruption_duration: formValues.advancedSettings?.interruption?.minInterruptionDuration ?? getFallback(null, 'interruptions.min_interruption_duration'),
          min_interruption_words: formValues.advancedSettings?.interruption?.minInterruptionWords ?? getFallback(null, 'interruptions.min_interruption_words'),
          drop_filler_words: formValues.advancedSettings?.interruption?.dropFillerWords ?? false,
          filler_drop_list: formValues.advancedSettings?.interruption?.fillerDropList ?? [],
        },
        interruption_mode: formValues.advancedSettings?.session?.interruption_mode ?? null,
        adaptive_stt: formValues.advancedSettings?.session?.interruption_mode === 'adaptive',
        ...(formValues.advancedSettings?.session?.interruption_mode === 'adaptive' && {
          adaptive_min_duration: formValues.advancedSettings.interruption?.adaptiveMinDuration ?? 0.8,
          adaptive_min_words: formValues.advancedSettings.interruption?.adaptiveMinWords ?? 0,
          adaptive_discard_audio_if_uninterruptible: formValues.advancedSettings.interruption?.adaptiveDiscardAudioIfUninterruptible ?? true,
          adaptive_resume_false_interruption: formValues.advancedSettings.interruption?.adaptiveResumeFalseInterruption ?? true,
          adaptive_false_interruption_timeout: formValues.advancedSettings.interruption?.adaptiveFalseInterruptionTimeout ?? 0.5,
          adaptive_backchannel_boundary_start: formValues.advancedSettings.interruption?.adaptiveBackchannelBoundaryStart ?? 0.1,
          adaptive_backchannel_boundary_end: formValues.advancedSettings.interruption?.adaptiveBackchannelBoundaryEnd ?? 2,
        }),
        first_message_mode: firstMessageModeConfig,
        first_message: firstMessageModeConfig.first_message,
        turn_detection: formValues.advancedSettings?.session?.turn_detection || getFallback(null, 'session_behavior.turn_detection'),
        session_behavior: {
          preemptive_generation: formValues.advancedSettings?.session?.preemptiveGeneration || getFallback(null, 'session_behavior.preemptive_generation'),
          turn_detection: formValues.advancedSettings?.session?.turn_detection || getFallback(null, 'session_behavior.turn_detection'),
          unlikely_threshold: formValues.advancedSettings?.session?.unlikely_threshold ?? getFallback(null, 'session_behavior.unlikely_threshold'),
          min_endpointing_delay: formValues.advancedSettings?.session?.min_endpointing_delay ?? getFallback(null, 'session_behavior.min_endpointing_delay'),
          max_endpointing_delay: formValues.advancedSettings?.session?.max_endpointing_delay ?? getFallback(null, 'session_behavior.max_endpointing_delay'),
          ...(formValues.advancedSettings?.session?.endpointing_mode && {
            endpointing_mode: formValues.advancedSettings.session.endpointing_mode
          }),
          ...(formValues.advancedSettings?.session?.interruption_mode && {
            interruption_mode: formValues.advancedSettings.session.interruption_mode
          }),
          ...(formValues.advancedSettings?.session?.user_away_timeout !== undefined && {
            user_away_timeout: formValues.advancedSettings.session.user_away_timeout
          }),
          ...(formValues.advancedSettings?.session?.user_away_timeout_message !== undefined && formValues.advancedSettings.session.user_away_timeout_message !== null && {
            user_away_timeout_message: formValues.advancedSettings.session.user_away_timeout_message
          }),
          ...(formValues.advancedSettings?.session?.user_away_timeout_max_count !== undefined && {
            user_away_timeout_max_count: formValues.advancedSettings.session.user_away_timeout_max_count
          }),
          ...(formValues.advancedSettings?.session?.user_away_timeout_end_message !== undefined && formValues.advancedSettings.session.user_away_timeout_end_message !== null && formValues.advancedSettings.session.user_away_timeout_end_message !== '' && {
            user_away_timeout_end_message: formValues.advancedSettings.session.user_away_timeout_end_message
          })
        },
        background_audio: {
          enabled: formValues.advancedSettings?.backgroundAudio?.mode !== 'disabled',
          thinking_probability: formValues.advancedSettings?.backgroundAudio?.thinkingProbability ?? 1.0,
          tool_call_typing_config: {
            enabled: formValues.advancedSettings?.backgroundAudio?.toolCallTyping ?? false,
            volume: formValues.advancedSettings?.backgroundAudio?.toolCallVolume ?? 0.8
          },
          ...(formValues.advancedSettings?.backgroundAudio?.mode === 'single' && {
            type: formValues.advancedSettings.backgroundAudio.singleType,
            volume: formValues.advancedSettings.backgroundAudio.singleVolume,
            timing: formValues.advancedSettings.backgroundAudio.singleTiming
          }),
          ...(formValues.advancedSettings?.backgroundAudio?.mode === 'dual' && {
            ambient: {
              type: formValues.advancedSettings.backgroundAudio.ambientType,
              volume: formValues.advancedSettings.backgroundAudio.ambientVolume
            },
            thinking: {
              type: formValues.advancedSettings.backgroundAudio.thinkingType,
              volume: formValues.advancedSettings.backgroundAudio.thinkingVolume
            }
          })
        },
        ...(formValues.dynamic_tts && formValues.dynamic_tts.length > 0 && {
          dynamic_tts: formValues.dynamic_tts
        }),
        fallback_global_enabled: !!formValues.fallbackGlobalEnabled,
      }
    })

    return buildAgentEnvelope(agentName, agentType, assistants)
  }, [
    assistantNames, 
    assistantsData,
    getAssistantData,
    agentName,
    agentType,
    currentFormik,
    currentTtsConfig,
    currentSttConfig,
    currentAzureConfig,
    fallbackAzureConfig
  ])

  const registerFormikRef = useCallback((assistantName: string, formikRef: FormikProps<any>) => {
    updateAssistantData(assistantName, { formikRef })
  }, [updateAssistantData])

  const updateTTSConfig = useCallback((assistantName: string, ttsConfig: any) => {
    updateAssistantData(assistantName, { ttsConfig, hasUnsavedChanges: true })
  }, [updateAssistantData])

  const updateSTTConfig = useCallback((assistantName: string, sttConfig: any) => {
    updateAssistantData(assistantName, { sttConfig, hasUnsavedChanges: true })
  }, [updateAssistantData])

  const updateAzureConfig = useCallback((assistantName: string, azureConfig: any) => {
    updateAssistantData(assistantName, { azureConfig, hasUnsavedChanges: true })
  }, [updateAssistantData])

  const hasUnsavedChanges = useMemo(() => {
    const mapHasChanges = Array.from(assistantsData.values()).some(data => data.hasUnsavedChanges)
    return mapHasChanges || (currentFormik?.dirty ?? false)
  }, [assistantsData, currentFormik])

  const resetUnsavedChanges = useCallback(() => {
    setAssistantsData(prev => {
      const newMap = new Map(prev)
      newMap.forEach((data, name) => {
        newMap.set(name, { ...data, hasUnsavedChanges: false })
      })
      return newMap
    })
  }, [])

  const addAssistant = useCallback((name: string) => {
    setAssistantNames(prev => [...prev, name])
    updateAssistantData(name, {
      name,
      hasUnsavedChanges: true,
      isConfigured: false
    })
  }, [updateAssistantData])

  const removeAssistant = useCallback((name: string) => {
    setAssistantNames(prev => prev.filter(n => n !== name))
    setAssistantsData(prev => {
      const newMap = new Map(prev)
      newMap.delete(name)
      return newMap
    })
  }, [])

  return {
    buildSavePayload,
    assistantNames,
    assistantsData,
    hasUnsavedChanges,
    addAssistant,
    removeAssistant,
    registerFormikRef,
    updateTTSConfig,
    updateSTTConfig,
    updateAzureConfig,
    resetUnsavedChanges,
    getAssistantData,
    updateAssistantData
  }
}