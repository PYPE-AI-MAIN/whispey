/**
 * The org QA tab: every agent in the project side by side.
 *
 * Answers one question — which agent needs attention today — and nothing else.
 * Detail lives on the agent's own QA page.
 */
import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/server/analytics/guard'
import { resolveProjectAccess, isQaDenied, qaDb } from '@/server/qa/access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WINDOW_DAYS = 7

type IssueType = { key: string; label: string; priority: string; is_positive: boolean }
type StatsRow = { agent_id: string; run_date: string; calls_total: number; calls_sampled: number; issue_counts: unknown; metrics: unknown }
type AgentRow = { id: string; name: string; qa_config: unknown }
type InsightSummary = { id: string; headline: string; severity: string }

function buildAgentRow(
  a: AgentRow,
  latest: StatsRow | undefined,
  types: Map<string, IssueType>,
  insight: InsightSummary | null,
) {
  const counts = (latest?.issue_counts || {}) as Record<string, { random?: number; pct?: number | null }>

  const p0 = Object.entries(counts).filter(([k]) => types.get(k)?.priority === 'P0' && !types.get(k)?.is_positive).length
  const worst = Object.entries(counts)
    .filter(([k]) => !types.get(k)?.is_positive)
    .sort((x, y) => (y[1].pct ?? 0) - (x[1].pct ?? 0))[0]

  return {
    id: a.id,
    name: a.name,
    enabled: Boolean((a.qa_config as { enabled?: boolean } | null)?.enabled),
    lastChecked: latest?.run_date ?? null,
    callsTotal: latest?.calls_total ?? 0,
    sampled: latest?.calls_sampled ?? 0,
    p0Count: p0,
    topIssue: worst ? { key: worst[0], label: types.get(worst[0])?.label || worst[0], pct: worst[1].pct ?? null } : null,
    insight,
  }
}

/** Project-wide issue totals over the window — how many calls, across how many agents. */
function buildIssueTotals(stats: StatsRow[], types: Map<string, IssueType>) {
  const totals = new Map<string, { calls: number; agents: Set<string> }>()
  for (const row of stats) {
    for (const [key, c] of Object.entries((row.issue_counts || {}) as Record<string, { random?: number; flagged?: number }>)) {
      if (types.get(key)?.is_positive) continue
      if (!totals.has(key)) totals.set(key, { calls: 0, agents: new Set() })
      const t = totals.get(key)!
      t.calls += (c.random || 0) + (c.flagged || 0)
      t.agents.add(row.agent_id)
    }
  }
  return totals
}

export const GET = guarded('qa/project', async (req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) => {
  const { projectId } = await ctx.params

  const access = await resolveProjectAccess(projectId)
  if (isQaDenied(access)) return NextResponse.json({ error: access.error }, { status: access.status })

  if (!access.agentIds.length) {
    return NextResponse.json({ agents: [], openInsights: [], issues: [] })
  }

  const since = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString().slice(0, 10)

  const [agentsRes, statsRes, insightsRes, typesRes] = await Promise.all([
    qaDb.from('pype_voice_agents').select('id, name, qa_config').in('id', access.agentIds),
    qaDb
      .from('qa_daily_stats')
      .select('agent_id, run_date, calls_total, calls_sampled, issue_counts, metrics')
      .in('agent_id', access.agentIds)
      .gte('run_date', since)
      .order('run_date', { ascending: false }),
    qaDb
      .from('qa_insights')
      .select('id, agent_id, run_date, severity, headline, trigger, status')
      .in('agent_id', access.agentIds)
      .eq('status', 'open')
      .order('run_date', { ascending: false }),
    qaDb.from('qa_issue_types').select('key, label, priority, is_positive').eq('active', true),
  ])

  const types = new Map((typesRes.data || []).map((t) => [t.key, t]))
  const stats = statsRes.data || []
  const insightsByAgent = new Map<string, { id: string; headline: string; severity: string }>()
  for (const i of insightsRes.data || []) {
    if (!insightsByAgent.has(i.agent_id)) {
      insightsByAgent.set(i.agent_id, { id: i.id, headline: i.headline, severity: i.severity })
    }
  }

  const latestByAgent = new Map<string, (typeof stats)[number]>()
  for (const row of stats) if (!latestByAgent.has(row.agent_id)) latestByAgent.set(row.agent_id, row)

  const agents = (agentsRes.data || [])
    .map((a) => buildAgentRow(a, latestByAgent.get(a.id), types, insightsByAgent.get(a.id) || null))
    // agents with something to say first
    .sort((a, b) => Number(Boolean(b.insight)) - Number(Boolean(a.insight)) || b.p0Count - a.p0Count)

  const totals = buildIssueTotals(stats, types)

  const issues = [...totals.entries()]
    .map(([key, t]) => ({
      key,
      label: types.get(key)?.label || key,
      priority: types.get(key)?.priority || 'P2',
      calls: t.calls,
      agents: t.agents.size,
    }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 15)

  return NextResponse.json({
    agents,
    openInsights: insightsRes.data || [],
    issues,
    windowDays: WINDOW_DAYS,
  })
})
