// src/app/api/mcp/agents/route.ts
//
// Self-contained agent creation for the MCP. Deliberately does NOT import or
// call the dashboard's /api/agents or /api/agents/create-agent routes (their
// core logic is private to those route files, not exported) — this is a
// parallel implementation so those existing, in-production routes are
// completely unaffected. It only reuses already-exported shared libs
// (deployAgentConfig's siblings: getPypeApiBaseUrlForServer, serviceAuthHeaders,
// decryptWithWhispeyKey) and mirrors create-agent's quota-transaction shape.
//
// Auth: a shared secret (X-Agent-Studio-Secret), not a Clerk session — this
// route is called server-to-server from the pype-mcp-server Agent Studio
// service, which has already resolved the caller's project scope and
// admin role itself.

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { decryptWithWhispeyKey } from '@/lib/whispey-crypto'
import { serviceAuthHeaders } from '@/lib/serviceToken'
import { getPypeApiBaseUrlForServer } from '@/lib/pypeApiFetch'
import { MCP_AGENT_DEFAULT_CONFIG } from '@/config/mcpAgentDefaults'
import { findMcpVoice, buildMcpTtsConfig } from '@/config/mcpAgentVoices'
import { validateDispositions, dispositionsToAgentColumns } from '@/lib/dispositions'

const supabase = createServiceRoleClient()

// MCP-created agents always deploy classic (subprocess) for now — see
// project history: explicitly deferred deciding on 'docker' for this path.
const DEPLOYMENT_TARGET = 'classic' as const

