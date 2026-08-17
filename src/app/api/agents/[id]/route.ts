// src/app/api/agents/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { serviceAuthHeaders } from '@/lib/serviceToken'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getPypeApiBaseUrlForServer } from '@/lib/pypeApiFetch'

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

const PATCHABLE_AGENT_FIELDS = [
  'field_extractor_prompt',
  'field_extractor',
  'field_extractor_variables',
  'flag_rules',
  'metrics',
] as const

// Mirrors utils/flagRulesEngine.mjs in the analytics lambda — keep both in sync.
const FLAG_SOURCES = new Set(['field_extractor', 'call_log'])
const FLAG_MATCH_TYPES = new Set(['exact', 'starts_with', 'ends_with', 'contains'])
const FLAG_OPERATORS = new Set(['equals', 'not_equals', 'greater_than', 'less_than'])
const CALL_LOG_FIELD_ALLOWLIST = new Set([
  'duration_seconds',
  'customer_number',
  'call_status',
  'metadata.transfer_call_initiated',
])
const MAX_RULES = 50
const MAX_CONDITIONS_PER_RULE = 20

function parseExtractorKeys(raw: unknown): Set<string> {
  if (typeof raw !== 'string' || !raw) return new Set()
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(
      parsed.map((f: any) => f?.key).filter((k: unknown): k is string => typeof k === 'string' && k.length > 0)
    )
  } catch {
    return new Set()
  }
}

// Returns an error message, or null if valid. `extractorKeys` cross-checks exact
// field_extractor references so a typo'd field name is rejected at save time.
function validateFlagRules(flagRules: unknown, extractorKeys: Set<string>): string | null {
  if (flagRules === null) return null // clearing the config is allowed
  if (typeof flagRules !== 'object' || Array.isArray(flagRules)) return 'flag_rules must be an object'
  const cfg = flagRules as Record<string, unknown>

  if (typeof cfg.enabled !== 'boolean') return 'flag_rules.enabled must be a boolean'
  if (!Array.isArray(cfg.rules)) return 'flag_rules.rules must be an array'
  if (cfg.rules.length > MAX_RULES) return `flag_rules.rules cannot exceed ${MAX_RULES} rules`

  for (const [i, rule] of cfg.rules.entries()) {
    if (typeof rule !== 'object' || rule === null) return `rule ${i + 1} must be an object`
    const r = rule as Record<string, unknown>
    if (typeof r.id !== 'string' || !r.id) return `rule ${i + 1} is missing an id`
    if (r.reason !== undefined && r.reason !== null && typeof r.reason !== 'string') {
      return `rule ${i + 1} has an invalid reason`
    }
    if (!Array.isArray(r.conditions) || r.conditions.length === 0) {
      return `rule ${i + 1} must have at least one condition`
    }
    if (r.conditions.length > MAX_CONDITIONS_PER_RULE) {
      return `rule ${i + 1} cannot exceed ${MAX_CONDITIONS_PER_RULE} conditions`
    }

    for (const [j, condition] of r.conditions.entries()) {
      if (typeof condition !== 'object' || condition === null) return `rule ${i + 1}, condition ${j + 1} must be an object`
      const c = condition as Record<string, unknown>
      const source = (c.source as string) ?? 'field_extractor'
      const matchType = (c.matchType as string) ?? 'exact'
      const operator = (c.operator as string) ?? 'equals'

      if (!FLAG_SOURCES.has(source)) return `rule ${i + 1}, condition ${j + 1} has an invalid source`
      if (!FLAG_MATCH_TYPES.has(matchType)) return `rule ${i + 1}, condition ${j + 1} has an invalid matchType`
      if (!FLAG_OPERATORS.has(operator)) return `rule ${i + 1}, condition ${j + 1} has an invalid operator`
      if (typeof c.field !== 'string' || !c.field) return `rule ${i + 1}, condition ${j + 1} is missing a field`
      if (c.value === undefined || c.value === null || c.value === '') {
        return `rule ${i + 1}, condition ${j + 1} is missing a value`
      }

      if (source === 'call_log') {
        if (matchType !== 'exact') return `rule ${i + 1}, condition ${j + 1}: call_log fields only support exact matching`
        if (!CALL_LOG_FIELD_ALLOWLIST.has(c.field)) {
          return `rule ${i + 1}, condition ${j + 1}: "${c.field}" is not an allowed call log field`
        }
        if ((operator === 'greater_than' || operator === 'less_than') && Number.isNaN(Number(c.value))) {
          return `rule ${i + 1}, condition ${j + 1}: value must be numeric for ${operator}`
        }
      } else if (matchType === 'exact' && extractorKeys.size > 0 && !extractorKeys.has(c.field)) {
        return `rule ${i + 1}, condition ${j + 1}: "${c.field}" is not a defined field extractor key`
      }
    }
  }
  return null
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

    const isViewer = roleResult.role === 'viewer'
    const visibility = roleResult.visibility
    const allowFieldExtractor = !isViewer || visibility?.org?.fieldExtractor === true
    const allowMetrics = !isViewer || visibility?.org?.metrics === true

    const updatePayload: Record<string, unknown> = {}
    for (const key of PATCHABLE_AGENT_FIELDS) {
      if (key in body) {
        if (key === 'field_extractor_prompt' || key === 'field_extractor' || key === 'field_extractor_variables' || key === 'flag_rules') {
          if (!allowFieldExtractor) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
          }
        }
        if (key === 'metrics') {
          if (!allowMetrics) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
          }
        }
        if (key === 'flag_rules') {
          // Cross-check against whatever field_extractor_prompt this same request submits,
          // falling back to the agent's existing one — catches a rule referencing a field
          // that doesn't (or no longer) exists before it ever reaches the database.
          const extractorSource = 'field_extractor_prompt' in body ? body.field_extractor_prompt : agent.field_extractor_prompt
          const extractorKeys = parseExtractorKeys(extractorSource)
          const validationError = validateFlagRules(body.flag_rules, extractorKeys)
          if (validationError) {
            return NextResponse.json({ error: `Invalid flag_rules: ${validationError}` }, { status: 400 })
          }
        }
        updatePayload[key] = body[key]
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

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