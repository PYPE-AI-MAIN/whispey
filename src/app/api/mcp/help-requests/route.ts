// "Ask Pype for help" from Claude, through the MCP (raise_help_request tool).
// Auth: X-Agent-Studio-Secret, same as the other /api/mcp routes — the MCP
// Agent Studio service has already resolved the caller's project scope.

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { hasStudioSecret } from '@/lib/mcpAgentHelpers'
import { validateHelpRequest } from '@/lib/helpRequests'
import { fileHelpRequest } from '@/server/helpRequests'

export async function POST(request: NextRequest) {
  if (!hasStudioSecret(request.headers.get('x-agent-studio-secret'), process.env.AGENT_STUDIO_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json().catch(() => null)
  if (!body?.project_id) return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
  const checked = validateHelpRequest(body)
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 })

  const filed = await fileHelpRequest(createServiceRoleClient(), {
    ...checked.value,
    source: 'mcp',
    projectId: String(body.project_id),
    agentId: typeof body.agent_id === 'string' && body.agent_id ? body.agent_id : null,
    mcpClientId: typeof body.created_by === 'string' ? body.created_by : null,
  })
  if (!filed.ok) return NextResponse.json({ error: filed.error }, { status: filed.status })
  return NextResponse.json({ jira_key: filed.jiraKey })
}
