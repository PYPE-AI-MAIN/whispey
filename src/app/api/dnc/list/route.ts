import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getSuperAdminEmail } from '@/lib/dnc'
import { withDataPlane, rethrowDataPlane, type DncListQuery, type Row } from '@/server/data-plane'
import { dncProjectId, dncStoresFor } from '@/server/dnc/stores'

export const runtime = 'nodejs'

const SCOPES = new Set(['global', 'project', 'agent'])
const LIMIT = 1000

/** Names for the organizations and agents the entries belong to (control plane, always Pype). */
async function nameEntries(rows: Row[]) {
  const supabase = createServiceRoleClient()
  const ids = (key: string) => [...new Set(rows.map((r) => r[key]).filter(Boolean))] as string[]
  const projectIds = ids('project_id')
  const agentIds = ids('agent_id')
  const [{ data: projects }, { data: agents }] = await Promise.all([
    projectIds.length ? supabase.from('pype_voice_projects').select('id, name').in('id', projectIds) : { data: [] },
    agentIds.length ? supabase.from('pype_voice_agents').select('id, name, display_name').in('id', agentIds) : { data: [] },
  ])
  const projectName = new Map((projects ?? []).map((p: Row) => [p.id, p.name]))
  const agentName = new Map((agents ?? []).map((a: Row) => [a.id, a.display_name || a.name]))
  return rows.map((r) => ({ ...r, project_name: projectName.get(r.project_id) ?? null, agent_name: agentName.get(r.agent_id) ?? null }))
}

/**
 * GET /api/dnc/list?scope=global|project|agent&project_id=&agent_id=&source=auto|manual&q=&with_global=1
 * Superadmin only. Active DNC entries, newest first, with the organization and
 * agent each one belongs to. No scope = every entry. `project_id` also matches
 * the agent entries of that organization. `source=manual` means manual, CSV or API.
 * Global entries always live in Pype; project and agent entries of a customer-held
 * project live in its data plane, so they are listed per project (`project_id`).
 * With `with_global=1` and a project, the global entries are returned too.
 */
export const GET = withDataPlane(async (dp, request: NextRequest) => {
  const admin = await getSuperAdminEmail()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const scope = searchParams.get('scope')
  const source = searchParams.get('source')
  const q = searchParams.get('q')?.trim()
  const digits = q?.replaceAll(/\D/g, '')

  const base: DncListQuery = {
    scope: scope && SCOPES.has(scope) ? (scope as DncListQuery['scope']) : undefined,
    projectId: searchParams.get('project_id') ?? undefined,
    agentId: searchParams.get('agent_id') ?? undefined,
    source: source === 'auto' || source === 'manual' ? source : undefined,
    digits: digits || undefined,
    limit: LIMIT,
  }

  try {
    const projectId = await dncProjectId(base.projectId, base.agentId)
    const { pype, scoped, customerHeld } = await dncStoresFor(dp, projectId)
    const split = !!projectId && (customerHeld || searchParams.get('with_global') === '1')

    let rows: Row[]
    let total: number
    if (split) {
      // Global entries from Pype, project and agent entries from the project's store.
      const parts = await Promise.all([
        !base.scope || base.scope === 'global' ? pype.listEntries({ ...base, scope: 'global', projectId: undefined, agentId: undefined }) : null,
        base.scope === 'global' ? null : scoped.listEntries(base),
      ])
      const got = parts.filter((p) => p !== null)
      rows = got.flatMap((p) => p.rows).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, LIMIT)
      total = got.reduce((n, p) => n + p.total, 0)
    } else {
      ;({ rows, total } = await pype.listEntries(base))
    }
    const entries = await nameEntries(rows)
    return NextResponse.json({ entries, total: total || entries.length, limit: LIMIT, customer_held: customerHeld })
  } catch (error) {
    rethrowDataPlane(error)
    console.error('DNC list error:', error)
    return NextResponse.json({ error: (error as Error).message || 'Failed to load DNC list' }, { status: 500 })
  }
})
