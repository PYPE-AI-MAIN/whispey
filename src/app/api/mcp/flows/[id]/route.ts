// src/app/api/mcp/flows/[id]/route.ts
//
// Change a conversation-flow agent through the MCP with a plain-language
// instruction ("add a transfer to a human if the caller is angry"). This is
// exactly one AI Builder chat turn on the canvas: the current flow plus the
// instruction go to the builder, the full new flow comes back, it is checked
// with the canvas lint and deployed. The live flow is untouched unless the
// new one passes and deploys.
//
// Same ownership rule as single-prompt agents: only the MCP key that created
// the agent may change it.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { flowUrl, hasStudioSecret } from '@/lib/mcpAgentHelpers'
import { safeParseWorkflow } from '@/lib/workflow/schema'
import { summarizeWorkflow } from '@/lib/workflow/builderOutput'
import { loadEditableAgent } from '@/server/mcpAgentDb'
import { runWorkflowBuilder } from '@/server/workflowBuilder'
import { deployWorkflow } from '@/server/workflowDeploy'

export const maxDuration = 300

const supabase = createServiceRoleClient()

const MAX_INSTRUCTION = 20_000

const fail = (error: string, status: number, details?: unknown) =>
  NextResponse.json(details === undefined ? { error } : { error, details }, { status })

interface UpdateFlowBody {
  project_id?: string
  instruction?: string
  created_by?: string
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasStudioSecret(request.headers.get('x-agent-studio-secret'), process.env.AGENT_STUDIO_SECRET)) {
    return fail('Unauthorized', 401)
  }
  const { id: agentId } = await params
  const body = (await request.json().catch(() => null)) as UpdateFlowBody | null
  if (!body) return fail('Invalid JSON body', 400)
  if (!body.project_id || !body.instruction?.trim()) return fail('project_id and instruction are required', 400)
  if (body.instruction.length > MAX_INSTRUCTION) {
    return fail(`instruction is too long (max ${MAX_INSTRUCTION} characters)`, 400)
  }

  const owned = await loadEditableAgent(supabase, agentId, body.project_id, body.created_by)
  if (!owned.ok) return fail(owned.error, owned.status)
  if (owned.agent.configuration?.workflowMode !== true) {
    return fail('This agent is not a conversation flow — use update_agent to change it', 400)
  }

  // The canvas loads the flow from the same place (configuration.workflow).
  const existing = safeParseWorkflow(owned.agent.configuration?.workflow)
  const current = existing.success ? existing.data : null

  const built = await runWorkflowBuilder({ instruction: body.instruction, current })
  if (!built.ok) return fail(built.error, 422)

  const backendAgentName = `${owned.agent.name}_${agentId.replaceAll('-', '_')}`
  const deployed = await deployWorkflow(supabase, owned.agent, backendAgentName, built.workflow)
  if (!deployed.ok) return fail(deployed.message, deployed.status, deployed.error)

  return NextResponse.json({
    agent_id: agentId,
    project_id: body.project_id,
    flow_url: flowUrl(body.project_id, agentId, process.env.NEXT_PUBLIC_APP_URL),
    flow: summarizeWorkflow(built.workflow),
    builder_note: built.reply || undefined,
    warnings: built.warnings.length ? built.warnings.slice(0, 5) : undefined,
    ...(deployed.warning && { deploy_warning: deployed.warning }),
  })
}
