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
import { catalogIsStale, rescan } from '@/server/analytics/catalog'
import { resolveAnalyticsContext, resolveProjectAnalyticsContext, isDenied } from '@/server/analytics/context'
import { applyDeclarations } from '@/server/analytics/extractor'
import { guarded } from '@/server/analytics/guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabase = createServiceRoleClient()

export const GET = guarded('analytics/fields', async (req: NextRequest) => {
  const agentId = req.nextUrl.searchParams.get('agentId')
  const projectId = req.nextUrl.searchParams.get('projectId')
  const force = req.nextUrl.searchParams.get('refresh') === '1'
  if (!agentId && !projectId) return NextResponse.json({ error: 'agentId or projectId is required' }, { status: 400 })

  if (projectId) return getProjectFields(projectId)
  // unreachable — the guard above requires at least one of agentId/projectId
  if (!agentId) return NextResponse.json({ error: 'agentId or projectId is required' }, { status: 400 })

  const resolved = await resolveAnalyticsContext(agentId)
  if (isDenied(resolved)) return resolved.errorResponse
  const { ctx, agent } = resolved

  const { data: existing } = await supabase
    .from('pype_analytics_fields')
    .select('*')
    .eq('agent_id', agentId)
    .order('coverage_pct', { ascending: false })

  const stale = catalogIsStale(existing ?? [], Date.now())

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

  /**
   * What the agent was told to extract beats what sampling guessed (§11.2).
   *
   * Applied here rather than in the rescan so it also reaches a cached catalog
   * — editing the extractor prompt should change the picker on the next load,
   * not six hours later.
   *
   * The prompt itself is only shown to people the agent route already shows it
   * to; the *types* it implies are not sensitive, being derivable from the data
   * anyway, so a viewer still gets correct yes/no fields and full value lists.
   */
  const described = applyDeclarations(visible, agent.extractorPrompt, {
    includeDescription: resolved.role !== 'viewer',
  })

  return NextResponse.json({
    agent: { id: agent.id, name: agent.name },
    outcome_ranking: agent.outcomeRanking ?? null,
    fields: described,
  })
})

/**
 * Confluence "Analytics Phase 3 and 4 — Build Spec" §3.4: union the field
 * catalogs of every agent in scope. Each agent still gets the same
 * staleness/empty check the agent-scoped route applies (line ~43) — an agent
 * nobody has ever opened the own Analytics page for would otherwise never be
 * scanned, silently emptying the org picker down to whatever other agents
 * happen to already have a catalog.
 *
 * There is no single agent's outcome_ranking here, so it's returned null —
 * ranking a project's outcomes stays an agent-page concept, not an org one.
 */
async function getProjectFields(projectId: string) {
  const resolved = await resolveProjectAnalyticsContext(projectId)
  if (isDenied(resolved)) return resolved.errorResponse
  const { ctx } = resolved

  const [{ data: existingRows }, { data: agents }] = await Promise.all([
    supabase.from('pype_analytics_fields').select('*').in('agent_id', ctx.agentIds).order('coverage_pct', { ascending: false }),
    supabase.from('pype_voice_agents').select('id, field_extractor_prompt').in('id', ctx.agentIds),
  ])
  const extractorPromptByAgent = new Map((agents ?? []).map((a) => [a.id, a.field_extractor_prompt ?? null]))

  const byAgent = new Map<string, any[]>()
  for (const r of existingRows ?? []) {
    const list = byAgent.get(r.agent_id as string) ?? []
    list.push(r)
    byAgent.set(r.agent_id as string, list)
  }
  const scanned = await Promise.all(
    ctx.agentIds.map(async (agentId) => {
      const existing = byAgent.get(agentId) ?? []
      if (!catalogIsStale(existing, Date.now())) return existing
      try {
        return await rescan(agentId, projectId, existing)
      } catch (err) {
        console.error('[analytics/fields] project rescan failed', agentId, err)
        return existing
      }
    })
  )
  const rows = scanned.flat()

  const visible = rows.filter(
    (r) => !ctx.deniedFields.has(r.col as string) && !ctx.deniedFields.has(`${r.col}.${((r.path ?? []) as string[]).join('.')}`)
  )

  // each agent's rows get that agent's own extractor declarations before
  // merging, since two agents can extract the same column differently
  const described = ctx.agentIds.flatMap((id) =>
    applyDeclarations(
      visible.filter((r) => r.agent_id === id),
      extractorPromptByAgent.get(id) ?? null,
      { includeDescription: resolved.role !== 'viewer' }
    )
  )

  // several agents can produce the same field; keep the one with the best coverage
  const byIdentity = new Map<string, (typeof described)[number]>()
  for (const f of described) {
    const key = `${f.col}.${(f.path ?? []).join('.')}`
    const prior = byIdentity.get(key)
    if (!prior || Number(f.coverage_pct) > Number(prior.coverage_pct)) byIdentity.set(key, f)
  }

  return NextResponse.json({
    agent: null,
    outcome_ranking: null,
    fields: [...byIdentity.values()].sort((a, b) => Number(b.coverage_pct) - Number(a.coverage_pct)),
  })
}

