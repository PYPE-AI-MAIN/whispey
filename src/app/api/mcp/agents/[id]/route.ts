// src/app/api/mcp/agents/[id]/route.ts
//
// Edit an existing agent through the MCP — restricted to prompt, greeting,
// voice, variables and dispositions. Nothing else about the agent's config can
// change here, even if a caller's request body included other fields: they're
// simply ignored, not merged in.
//
// Reuses deployAgentConfig (an already-exported shared lib, same one
// save-and-deploy/route.ts calls) rather than hitting that route over HTTP —
// so save-and-deploy stays completely untouched.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { serviceAuthHeaders } from '@/lib/serviceToken'
import { getPypeApiBaseUrlForServer, fetchPypeApiWithRetry, isPypeUpstreamUnreachable } from '@/lib/pypeApiFetch'
import { getDeploymentTargetFromAgentBackendName } from '@/lib/getProjectRoleForApi'
import { deployAgentConfig } from '@/lib/deployAgentConfig'
import { findMcpVoice, buildMcpTtsConfig } from '@/config/mcpAgentVoices'
import { validateDispositions, dispositionsToAgentColumns } from '@/lib/dispositions'
import {
  applyAssistantUpdates, hasStudioSecret, studioUrl, voiceRefError, type VoiceRef,
} from '@/lib/mcpAgentHelpers'
import { loadEditableAgent, resolveWhispeyKeyFields } from '@/server/mcpAgentDb'

const supabase = createServiceRoleClient()

interface UpdateBody {
  project_id?: string
  prompt?: string
  greeting?: string
  voice?: VoiceRef
  variables?: Record<string, string>
  dispositions?: unknown
  created_by?: string
}

type McpVoice = NonNullable<ReturnType<typeof findMcpVoice>>

interface UpdateInput {
  projectId: string
  body: UpdateBody
  mcpVoice?: McpVoice
  dispositionColumns?: ReturnType<typeof dispositionsToAgentColumns>
}

type Parsed = { ok: true; input: UpdateInput } | { ok: false; response: NextResponse }

const fail = (error: string, status: number, details?: unknown) =>
  NextResponse.json(details === undefined ? { error } : { error, details }, { status })

function nothingToUpdate(body: UpdateBody): boolean {
  return [body.prompt, body.greeting, body.voice, body.variables, body.dispositions].every((v) => v === undefined)
}

/** Only the assistant-level fields need a redeploy; dispositions are a DB write. */
function touchesAssistant(body: UpdateBody): boolean {
  return [body.prompt, body.greeting, body.voice, body.variables].some((v) => v !== undefined)
}

function resolveVoice(voice: VoiceRef | undefined): { mcpVoice?: McpVoice } | { error: NextResponse } {
  if (voice === undefined) return {}
  const problem = voiceRefError(voice)
  if (problem) return { error: fail(problem, 400) }
  const mcpVoice = findMcpVoice(voice.provider as string, voice.voice_id as string)
  if (!mcpVoice) {
    return { error: fail(`Voice ${voice.provider}/${voice.voice_id} is not in the Agent Studio voice list`, 400) }
  }
  return { mcpVoice }
}

function parseUpdateInput(body: UpdateBody): Parsed {
  if (!body.project_id) return { ok: false, response: fail('project_id is required', 400) }
  if (nothingToUpdate(body)) {
    return {
      ok: false,
      response: fail('Nothing to update — provide prompt, greeting, voice, variables, and/or dispositions', 400),
    }
  }

  let dispositionColumns: UpdateInput['dispositionColumns']
  if (body.dispositions !== undefined) {
    const checked = validateDispositions(body.dispositions)
    if (!checked.ok) return { ok: false, response: fail(checked.error, 400) }
    dispositionColumns = dispositionsToAgentColumns(checked.dispositions)
  }

  const voice = resolveVoice(body.voice)
  if ('error' in voice) return { ok: false, response: voice.error }

  return { ok: true, input: { projectId: body.project_id, body, mcpVoice: voice.mcpVoice, dispositionColumns } }
}

