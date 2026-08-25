// Server-side helpers for `pype_voice_agents.call_log_settings` — the per-agent
// download/column-visibility policy enforced in the call-logs query/count routes
// and read/written by the download-settings admin APIs.

export interface UserColumnOverride {
  hidden_view_columns: string[]
  hidden_download_columns: string[]
}

export interface DownloadSettings {
  enabled: boolean
  superadmin_only_columns: string[]
  user_overrides: Record<string, UserColumnOverride>
}

export interface CallLogSettings {
  download_settings?: Partial<DownloadSettings>
}

export const DEFAULT_DOWNLOAD_SETTINGS: DownloadSettings = {
  enabled: true,
  superadmin_only_columns: [],
  user_overrides: {},
}

/**
 * Normalizes one user_overrides entry. Old data may still be shaped as
 * `{ hidden_columns: string[] }` from before view/download restrictions were
 * split apart — that key is ignored (not migrated) since this predates prod data.
 */
const normalizeUserOverride = (raw: unknown): UserColumnOverride => {
  const override = (raw && typeof raw === 'object' ? raw : {}) as Partial<UserColumnOverride>
  return {
    hidden_view_columns: Array.isArray(override.hidden_view_columns) ? override.hidden_view_columns : [],
    hidden_download_columns: Array.isArray(override.hidden_download_columns) ? override.hidden_download_columns : [],
  }
}

export const normalizeDownloadSettings = (
  raw: Partial<DownloadSettings> | null | undefined
): DownloadSettings => {
  const rawOverrides = raw?.user_overrides && typeof raw.user_overrides === 'object' ? raw.user_overrides : {}
  const user_overrides: Record<string, UserColumnOverride> = {}
  for (const email of Object.keys(rawOverrides)) {
    user_overrides[email] = normalizeUserOverride((rawOverrides as Record<string, unknown>)[email])
  }
  return {
    enabled: raw?.enabled ?? DEFAULT_DOWNLOAD_SETTINGS.enabled,
    superadmin_only_columns: Array.isArray(raw?.superadmin_only_columns) ? raw!.superadmin_only_columns : [],
    user_overrides,
  }
}

/**
 * Columns the requesting user must never see/download for this agent.
 * Superadmins have no restrictions — everything below only applies to non-superadmins.
 *
 * `forDownload` additionally unions in `hidden_download_columns` — columns that
 * still show on-screen but are excluded specifically from CSV export.
 */
export const getDisallowedColumns = (
  settings: CallLogSettings | null | undefined,
  isSuperAdmin: boolean,
  userEmail: string | null,
  forDownload = false
): Set<string> => {
  if (isSuperAdmin) return new Set()
  const download = normalizeDownloadSettings(settings?.download_settings)
  const disallowed = new Set(download.superadmin_only_columns)
  const override = userEmail ? download.user_overrides[userEmail] : undefined
  override?.hidden_view_columns.forEach(col => disallowed.add(col))
  if (forDownload) {
    override?.hidden_download_columns.forEach(col => disallowed.add(col))
  }
  return disallowed
}

/**
 * Filters a p_select value (comma-separated string, array of column names, or '*')
 * to drop disallowed columns. '*' is left as-is — the RPC/table select doesn't
 * support excluding columns from '*' at this layer, so callers selecting '*'
 * should be treated as ineligible for restricted columns by other means.
 */
export const filterSelectColumns = (
  pSelect: unknown,
  disallowed: Set<string>
): unknown => {
  if (disallowed.size === 0) return pSelect
  if (Array.isArray(pSelect)) {
    return pSelect.filter(col => !disallowed.has(String(col).trim()))
  }
  if (typeof pSelect === 'string' && pSelect !== '*') {
    return pSelect
      .split(',')
      .map(col => col.trim())
      .filter(col => col && !disallowed.has(col))
      .join(',')
  }
  return pSelect
}
