import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { serviceAuthHeaders } from '@/lib/serviceToken'
import {
  getPypeApiBaseUrlForServer,
  isPypeUpstreamUnreachable,
  pypeApiAbortSignal,
  PYPE_API_DEPLOY_TIMEOUT_MS,
} from '@/lib/pypeApiFetch'
import { isViewerForProject } from '@/lib/getProjectRoleForApi'

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

    const baseUrl = getPypeApiBaseUrlForServer()
    if (!baseUrl) {
      return NextResponse.json({ message: 'Missing PYPEAI_API_URL or NEXT_PUBLIC_PYPEAI_API_URL' }, { status: 500 })
    }

    let response: Response
    try {
      response = await fetch(`${baseUrl}/workflow/${encodeURIComponent(agentName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...serviceAuthHeaders() },
        // Forward the real agent row id so the backend stores it as the config's
        // agent_id. Without it save_agent_config() mints a uuid5(agent_name) and
        // every call gets logged to Whispey under that phantom id — invisible in
        // this agent's call logs. rowId is already resolved above.
        body: JSON.stringify({ ...body, agent_id: rowId }),
        signal: pypeApiAbortSignal(PYPE_API_DEPLOY_TIMEOUT_MS),
      })
    } catch (err) {
      if (isPypeUpstreamUnreachable(err)) {
        return NextResponse.json(
          { message: 'Voice backend unreachable. The workflow could not be deployed.', unreachable: true },
          { status: 503 }
        )
      }
      throw err
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      return NextResponse.json(
        { message: `Failed to deploy workflow: ${response.status}`, error: errorText || undefined },
        { status: response.status }
      )
    }

    const data = await response.json().catch(() => ({}))

    // Keep Supabase's copy in sync so the dashboard's own config history/diff UI sees it too.
    await supabase
      .from('pype_voice_agents')
      .update({ configuration: { ...agentRow.configuration, workflow: body.workflow } })
      .eq('id', agentRow.id)

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json({ message: 'Unexpected error deploying workflow', error: err?.message }, { status: 500 })
  }
}
