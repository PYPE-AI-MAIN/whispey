// src/app/api/mcp/agents/[id]/route.ts
//
// Edit an existing agent through the MCP — restricted to prompt, greeting,
// and voice. Nothing else about the agent's config can change here, even if
// a caller's request body included other fields: they're simply ignored,
// not merged in.
//
// Reuses deployAgentConfig (an already-exported shared lib, same one
// save-and-deploy/route.ts calls) rather than hitting that route over HTTP —
// so save-and-deploy stays completely untouched.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { decryptWithWhispeyKey } from '@/lib/whispey-crypto'
import { serviceAuthHeaders } from '@/lib/serviceToken'
import { getPypeApiBaseUrlForServer, fetchPypeApiWithRetry, isPypeUpstreamUnreachable } from '@/lib/pypeApiFetch'
import { getDeploymentTargetFromAgentBackendName } from '@/lib/getProjectRoleForApi'
import { deployAgentConfig } from '@/lib/deployAgentConfig'
import { findMcpVoice, buildMcpTtsConfig } from '@/config/mcpAgentVoices'

const supabase = createServiceRoleClient()

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const secret = request.headers.get('x-agent-studio-secret')
  if (!secret || !process.env.AGENT_STUDIO_SECRET || secret !== process.env.AGENT_STUDIO_SECRET) {
    return unauthorized()
  }

  const { id: agentId } = await params
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { project_id, prompt, greeting, voice, variables, created_by } = body as {
    project_id?: string
    prompt?: string
    greeting?: string
    voice?: { provider?: string; voice_id?: string }
    variables?: Record<string, string>
    created_by?: string
  }

  if (!project_id) {
    return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
  }
  if (prompt === undefined && greeting === undefined && voice === undefined && variables === undefined) {
    return NextResponse.json(
      { error: 'Nothing to update — provide prompt, greeting, voice, and/or variables' },
      { status: 400 }
    )
  }

  let mcpVoice: ReturnType<typeof findMcpVoice> | undefined
  if (voice !== undefined) {
    if (!voice?.provider || !voice?.voice_id) {
      return NextResponse.json({ error: 'voice requires provider and voice_id' }, { status: 400 })
    }
    mcpVoice = findMcpVoice(voice.provider, voice.voice_id)
    if (!mcpVoice) {
      return NextResponse.json(
        { error: `Voice ${voice.provider}/${voice.voice_id} is not in the Agent Studio voice list` },
        { status: 400 }
      )
    }
  }

  // --- Look up the agent and verify it belongs to the claimed project ---
  const { data: agentRow, error: agentError } = await supabase
    .from('pype_voice_agents')
    .select('id, name, project_id, configuration')
    .eq('id', agentId)
    .maybeSingle()

  if (agentError || !agentRow) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }
  if (agentRow.project_id !== project_id) {
    return NextResponse.json({ error: 'Agent does not belong to project_id' }, { status: 403 })
  }
  // Only agents the MCP itself created can be edited through the MCP — an
  // agent built in the dashboard was never scoped to this restricted
  // prompt/greeting/voice-only surface, so it stays off-limits here.
  if (agentRow.configuration?.created_via !== 'mcp') {
    return NextResponse.json(
      { error: 'This agent was not created through the MCP and cannot be edited here' },
      { status: 403 }
    )
  }
  // Further restricted to the same caller that created it — one MCP client's
  // key can never edit another client's agent, even though both are
  // MCP-created and in a project this key can otherwise see.
  if (!created_by || agentRow.configuration?.created_by !== created_by) {
    return NextResponse.json(
      { error: 'You can only edit agents you created through the MCP' },
      { status: 403 }
    )
  }

  // agentRow.name is the SHORT name (matches real agents, e.g. "lslocaltwo") —
  // the backend/LiveKit registration uses the full underscored name, same
  // reconstruction Studio's own context uses.
  const backendAgentName = `${agentRow.name}_${agentId.replaceAll('-', '_')}`

  // --- Resolve which backend this agent actually lives on, and fetch its current config ---
  const deploymentTarget = await getDeploymentTargetFromAgentBackendName(backendAgentName)
  const apiBase = getPypeApiBaseUrlForServer(deploymentTarget)
  if (!apiBase) {
    return NextResponse.json({ error: 'Voice backend URL is not configured' }, { status: 500 })
  }

  let currentConfig: any
  try {
    const getResp = await fetchPypeApiWithRetry(`${apiBase}/agent_config/${encodeURIComponent(backendAgentName)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...serviceAuthHeaders() },
    })
    if (!getResp.ok) {
      return NextResponse.json({ error: 'Failed to load current agent config' }, { status: 502 })
    }
    currentConfig = await getResp.json()
  } catch (err) {
    if (isPypeUpstreamUnreachable(err)) {
      return NextResponse.json({ error: 'Voice backend is unreachable' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Failed to load current agent config' }, { status: 502 })
  }

  const currentAssistant = currentConfig?.agent?.assistant?.[0]
  if (!currentAssistant) {
    return NextResponse.json({ error: 'Current agent config has no assistant to update' }, { status: 502 })
  }

  // --- Merge ONLY prompt/greeting/voice — everything else stays exactly as it is ---
  const updatedAssistant = { ...currentAssistant }
  if (prompt !== undefined) {
    updatedAssistant.prompt = prompt
  }
  if (greeting !== undefined) {
    updatedAssistant.first_message_mode = {
      ...(currentAssistant.first_message_mode ?? {}),
      mode: 'assistant_speaks_first',
      first_message: greeting,
    }
  }
  if (mcpVoice) {
    // Full replace, not a merge — Sarvam and ElevenLabs use different field
    // shapes (speaker vs voice_id, different settings), so carrying any old
    // field over risks a stale value surviving a provider switch (e.g. the
    // previous provider's voice_id lingering and still showing as "selected"
    // in Studio's picker even after switching to a Sarvam speaker).
    updatedAssistant.tts = buildMcpTtsConfig(mcpVoice)
  }
  if (variables !== undefined) {
    // Merge, not replace — updating one value shouldn't require resending
    // every other variable the agent already has.
    updatedAssistant.variables = { ...(currentAssistant.variables ?? {}), ...variables }
  }

  const agentConfigBody: any = {
    agent: {
      name: backendAgentName,
      agent_id: agentId,
      assistant: [updatedAssistant],
    },
  }

  // --- Attach the project's Whispey API key, same fields save-and-deploy's
  // attachWhispeyApiKey writes (that function is private to that route file,
  // so this is a deliberate small duplicate, not an import). ---
  const { data: apiKeyRow } = await supabase
    .from('pype_voice_api_keys')
    .select('id, token_hash, token_hash_master')
    .eq('project_id', project_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (apiKeyRow) {
    if (apiKeyRow.id) {
      agentConfigBody.agent.whispey_key_id = apiKeyRow.id
    }
    if (apiKeyRow.token_hash_master) {
      try {
        agentConfigBody.agent.whispey_api_key = decryptWithWhispeyKey(apiKeyRow.token_hash_master)
      } catch {
        if (apiKeyRow.token_hash) {
          agentConfigBody.agent.token_hash = apiKeyRow.token_hash
        }
      }
    } else if (apiKeyRow.token_hash) {
      agentConfigBody.agent.token_hash = apiKeyRow.token_hash
    }
  }

  const result = await deployAgentConfig(backendAgentName, agentConfigBody, deploymentTarget)

  if (!result.ok) {
    return NextResponse.json(
      { error: 'Failed to deploy updated config', details: result.errorText },
      { status: result.status || 502 }
    )
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')

  return NextResponse.json({
    agent_id: agentId,
    name: backendAgentName,
    project_id,
    studio_url: `${appUrl}/${project_id}/agents/${agentId}/studio`,
    updated: {
      prompt: prompt !== undefined,
      greeting: greeting !== undefined,
      voice: mcpVoice ? { provider: mcpVoice.provider, voice_id: mcpVoice.voice_id } : false,
      variables: variables !== undefined,
    },
  })
}
