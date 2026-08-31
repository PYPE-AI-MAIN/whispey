import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { requireSuperAdminOrForbidden, fetchAgentCallLogSettings, updateAgentCallLogSettings } from '@/lib/agentCallLogSettingsStore'

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

  const forbidden = await requireSuperAdminOrForbidden(userId)
  if (forbidden) return forbidden

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

  const fetched = await fetchAgentCallLogSettings(agentId)
  if ('errorResponse' in fetched) return fetched.errorResponse
  const { current, currentDownload } = fetched

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

  const updateError = await updateAgentCallLogSettings(agentId, current, nextDownload)
  if (updateError) return updateError

  return NextResponse.json({ download_settings: nextDownload })
}
