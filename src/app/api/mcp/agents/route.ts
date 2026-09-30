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
import { randomUUID } from 'node:crypto'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { serviceAuthHeaders } from '@/lib/serviceToken'
import { getPypeApiBaseUrlForServer } from '@/lib/pypeApiFetch'
import { MCP_AGENT_DEFAULT_CONFIG } from '@/config/mcpAgentDefaults'
import { findMcpVoice, buildMcpTtsConfig } from '@/config/mcpAgentVoices'
import { validateDispositions, dispositionsToAgentColumns } from '@/lib/dispositions'
import { hasStudioSecret, slugifyAgentName, studioUrl, type VoiceRef } from '@/lib/mcpAgentHelpers'
import { resolveWhispeyKeyFields } from '@/server/mcpAgentDb'

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

interface CreateBody {
  project_id?: string
  display_name?: string
  prompt?: string
  greeting?: string
  voice?: VoiceRef
  variables?: Record<string, string>
  dispositions?: unknown
  created_by?: string
}

type McpVoice = NonNullable<ReturnType<typeof findMcpVoice>>

interface CreateInput {
  projectId: string
  displayName: string
  prompt: string
  body: CreateBody
  mcpVoice: McpVoice
  dispositionColumns?: ReturnType<typeof dispositionsToAgentColumns>
}

type Parsed = { ok: true; input: CreateInput } | { ok: false; response: NextResponse }

const fail = (error: string, status: number, details?: unknown) =>
  NextResponse.json(details === undefined ? { error } : { error, details }, { status })

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

function parseCreateInput(body: CreateBody): Parsed {
  const { project_id, display_name, prompt, voice } = body
  if (!project_id || !display_name || !prompt || !voice?.provider || !voice?.voice_id) {
    return {
      ok: false,
      response: fail('project_id, display_name, prompt, and voice { provider, voice_id } are required', 400),
    }
  }

  // Validated up front, before anything is created, so a bad list can't leave
  // a half-configured agent behind.
  let dispositionColumns: CreateInput['dispositionColumns']
  if (body.dispositions !== undefined) {
    const checked = validateDispositions(body.dispositions)
    if (!checked.ok) return { ok: false, response: fail(checked.error, 400) }
    dispositionColumns = dispositionsToAgentColumns(checked.dispositions)
  }

  const mcpVoice = findMcpVoice(voice.provider, voice.voice_id)
  if (!mcpVoice) {
    return {
      ok: false,
      response: fail(`Voice ${voice.provider}/${voice.voice_id} is not in the Agent Studio voice list`, 400),
    }
  }

  return {
    ok: true,
    input: { projectId: project_id, displayName: display_name, prompt, body, mcpVoice, dispositionColumns },
  }
}

/** The assistant config: only prompt/greeting/voice/variables are caller-controlled. */
function buildAssistant(input: CreateInput, backendAgentName: string) {
  const d = MCP_AGENT_DEFAULT_CONFIG
  const { body } = input
  const firstMessage = body.greeting
    ? {
        mode: 'assistant_speaks_first',
        first_message: body.greeting,
        allow_interruptions: d.first_message_mode?.allow_interruptions ?? false,
      }
    : d.first_message_mode

  return {
    name: backendAgentName,
    prompt: input.prompt,
    variables: body.variables ?? {},
    stt: d.stt,
    llm: d.llm,
    tts: buildMcpTtsConfig(input.mcpVoice),
    vad: d.vad,
    interruptions: d.interruptions,
    first_message_mode: firstMessage,
    session_behavior: d.session_behavior,
    background_audio: d.background_audio,
    tools: d.tools,
    filler_words: d.filler_words,
    bug_reports: d.bug_reports,
    context_memory: d.context_memory,
  }
}

async function callBackend(apiBase: string, path: string, payload: unknown) {
  return fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...serviceAuthHeaders() },
    body: JSON.stringify(payload),
  })
}

