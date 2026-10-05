import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getProjectRoleForApi, getDeploymentTargetFromAgentBackendName } from '@/lib/getProjectRoleForApi'
import { getPypeApiBaseUrlForServer, fetchPypeApiWithRetry } from '@/lib/pypeApiFetch'
import { serviceAuthHeaders } from '@/lib/serviceToken'
import { deployAgentConfig } from '@/lib/deployAgentConfig'
import { resolveWhispeyKeyFields } from '@/server/mcpAgentDb'

const BUILTIN = new Set(['end_call', 'knowledge_search', 'update_vad_options', 'voicemail_detection'])

function toBackendTool(input: Record<string, unknown>) {
  const type = String(input.type || 'custom_function')
  const name = String(input.name || '').trim()
  const description = String(input.description || '')
  if (BUILTIN.has(type)) {
    return { type, name: name || type, description }
  }
  const headers = input.headers && typeof input.headers === 'object' && !Array.isArray(input.headers) ? input.headers : {}
  const parameters = Array.isArray(input.parameters)
    ? input.parameters
        .filter((p) => p && typeof p === 'object' && String((p as { name?: string }).name || '').trim())
        .map((p) => {
          const row = p as { name: string; type?: string; description?: string; required?: boolean }
          return {
            name: String(row.name).trim(),
            type: row.type || 'str',
            description: row.description || '',
            required: !!row.required,
          }
        })
    : []
  return {
    type: 'custom_function',
    name,
    description,
    api_url: String(input.api_url || '').trim(),
    http_method: String(input.http_method || 'POST').toUpperCase(),
    timeout: Number(input.timeout) || 10,
    async: input.async !== false,
    headers,
    parameters,
    custom_payload: String(input.custom_payload || ''),
    response_mapping: {},
  }
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const projectId = body?.projectId as string | undefined
  const agentId = body?.agentId as string | undefined
  if (!projectId || !agentId || !body?.tool) {
    return NextResponse.json({ error: 'projectId, agentId, and tool are required' }, { status: 400 })
  }

  const access = await getProjectRoleForApi(projectId)
  if (!access) return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 })
  if (access.role === 'viewer') return NextResponse.json({ error: 'Viewer access' }, { status: 403 })

  const tool = toBackendTool(body.tool as Record<string, unknown>)
  if (!tool.name) return NextResponse.json({ error: 'Tool name is required' }, { status: 400 })
  if (tool.type === 'custom_function' && !('api_url' in tool && tool.api_url)) {
    return NextResponse.json({ error: 'API URL is required for a custom tool' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { data: agent } = await supabase
    .from('pype_voice_agents')
    .select('name, display_name')
    .eq('id', agentId)
    .eq('project_id', projectId)
    .maybeSingle()
  if (!agent?.name) return NextResponse.json({ error: 'No such agent in this project' }, { status: 404 })

  const backendAgentName = `${agent.name}_${agentId.replaceAll('-', '_')}`
  const deploymentTarget = await getDeploymentTargetFromAgentBackendName(backendAgentName)
  const apiBase = getPypeApiBaseUrlForServer(deploymentTarget)
  if (!apiBase) return NextResponse.json({ error: 'Voice backend URL is not configured' }, { status: 500 })

  const resp = await fetchPypeApiWithRetry(`${apiBase}/agent_config/${encodeURIComponent(backendAgentName)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...serviceAuthHeaders() },
  })
  if (!resp.ok) return NextResponse.json({ error: 'Failed to load current agent config' }, { status: 502 })
  const config = await resp.json()
  const assistant = config?.agent?.assistant?.[0]
  if (!assistant) return NextResponse.json({ error: 'Agent has no assistant to update' }, { status: 502 })

  const existing = Array.isArray(assistant.tools) ? assistant.tools : []
  const tools = existing.filter((t: { name?: string; type?: string }) => !(t?.name === tool.name && t?.type === tool.type))
  tools.push(tool)
  assistant.tools = tools

  const deployed = await deployAgentConfig(
    backendAgentName,
    {
      agent: {
        name: backendAgentName,
        agent_id: agentId,
        assistant: [assistant],
        ...(await resolveWhispeyKeyFields(supabase, projectId)),
      },
    },
    deploymentTarget,
  )
  if (!deployed.ok) return NextResponse.json({ error: deployed.errorText || 'Failed to deploy tool' }, { status: 502 })

  return NextResponse.json({
    ok: true,
    display_name: agent.display_name,
    backend_name: backendAgentName,
    tool_name: tool.name,
    tool_type: tool.type,
  })
}
