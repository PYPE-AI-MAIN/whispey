import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getCallerGlobalRole } from '@/lib/prod-auth'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { normalizeDownloadSettings, type CallLogSettings } from '@/lib/callLogSettings'

const supabase = createServiceRoleClient()

const BASIC_CALL_LOG_COLUMNS = [
  'customer_number', 'call_ended_reason', 'call_started_at', 'call_ended_at',
  'duration_seconds', 'recording_url', 'environment', 'avg_latency',
  'total_llm_cost', 'total_tts_cost', 'total_stt_cost', 'tags', 'flag',
]

/**
 * GET /api/admin/users/[userId]/agent-access
 * Superadmin-only. Lists every agent this user has project access to, along
 * with the agent's current call_log_settings so the admin page can render a
 * per-column visibility checklist scoped to that agent + user.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: targetUserId } = await params
  const { userId: callerId } = await auth()
  if (!callerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const callerRole = await getCallerGlobalRole(callerId)
  if (callerRole !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: targetUser, error: userErr } = await supabase
    .from('pype_voice_users')
    .select('id, email, first_name, last_name, profile_image_url, created_at, clerk_id, roles')
    .eq('id', targetUserId)
    .maybeSingle()

  if (userErr || !targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { data: mappings, error: mappingErr } = await supabase
    .from('pype_voice_email_project_mapping')
    .select(`
      project_id, role, permissions,
      project:pype_voice_projects!inner ( id, name )
    `)
    .or(`clerk_id.eq.${targetUser.clerk_id},email.ilike.${targetUser.email}`)
    .or('is_active.is.null,is_active.eq.true')

  if (mappingErr) {
    return NextResponse.json({ error: mappingErr.message }, { status: 500 })
  }

  const projectIds = Array.from(new Set((mappings ?? []).map(m => m.project_id as string)))
  const projectById = new Map((mappings ?? []).map((m: any) => [m.project_id, m.project]))
  const downloadDisabledByProject = new Map(
    (mappings ?? []).map((m: any) => [m.project_id, (m.permissions as { download_disabled?: boolean } | null)?.download_disabled === true])
  )

  const { data: agents, error: agentsErr } = await supabase
    .from('pype_voice_agents')
    .select('id, name, project_id, call_log_settings')
    .in('project_id', projectIds.length > 0 ? projectIds : ['00000000-0000-0000-0000-000000000000'])

  if (agentsErr) {
    return NextResponse.json({ error: agentsErr.message }, { status: 500 })
  }

  const projects = projectIds.map(projectId => {
    const project = projectById.get(projectId)
    const projectAgents = (agents ?? [])
      .filter(a => a.project_id === projectId)
      .map(a => {
        const download = normalizeDownloadSettings(
          (a.call_log_settings as CallLogSettings | null)?.download_settings
        )
        const override = download.user_overrides[targetUser.email]
        return {
          id: a.id,
          name: a.name,
          superadminOnlyColumns: download.superadmin_only_columns,
          hiddenViewColumnsForUser: override?.hidden_view_columns ?? [],
          hiddenDownloadColumnsForUser: override?.hidden_download_columns ?? [],
          downloadDisabledForUser: override?.download_disabled ?? false,
        }
      })
    return {
      id: projectId,
      name: project?.name ?? projectId,
      downloadDisabled: downloadDisabledByProject.get(projectId) ?? false,
      agents: projectAgents,
    }
  })

  return NextResponse.json({
    user: {
      id: targetUser.id,
      email: targetUser.email,
      first_name: targetUser.first_name,
      last_name: targetUser.last_name,
      profile_image_url: targetUser.profile_image_url,
      created_at: targetUser.created_at,
      globalRole: targetUser.roles?.globalRole ?? 'user',
    },
    projects,
    availableColumns: BASIC_CALL_LOG_COLUMNS,
  })
}

/**
 * PATCH /api/admin/users/[userId]/agent-access
 * Body: { project_id: string, download_disabled: boolean }
 * Superadmin-only — toggles this user's ability to download call logs in one
 * project, stored on their pype_voice_email_project_mapping.permissions row.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId: targetUserId } = await params
  const { userId: callerId } = await auth()
  if (!callerId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const callerRole = await getCallerGlobalRole(callerId)
  if (callerRole !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { project_id?: string; download_disabled?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const projectId = body.project_id
  if (!projectId || typeof body.download_disabled !== 'boolean') {
    return NextResponse.json({ error: 'project_id and download_disabled are required' }, { status: 400 })
  }

  const { data: targetUser, error: userErr } = await supabase
    .from('pype_voice_users')
    .select('email, clerk_id')
    .eq('id', targetUserId)
    .maybeSingle()

  if (userErr || !targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { data: mapping, error: mappingErr } = await supabase
    .from('pype_voice_email_project_mapping')
    .select('id, permissions')
    .eq('project_id', projectId)
    .or(`clerk_id.eq.${targetUser.clerk_id},email.ilike.${targetUser.email}`)
    .or('is_active.is.null,is_active.eq.true')
    .maybeSingle()

  if (mappingErr || !mapping) {
    return NextResponse.json({ error: 'Project membership not found' }, { status: 404 })
  }

  const nextPermissions = { ...(mapping.permissions as Record<string, unknown> | null), download_disabled: body.download_disabled }

  const { error: updateErr } = await supabase
    .from('pype_voice_email_project_mapping')
    .update({ permissions: nextPermissions })
    .eq('id', mapping.id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ download_disabled: body.download_disabled })
}
