// src/app/api/agents/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { encryptApiKey } from '@/lib/vapi-encryption'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { deriveAgentName, normalizeAgentDisplayName } from '@/lib/agentDisplayName'

const supabase = createServiceRoleClient()

async function createPipecatAgent(agentData: any, projectId: string, whispeyAgentId: string, whispeyApiKey: string) {
  const pipecatBaseUrl = process.env.PIPECAT_BASE_URL
  if (!pipecatBaseUrl) {
    throw new Error('PIPECAT_BASE_URL environment variable is not set')
  }

  const pipecatPayload = {
    id: whispeyAgentId,              // ✅ use Supabase UUID so both DBs share the same ID
    name: agentData.name,
    prompt: `You are a helpful voice assistant named ${agentData.display_name || agentData.name}. ${agentData.configuration?.description || 'Assist users with their queries in a friendly and professional manner.'}`,
    tools: ["transfer_call"],
    custom_tools: [],
    stt_language: "en-IN",
    stt_model: "saarika:v2.5",
    tts_voice_id: null,
    tts_model: "eleven_flash_v2_5",
    llm_model: "gpt-4.1-mini",
    transfer_number: "",
    whispey_api_key: whispeyApiKey,
    whispey_agent_id: whispeyAgentId
  }

  console.log('🔧 Creating Pipecat agent with payload:', pipecatPayload)

  const response = await fetch(`${pipecatBaseUrl}/v1/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pipecatPayload)
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Failed to create Pipecat agent' }))
    console.error('❌ Pipecat API Error:', response.status, errorData)
    throw new Error(`Pipecat API error: ${response.status} - ${JSON.stringify(errorData)}`)
  }

  const pipecatAgent = await response.json()
  console.log('✅ Pipecat agent created successfully:', pipecatAgent)
  
  return pipecatAgent
}

/**
 * Pick a free `name` for this project, starting from the label-derived prefix.
 * `name` collides easily once it is only the first 10 chars of a label, and the
 * caller-facing 409 ("Agent with name Front_Desk already exists") would be
 * baffling for someone who typed "Front Desk Reception" — so resolve it here.
 *
 * Digits can't be used as the suffix (backend agent names reject them), hence
 * letters. ponytail: fetches every name in the project rather than filtering in
 * SQL — projects are capped at a handful of agents, and a LIKE pattern would
 * have to escape the `_` that derived names are full of. No DB unique constraint
 * to race against either: a concurrent double-create can still land the same
 * prefix, which is harmless because the backend name carries the agent UUID.
 * Widen the suffix if a project ever needs >26 agents sharing a 10-char prefix.
 */
async function reserveAgentName(projectId: string, base: string): Promise<string | null> {
  const { data } = await supabase
    .from('pype_voice_agents')
    .select('name')
    .eq('project_id', projectId)

  const taken = new Set((data ?? []).map((row: { name: string }) => row.name))
  if (!taken.has(base)) return base
  for (const suffix of 'bcdefghijklmnopqrstuvwxyz') {
    const candidate = `${base}_${suffix}`
    if (!taken.has(candidate)) return candidate
  }
  return null
}

type AgentIdentity =
  | { ok: true; name: string; display_name: string | null }
  | { ok: false; error: string; status: number }

/**
 * Decide the immutable `name` and the human `display_name` for a new agent.
 *
 * Callers that send a free-text `display_name` (the create form) get `name`
 * derived from it here, so the stored backend identity is authoritative rather
 * than whatever the client computed. Callers that send only `name` (the connect
 * flows, and the voice backend registering itself) keep the original behaviour.
 */
async function resolveAgentIdentity(
  projectId: string,
  rawName: string,
  rawDisplayName: unknown
): Promise<AgentIdentity> {
  let label: string | null
  try {
    label = normalizeAgentDisplayName(rawDisplayName)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid display_name', status: 400 }
  }

  if (label) {
    const reserved = await reserveAgentName(projectId, deriveAgentName(label))
    if (!reserved) {
      return {
        ok: false,
        error: `Too many agents named like "${label}" in this project. Please pick a different name.`,
        status: 409,
      }
    }
    return { ok: true, name: reserved, display_name: label }
  }

  const { data: existingAgent, error: checkError } = await supabase
    .from('pype_voice_agents')
    .select('id, name')
    .eq('project_id', projectId)
    .eq('name', rawName.trim())
    .maybeSingle()

  if (checkError) {
    console.error('❌ Error checking existing agent:', checkError)
    return { ok: false, error: 'Failed to validate agent name', status: 500 }
  }
  if (existingAgent) {
    return {
      ok: false,
      error: `Agent with name "${rawName.trim()}" already exists in this project. Please choose a different name.`,
      status: 409,
    }
  }
  return { ok: true, name: rawName.trim(), display_name: null }
}

/** Returns an error message if the platform's config block is incomplete, else null. */
function validatePlatformConfig(platform: string, configuration: any): string | null {
  if (platform === 'vapi') {
    const v = configuration?.vapi
    if (!v?.apiKey || !v?.assistantId || !v?.projectApiKey) {
      return 'Vapi configuration is incomplete. Required: apiKey, assistantId, projectApiKey'
    }
  }
  if (platform === 'retell') {
    const r = configuration?.retell
    if (!r?.apiKey || !r?.agentId) {
      return 'Retell configuration is incomplete. Required: apiKey, agentId'
    }
  }
  return null
}

/** Encrypt vapi/retell secrets into agentData and strip them from the stored config. */
function applyPlatformCredentials(agentData: any, platform: string, configuration: any, projectId: string): void {
  if (platform === 'vapi' && configuration?.vapi) {
    agentData.vapi_api_key_encrypted = encryptApiKey(configuration.vapi.apiKey, projectId)
    agentData.vapi_project_key_encrypted = encryptApiKey(configuration.vapi.projectApiKey, projectId)
    const cleanConfiguration = { ...configuration }
    if (cleanConfiguration.vapi) {
      delete cleanConfiguration.vapi.apiKey
      delete cleanConfiguration.vapi.projectApiKey
      agentData.configuration = cleanConfiguration
    }
    console.log('🔐 Vapi API keys encrypted and stored securely')
  }

  if (platform === 'retell' && configuration?.retell) {
    agentData.retell_api_key_encrypted = encryptApiKey(configuration.retell.apiKey, projectId)
    agentData.configuration = {
      ...configuration,
      retell: {
        agentId:    configuration.retell.agentId,
        agentName:  configuration.retell.agentName,
        voiceId:    configuration.retell.voiceId,
        language:   configuration.retell.language,
        xPypeToken: configuration.retell.projectApiKey,
      },
    }
    console.log('🔐 Retell API key encrypted and stored securely')
  }
}

/** Resolve the project's whispey API key for Pipecat, falling back to the default. */
async function resolveWhispeyApiKey(projectId: string): Promise<string> {
  const { data: apiKeyRow, error: keyError } = await supabase
    .from('pype_voice_api_keys')
    .select('id, token_hash, token_hash_master')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!keyError && apiKeyRow?.token_hash_master) {
    try {
      const { decryptWithWhispeyKey } = await import('@/lib/whispey-crypto')
      return decryptWithWhispeyKey(apiKeyRow.token_hash_master)
    } catch (decryptError) {
      console.error('❌ Failed to decrypt API key, using fallback:', decryptError)
    }
  } else {
    console.log('🔍 Using fallback API key - keyError:', !!keyError, 'hasTokenHashMaster:', !!apiKeyRow?.token_hash_master)
  }
  return 'pype-api-v1'
}

/**
 * Create the Pipecat agent for an already-inserted Supabase row and store its id
 * back on the config. Returns an error message (caller responds 500) or null on
 * success. On failure the Supabase row is rolled back so we never leave an orphan.
 */
async function provisionPipecatAgent(agent: any, projectId: string): Promise<string | null> {
  try {
    const whispeyApiKey = await resolveWhispeyApiKey(projectId)
    const pipecatAgent = await createPipecatAgent(agent, projectId, agent.id, whispeyApiKey)

    const { error: updateError } = await supabase
      .from('pype_voice_agents')
      .update({ configuration: { ...agent.configuration, pipecat_agent_id: pipecatAgent.id } })
      .eq('id', agent.id)

    if (updateError) {
      // Non-fatal — agent is created, just log it
      console.error('❌ Failed to store pipecat_agent_id in Supabase:', updateError)
    } else {
      agent.configuration.pipecat_agent_id = pipecatAgent.id
      console.log('✅ pipecat_agent_id stored in Supabase configuration')
    }
    return null
  } catch (pipecatError) {
    console.error('❌ Failed to create Pipecat agent, rolling back Supabase record:', pipecatError)
    await supabase.from('pype_voice_agents').delete().eq('id', agent.id)
    return `Failed to create Pipecat agent: ${pipecatError instanceof Error ? pipecatError.message : 'Unknown error'}`
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, display_name, agent_type, configuration, project_id, environment, platform } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Agent name is required' }, { status: 400 })
    }

    if (!agent_type) {
      return NextResponse.json({ error: 'Agent type is required' }, { status: 400 })
    }

    if (!project_id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    const configError = validatePlatformConfig(platform, configuration)
    if (configError) {
      return NextResponse.json({ error: configError }, { status: 400 })
    }

    const { data: project, error: projectError } = await supabase
      .from('pype_voice_projects')
      .select('id')
      .eq('id', project_id)
      .single()

    if (projectError || !project) {
      console.error('Project lookup error:', projectError)
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 })
    }

    const identity = await resolveAgentIdentity(project_id, name, display_name)
    if (!identity.ok) {
      return NextResponse.json({ error: identity.error }, { status: identity.status })
    }

    const agentData: any = {
      name: identity.name,
      display_name: identity.display_name,
      agent_type,
      configuration: configuration || {},
      project_id,
      environment: environment || 'dev',
      is_active: true
    }

    applyPlatformCredentials(agentData, platform, configuration, project_id)

    // ✅ Step 1: Insert into Supabase first to get agent.id
    console.log('💾 Inserting agent data:', {
      ...agentData,
      vapi_api_key_encrypted: agentData.vapi_api_key_encrypted ? '[ENCRYPTED]' : undefined,
      vapi_project_key_encrypted: agentData.vapi_project_key_encrypted ? '[ENCRYPTED]' : undefined,
      retell_api_key_encrypted: agentData.retell_api_key_encrypted ? '[ENCRYPTED]' : undefined,
    })

    const { data: agent, error: agentError } = await supabase
      .from('pype_voice_agents')
      .insert([agentData])
      .select('*')
      .single()

    if (agentError) {
      console.error('❌ Error creating agent:', agentError)
      return NextResponse.json({ error: `Failed to create agent: ${agentError.message}` }, { status: 500 })
    }

    // ✅ Step 2: Create Pipecat agent with real agent.id and project API key
    if (platform === 'pipecat') {
      const pipecatError = await provisionPipecatAgent(agent, project_id)
      if (pipecatError) {
        return NextResponse.json({ error: pipecatError }, { status: 500 })
      }
    }

    console.log(`✅ Successfully created ${platform} agent "${agent.name}" with ID: ${agent.id}`)
    return NextResponse.json(agent, { status: 201 })

  } catch (error) {
    console.error('💥 Unexpected error creating agent:', error)
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('project_id')

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    const { data: agents, error } = await supabase
      .from('pype_voice_agents')
      .select('*')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching agents:', error)
      return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 })
    }

    return NextResponse.json({ agents })

  } catch (error) {
    console.error('Unexpected error fetching agents:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}