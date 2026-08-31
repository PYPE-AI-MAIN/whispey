import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getCallerGlobalRole } from '@/lib/prod-auth'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { normalizeDownloadSettings, type CallLogSettings } from '@/lib/callLogSettings'

const supabase = createServiceRoleClient()

/**
 * PATCH /api/agents/[id]/download-settings/user-overrides
 * Body: { email: string, hidden_view_columns: string[], hidden_download_columns: string[], download_disabled?: boolean }
 * Global-superadmin only — sets the extra columns hidden for one specific
 * user on top of the agent's superadmin_only_columns baseline. hidden_view_columns
 * hides a column everywhere (table + downloads); hidden_download_columns leaves it
 * visible on-screen but strips it from CSV exports. download_disabled blocks this
 * user from downloading call logs on this specific agent entirely, independent of
 * the project-wide download switch.
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

  const globalRole = await getCallerGlobalRole(userId)
  if (globalRole !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { email?: string; hidden_view_columns?: string[]; hidden_download_columns?: string[]; download_disabled?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const hiddenViewColumns = body.hidden_view_columns
  const hiddenDownloadColumns = body.hidden_download_columns
  const downloadDisabled = body.download_disabled === true
  if (!email || !Array.isArray(hiddenViewColumns) || !Array.isArray(hiddenDownloadColumns)) {
    return NextResponse.json({ error: 'email, hidden_view_columns and hidden_download_columns are required' }, { status: 400 })
  }

  const { data: agentRow, error: agentErr } = await supabase
    .from('pype_voice_agents')
    .select('call_log_settings')
    .eq('id', agentId)
    .maybeSingle()

  if (agentErr || !agentRow) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  const current = (agentRow.call_log_settings as CallLogSettings | null) ?? {}
  const currentDownload = normalizeDownloadSettings(current.download_settings)

  const nextUserOverrides = { ...currentDownload.user_overrides }
  if (hiddenViewColumns.length === 0 && hiddenDownloadColumns.length === 0 && !downloadDisabled) {
    delete nextUserOverrides[email]
  } else {
    nextUserOverrides[email] = {
      hidden_view_columns: hiddenViewColumns,
      hidden_download_columns: hiddenDownloadColumns,
      download_disabled: downloadDisabled,
    }
  }

  const nextDownload = { ...currentDownload, user_overrides: nextUserOverrides }
  const nextSettings: CallLogSettings = { ...current, download_settings: nextDownload }

  const { error } = await supabase
    .from('pype_voice_agents')
    .update({ call_log_settings: nextSettings })
    .eq('id', agentId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ download_settings: nextDownload })
}
