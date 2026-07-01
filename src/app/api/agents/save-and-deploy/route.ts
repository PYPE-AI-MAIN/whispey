import { NextRequest, NextResponse } from 'next/server'
import { decryptWithWhispeyKey } from '@/lib/whispey-crypto'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { serviceAuthHeaders } from '@/lib/serviceToken'
import {
  getPypeApiBaseUrlForServer,
  isPypeUpstreamUnreachable,
  pypeApiAbortSignal,
  PYPE_API_DEPLOY_TIMEOUT_MS,
} from '@/lib/pypeApiFetch'

const supabase = createServiceRoleClient()

function serializeLanguageSwitchSTTRoute(stt: any): any {
  if (!stt) return {}
  const out: any = { name: stt.name }
  if (stt.name === 'sarvam') {
    out.language = stt.language
    out.model = stt.model
    if (stt.adaptive_stt) out.adaptive_stt = true
    if (stt.mode) out.mode = stt.mode
    out.flush_signal = stt.flush_signal ?? true
  } else if (stt.name === 'deepgram') {
    out.language = stt.language
    out.model = stt.model
    if (stt.model?.startsWith('flux-general')) {
      if (stt.eot_threshold != null) out.eot_threshold = stt.eot_threshold
      if (stt.eager_eot_threshold != null) out.eager_eot_threshold = stt.eager_eot_threshold
      if (stt.eot_timeout_ms != null) out.eot_timeout_ms = stt.eot_timeout_ms
    } else {
      if (stt.endpointing_ms != null) out.endpointing_ms = stt.endpointing_ms
      if (stt.punctuate != null) out.punctuate = stt.punctuate
      if (stt.smart_format != null) out.smart_format = stt.smart_format
      if (stt.profanity_filter != null) out.profanity_filter = stt.profanity_filter
      if (stt.numerals != null) out.numerals = stt.numerals
      if (stt.keyterm?.length) out.keyterm = stt.keyterm
    }
  } else if (stt.name === 'google') {
    out.language = stt.language
    if (stt.model) out.model = stt.model
  }
  return out
}

