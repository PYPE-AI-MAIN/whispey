// src/app/api/mcp/flows/route.ts
//
// Create a conversation-flow agent through the MCP. The same thing the
// dashboard does when you pick "What are you building? → Conversation Flow"
// and describe the call on the canvas: create the agent row (workflowMode),
// let the AI Builder write the flow from the description, check it with the
// canvas's own lint, then deploy it. Nothing is half-created: if the builder
// or the deploy fails, the row is removed and no quota is used.
//
// Auth: X-Agent-Studio-Secret (server-to-server from the pype-mcp-server Agent
// Studio service, which has already checked the caller's admin role and
// project scope), same as /api/mcp/agents.

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { flowUrl, hasStudioSecret, slugifyAgentName } from '@/lib/mcpAgentHelpers'
import { summarizeWorkflow } from '@/lib/workflow/builderOutput'
import { checkAgentQuota, recordAgentCreated } from '@/server/mcpAgentDb'
import { runWorkflowBuilder } from '@/server/workflowBuilder'
import { deployWorkflow } from '@/server/workflowDeploy'

// The AI Builder can take a minute or two for a large flow, plus the deploy.
export const maxDuration = 300

const supabase = createServiceRoleClient()

const MAX_DESCRIPTION = 20_000

const fail = (error: string, status: number, details?: unknown) =>
  NextResponse.json(details === undefined ? { error } : { error, details }, { status })

interface CreateFlowBody {
  project_id?: string
  display_name?: string
  description?: string
  created_by?: string
}

function inputError(body: CreateFlowBody): string | null {
  if (!body.project_id || !body.display_name?.trim() || !body.description?.trim()) {
    return 'project_id, display_name and description are required'
  }
  if (body.description.length > MAX_DESCRIPTION) {
    return `description is too long (max ${MAX_DESCRIPTION} characters)`
  }
  return null
}

export async function POST(request: NextRequest) {
  if (!hasStudioSecret(request.headers.get('x-agent-studio-secret'), process.env.AGENT_STUDIO_SECRET)) {
    return fail('Unauthorized', 401)
  }
  const body = (await request.json().catch(() => null)) as CreateFlowBody | null
  if (!body) return fail('Invalid JSON body', 400)
  const problem = inputError(body)
  if (problem) return fail(problem, 400)

  const projectId = body.project_id as string
  const displayName = (body.display_name as string).trim()

  const quota = await checkAgentQuota(supabase, projectId)
  if (!quota.ok) return fail(quota.error, quota.status)

  const agentId = randomUUID()
  const name = slugifyAgentName(displayName)
  const backendAgentName = `${name}_${agentId.replaceAll('-', '_')}`
  const configuration = {
    created_via: 'mcp',
    created_by: body.created_by ?? null,
    description: body.description?.trim().slice(0, 500) ?? null,
    workflowMode: true,
    deployment_target: 'classic',
  }

  const { error: insertError } = await supabase.from('pype_voice_agents').insert({
    id: agentId,
    name,
    display_name: displayName,
    agent_type: 'pype_agent',
    configuration,
    project_id: projectId,
    environment: 'dev',
    is_active: true,
  })
  if (insertError) return fail('Failed to create agent record', 500, insertError.message)

  const removeRow = () => supabase.from('pype_voice_agents').delete().eq('id', agentId)

  const built = await runWorkflowBuilder({ instruction: body.description as string })
  if (!built.ok) {
    await removeRow()
    return fail(built.error, 422)
  }

  const deployed = await deployWorkflow(supabase, { id: agentId, configuration }, backendAgentName, built.workflow)
  if (!deployed.ok) {
    await removeRow()
    return fail(deployed.message, deployed.status, deployed.error)
  }

  await recordAgentCreated(supabase, projectId, quota, agentId)

  return NextResponse.json({
    agent_id: agentId,
    name: backendAgentName,
    display_name: displayName,
    project_id: projectId,
    flow_url: flowUrl(projectId, agentId, process.env.NEXT_PUBLIC_APP_URL),
    flow: summarizeWorkflow(built.workflow),
    builder_note: built.reply || undefined,
    warnings: built.warnings.length ? built.warnings.slice(0, 5) : undefined,
    ...(deployed.warning && { deploy_warning: deployed.warning }),
  })
}
