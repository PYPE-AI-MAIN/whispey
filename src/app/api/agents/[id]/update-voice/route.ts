// Public API to update agent voice for playground
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const body = await request.json()
    const { voiceId, voiceName } = body

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      )
    }

    if (!voiceId) {
      return NextResponse.json(
        { error: 'Voice ID is required' },
        { status: 400 }
      )
    }

    // Get agent data
    const { data: agent, error: agentError } = await supabase
      .from('pype_voice_agents')
      .select('name, configuration')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Sanitize agent ID
    const sanitizedAgentId = agentId.replace(/-/g, '_')
    const agentNameWithId = `${agent.name}_${sanitizedAgentId}`

    // Get current agent config from backend to preserve existing structure
    const configApiUrl = `${process.env.NEXT_PUBLIC_PYPEAI_API_URL}/agent_config/${agentNameWithId}`
    let existingConfig = null
    
    try {
      const configResponse = await fetch(configApiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'pype-api-v1'
        }
      })
      
      if (configResponse.ok) {
        existingConfig = await configResponse.json()
      }
    } catch (error) {
      console.warn('Could not fetch existing config, will create new structure:', error)
    }

    // Build agent config body - merge with existing or create new
    let agentConfigBody: any
    
    if (existingConfig?.agent?.assistant?.[0]) {
      // Merge with existing config
      agentConfigBody = {
        agent: {
          ...existingConfig.agent,
          assistant: [{
            ...existingConfig.agent.assistant[0],
            tts: {
              name: 'elevenlabs',
              voice_id: voiceId,
              model: 'eleven_flash_v2_5',
              language: 'en',
              voice_settings: {
                similarity_boost: 1,
                stability: 0.8,
                style: 1,
                use_speaker_boost: true,
                speed: 1.05
              }
            }
          }]
        }
      }
    } else {
      // Create new structure
      agentConfigBody = {
        agent: {
          name: agentNameWithId,
          assistant: [{
            tts: {
              name: 'elevenlabs',
              voice_id: voiceId,
              model: 'eleven_flash_v2_5',
              language: 'en',
              voice_settings: {
                similarity_boost: 1,
                stability: 0.8,
                style: 1,
                use_speaker_boost: true,
                speed: 1.05
              }
            }
          }]
        }
      }
    }

    // Update agent config via backend API first
    const backendResponse = await fetch(configApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'pype-api-v1'
      },
      body: JSON.stringify(agentConfigBody)
    })

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text()
      console.error('Backend API error:', errorText)
      return NextResponse.json(
        { error: 'Failed to update agent configuration', details: errorText },
        { status: backendResponse.status }
      )
    }

    // Update in database (store simplified config)
    const currentConfig = agent.configuration || {}
    const updatedConfig = {
      ...currentConfig,
      tts: {
        name: 'elevenlabs',
        provider: 'elevenlabs',
        voice_id: voiceId,
        model: 'eleven_flash_v2_5',
        language: 'en',
        voice_settings: {
          similarity_boost: 1,
          stability: 0.8,
          style: 1,
          use_speaker_boost: true,
          speed: 1.05
        }
      }
    }

    const { error: updateError } = await supabase
      .from('pype_voice_agents')
      .update({ 
        configuration: updatedConfig,
        updated_at: new Date().toISOString()
      })
      .eq('id', agentId)

    if (updateError) {
      console.error('Error updating agent config in database:', updateError)
      // Don't fail - backend update succeeded
    }

    return NextResponse.json({ 
      success: true,
      message: 'Voice updated successfully'
    })

  } catch (error) {
    console.error('Error updating voice:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
