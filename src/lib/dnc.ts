// Server-only DNC (Do Not Call) helpers: phone normalization, list lookup, and
// the superadmin gate used by the /api/dnc routes and the settings/dnc UI.
import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { isPlatformAdmin } from '@/lib/isPlatformAdmin'

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
  let digits = raw.replaceAll(/\D/g, '')
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

/** Coerce a `string | string[]` request field into an array (empty when absent). */
export function toNumbersArray(raw: string | string[] | null | undefined): string[] {
  if (Array.isArray(raw)) return raw
  if (raw === null || raw === undefined) return []
  return [raw]
}

export type DncScope = 'global' | 'project' | 'agent'

export interface DncRowMeta {
  scope: DncScope
  /** Required for 'project' and 'agent' (the agent's own project). */
  projectId: string | null
  /** Required for 'agent'. */
  agentId?: string | null
  reason: string | null
  source: string
  addedBy: string
}

/**
 * Normalize + dedupe raw inputs into insertable DNC rows.
 * Returns the rows plus the list of inputs that failed normalization.
 */
export function buildDncRows(inputs: string[], meta: DncRowMeta): {
  rows: Record<string, unknown>[]
  invalid: string[]
} {
  const invalid: string[] = []
  const seen = new Set<string>()
  const rows: Record<string, unknown>[] = []
  for (const input of inputs) {
    const e164 = normalizePhone(input)
    if (!e164) {
      invalid.push(input)
      continue
    }
    if (seen.has(e164)) continue // dedupe within this request
    seen.add(e164)
    rows.push({
      phone_e164: e164,
      phone_raw: input,
      scope: meta.scope,
      project_id: meta.scope === 'global' ? null : meta.projectId,
      agent_id: meta.scope === 'agent' ? (meta.agentId ?? null) : null,
      reason: meta.reason,
      source: meta.source,
      added_by: meta.addedBy,
      is_active: true,
    })
  }
  return { rows, invalid }
}

export interface DncCheckResult {
  input: string
  normalized: string | null
  blocked: boolean
  scope?: DncScope
}

/**
 * The PostgREST filter for rows that apply to a call: global rows always,
 * project rows for its project, agent rows (e.g. added by the DNC checker) for
 * its agent only. Same rule as the backend (utils/dnc.py) and the scheduler.
 */
export function dncScopeFilter(projectId?: string | null, agentId?: string | null): string {
  const clauses = ['scope.eq.global']
  if (projectId) clauses.push(`and(scope.eq.project,project_id.eq.${projectId})`)
  if (agentId) clauses.push(`and(scope.eq.agent,agent_id.eq.${agentId})`)
  return clauses.join(',')
}

// When a number is blocked at more than one level, the widest one is reported.
const SCOPE_RANK: Record<DncScope, number> = { global: 3, project: 2, agent: 1 }

/**
 * Check one or more numbers against the DNC list for a given project and agent.
 * A number is blocked if an active row matches its normalized form AND the row
 * is global, scoped to `projectId`, or scoped to `agentId`. Unparseable numbers
 * are treated as NOT blocked (they can't be dialed meaningfully anyway) but
 * flagged normalized:null.
 */
export async function checkDncNumbers(
  numbers: string[],
  projectId?: string | null,
  agentId?: string | null
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
  const blockedMap = new Map<string, DncScope>()
  for (let i = 0; i < lookup.length; i += CHUNK) {
    const slice = lookup.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from(DNC_TABLE)
      .select('phone_e164, scope, project_id, agent_id')
      .eq('is_active', true)
      .in('phone_e164', slice)
      .or(dncScopeFilter(projectId, agentId))
    if (error) throw error
    for (const row of data ?? []) {
      const scope = row.scope as DncScope
      const existing = blockedMap.get(row.phone_e164)
      if (!existing || SCOPE_RANK[scope] > SCOPE_RANK[existing]) blockedMap.set(row.phone_e164, scope)
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
    .select('roles, email')
    .eq('clerk_id', userId)
    .single()
  // Platform admins (PYPE_ADMINS) get full superadmin-equivalent access —
  // same one-directional rule as getCallerGlobalRole in prod-auth.ts.
  if (data?.roles?.globalRole !== 'superadmin' && !isPlatformAdmin(data?.email)) return null
  const user = await currentUser()
  return user?.emailAddresses?.[0]?.emailAddress ?? userId
}