function serializeLanguageSwitchTTSRoute(tts: any): any {
  if (!tts) return {}
  const out: any = { name: tts.name }
  if (tts.name === 'sarvam') {
    out.language = tts.language
    out.model = tts.model || 'bulbul:v3-beta'
    out.speaker = tts.speaker || tts.voice_id || ''
    if (tts.voice_settings) {
      out.voice_settings = {
        pace: tts.voice_settings.pace ?? 1,
        loudness: tts.voice_settings.loudness ?? 1,
        pitch: tts.voice_settings.pitch ?? 0,
        enable_preprocessing: tts.voice_settings.enable_preprocessing ?? false,
      }
    }
  } else if (tts.name === 'elevenlabs') {
    out.voice_id = tts.voice_id || ''
    out.model = tts.model || 'eleven_multilingual_v2'
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
  } else if (tts.name === 'google') {
    out.voice_name = tts.voice_name || ''
    if (tts.gender) out.gender = tts.gender
  }
  return out
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    let agentConfigBody
    let agentName
    let agentId: string | null = null
    let projectId: string | null = null
    
    // Check if it's the NEW structure (with agent object already built)
    if (body.agent && body.agent.assistant && Array.isArray(body.agent.assistant)) {
      agentName = body.agent.name || body.metadata?.agentName
      agentId = body.agent.agent_id || body.metadata?.agentId
      
      // Just pass through the agent object directly
      agentConfigBody = {
        agent: body.agent
      }      
    } 
    // Check if it's the OLD structure (needs transformation)
    else if (body.formikValues && body.metadata) {
      agentName = body.metadata.agentName
      agentId = body.metadata.agentId
      agentConfigBody = transformFormDataToAgentConfig(body)
    } 
    else {
      return NextResponse.json(
        { message: 'Invalid request structure. Expected either {agent: ...} or {formikValues: ...}' },
        { status: 400 }
      )
    }
    
    if (!agentName) {
      return NextResponse.json(
        { message: 'Agent name is required' },
        { status: 400 }
      )
    }

    // Validate agentName to prevent SSRF via path traversal.
    // Only allow alphanumeric characters, hyphens, and underscores.
    if (!/^[a-zA-Z0-9_-]+$/.test(agentName)) {
      return NextResponse.json(
        { message: 'Invalid agent name. Only alphanumeric characters, hyphens, and underscores are allowed.' },
        { status: 400 }
      )
    }

    // Fetch and decrypt API key from database
    if (agentId) {
      try {
        // Get agent record to find project_id
        const { data: agent, error: agentError } = await supabase
          .from('pype_voice_agents')
          .select('project_id, configuration')
          .eq('id', agentId)
          .single()

        if (!agentError && agent) {
          projectId = agent.project_id

          // Get API key from pype_voice_api_keys table
          if (projectId) {
            // Get the first API key for this project (most recent)
            const { data: apiKey, error: keyError } = await supabase
              .from('pype_voice_api_keys')
              .select('id, token_hash, token_hash_master')
              .eq('project_id', projectId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()

            if (!keyError && apiKey) {
              // Add to agent configuration
              if (agentConfigBody.agent) {
                // Store whispey_key_id (the database ID)
                if (apiKey.id) {
                  agentConfigBody.agent.whispey_key_id = apiKey.id
                }

                // Decrypt and store the API key
                if (apiKey.token_hash_master) {
                  try {
                    const decryptedKey = decryptWithWhispeyKey(apiKey.token_hash_master)
                    agentConfigBody.agent.whispey_api_key = decryptedKey
                    console.log('✅ Decrypted and stored whispey_api_key in agent config')
                  } catch (decryptError) {
                    console.error('❌ Failed to decrypt API key:', decryptError)
                    // Fallback: store token_hash if decryption fails
                    if (apiKey.token_hash) {
                      agentConfigBody.agent.token_hash = apiKey.token_hash
                    }
                  }
                } else if (apiKey.token_hash) {
                  // Fallback: use token_hash if token_hash_master not available
                  agentConfigBody.agent.token_hash = apiKey.token_hash
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching/decrypting API key:', error)
        // Don't fail the request, just log the error
      }
    }
    

    const baseUrl = getPypeApiBaseUrlForServer()
    if (!baseUrl) {
      console.error('❌ [save-and-deploy] No voice backend URL configured. Set PYPEAI_API_URL or NEXT_PUBLIC_PYPEAI_API_URL.')
      return NextResponse.json(
        { message: 'Voice backend URL is not configured. Set PYPEAI_API_URL or NEXT_PUBLIC_PYPEAI_API_URL.' },
        { status: 503 }
      )
    }

    const apiUrl = `${baseUrl}/agent_config/${encodeURIComponent(agentName)}`

    console.log('📤 [save-and-deploy] Sending to voice backend:', {
      url: apiUrl,
      agentName,
      agentId,
      assistantCount: agentConfigBody?.agent?.assistant?.length ?? 0,
      assistantNames: agentConfigBody?.agent?.assistant?.map((a: any) => a?.name) ?? [],
      payloadKeys: Object.keys(agentConfigBody?.agent ?? {}),
    })

    let response: Response
    const fetchStart = Date.now()
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...serviceAuthHeaders()
        },
        body: JSON.stringify(agentConfigBody),
        signal: pypeApiAbortSignal(PYPE_API_DEPLOY_TIMEOUT_MS),
      })
    } catch (fetchErr: unknown) {
      const elapsed = Date.now() - fetchStart
      const e = fetchErr as any
      console.error('❌ [save-and-deploy] Fetch threw after', elapsed, 'ms:', {
        name: e?.name,
        message: e?.message,
        causeCode: e?.cause?.code,
        url: apiUrl,
      })
      if (isPypeUpstreamUnreachable(fetchErr)) {
        return NextResponse.json(
          {
            message: 'Voice backend unreachable. The agent config could not be deployed because the voice backend did not respond.',
            backendUnavailable: true,
            debug: {
              url: apiUrl,
              elapsedMs: elapsed,
              errorName: e?.name,
              errorMessage: e?.message,
              causeCode: e?.cause?.code,
            },
          },
          { status: 503 }
        )
      }
      throw fetchErr
    }

    const elapsed = Date.now() - fetchStart
    console.log('📥 [save-and-deploy] Voice backend responded:', {
      status: response.status,
      statusText: response.statusText,
      elapsedMs: elapsed,
      url: apiUrl,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ [save-and-deploy] Voice backend returned error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        url: apiUrl,
      })
      return NextResponse.json(
        { 
          message: `Failed to deploy agent: ${response.status} ${response.statusText}`,
          error: errorText,
          debug: { url: apiUrl, status: response.status },
        },
        { status: response.status }
      )
    }

    const result = await response.json()
    console.log('✅ [save-and-deploy] Agent deployed successfully:', { agentName, elapsedMs: elapsed })

    return NextResponse.json({
      success: true,
      message: 'Agent deployed successfully',
      data: result
    })
    
  } catch (error: any) {    
    return NextResponse.json(
      { message: 'Failed to save and deploy agent', error: error.message },
      { status: 500 }
    )
  }
}