/** Dispositions live on the agent row (not in the voice backend's config). */
async function saveDispositions(agentId: string, columns: NonNullable<UpdateInput['dispositionColumns']>) {
  const { error } = await supabase
    .from('pype_voice_agents')
    .update({ ...columns, updated_at: new Date().toISOString() })
    .eq('id', agentId)
  return error ? fail('Failed to save dispositions', 500, error.message) : null
}

async function loadCurrentAssistant(apiBase: string, backendAgentName: string) {
  try {
    const resp = await fetchPypeApiWithRetry(`${apiBase}/agent_config/${encodeURIComponent(backendAgentName)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...serviceAuthHeaders() },
    })
    if (!resp.ok) return { error: fail('Failed to load current agent config', 502) }
    const config = await resp.json()
    const assistant = config?.agent?.assistant?.[0]
    return assistant
      ? { assistant }
      : { error: fail('Current agent config has no assistant to update', 502) }
  } catch (err) {
    const unreachable = isPypeUpstreamUnreachable(err)
    return {
      error: unreachable
        ? fail('Voice backend is unreachable', 503)
        : fail('Failed to load current agent config', 502),
    }
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasStudioSecret(request.headers.get('x-agent-studio-secret'), process.env.AGENT_STUDIO_SECRET)) {
    return fail('Unauthorized', 401)
  }

  const { id: agentId } = await params
  const rawBody = await request.json().catch(() => null)
  if (!rawBody) return fail('Invalid JSON body', 400)

  const parsed = parseUpdateInput(rawBody as UpdateBody)
  if (!parsed.ok) return parsed.response
  const { projectId, body, mcpVoice, dispositionColumns } = parsed.input

  const owned = await loadEditableAgent(supabase, agentId, projectId, body.created_by)
  if (!owned.ok) return fail(owned.error, owned.status)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  // When dispositions are the only change there is nothing to redeploy, which
  // keeps the agent up during the edit.
  if (dispositionColumns) {
    const failure = await saveDispositions(agentId, dispositionColumns)
    if (failure) return failure
    if (!touchesAssistant(body)) {
      return NextResponse.json({
        agent_id: agentId,
        project_id: projectId,
        studio_url: studioUrl(projectId, agentId, appUrl),
        updated: { prompt: false, greeting: false, voice: false, variables: false, dispositions: true },
      })
    }
  }

  // agent.name is the SHORT name (matches real agents, e.g. "lslocaltwo") — the
  // backend/LiveKit registration uses the full underscored name.
  const backendAgentName = `${owned.agent.name}_${agentId.replaceAll('-', '_')}`

  const deploymentTarget = await getDeploymentTargetFromAgentBackendName(backendAgentName)
  const apiBase = getPypeApiBaseUrlForServer(deploymentTarget)
  if (!apiBase) return fail('Voice backend URL is not configured', 500)

  const current = await loadCurrentAssistant(apiBase, backendAgentName)
  if ('error' in current) return current.error

  const updatedAssistant = applyAssistantUpdates(current.assistant, {
    prompt: body.prompt,
    greeting: body.greeting,
    tts: mcpVoice ? buildMcpTtsConfig(mcpVoice) : undefined,
    variables: body.variables,
  })

  const result = await deployAgentConfig(
    backendAgentName,
    {
      agent: {
        name: backendAgentName,
        agent_id: agentId,
        assistant: [updatedAssistant],
        ...(await resolveWhispeyKeyFields(supabase, projectId)),
      },
    },
    deploymentTarget
  )
  if (!result.ok) return fail('Failed to deploy updated config', result.status || 502, result.errorText)

  return NextResponse.json({
    agent_id: agentId,
    name: backendAgentName,
    project_id: projectId,
    studio_url: studioUrl(projectId, agentId, appUrl),
    updated: {
      prompt: body.prompt !== undefined,
      greeting: body.greeting !== undefined,
      voice: mcpVoice ? { provider: mcpVoice.provider, voice_id: mcpVoice.voice_id } : false,
      variables: body.variables !== undefined,
      dispositions: body.dispositions !== undefined,
    },
  })
}