type AgentQuotaState = {
  limits: { max_agents: number }
  usage: { active_count: number }
  agents: Array<{ id: string; created_at: string; status: string }>
  last_updated: string
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

async function getOrInitProjectAgentState(projectId: string): Promise<{
  state: AgentQuotaState
  error?: string
}> {
  const { data: projectRow, error: fetchError } = await supabase
    .from('pype_voice_projects')
    .select('id, agent')
    .eq('id', projectId)
    .single()

  if (fetchError || !projectRow) {
    return { state: {} as AgentQuotaState, error: fetchError?.message || 'Project not found' }
  }

  const defaultState: AgentQuotaState = {
    limits: { max_agents: 2 },
    usage: { active_count: 0 },
    agents: [],
    last_updated: new Date().toISOString(),
  }

  const state: AgentQuotaState = (projectRow as any).agent || defaultState
  return { state }
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-agent-studio-secret')
  if (!secret || !process.env.AGENT_STUDIO_SECRET || secret !== process.env.AGENT_STUDIO_SECRET) {
    return unauthorized()
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { project_id, display_name, prompt, greeting, voice, variables, dispositions, created_by } = body as {
    project_id?: string
    display_name?: string
    prompt?: string
    greeting?: string
    voice?: { provider?: string; voice_id?: string }
    variables?: Record<string, string>
    dispositions?: unknown
    created_by?: string
  }

  if (!project_id || !display_name || !prompt || !voice?.provider || !voice?.voice_id) {
    return NextResponse.json(
      { error: 'project_id, display_name, prompt, and voice { provider, voice_id } are required' },
      { status: 400 }
    )
  }

  // display_name is freeform (shown in Whispey) — the caller never has to
  // think about backend-safe naming. `name` is derived from it here: the
  // backend writes it into a Python import statement when validating config
  // updates (agent_runtime_config.py), so it must be alphanumeric/underscore
  // only — a hyphen or space there is a SyntaxError, not just a display issue.
  const slugified = display_name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '_')
    .replaceAll(/^_+|_+$/g, '')
    .slice(0, 40)
  const name = slugified || 'agent'

  // Validated up front, before anything is created, so a bad list can't leave
  // a half-configured agent behind.
  let dispositionColumns: ReturnType<typeof dispositionsToAgentColumns> | null = null
  if (dispositions !== undefined) {
    const checked = validateDispositions(dispositions)
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 })
    dispositionColumns = dispositionsToAgentColumns(checked.dispositions)
  }

  const mcpVoice = findMcpVoice(voice.provider, voice.voice_id)
  if (!mcpVoice) {
    return NextResponse.json(
      { error: `Voice ${voice.provider}/${voice.voice_id} is not in the Agent Studio voice list` },
      { status: 400 }
    )
  }

  // --- Quota check (same shape as create-agent/route.ts, own logic) ---
  const { state, error: stateError } = await getOrInitProjectAgentState(project_id)
  if (stateError) {
    return NextResponse.json({ error: 'Failed to load project state' }, { status: 500 })
  }
  const currentActive = state?.usage?.active_count ?? 0
  const maxAllowed = state?.limits?.max_agents ?? 0
  if (currentActive >= maxAllowed) {
    return NextResponse.json(
      { error: 'Agent limit reached for this project' },
      { status: 403 }
    )
  }

  const agentId = randomUUID()
  const backendAgentName = `${name}_${agentId.replaceAll('-', '_')}`

  // --- Create the pype_voice_agents row (mirrors /api/agents POST) ---
  // `name` is the SHORT name here, matching real agents (e.g. "lslocaltwo",
  // not "lslocaltwo_f9523..."). The full underscored name is a backend/LiveKit
  // registration detail, reconstructed on demand as `${name}_${id}` — storing
  // the full name in this column double-appends the id suffix wherever that
  // reconstruction happens (Studio's context, useVoiceAgent, etc.).
  const { error: insertError } = await supabase.from('pype_voice_agents').insert({
    id: agentId,
    name,
    display_name,
    agent_type: 'pype_agent',
    configuration: { created_via: 'mcp', created_by: created_by ?? null, description: null, deployment_target: DEPLOYMENT_TARGET },
    project_id,
    environment: 'dev',
    is_active: true,
    // field_extractor (the on-switch) and field_extractor_prompt must be set together
    ...(dispositionColumns ?? {}),
  })
  if (insertError) {
    return NextResponse.json({ error: 'Failed to create agent record', details: insertError.message }, { status: 500 })
  }

  // --- Build the assistant config: only prompt/greeting/voice are caller-controlled ---
  const d = MCP_AGENT_DEFAULT_CONFIG

  const assistant = {
    name: backendAgentName,
    prompt,
    variables: variables ?? {},
    stt: d.stt,
    llm: d.llm,
    tts: buildMcpTtsConfig(mcpVoice),
    vad: d.vad,
    interruptions: d.interruptions,
    first_message_mode: greeting
      ? { mode: 'assistant_speaks_first', first_message: greeting, allow_interruptions: d.first_message_mode?.allow_interruptions ?? false }
      : d.first_message_mode,
    session_behavior: d.session_behavior,
    background_audio: d.background_audio,
    tools: d.tools,
    filler_words: d.filler_words,
    bug_reports: d.bug_reports,
    context_memory: d.context_memory,
  }

  // --- Decrypt this project's Whispey API key, same as create-agent/route.ts ---
  let whispeyApiKey: string | undefined
  const { data: apiKeyRow } = await supabase
    .from('pype_voice_api_keys')
    .select('token_hash_master, token_hash')
    .eq('project_id', project_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (apiKeyRow?.token_hash_master) {
    try {
      whispeyApiKey = decryptWithWhispeyKey(apiKeyRow.token_hash_master)
    } catch {
      // fall through to token_hash below
    }
  }

  const agentPayload: Record<string, any> = {
    project_id,
    agent: {
      agent_id: agentId,
      name: backendAgentName,
      assistant: [assistant],
      ...(whispeyApiKey ? { whispey_api_key: whispeyApiKey } : apiKeyRow?.token_hash ? { token_hash: apiKeyRow.token_hash } : {}),
    },
  }

  // --- Call pype-voice-agent-be, exactly like create-agent/route.ts does ---
  const apiBase = getPypeApiBaseUrlForServer(DEPLOYMENT_TARGET)
  if (!apiBase) {
    await supabase.from('pype_voice_agents').delete().eq('id', agentId)
    return NextResponse.json({ error: 'Voice backend URL is not configured' }, { status: 500 })
  }

  let backendOk = false
  let backendData: any = null
  try {
    const resp = await fetch(`${apiBase}/create-agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...serviceAuthHeaders() },
      body: JSON.stringify(agentPayload),
    })
    backendData = await resp.json().catch(() => null)
    backendOk = resp.ok
  } catch (err) {
    backendData = { error: err instanceof Error ? err.message : 'Unknown error' }
  }

  if (!backendOk) {
    // Roll back: delete the DB row so a failed create doesn't count against quota
    // or show up as a phantom agent.
    await supabase.from('pype_voice_agents').delete().eq('id', agentId)
    return NextResponse.json({ error: 'Failed to provision agent', details: backendData }, { status: 502 })
  }

  // --- Start the LiveKit worker. In 'classic' deployment mode /create-agent
  // only writes config — it does not start the worker (that's bundled into
  // creation only in 'docker' mode). Best-effort: a failed start here doesn't
  // roll back the agent, since it can still be started later from Studio.
  try {
    await fetch(`${apiBase}/run_agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...serviceAuthHeaders() },
      body: JSON.stringify({ agent_name: backendAgentName }),
    })
  } catch (err) {
    console.error('Failed to auto-start agent after creation:', err)
  }

  // --- Increment quota usage now that provisioning succeeded ---
  const createdAt = new Date().toISOString()
  await supabase
    .from('pype_voice_projects')
    .update({
      agent: {
        limits: { max_agents: maxAllowed },
        usage: { active_count: currentActive + 1 },
        agents: [...(state?.agents || []), { id: agentId, created_at: createdAt, status: 'active' }],
        last_updated: createdAt,
      },
    })
    .eq('id', project_id)

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')

  return NextResponse.json({
    agent_id: agentId,
    name: backendAgentName,
    display_name,
    project_id,
    studio_url: `${appUrl}/${project_id}/agents/${agentId}/studio`,
  })
}
