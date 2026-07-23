import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { DNC_TABLE, getSuperAdminEmail } from '@/lib/dnc'

export const runtime = 'nodejs'

/**
 * GET /api/dnc/list?scope=global|project&project_id=<uuid>&q=<search>
 * Superadmin only. Returns active DNC entries, newest first.
 */
export async function GET(request: NextRequest) {
  const admin = await getSuperAdminEmail()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const scope = searchParams.get('scope')
  const projectId = searchParams.get('project_id')
  const q = searchParams.get('q')?.trim()

  const supabase = createServiceRoleClient()
  let query = supabase
    .from(DNC_TABLE)
    .select('id, phone_e164, phone_raw, scope, project_id, reason, source, added_by, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (scope === 'global' || scope === 'project') query = query.eq('scope', scope)
  if (projectId) query = query.eq('project_id', projectId)
  if (q) query = query.ilike('phone_e164', `%${q.replaceAll(/\D/g, '')}%`)

  const { data, error } = await query.limit(1000)
  if (error) {
    console.error('DNC list error:', error)
    return NextResponse.json({ error: error.message || 'Failed to load DNC list' }, { status: 500 })
  }
  return NextResponse.json({ entries: data ?? [] })
}
