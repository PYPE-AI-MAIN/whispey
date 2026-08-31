import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { getCallerGlobalRole } from '@/lib/prod-auth'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { normalizeDownloadSettings, isAgentDownloadDisabledForUser, type CallLogSettings } from '@/lib/callLogSettings'
import { requireSuperAdminOrForbidden, fetchAgentCallLogSettings, updateAgentCallLogSettings } from '@/lib/agentCallLogSettingsStore'

const supabase = createServiceRoleClient()

/**
 * GET /api/agents/[id]/download-settings
 * Any project member can read this — the FE needs it to decide whether to
 * render the download button and which columns the current user may see.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params
  const { userId } = await auth()
  const user = await currentUser()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: agentRow, error: agentErr } = await supabase
    .from('pype_voice_agents')
    .select('project_id, call_log_settings')
    .eq('id', agentId)
    .maybeSingle()

  if (agentErr || !agentRow?.project_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const access = await getProjectRoleForApi(agentRow.project_id as string)
  if (!access) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const globalRole = await getCallerGlobalRole(userId)
  const isSuperAdmin = globalRole === 'superadmin'
  const userEmail = user?.emailAddresses?.[0]?.emailAddress ?? null
  const downloadSettings = normalizeDownloadSettings(
    (agentRow.call_log_settings as CallLogSettings | null)?.download_settings
  )

  const override = userEmail ? downloadSettings.user_overrides[userEmail.trim().toLowerCase()] : undefined
  const hiddenColumns = isSuperAdmin
    ? []
    : [...downloadSettings.superadmin_only_columns, ...(override?.hidden_view_columns ?? [])]
  const hiddenDownloadColumns = isSuperAdmin
    ? []
    : [...hiddenColumns, ...(override?.hidden_download_columns ?? [])]

  const agentLevelEnabled = downloadSettings.enabled || isSuperAdmin
  const projectLevelDisabled = !isSuperAdmin && access.downloadDisabled === true
  const perAgentUserDisabled = isAgentDownloadDisabledForUser(
    agentRow.call_log_settings as CallLogSettings | null,
    isSuperAdmin,
    userEmail
  )
  const canDownload = agentLevelEnabled && !projectLevelDisabled && !perAgentUserDisabled

  return NextResponse.json({
    enabled: downloadSettings.enabled,
    isSuperAdmin,
    canDownload,
    hiddenColumns: Array.from(new Set(hiddenColumns)),
    hiddenDownloadColumns: Array.from(new Set(hiddenDownloadColumns)),
    // Only superadmins get the raw settings — they're the only ones who edit them.
    settings: isSuperAdmin ? downloadSettings : undefined,
  })
}

/**
 * PATCH /api/agents/[id]/download-settings
 * Body: { enabled?: boolean, superadmin_only_columns?: string[] }
 * Global-superadmin only. Read-modify-write on the whole call_log_settings
 * JSONB blob so other keys inside it are never clobbered.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const forbidden = await requireSuperAdminOrForbidden(userId)
  if (forbidden) return forbidden

  let body: { enabled?: boolean; superadmin_only_columns?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const fetched = await fetchAgentCallLogSettings(agentId)
  if ('errorResponse' in fetched) return fetched.errorResponse
  const { current, currentDownload } = fetched

  const nextDownload = {
    ...currentDownload,
    ...(body.enabled === undefined ? {} : { enabled: body.enabled }),
    ...(body.superadmin_only_columns === undefined
      ? {}
      : { superadmin_only_columns: body.superadmin_only_columns }),
  }

  const updateError = await updateAgentCallLogSettings(agentId, current, nextDownload)
  if (updateError) return updateError

  return NextResponse.json({ download_settings: nextDownload })
}
