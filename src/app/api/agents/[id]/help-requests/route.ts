// "Ask Pype for help" from the Agent Studio page. Any member of the agent's
// project may ask; the request becomes a Jira issue for the Pype team.

import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { validateHelpRequest } from '@/lib/helpRequests'
import { fileHelpRequest } from '@/server/helpRequests'

export const runtime = 'nodejs'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: agentId } = await params
  const body = await request.json().catch(() => null)
  const checked = validateHelpRequest(body)
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 })

  const supabase = createServiceRoleClient()
  const { data: agent } = await supabase.from('pype_voice_agents').select('project_id').eq('id', agentId).maybeSingle()
  if (!agent?.project_id) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })

  // Members of the project only (any role — a viewer may still need help).
  const role = await getProjectRoleForApi(agent.project_id as string)
  if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const user = await currentUser()
  const lastCallId = typeof body?.last_call_id === 'string' ? body.last_call_id.slice(0, 100) : null

  const filed = await fileHelpRequest(supabase, {
    ...checked.value,
    source: 'studio',
    projectId: agent.project_id as string,
    agentId,
    requesterEmail: user?.primaryEmailAddress?.emailAddress ?? null,
    lastCallId,
  })
  if (!filed.ok) return NextResponse.json({ error: filed.error }, { status: filed.status })
  return NextResponse.json({ jira_key: filed.jiraKey })
}
