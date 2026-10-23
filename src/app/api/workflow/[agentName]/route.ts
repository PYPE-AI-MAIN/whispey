import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { isViewerForProject } from '@/lib/getProjectRoleForApi'
import { deployWorkflow } from '@/server/workflowDeploy'

// Deploying hot-reloads the running agent worker on the backend (20-30s).
export const maxDuration = 60

const supabase = createServiceRoleClient()

/** Backend name format: {agentName}_{uuid_with_underscores} — mirrors getProjectIdFromAgentBackendName. */
function agentRowIdFromBackendName(agentName: string): string | null {
  const parts = agentName.trim().split('_')
  if (parts.length < 5) return null
  return parts.slice(-5).join('-')
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ agentName: string }> }) {
  try {
    const { agentName } = await params
    if (!agentName) {
      return NextResponse.json({ message: 'Agent name is required' }, { status: 400 })
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(agentName)) {
      return NextResponse.json({ message: 'Invalid agent name' }, { status: 400 })
    }

    const body = await req.json()
    if (!body?.workflow) {
      return NextResponse.json({ message: 'Request body must be { workflow: {...} }' }, { status: 400 })
    }

    const rowId = agentRowIdFromBackendName(agentName)
    if (!rowId) {
      return NextResponse.json({ message: 'Could not resolve agent from name' }, { status: 400 })
    }
    const { data: agentRow } = await supabase
      .from('pype_voice_agents')
      .select('id, project_id, configuration')
      .eq('id', rowId)
      .maybeSingle()
    if (!agentRow) {
      return NextResponse.json({ message: 'Agent not found' }, { status: 404 })
    }
    // Fail closed: blocks viewers AND anyone with no project membership at all —
    // do not swap this for an ad-hoc role check that only fires when a mapping exists.
    if (await isViewerForProject(agentRow.project_id)) {
      return NextResponse.json({ message: 'Forbidden: you do not have permission to deploy this agent' }, { status: 403 })
    }

    const result = await deployWorkflow(supabase, agentRow, agentName, body.workflow)
    if (!result.ok) {
      return NextResponse.json(
        { message: result.message, error: result.error, ...(result.unreachable && { unreachable: true }) },
        { status: result.status }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      ...(result.warning && { warning: result.warning }),
    })
  } catch (err: any) {
    return NextResponse.json({ message: 'Unexpected error deploying workflow', error: err?.message }, { status: 500 })
  }
}
