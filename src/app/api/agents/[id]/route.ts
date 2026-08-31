// src/app/api/agents/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { serviceAuthHeaders } from '@/lib/serviceToken'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getPypeApiBaseUrlForServer } from '@/lib/pypeApiFetch'
import { normalizeAgentDisplayName } from '@/lib/agentDisplayName'
import { parseExtractorKeys, validateFlagRules } from '@/lib/flagRulesValidation'

// GET method to fetch agent details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServiceRoleClient()
    const { id: agentId } = await params

    // Fetch agent data from database
    const { data: agent, error } = await supabase
      .from('pype_voice_agents')
      .select('*')
      .eq('id', agentId)
      .single()

    if (error) {
      console.error('❌ Supabase error:', error)
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    const projectId = agent.project_id
    const roleResult = projectId ? await getProjectRoleForApi(projectId) : null
    const isViewer = roleResult?.role === 'viewer'
    const visibility = roleResult?.visibility
    // Include field_extractor/metrics for non-viewers, or for viewers when permissions.visibility grants it (Supabase).
    const allowFieldExtractor = !isViewer || visibility?.org?.fieldExtractor === true
    const allowMetrics = !isViewer || visibility?.org?.metrics === true

    const agentResponse: Record<string, unknown> = {
      id: agent.id,
      name: agent.name,
      display_name: agent.display_name ?? null,
      agent_type: agent.agent_type,
      configuration: agent.configuration,
      project_id: agent.project_id,
      environment: agent.environment,
      is_active: agent.is_active,
      created_at: agent.created_at,
      updated_at: agent.updated_at,
      user_id: agent.user_id,
      has_vapi_keys: Boolean(agent.vapi_api_key_encrypted && agent.vapi_project_key_encrypted),
      vapi_api_key_encrypted: agent.vapi_api_key_encrypted,
      vapi_project_key_encrypted: agent.vapi_project_key_encrypted,
    }
    if (allowFieldExtractor) {
      agentResponse.field_extractor = agent.field_extractor
      agentResponse.field_extractor_prompt = agent.field_extractor_prompt
      agentResponse.field_extractor_keys = agent.field_extractor_keys
      agentResponse.field_extractor_variables = agent.field_extractor_variables || {}
      agentResponse.flag_rules = agent.flag_rules || null
    }
    if (allowMetrics) {
      agentResponse.metrics = agent.metrics ?? null
    }

    return NextResponse.json(agentResponse)

  } catch (error) {
    console.error('💥 Error fetching agent:', error)
    return NextResponse.json(
      { error: `Failed to fetch agent: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

// Gated fields → the visibility flag a viewer needs set to `true` to edit them.
// `name` is deliberately absent (immutable); `display_name` is handled separately.
const GATED_FIELDS = {
  field_extractor_prompt: 'fieldExtractor',
  field_extractor: 'fieldExtractor',
  field_extractor_variables: 'fieldExtractor',
  flag_rules: 'fieldExtractor', // same sensitivity as field extractor internals
  metrics: 'metrics',
} as const

type RoleResult = NonNullable<Awaited<ReturnType<typeof getProjectRoleForApi>>>
type BuildResult =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; error: string; status: number }

/** Normalize display_name; returns the value to store or an error result. */
function resolveDisplayNameField(
  body: Record<string, unknown>,
  isViewer: boolean
): { value: string | null } | { error: string; status: number } {
  if (isViewer) return { error: 'Forbidden', status: 403 }
  try {
    return { value: normalizeAgentDisplayName(body.display_name) }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Invalid display_name', status: 400 }
  }
}

/**
 * Build the validated PATCH payload, enforcing per-field role/visibility rules.
 * `display_name` is handled outside the loop (it needs normalization); `name`
 * is intentionally not patchable — the backend identity is derived from it.
 * `existingFieldExtractorPrompt` cross-checks flag_rules field references against
 * whatever field_extractor_prompt this same request submits, falling back to the
 * agent's existing one.
 */
// Validate flag_rules against the field-extractor keys from this request (falling back to
// the agent's stored prompt). Returns a user-facing error message, or null when valid.
function flagRulesError(body: Record<string, unknown>, existingFieldExtractorPrompt: unknown): string | null {
  const extractorSource = 'field_extractor_prompt' in body ? body.field_extractor_prompt : existingFieldExtractorPrompt
  const validationError = validateFlagRules(body.flag_rules, parseExtractorKeys(extractorSource))
  return validationError ? `Invalid flag_rules: ${validationError}` : null
}

function buildAgentUpdatePayload(
  body: Record<string, unknown>,
  roleResult: RoleResult,
  existingFieldExtractorPrompt: unknown
): BuildResult {
  const isViewer = roleResult.role === 'viewer'
  const org = roleResult.visibility?.org
  const payload: Record<string, unknown> = {}

  if ('display_name' in body) {
    const r = resolveDisplayNameField(body, isViewer)
    if ('error' in r) return { ok: false, error: r.error, status: r.status }
    payload.display_name = r.value
  }

  for (const [key, gate] of Object.entries(GATED_FIELDS)) {
    if (!(key in body)) continue
    if (isViewer && org?.[gate] !== true) return { ok: false, error: 'Forbidden', status: 403 }
    if (key === 'flag_rules') {
      const err = flagRulesError(body, existingFieldExtractorPrompt)
      if (err) return { ok: false, error: err, status: 400 }
    }
    payload[key] = body[key]
  }

  if (Object.keys(payload).length === 0) {
    return { ok: false, error: 'No valid fields to update', status: 400 }
  }
  return { ok: true, payload }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServiceRoleClient()
    const { id: agentId } = await params
    if (!agentId) {
      return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 })
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { data: agent, error: fetchErr } = await supabase
      .from('pype_voice_agents')
      .select('project_id, field_extractor_prompt')
      .eq('id', agentId)
      .single()

    if (fetchErr || !agent?.project_id) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const projectId = agent.project_id as string
    const roleResult = await getProjectRoleForApi(projectId)
    if (!roleResult) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const built = buildAgentUpdatePayload(body, roleResult, agent.field_extractor_prompt)
    if (!built.ok) {
      return NextResponse.json({ error: built.error }, { status: built.status })
    }
    const updatePayload = built.payload
    updatePayload.updated_at = new Date().toISOString()

    const { error: updateErr } = await supabase
      .from('pype_voice_agents')
      .update(updatePayload)
      .eq('id', agentId)

    if (updateErr) {
      console.error('Agent PATCH error:', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Agent PATCH:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// DELETE method to remove agent and all related data
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServiceRoleClient()
    const { id: agentId } = await params

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID is required' },
        { status: 400 }
      )
    }

    // Get clerk_id for quota update
    const { userId: clerkId } = await auth()
    if (!clerkId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get agent details before deletion (we need name for backend deletion and project_id for quota update)
    const { data: agentData, error: agentFetchError } = await supabase
      .from('pype_voice_agents')
      .select('name, project_id, configuration')
      .eq('id', agentId)
      .single()

    if (agentFetchError || !agentData) {
      console.warn('⚠️ Could not fetch agent details:', agentFetchError)
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    const projectId = agentData.project_id
    if (!projectId) {
      console.error('❌ Agent has no project_id associated')
      return NextResponse.json(
        { error: 'Agent has no associated project' },
        { status: 400 }
      )
    }

    // Start cascade deletion process

    // 1. Delete call logs for this agent
    const { error: callLogsError } = await supabase
      .from('pype_voice_call_logs')
      .delete()
      .eq('agent_id', agentId)

    if (callLogsError) {
      console.error('Error deleting call logs:', callLogsError)
      return NextResponse.json(
        { error: 'Failed to delete call logs' },
        { status: 500 }
      )
    }
    console.log('Successfully deleted call logs')

    // 2. Delete metrics logs (adjust based on your schema relationships)
    const { error: metricsError } = await supabase
      .from('pype_voice_metrics_logs')
      .delete()
      .eq('session_id', agentId) // Adjust this field based on your actual schema

    // Don't fail if metrics logs have different relationships
    if (metricsError) {
      console.warn('Warning: Could not delete metrics logs:', metricsError)
    } else {
      console.log('Successfully deleted metrics logs')
    }

    console.log('Successfully deleted auth tokens')

    // 4. Finally, delete the agent itself
    const { error: agentError } = await supabase
      .from('pype_voice_agents')
      .delete()
      .eq('id', agentId)

    if (agentError) {
      console.error('Error deleting agent:', agentError)
      return NextResponse.json(
        { error: 'Failed to delete agent' },
        { status: 500 }
      )
    }
    
    console.log(`Successfully deleted agent: ${agentId}`)

    // 5. Delete from backend — branch on Pipecat vs LiveKit
    if (agentData?.name) {
      try {
        const pipecatAgentId = agentData.configuration?.pipecat_agent_id
        const isPipecat = !!pipecatAgentId

        if (isPipecat) {
          console.log('🔄 Deleting Pipecat agent:', pipecatAgentId)
          const pipecatBaseUrl = process.env.PIPECAT_BASE_URL

          if (!pipecatBaseUrl) {
            console.error('❌ PIPECAT_BASE_URL not set')
          } else {
            const pipecatResponse = await fetch(`${pipecatBaseUrl}/v1/agents/${pipecatAgentId}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' }
            })

            if (pipecatResponse.ok) {
              console.log('✅ Pipecat agent deleted successfully')
            } else {
              const errorData = await pipecatResponse.text()
              console.error('❌ Pipecat delete failed:', pipecatResponse.status, errorData)
            }
          }

        } else {
          console.log('🔄 Deleting LiveKit agent from backend...')
          const sanitizedAgentId = agentId.replace(/-/g, '_')
          const agentNameWithId = `${agentData.name}_${sanitizedAgentId}`

          // Delete from whichever backend this agent actually lives on — read
          // back the target it was created with, since a container-based agent
          // only exists on the docker VM and deleting against classic is a no-op.
          const deploymentTarget = agentData.configuration?.deployment_target === 'docker' ? 'docker' : 'classic'
          const deleteBaseUrl = getPypeApiBaseUrlForServer(deploymentTarget)

          let backendDeleteResponse = await fetch(`${deleteBaseUrl}/delete_agent`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', ...serviceAuthHeaders() },
            body: JSON.stringify({ agent_name: agentNameWithId })
          })

          if (!backendDeleteResponse.ok) {
            console.log('🔄 First attempt failed, trying with name only:', agentData.name)
            backendDeleteResponse = await fetch(`${deleteBaseUrl}/delete_agent`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json', ...serviceAuthHeaders() },
              body: JSON.stringify({ agent_name: agentData.name })
            })
          }

          if (backendDeleteResponse.ok) {
            console.log('✅ LiveKit agent deleted from backend')
          } else {
            const errorData = await backendDeleteResponse.text()
            console.error('❌ Backend delete failed:', backendDeleteResponse.status, errorData)
          }
        }
      } catch (backendError) {
        console.error('❌ Backend delete error:', backendError)
      }
    } else {
      console.warn('⚠️ No agent name available for backend deletion')
    }

    // 6. Update project's agent quota state to reduce active count and remove agent
    try {
      console.log('🔄 Updating project agent quota state...')
      
      // Get current project state
      const { data: projectRow, error: fetchError } = await supabase
        .from('pype_voice_projects')
        .select('agent')
        .eq('id', projectId)
        .single()

      if (fetchError || !projectRow) {
        console.warn('⚠️ Could not fetch project state for quota update:', fetchError)
      } else {
        const currentState = (projectRow as any).agent
        if (currentState && currentState.agents) {
          // Remove the agent from the agents array and reduce active count
          const updatedAgents = currentState.agents.filter((agent: any) => agent.id !== agentId)
          const updatedState = {
            ...currentState,
            usage: {
              ...currentState.usage,
              active_count: Math.max(0, currentState.usage.active_count - 1)
            },
            agents: updatedAgents,
            last_updated: new Date().toISOString()
          }

          console.log('🔍 Updated project state:', JSON.stringify(updatedState, null, 2))

          const { error: updateError } = await supabase
            .from('pype_voice_projects')
            .update({ agent: updatedState })
            .eq('id', projectId)

          if (updateError) {
            console.error('❌ Failed to update project quota state:', updateError)
          } else {
            console.log('✅ Successfully updated project quota state')
          }
        }
      }
    } catch (quotaError) {
      console.error('❌ Error updating project quota state:', quotaError)
    }

    return NextResponse.json(
      { 
        message: 'Agent and all related data deleted successfully'
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Unexpected error during agent deletion:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}