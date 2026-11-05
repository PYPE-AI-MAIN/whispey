import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getSuperAdminEmail } from '@/lib/dnc'

export const runtime = 'nodejs'

/**
 * GET /api/dnc/agents?project_id=<uuid>
 * Superadmin only. The organization's active agents with their DNC checker
 * setting, for the DNC page's agent picker and checker switches.
 */
export async function GET(request: NextRequest) {
  const admin = await getSuperAdminEmail()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const projectId = new URL(request.url).searchParams.get('project_id')
  if (!projectId) return NextResponse.json({ error: 'project_id is required' }, { status: 400 })

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('pype_voice_agents')
    .select('id, name, display_name, dnc_checker_enabled')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('DNC agents error:', error)
    return NextResponse.json({ error: 'Failed to load agents' }, { status: 500 })
  }
  const agents = (data ?? []).map((a) => ({
    id: a.id,
    name: a.display_name || a.name,
    dnc_checker_enabled: !!a.dnc_checker_enabled,
  }))
  return NextResponse.json({ agents })
}

/**
 * PATCH /api/dnc/agents
 * Body: { agent_id: string, dnc_checker_enabled: boolean }
 * Superadmin only. Turns one agent's DNC checker on or off.
 */
export async function PATCH(request: NextRequest) {
  const admin = await getSuperAdminEmail()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { agent_id?: unknown; dnc_checker_enabled?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (typeof body.agent_id !== 'string' || !body.agent_id) {
    return NextResponse.json({ error: 'agent_id is required' }, { status: 400 })
  }
  if (typeof body.dnc_checker_enabled !== 'boolean') {
    return NextResponse.json({ error: 'dnc_checker_enabled must be true or false' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('pype_voice_agents')
    .update({ dnc_checker_enabled: body.dnc_checker_enabled })
    .eq('id', body.agent_id)
    .select('id')
  if (error) {
    console.error('DNC checker toggle error:', error)
    return NextResponse.json({ error: 'Failed to update the agent' }, { status: 500 })
  }
  if (!data?.length) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
