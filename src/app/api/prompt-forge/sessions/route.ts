import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { SESSION_FIELDS, agentInProject, ownerEmails, pickFields, requireForgeUser } from '@/server/promptForge/access'

export const runtime = 'nodejs'

// Every session of the agent is listed for anyone with Prompt Forge access;
// `can_edit` says which ones the caller owns (or are unowned, from before owners were recorded).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agent_id')
  const projectId = searchParams.get('project_id')
  if (!agentId || !projectId) {
    return NextResponse.json({ error: 'agent_id and project_id required' }, { status: 400 })
  }

  const access = await requireForgeUser(projectId)
  if ('response' in access) return access.response
  if (!(await agentInProject(agentId, projectId))) return NextResponse.json({ error: 'No such agent in this project' }, { status: 403 })

  try {
    const { data, error } = await createServiceRoleClient()
      .from('pype_voice_promptforge_sessions')
      .select('*')
      .eq('agent_id', agentId)
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false })
    if (error) throw error
    const ids = (data ?? []).map((s) => s.id)
    const [emails, { data: versionRows }] = await Promise.all([
      ownerEmails((data ?? []).map((s) => s.created_by)),
      ids.length
        ? createServiceRoleClient().from('pype_voice_promptforge_session_versions').select('session_id').in('session_id', ids)
        : Promise.resolve({ data: [] as { session_id: string }[] }),
    ])
    const versionCount = new Map<string, number>()
    for (const v of versionRows ?? []) versionCount.set(v.session_id, (versionCount.get(v.session_id) ?? 0) + 1)
    return NextResponse.json((data ?? []).map((s) => ({
      ...s,
      owner_email: s.created_by ? emails[s.created_by] ?? null : null,
      is_mine: s.created_by === access.user.userId,
      can_edit: !s.created_by || s.created_by === access.user.userId,
      version_count: versionCount.get(s.id) ?? 0,
    })))
  } catch (err: any) {
    console.error('[prompt-forge/sessions GET]', err)
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 })
  }
}

// Creates a session owned by the caller — empty, or a copy (Duplicate) when the body carries its fields.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agent_id, project_id } = body
    if (!agent_id || !project_id) {
      return NextResponse.json({ error: 'agent_id and project_id required' }, { status: 400 })
    }
    const access = await requireForgeUser(project_id)
    if ('response' in access) return access.response
    if (!(await agentInProject(agent_id, project_id))) return NextResponse.json({ error: 'No such agent in this project' }, { status: 403 })

    const { data, error } = await createServiceRoleClient()
      .from('pype_voice_promptforge_sessions')
      .insert({
        name: 'Untitled session',
        system_prompt: '',
        variables: [],
        tools: [],
        messages: [],
        // left empty so the page uses the agent's own model until someone picks another
        model: null,
        provider: null,
        temperature: null,
        ...pickFields(body, SESSION_FIELDS),
        agent_id,
        project_id,
        created_by: access.user.userId,
      })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ ...data, owner_email: access.user.email, can_edit: true }, { status: 201 })
  } catch (err: any) {
    console.error('[prompt-forge/sessions POST]', err)
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 })
  }
}
