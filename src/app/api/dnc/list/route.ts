import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { DNC_TABLE, getSuperAdminEmail } from '@/lib/dnc'

export const runtime = 'nodejs'

const SCOPES = new Set(['global', 'project', 'agent'])
const LIMIT = 1000

type Named = { name: string | null; display_name?: string | null }
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

/**
 * GET /api/dnc/list?scope=global|project|agent&project_id=&agent_id=&source=auto|manual&q=
 * Superadmin only. Active DNC entries, newest first, with the organization and
 * agent each one belongs to. No scope = every entry. `project_id` also matches
 * the agent entries of that organization. `source=manual` means manual, CSV or API.
 */
export async function GET(request: NextRequest) {
  const admin = await getSuperAdminEmail()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const scope = searchParams.get('scope')
  const projectId = searchParams.get('project_id')
  const agentId = searchParams.get('agent_id')
  const source = searchParams.get('source')
  const q = searchParams.get('q')?.trim()

  const supabase = createServiceRoleClient()
  let query = supabase
    .from(DNC_TABLE)
    .select(
      'id, phone_e164, phone_raw, scope, project_id, agent_id, call_log_id, reason, source, added_by, created_at, ' +
        'project:pype_voice_projects(name), agent:pype_voice_agents(name, display_name)',
      { count: 'exact' },
    )
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (scope && SCOPES.has(scope)) query = query.eq('scope', scope)
  if (projectId) query = query.eq('project_id', projectId)
  if (agentId) query = query.eq('agent_id', agentId)
  if (source === 'auto') query = query.eq('source', 'auto')
  if (source === 'manual') query = query.neq('source', 'auto')
  if (q) {
    const digits = q.replaceAll(/\D/g, '')
    if (digits) query = query.ilike('phone_e164', `%${digits}%`)
  }

  const { data, error, count } = await query.limit(LIMIT)
  if (error) {
    console.error('DNC list error:', error)
    return NextResponse.json({ error: error.message || 'Failed to load DNC list' }, { status: 500 })
  }

  const entries = ((data ?? []) as unknown as Array<Record<string, unknown> & { project?: Named | Named[]; agent?: Named | Named[] }>).map(
    ({ project, agent, ...row }) => {
      const p = one(project)
      const a = one(agent)
      return { ...row, project_name: p?.name ?? null, agent_name: a ? a.display_name || a.name : null }
    },
  )
  return NextResponse.json({ entries, total: count ?? entries.length, limit: LIMIT })
}
