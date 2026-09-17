/**
 * What this agent actually produces — Confluence "Analytics Phase 1 and 2 —
 * Build Spec" §11.1. Feeds the field picker, the filter chips and the
 * outcome-order editor.
 *
 * Rescanned on demand rather than on a schedule: a dashboard is opened far less
 * often than a call is logged, and a cron job over every agent would be work
 * nobody is waiting for.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { JSON_COLS } from '@/server/analytics/spec'
import { scanColumn, inferField } from '@/server/analytics/catalog'
import { resolveAnalyticsContext, isDenied } from '@/server/analytics/context'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabase = createServiceRoleClient()
const STALE_AFTER_MS = 6 * 60 * 60 * 1000

export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agentId')
  const force = req.nextUrl.searchParams.get('refresh') === '1'
  if (!agentId) return NextResponse.json({ error: 'agentId is required' }, { status: 400 })

  const resolved = await resolveAnalyticsContext(agentId)
  if (isDenied(resolved)) return resolved.errorResponse
  const { ctx, agent } = resolved

  const { data: existing } = await supabase
    .from('pype_analytics_fields')
    .select('*')
    .eq('agent_id', agentId)
    .order('coverage_pct', { ascending: false })

  const newest = (existing ?? []).reduce((max, r) => Math.max(max, Date.parse(r.last_seen_at ?? 0)), 0)
  const stale = !existing?.length || Date.now() - newest > STALE_AFTER_MS

  let rows = existing ?? []
  if (stale || force) {
    try {
      rows = await rescan(agentId, agent.projectId, existing ?? [])
    } catch (err) {
      console.error('[analytics/fields] rescan failed', err)
      // a stale catalog still helps someone find a field; an empty page does not
      if (!rows.length) return NextResponse.json({ error: 'Could not read this agent’s fields' }, { status: 500 })
    }
  }

  // the catalog helps people find fields; it must not show one they cannot read
  const visible = rows.filter(
    (r) => !ctx.deniedFields.has(r.col) && !ctx.deniedFields.has(`${r.col}.${(r.path ?? []).join('.')}`)
  )

  return NextResponse.json({
    agent: { id: agent.id, name: agent.name },
    outcome_ranking: agent.outcomeRanking ?? null,
    fields: visible,
  })
}

/**
 * Replaces what we worked out, keeps what a person decided. A confirmed type,
 * an edited label and hand-picked empty values survive a rescan; coverage,
 * cardinality and the value list are always recomputed.
 */
async function rescan(
  agentId: string,
  projectId: string,
  existing: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  const keep = new Map(existing.map((r) => [`${r.col}.${((r.path ?? []) as string[]).join('.')}`, r]))
  const now = new Date().toISOString()
  const out: Record<string, unknown>[] = []

  for (const col of JSON_COLS) {
    for (const stats of await scanColumn(agentId, col)) {
      const inferred = inferField(stats)
      const key = `${col}.${stats.path.join('.')}`
      const prior = keep.get(key)
      const confirmed = prior?.type_confirmed === true

      out.push({
        ...(prior?.id ? { id: prior.id } : {}),
        project_id: projectId,
        agent_id: agentId,
        source: 'voice',
        col,
        path: stats.path,
        // a person's label and confirmed type win over anything we work out
        label: (confirmed && (prior?.label as string)) || inferred.label,
        value_type: confirmed ? prior?.value_type : inferred.value_type,
        encoding: confirmed ? prior?.encoding : inferred.encoding,
        boolean_encoding: confirmed ? prior?.boolean_encoding : (inferred.boolean_encoding ?? null),
        json_shape: inferred.json_shape ?? null,
        sentinels: prior?.sentinels ?? null,
        enum_values: inferred.enum_values ?? prior?.enum_values ?? null,
        is_identity_candidate: inferred.is_identity_candidate,
        type_confirmed: confirmed,
        cardinality_est: inferred.cardinality_est,
        coverage_pct: inferred.coverage_pct,
        blank_count: stats.n_null,
        empty_count: stats.n_sentinel,
        // 'summary ' with a trailing space sits next to 'summary'; this is what
        // lets the picker show one entry instead of two
        name_normalised: stats.path.map((p) => p.trim().toLowerCase()).join('.'),
        is_dimension: inferred.is_dimension,
        first_seen_at: prior?.first_seen_at ?? now,
        last_seen_at: now,
      })
    }
  }

  if (out.length === 0) return existing
  await supabase.from('pype_analytics_fields').delete().eq('agent_id', agentId)
  const { error } = await supabase.from('pype_analytics_fields').insert(out)
  if (error) throw new Error(error.message)
  return out.sort((a, b) => Number(b.coverage_pct) - Number(a.coverage_pct))
}
