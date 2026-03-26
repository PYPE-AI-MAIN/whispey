import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { createServiceRoleClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  const user = await currentUser()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const email = user?.emailAddresses?.[0]?.emailAddress
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  let body: { projectId?: string; agentId?: string; groups?: { id: string; order: number }[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { projectId, agentId, groups } = body
  if (!projectId || !agentId || !Array.isArray(groups)) {
    return NextResponse.json({ error: 'projectId, agentId, and groups required' }, { status: 400 })
  }

  const access = await getProjectRoleForApi(projectId)
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createServiceRoleClient()
  await Promise.all(
    groups.map((g) =>
      supabase
        .from('pype_voice_metric_groups')
        .update({ order: g.order })
        .eq('id', g.id)
        .eq('project_id', projectId)
        .eq('agent_id', agentId)
        .eq('user_email', email)
    )
  )

  return NextResponse.json({ success: true })
}
