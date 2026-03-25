import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { createServiceRoleClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  const user = await currentUser()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const email = user?.emailAddresses?.[0]?.emailAddress
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')
  const agentId = searchParams.get('agentId')
  if (!projectId || !agentId) {
    return NextResponse.json({ error: 'projectId and agentId required' }, { status: 400 })
  }

  const access = await getProjectRoleForApi(projectId)
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('pype_voice_metric_groups')
    .select('*')
    .eq('project_id', projectId)
    .eq('agent_id', agentId)
    .eq('user_email', email)
    .order('order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data: data ?? [] })
}

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

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const projectId = body.project_id as string
  const agentId = body.agent_id as string
  if (!projectId || !agentId) {
    return NextResponse.json({ error: 'project_id and agent_id required' }, { status: 400 })
  }

  const access = await getProjectRoleForApi(projectId)
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (body.user_email !== email) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('pype_voice_metric_groups')
    .insert({
      name: body.name,
      project_id: projectId,
      agent_id: agentId,
      user_email: email,
      metric_ids: body.metric_ids,
      chart_ids: body.chart_ids,
      order: body.order,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ data }, { status: 201 })
}
