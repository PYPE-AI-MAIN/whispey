// Public API to update agent voice for playground
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { serviceAuthHeaders } from '@/lib/serviceToken'
import { getPypeApiBaseUrlForServer, pypeApiAbortSignal } from '@/lib/pypeApiFetch'
import { deployAgentConfig } from '@/lib/deployAgentConfig'

// Updating a running agent hot-reloads its worker on the backend (20-30s);
// don't let Vercel kill this route at the default 10-15s.
export const maxDuration = 60

const supabase = createServiceRoleClient()

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

    const baseUrl = getPypeApiBaseUrlForServer()
    if (!baseUrl) {
      console.error('❌ [update-voice] No voice backend URL configured. Set PYPEAI_API_URL or NEXT_PUBLIC_PYPEAI_API_URL.')
      return NextResponse.json(
        { error: 'Voice backend URL is not configured' },
        { status: 503 }
      )
    }

    const configApiUrl = `${baseUrl}/agent_config/${agentNameWithId}`
    let existingConfig: any = null

    // Prefer the last saved config version — the exact payload shape the
    // config page deploys successfully. The backend's GET copy is missing
    // fields (tools, filler_words, variables) that crash its file generator
    // ("'NoneType' object is not iterable") and make playground updates fail.
    const { data: lastVersion } = await supabase
      .from('pype_agent_config_versions')
      .select('config_snapshot')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastVersion?.config_snapshot) {
      try {
        existingConfig = typeof lastVersion.config_snapshot === 'string'
          ? JSON.parse(lastVersion.config_snapshot)
          : lastVersion.config_snapshot
      } catch { existingConfig = null }
    }

    // Fallback: read the current config from the backend
    if (!existingConfig?.agent?.assistant?.[0]) {
      try {
        const configResponse = await fetch(configApiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...serviceAuthHeaders()
          },
          signal: pypeApiAbortSignal()
        })

        if (configResponse.ok) {
          existingConfig = await configResponse.json()
        }
      } catch (error) {
        console.warn('Could not fetch existing config, will create new structure:', error)
      }
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

    // Deploy via the same shared path as save-and-deploy. Do NOT stop the
    // agent first: the backend's stopped-agent update path crashes with
    // "'NoneType' object is not iterable" and rolls back every time. The
    // running-agent path 502s (worker killed mid-hot-reload) but the update
    // often still lands — deployAgentConfig verifies that before failing.
    const deployResult = await deployAgentConfig(agentNameWithId, agentConfigBody)

    if (!deployResult.ok) {
      return NextResponse.json(
        {
          error: deployResult.unreachable
            ? 'Voice agent backend is unreachable, please try again'
            : 'Failed to update agent configuration',
          details: deployResult.errorText
        },
        { status: deployResult.status }
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
      message: 'Voice updated successfully',
      verified_after_error: deployResult.verifiedAfterError ?? false
    })

  } catch (error) {
    console.error('Error updating voice:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
