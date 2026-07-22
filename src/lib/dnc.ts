// Server-only DNC (Do Not Call) helpers: phone normalization, list lookup, and
// the superadmin gate used by the /api/dnc routes and the settings/dnc UI.
import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'

export const DNC_TABLE = 'pype_voice_dnc_list'

/**
 * Normalize a raw phone number to E.164 (default region India / +91).
 * Dependency-free and deterministic — the SAME rules must exist in the BE
 * (utils/dnc.py) so a number stored from one service matches a lookup from
 * another. Returns null when there aren't enough digits to be a real number.
 */
export function normalizePhone(raw: string, defaultCountryCode = '91'): string | null {
  if (!raw) return null
  const hadPlus = raw.trim().startsWith('+')
  let digits = raw.replace(/\D/g, '')
  if (!digits) return null

  // International prefix "00xxxx" -> treat the rest as already country-coded.
  if (!hadPlus && digits.startsWith('00')) {
    digits = digits.slice(2)
    return digits.length >= 8 ? `+${digits}` : null
  }

  // Explicit "+<countrycode>..." — trust it as-is.
  if (hadPlus) {
    return digits.length >= 8 ? `+${digits}` : null
  }

  // National number with a leading trunk 0 (e.g. 09876543210) -> strip it.
  if (digits.startsWith('0')) digits = digits.replace(/^0+/, '')

  // Already carries the default country code (e.g. 919876543210).
  if (digits.startsWith(defaultCountryCode) && digits.length > 10) {
    return `+${digits}`
  }

  // Bare national number -> prepend the default country code.
  if (digits.length === 10) return `+${defaultCountryCode}${digits}`

  // Anything else with enough digits: assume it already includes a country code.
  return digits.length >= 8 ? `+${digits}` : null
}

export interface DncCheckResult {
  input: string
  normalized: string | null
  blocked: boolean
  scope?: 'global' | 'project'
}

/**
 * Check one or more numbers against the DNC list for a given project context.
 * A number is blocked if an active row matches its normalized form AND the row
 * is either global or scoped to `projectId`. Unparseable numbers are treated as
 * NOT blocked (they can't be dialed meaningfully anyway) but flagged normalized:null.
 */
export async function checkDncNumbers(
  numbers: string[],
  projectId?: string | null
): Promise<DncCheckResult[]> {
  const supabase = createServiceRoleClient()
  const normalized = numbers.map((n) => ({ input: n, normalized: normalizePhone(n) }))
  const lookup = [...new Set(normalized.map((n) => n.normalized).filter(Boolean))] as string[]

  if (lookup.length === 0) {
    return normalized.map((n) => ({ ...n, blocked: false }))
  }

  // Chunk the `.in()` lookup so large campaign uploads don't blow past query
  // limits. 200 numbers per query is comfortably within Supabase/PostgREST bounds.
  const CHUNK = 200
  const blockedMap = new Map<string, 'global' | 'project'>()
  for (let i = 0; i < lookup.length; i += CHUNK) {
    const slice = lookup.slice(i, i + CHUNK)
    let query = supabase
      .from(DNC_TABLE)
      .select('phone_e164, scope, project_id')
      .eq('is_active', true)
      .in('phone_e164', slice)

    // Match global rows always; project rows only for this project.
    if (projectId) {
      query = query.or(`scope.eq.global,and(scope.eq.project,project_id.eq.${projectId})`)
    } else {
      query = query.eq('scope', 'global')
    }

    const { data, error } = await query
    if (error) throw error
    for (const row of data ?? []) {
      // Prefer 'global' label if a number is blocked both globally and per-project.
      const existing = blockedMap.get(row.phone_e164)
      if (existing !== 'global') blockedMap.set(row.phone_e164, row.scope)
    }
  }

  return normalized.map((n) => ({
    ...n,
    blocked: n.normalized ? blockedMap.has(n.normalized) : false,
    scope: n.normalized ? blockedMap.get(n.normalized) : undefined,
  }))
}

/**
 * Returns the current user's email if they are a global superadmin, else null.
 * DNC management + viewing is superadmin-only.
 */
export async function getSuperAdminEmail(): Promise<string | null> {
  const { userId } = await auth()
  if (!userId) return null
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('pype_voice_users')
    .select('roles')
    .eq('clerk_id', userId)
    .single()
  if (data?.roles?.globalRole !== 'superadmin') return null
  const user = await currentUser()
  return user?.emailAddresses?.[0]?.emailAddress ?? userId
}
