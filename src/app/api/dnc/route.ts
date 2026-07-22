import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { DNC_TABLE, getSuperAdminEmail, normalizePhone } from '@/lib/dnc'

export const runtime = 'nodejs'

/**
 * POST /api/dnc
 * Body: {
 *   numbers: string | string[],   // one or many (CSV upload sends many)
 *   scope: 'global' | 'project',
 *   project_id?: string,          // required when scope='project'
 *   reason?: string,
 *   source?: 'manual' | 'csv' | 'api'
 * }
 * Superadmin only. Adds numbers to the DNC list. Duplicates within a scope are
 * skipped (the partial unique index also enforces this at the DB level).
 */
export async function POST(request: NextRequest) {
  const admin = await getSuperAdminEmail()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: {
    numbers?: string | string[]
    scope?: 'global' | 'project'
    project_id?: string
    reason?: string
    source?: 'manual' | 'csv' | 'api'
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const scope = body.scope
  if (scope !== 'global' && scope !== 'project') {
    return NextResponse.json({ error: "scope must be 'global' or 'project'" }, { status: 400 })
  }
  if (scope === 'project' && !body.project_id) {
    return NextResponse.json({ error: 'project_id is required for project scope' }, { status: 400 })
  }

  const raw = body.numbers
  const inputs = Array.isArray(raw) ? raw : raw != null ? [raw] : []
  if (inputs.length === 0) {
    return NextResponse.json({ error: '`numbers` is required' }, { status: 400 })
  }

  const source = body.source ?? 'manual'
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
      scope,
      project_id: scope === 'project' ? body.project_id : null,
      reason: body.reason ?? null,
      source,
      added_by: admin,
      is_active: true,
    })
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No valid numbers', invalid }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // Skip numbers already active in this scope so we don't trip the unique index.
  const existingQuery = supabase
    .from(DNC_TABLE)
    .select('phone_e164')
    .eq('is_active', true)
    .eq('scope', scope)
    .in('phone_e164', rows.map((r) => r.phone_e164 as string))
  const existing =
    scope === 'project'
      ? await existingQuery.eq('project_id', body.project_id!)
      : await existingQuery
  if (existing.error) {
    console.error('DNC add (dupe check) error:', existing.error)
    return NextResponse.json({ error: 'Failed to add numbers' }, { status: 500 })
  }
  const already = new Set((existing.data ?? []).map((r) => r.phone_e164))
  const toInsert = rows.filter((r) => !already.has(r.phone_e164 as string))

  if (toInsert.length > 0) {
    const { error } = await supabase.from(DNC_TABLE).insert(toInsert)
    if (error) {
      console.error('DNC add (insert) error:', error)
      return NextResponse.json({ error: 'Failed to add numbers' }, { status: 500 })
    }
  }

  return NextResponse.json({
    added: toInsert.length,
    skipped_duplicates: rows.length - toInsert.length,
    invalid,
  })
}
