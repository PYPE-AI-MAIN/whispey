import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user (middleware already protects this route)
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    
    let agentConfigBody
    let agentName
    
    // Check if it's the NEW structure (with agent object already built)
    if (body.agent && body.agent.assistant && Array.isArray(body.agent.assistant)) {
      agentName = body.agent.name || body.metadata?.agentName
      
      // Just pass through the agent object directly
      agentConfigBody = {
        agent: body.agent
      }      
    } 
    // Check if it's the OLD structure (needs transformation)
    else if (body.formikValues && body.metadata) {
      agentName = body.metadata.agentName
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
            min_silence_duration: formikValues.advancedSettings.vad.minSilenceDuration
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