function transformFormDataToAgentConfig(formData: any) {
  const {
    formikValues,
    ttsConfiguration,
    sttConfiguration,
    llmConfiguration,
    agentSettings,
    assistantName,
    metadata
  } = formData

  console.log('🔄 Transforming OLD structure with formikValues:', {
    hasFormikValues: !!formikValues,
    hasTTS: !!ttsConfiguration,
    hasSTT: !!sttConfiguration,
    hasLLM: !!llmConfiguration
  })

  // Handle first_message_mode - ensure it's in the correct object format
  let firstMessageModeConfig
  if (typeof formikValues.firstMessageMode === 'object') {
    // New object format from form
    firstMessageModeConfig = {
      allow_interruptions: formikValues.firstMessageMode.allow_interruptions,
      mode: formikValues.firstMessageMode.mode,
      first_message: formikValues.firstMessageMode.first_message
    }
  } else {
    // Fallback for old string format - convert to object
    firstMessageModeConfig = {
      allow_interruptions: true,
      mode: formikValues.firstMessageMode || 'user_speaks_first',
      first_message: formikValues.customFirstMessage || ''
    }
  }

  return {
    agent: {
      name: metadata.agentName,
      type: "OUTBOUND",
      assistant: [
        {
          name: assistantName,
          prompt: agentSettings.prompt,
          variables: formikValues.variables ? 
          formikValues.variables.reduce((acc: any, variable: any) => {
            acc[variable.name] = variable.value;
            return acc;
          }, {}) : {},
          stt: {
            name: sttConfiguration.provider,
            language: sttConfiguration.config.language,
            model: sttConfiguration.model
          },
          llm: {
            name: llmConfiguration.provider,
            provider: llmConfiguration.provider,
            model: llmConfiguration.model,
            temperature: llmConfiguration.temperature,
          },
          tts: (() => {
            const ttsProvider = ttsConfiguration.provider
            const isSarvam = ttsProvider === 'sarvam' || ttsProvider === 'sarvam_tts'
            
            if (isSarvam) {
              // Sarvam TTS configuration - using ElevenLabs format
              const targetLanguageCode = ttsConfiguration.config.target_language_code || "en-IN"
              const sarvamSpeed = ttsConfiguration.config.speed ?? 1.0
              const sarvamLoudness = ttsConfiguration.config.loudness ?? 1.0
              
              return {
                name: ttsProvider,
                voice_id: ttsConfiguration.voiceId,
                model: ttsConfiguration.model,
                language: targetLanguageCode, // Map target_language_code to language
                voice_settings: {
                  similarity_boost: 1, // Default for Sarvam
                  stability: 0.8, // Default for Sarvam
                  style: 1, // Default for Sarvam
                  use_speaker_boost: true, // Default for Sarvam
                  speed: sarvamSpeed, // Map speed from Sarvam config
                  loudness: sarvamLoudness, // Include loudness in voice_settings
                  enable_preprocessing: ttsConfiguration.config.enable_preprocessing ?? true
                }
              }
            } else {
              // ElevenLabs or other TTS configuration
              return {
                name: ttsProvider,
                voice_id: ttsConfiguration.voiceId,
                model: ttsConfiguration.model,
                language: ttsConfiguration.config.language || "en",
                voice_settings: {
                  similarity_boost: ttsConfiguration.config.similarityBoost || 1,
                  stability: ttsConfiguration.config.stability || 0.7,
                  style: ttsConfiguration.config.style || 0.7,
                  use_speaker_boost: ttsConfiguration.config.useSpeakerBoost || false,
                  speed: ttsConfiguration.config.speed || 1.15
                }
              }
            }
          })(),
          vad: {
            name: formikValues.advancedSettings.vad.vadProvider,
            ...(formikValues.advancedSettings.vad.minSilenceDuration !== undefined && {
              min_silence_duration: formikValues.advancedSettings.vad.minSilenceDuration
            }),
            ...(formikValues.advancedSettings.vad.minSpeechDuration !== undefined && {
              min_speech_duration: formikValues.advancedSettings.vad.minSpeechDuration
            }),
            ...(formikValues.advancedSettings.vad.prefixPaddingDuration !== undefined && {
              prefix_padding_duration: formikValues.advancedSettings.vad.prefixPaddingDuration
            }),
            ...(formikValues.advancedSettings.vad.maxBufferedSpeech !== undefined && {
              max_buffered_speech: formikValues.advancedSettings.vad.maxBufferedSpeech
            }),
            ...(formikValues.advancedSettings.vad.activationThreshold !== undefined && {
              activation_threshold: formikValues.advancedSettings.vad.activationThreshold
            }),
            ...(formikValues.advancedSettings.vad.sampleRate !== undefined && {
              sample_rate: formikValues.advancedSettings.vad.sampleRate
            }),
            ...(formikValues.advancedSettings.vad.forceCpu !== undefined && {
              force_cpu: formikValues.advancedSettings.vad.forceCpu
            })
          },
          tools: [
            ...formikValues.advancedSettings.tools.tools.map((tool: any) => ({
            type: tool.type,
            ...(tool.type !== 'end_call' ? {
              name: tool.name,
              description: tool.config.description,
              ...(tool.type === 'custom_function' ? {
                api_url: tool.config.endpoint,
                http_method: tool.config.method,
                timeout: tool.config.timeout,
                async: tool.config.asyncExecution,
                headers: tool.config.headers,
                parameters: tool.config.parameters,
                filler_config: tool.config.filler_config ?? null,
              } : tool.type === 'transfer_call' ? {
                transfer_number: tool.config.transferNumber,
                sip_outbound_trunk: tool.config.sipTrunkId,
                acefone_token: tool.config.acefoneToken || null,
                pre_transfer_webhook_url: tool.config.preTransferWebhookUrl || null,
                pre_transfer_webhook_fields: tool.config.preTransferWebhookFields || null,
                // Trigger-mode flags. Defaults preserve old behavior:
                //   enable_as_tool defaults to true  (current tool-based trigger)
                //   enable_as_tag  defaults to false (new <transfer/> tag trigger)
                enable_as_tool: tool.config.enableAsTool !== false,
                enable_as_tag:  tool.config.enableAsTag === true,
              } : {})
            } : {})
          })),
            ...(formikValues.advancedSettings.tools.languageSwitchTools || []).map((ls: any) => {
              const entry: any = {
                type: 'language_switch',
                tool_name: ls.tool_name,
                description: ls.description,
                language_code: ls.language_code,
                system_message: ls.system_message,
                allow_interruptions: ls.allow_interruptions,
                switch_stt: ls.switch_stt ?? true,
                switch_tts: ls.switch_tts ?? true,
                stt: serializeLanguageSwitchSTTRoute(ls.stt),
                tts: serializeLanguageSwitchTTSRoute(ls.tts),
              }
              if (ls.allow_interruptions) entry.interruption = ls.interruption ?? true
              return entry
            }),
          ],
          filler_words: {
            enabled: (formikValues.advancedSettings.fillers.enableFillerWords ?? false) && [
              ...(formikValues.advancedSettings.fillers.generalFillers ?? []),
              ...(formikValues.advancedSettings.fillers.questionFillers ?? []),
              ...(formikValues.advancedSettings.fillers.ambiguousFillers ?? []),
            ].some((w: string) => w !== ''),
            language: formikValues.advancedSettings.fillers.language ?? 'auto',
            question_keywords: formikValues.advancedSettings.fillers.questionKeywords?.filter((f: string) => f !== '') ?? [],
            question_fillers: formikValues.advancedSettings.fillers.questionFillers?.filter((f: string) => f !== '') ?? [],
            ambiguous_keywords: formikValues.advancedSettings.fillers.ambiguousKeywords?.filter((f: string) => f !== '') ?? [],
            ambiguous_fillers: formikValues.advancedSettings.fillers.ambiguousFillers?.filter((f: string) => f !== '') ?? [],
            general_fillers: formikValues.advancedSettings.fillers.generalFillers.filter((f: string) => f !== ''),
            typing_probability: formikValues.advancedSettings.backgroundAudio?.thinkingProbability ?? 0.10,
            filler_cooldown_sec: formikValues.advancedSettings.fillers.fillerCooldownSec ?? 4.0,
            latency_threshold: formikValues.advancedSettings.fillers.latencyThreshold ?? 1.2,
            conversation_fillers: formikValues.advancedSettings.fillers.conversationFillers.filter((f: string) => f !== ''),
            conversation_keywords: formikValues.advancedSettings.fillers.conversationKeywords.filter((f: string) => f !== '')
          },
          bug_reports: {
            enable: formikValues.advancedSettings.bugs.enableBugReport,
            bug_start_command: formikValues.advancedSettings.bugs.bugStartCommands,
            bug_end_command: formikValues.advancedSettings.bugs.bugEndCommands,
            response: formikValues.advancedSettings.bugs.initialResponse,
            collection_prompt: formikValues.advancedSettings.bugs.collectionPrompt
          },
          context_memory: {
            enabled: formikValues.advancedSettings.contextMemory?.enabled ?? false
          },
          turn_detection: formikValues.advancedSettings.session.turn_detection,
          session_behavior: {
            preemptive_generation: formikValues.advancedSettings.session.preemptiveGeneration || 'disabled',
            turn_detection: formikValues.advancedSettings.session.turn_detection,
            unlikely_threshold: formikValues.advancedSettings.session.unlikely_threshold,
            min_endpointing_delay: formikValues.advancedSettings.session.min_endpointing_delay,
            max_endpointing_delay: formikValues.advancedSettings.session.max_endpointing_delay,
            ...(formikValues.advancedSettings.session.endpointing_mode && {
              endpointing_mode: formikValues.advancedSettings.session.endpointing_mode
            }),
            ...(formikValues.advancedSettings.session.interruption_mode && {
              interruption_mode: formikValues.advancedSettings.session.interruption_mode
            }),
            ...(formikValues.advancedSettings.session.user_away_timeout !== undefined && {
              user_away_timeout: formikValues.advancedSettings.session.user_away_timeout
            }),
            ...(formikValues.advancedSettings.session.user_away_timeout_message !== undefined && formikValues.advancedSettings.session.user_away_timeout_message !== null && formikValues.advancedSettings.session.user_away_timeout_message !== '' && {
              user_away_timeout_message: formikValues.advancedSettings.session.user_away_timeout_message
            }),
            ...(formikValues.advancedSettings.session.user_away_timeout_max_count !== undefined && {
              user_away_timeout_max_count: formikValues.advancedSettings.session.user_away_timeout_max_count
            }),
            ...(formikValues.advancedSettings.session.user_away_timeout_end_message !== undefined && formikValues.advancedSettings.session.user_away_timeout_end_message !== null && formikValues.advancedSettings.session.user_away_timeout_end_message !== '' && {
              user_away_timeout_end_message: formikValues.advancedSettings.session.user_away_timeout_end_message
            })
          },
          interruptions: {
            allow_interruptions: formikValues.advancedSettings.interruption.allowInterruptions,
            min_interruption_duration: formikValues.advancedSettings.interruption.minInterruptionDuration,
            min_interruption_words: formikValues.advancedSettings.interruption.minInterruptionWords,
            drop_filler_words: formikValues.advancedSettings.interruption.dropFillerWords ?? false,
            filler_drop_list: formikValues.advancedSettings.interruption.fillerDropList ?? [],
          },
          interruption_mode: formikValues.advancedSettings.session.interruption_mode ?? null,
          adaptive_stt: formikValues.advancedSettings.session.interruption_mode === 'adaptive',
          ...(formikValues.advancedSettings.session.interruption_mode === 'adaptive' && {
            adaptive_min_duration: formikValues.advancedSettings.interruption.adaptiveMinDuration ?? 0.5,
            adaptive_min_words: formikValues.advancedSettings.interruption.adaptiveMinWords ?? 0,
            adaptive_discard_audio_if_uninterruptible: formikValues.advancedSettings.interruption.adaptiveDiscardAudioIfUninterruptible ?? true,
            adaptive_resume_false_interruption: formikValues.advancedSettings.interruption.adaptiveResumeFalseInterruption ?? true,
            adaptive_false_interruption_timeout: formikValues.advancedSettings.interruption.adaptiveFalseInterruptionTimeout ?? 2.0,
            adaptive_backchannel_boundary_start: formikValues.advancedSettings.interruption.adaptiveBackchannelBoundaryStart ?? 1.0,
            adaptive_backchannel_boundary_end: formikValues.advancedSettings.interruption.adaptiveBackchannelBoundaryEnd ?? 3.5,
          }),
          first_message_mode: firstMessageModeConfig
        }
      ],
      agent_id: metadata.agentId
    }
  }
}