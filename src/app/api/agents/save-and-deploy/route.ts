import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decryptWithWhispeyKey } from '@/lib/whispey-crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

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
    
    
    const apiUrl = `${process.env.NEXT_PUBLIC_PYPEAI_API_URL}/agent_config/${agentName}`
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'pype-api-v1'
      },
      body: JSON.stringify(agentConfigBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { 
          message: `Failed to deploy agent: ${response.status} ${response.statusText}`,
          error: errorText 
        },
        { status: response.status }
      )
    }

    const result = await response.json()    
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
          tools: formikValues.advancedSettings.tools.tools.map((tool: any) => ({
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
                parameters: tool.config.parameters
              } : tool.type === 'transfer_call' ? {
                transfer_number: tool.config.transferNumber,
                sip_outbound_trunk: tool.config.sipTrunkId
              } : {})
            } : {})
          })),
          filler_words: {
            enabled: formikValues.advancedSettings.fillers.enableFillerWords,
            general_fillers: formikValues.advancedSettings.fillers.generalFillers.filter((f: string) => f !== ''),
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
          turn_detection: formikValues.advancedSettings.session.turn_detection,
          session_behavior: {
            preemptive_generation: formikValues.advancedSettings.session.preemptiveGeneration || 'disabled',
            turn_detection: formikValues.advancedSettings.session.turn_detection,
            unlikely_threshold: formikValues.advancedSettings.session.unlikely_threshold,
            min_endpointing_delay: formikValues.advancedSettings.session.min_endpointing_delay,
            max_endpointing_delay: formikValues.advancedSettings.session.max_endpointing_delay,
            ...(formikValues.advancedSettings.session.user_away_timeout !== undefined && {
              user_away_timeout: formikValues.advancedSettings.session.user_away_timeout
            }),
            ...(formikValues.advancedSettings.session.user_away_timeout_message !== undefined && formikValues.advancedSettings.session.user_away_timeout_message !== null && formikValues.advancedSettings.session.user_away_timeout_message !== '' && {
              user_away_timeout_message: formikValues.advancedSettings.session.user_away_timeout_message
            })
          },
          interruptions: {
            allow_interruptions: formikValues.advancedSettings.interruption.allowInterruptions,
            min_interruption_duration: formikValues.advancedSettings.interruption.minInterruptionDuration,
            min_interruption_words: formikValues.advancedSettings.interruption.minInterruptionWords
          },
          first_message_mode: firstMessageModeConfig
        }
      ],
      agent_id: metadata.agentId
    }
  }
}