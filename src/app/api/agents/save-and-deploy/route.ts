import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { agentName } = body.metadata
    console.log('🏷️ Agent name:', agentName)
    
    const agentConfigBody = transformFormDataToAgentConfig(body)
    console.log('🔄 Transformed config:', JSON.stringify(agentConfigBody, null, 2))
    
    // Log the exact URL and headers being sent
    const apiUrl = `${process.env.NEXT_PUBLIC_PYPEAI_API_URL}/agent_config/${agentName}`
    console.log('📡 API URL:', apiUrl)
    console.log('📦 Payload size:', JSON.stringify(agentConfigBody).length, 'characters')
    
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
      console.error('❌ PypeAI API Error Response:', errorText)
      console.error('❌ Response Headers:', [...response.headers.entries()])
      throw new Error(`PypeAI API error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    console.log('✅ PypeAI API Success:', result)
    return NextResponse.json(result)
    
  } catch (error: any) {
    console.error('❌ Save and deploy error:', error)
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
          tts: {
            name: ttsConfiguration.provider,
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
          },
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
          // NEW: interruptions as separate object (not individual fields)
          interruptions: {
            allow_interruptions: formikValues.advancedSettings.interruption.allowInterruptions,
            min_interruption_duration: formikValues.advancedSettings.interruption.minInterruptionDuration,
            min_interruption_words: formikValues.advancedSettings.interruption.minInterruptionWords
          },
          // NEW: first_message_mode as object
          first_message_mode: firstMessageModeConfig
        }
      ],
      agent_id: metadata.agentId
    }
  }
}