async function provisionBackend(apiBase: string, payload: unknown): Promise<{ ok: boolean; data: unknown }> {
  try {
    const resp = await callBackend(apiBase, '/create-agent', payload)
    return { ok: resp.ok, data: await resp.json().catch(() => null) }
  } catch (err) {
    return { ok: false, data: { error: err instanceof Error ? err.message : 'Unknown error' } }
  }
}

/** Best-effort: 'classic' /create-agent only writes config, it doesn't start the worker. */
async function startWorker(apiBase: string, backendAgentName: string) {
  try {
    await callBackend(apiBase, '/run_agent', { agent_name: backendAgentName })
  } catch (err) {
    console.error('Failed to auto-start agent after creation:', err)
  }
}

export async function POST(request: NextRequest) {
  if (!hasStudioSecret(request.headers.get('x-agent-studio-secret'), process.env.AGENT_STUDIO_SECRET)) {
    return fail('Unauthorized', 401)
  }

  const rawBody = await request.json().catch(() => null)
  if (!rawBody) return fail('Invalid JSON body', 400)

  const parsed = parseCreateInput(rawBody as CreateBody)
  if (!parsed.ok) return parsed.response
  const input = parsed.input
  const { projectId, displayName, body, dispositionColumns } = input
  const name = slugifyAgentName(displayName)

  // --- Quota check (same shape as create-agent/route.ts, own logic) ---
  const { state, error: stateError } = await getOrInitProjectAgentState(projectId)
  if (stateError) return fail('Failed to load project state', 500)
  const currentActive = state?.usage?.active_count ?? 0
  const maxAllowed = state?.limits?.max_agents ?? 0
  if (currentActive >= maxAllowed) return fail('Agent limit reached for this project', 403)

  const agentId = randomUUID()
  const backendAgentName = `${name}_${agentId.replaceAll('-', '_')}`

  // --- Create the pype_voice_agents row (mirrors /api/agents POST) ---
  // `name` is the SHORT name here, matching real agents (e.g. "lslocaltwo",
  // not "lslocaltwo_f9523..."). The full underscored name is a backend/LiveKit
  // registration detail, reconstructed on demand as `${name}_${id}`.
  const { error: insertError } = await supabase.from('pype_voice_agents').insert({
    id: agentId,
    name,
    display_name: displayName,
    agent_type: 'pype_agent',
    configuration: {
      created_via: 'mcp',
      created_by: body.created_by ?? null,
      description: null,
      deployment_target: DEPLOYMENT_TARGET,
    },
    project_id: projectId,
    environment: 'dev',
    is_active: true,
    // field_extractor (the on-switch) and field_extractor_prompt must be set together
    ...dispositionColumns,
  })
  if (insertError) return fail('Failed to create agent record', 500, insertError.message)

  // --- Call pype-voice-agent-be, exactly like create-agent/route.ts does ---
  const apiBase = getPypeApiBaseUrlForServer(DEPLOYMENT_TARGET)
  if (!apiBase) {
    await supabase.from('pype_voice_agents').delete().eq('id', agentId)
    return fail('Voice backend URL is not configured', 500)
  }

  const provisioned = await provisionBackend(apiBase, {
    project_id: projectId,
    agent: {
      agent_id: agentId,
      name: backendAgentName,
      assistant: [buildAssistant(input, backendAgentName)],
      ...(await resolveWhispeyKeyFields(supabase, projectId)),
    },
  })
  if (!provisioned.ok) {
    // Roll back: delete the DB row so a failed create doesn't count against quota
    // or show up as a phantom agent.
    await supabase.from('pype_voice_agents').delete().eq('id', agentId)
    return fail('Failed to provision agent', 502, provisioned.data)
  }

  await startWorker(apiBase, backendAgentName)

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
    .eq('id', projectId)

  return NextResponse.json({
    agent_id: agentId,
    name: backendAgentName,
    display_name: displayName,
    project_id: projectId,
    studio_url: studioUrl(projectId, agentId, process.env.NEXT_PUBLIC_APP_URL),
  })
}
