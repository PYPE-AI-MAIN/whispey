// Server-only I/O helpers for reading/writing `pype_voice_agents.call_log_settings`.
// Split out from callLogSettings.ts (which stays pure/I/O-free) because these need
// a Supabase client and the caller's global role. Shared by the download-settings
// PATCH handlers, which both require global-superadmin and both do the same
// fetch-row/404 and read-modify-write-back sequence against `call_log_settings`.

import { NextResponse } from 'next/server'
import { getCallerGlobalRole } from '@/lib/prod-auth'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { normalizeDownloadSettings, getDisallowedColumns, type CallLogSettings, type DownloadSettings } from '@/lib/callLogSettings'

const supabase = createServiceRoleClient()

/**
 * Ready-to-return 403 if the caller is not a global superadmin, or null to
 * continue. Collapses the getCallerGlobalRole + role-check + 403 block
 * repeated across every download-settings PATCH handler (both require
 * superadmin).
 */
export async function requireSuperAdminOrForbidden(userId: string): Promise<NextResponse | null> {
  const globalRole = await getCallerGlobalRole(userId)
  if (globalRole !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

/**
 * Resolves everything a call-logs query route needs to enforce per-user/per-agent
 * column access for one request: whether the caller is a superadmin, their Clerk
 * email, and the concrete set of disallowed columns for this purpose. Shared by
 * the agent- and project-scoped call-logs query routes, which both used to
 * inline this same sequence (role lookup, email extraction, disallowed-columns
 * computation) before filtering `p_select` and stripping rows.
 */
export const resolveColumnAccessForRequest = async (params: {
  userId: string
  userEmail: string | null
  callLogSettings: CallLogSettings | null | undefined
  isDownload: boolean
}): Promise<{ isSuperAdmin: boolean; userEmail: string | null; disallowedColumns: Set<string> }> => {
  const globalRole = await getCallerGlobalRole(params.userId)
  const isSuperAdmin = globalRole === 'superadmin'
  const disallowedColumns = getDisallowedColumns(params.callLogSettings, isSuperAdmin, params.userEmail, params.isDownload)
  return { isSuperAdmin, userEmail: params.userEmail, disallowedColumns }
}

/**
 * Fetches an agent's current (normalized) download settings, or a ready-to-return
 * 404 if the agent doesn't exist. Collapses the
 * `pype_voice_agents.select('call_log_settings').maybeSingle()` + null-check
 * pattern repeated across both download-settings PATCH handlers.
 */
export async function fetchAgentCallLogSettings(
  agentId: string
): Promise<{ current: CallLogSettings; currentDownload: DownloadSettings } | { errorResponse: NextResponse }> {
  const { data: agentRow, error: agentErr } = await supabase
    .from('pype_voice_agents')
    .select('call_log_settings')
    .eq('id', agentId)
    .maybeSingle()

  if (agentErr || !agentRow) {
    return { errorResponse: NextResponse.json({ error: 'Agent not found' }, { status: 404 }) }
  }

  const current = (agentRow.call_log_settings as CallLogSettings | null) ?? {}
  const currentDownload = normalizeDownloadSettings(current.download_settings)
  return { current, currentDownload }
}

/**
 * Writes back `call_log_settings` with `download_settings` replaced by
 * `nextDownload`, preserving any other keys on `current`. Collapses the
 * merge-and-`.update(...).eq('id', agentId)` + error-check pattern repeated
 * across both download-settings PATCH handlers.
 */
export async function updateAgentCallLogSettings(
  agentId: string,
  current: CallLogSettings,
  nextDownload: DownloadSettings
): Promise<NextResponse | null> {
  const nextSettings: CallLogSettings = { ...current, download_settings: nextDownload }
  const { error } = await supabase
    .from('pype_voice_agents')
    .update({ call_log_settings: nextSettings })
    .eq('id', agentId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return null
}
