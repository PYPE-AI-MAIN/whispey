/**
 * Everything the agent QA page needs, in one request.
 *
 * The page is read-mostly and all of it is on screen at once, so one round trip
 * beats five. Nothing here is computed on the fly — the night job already did
 * the counting and wrote qa_daily_stats, which is why "down 4 points on last
 * week" is a lookup rather than a scan over old calls.
 */
import { NextRequest, NextResponse } from 'next/server'
import { guarded } from '@/server/analytics/guard'
import { resolveAgentAccess, isQaDenied, qaDb } from '@/server/qa/access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TREND_DAYS = 30

export const GET = guarded('qa/agent', async (req: NextRequest, ctx: { params: Promise<{ agentId: string }> }) => {
  const { agentId } = await ctx.params

  const access = await resolveAgentAccess(agentId)
  if (isQaDenied(access)) return NextResponse.json({ error: access.error }, { status: access.status })

  const since = new Date(Date.now() - TREND_DAYS * 86400000).toISOString().slice(0, 10)

  // Real disposition values this agent has actually recorded, so the settings
  // dialog can offer them instead of asking someone to remember the spelling.
  // Sampled, not exhaustive — it is a suggestion list, not a constraint.
  const knownDispositions = await (async () => {
    const { data } = await qaDb
      .from('pype_voice_call_logs')
      .select('transcription_metrics')
      .eq('agent_id', agentId)
      .not('transcription_metrics', 'is', null)
      .order('created_at', { ascending: false })
      .limit(300)

    const seen = new Set<string>()
    for (const row of data || []) {
      const v = (row.transcription_metrics as Record<string, unknown> | null)?.final_disposition
      if (typeof v !== 'string') continue
      const clean = v.trim().toLowerCase()
      if (!clean || ['-', 'n/a', 'na', 'null', 'undefined'].includes(clean)) continue
      seen.add(clean)
      if (seen.size >= 25) break
    }
    return [...seen].sort((a, b) => a.localeCompare(b))
  })()

  const [statsRes, insightsRes, typesRes, runsRes, momentsRes] = await Promise.all([
    qaDb
      .from('qa_daily_stats')
      .select('run_date, calls_total, calls_sampled, flagged_n, random_n, issue_counts, metrics')
      .eq('agent_id', agentId)
      .gte('run_date', since)
      .order('run_date', { ascending: false }),

    qaDb
      .from('qa_insights')
      .select('id, run_date, severity, headline, bullets, metrics, suggested_prompt_patch, trigger, status, acted_at, delivered_at, created_at')
      .eq('agent_id', agentId)
      .order('run_date', { ascending: false })
      .limit(20),

    qaDb.from('qa_issue_types').select('key, label, category, priority, detection, fixable_by, is_positive').eq('active', true),

    // what the night actually did, so the page can say "checked, nothing new"
    // rather than looking broken on a quiet day
    qaDb
      .from('qa_call_runs')
      .select('run_date, stage, status, calls_seen, finished_at, error')
      .eq('agent_id', agentId)
      .order('run_date', { ascending: false })
      .limit(12),

    // where in each recording the issue actually happened, so "see a call"
    // lands on the moment rather than at 0:00
    qaDb
      .from('qa_call_issues')
      .select('issue_key, call_log_id, turn_seconds, evidence')
      .eq('agent_id', agentId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  const stats = statsRes.data || []
  const insights = insightsRes.data || []
  const issueTypes = typesRes.data || []
  const runs = runsRes.data || []

  // first recorded moment per (issue, call) — one example is enough for a link
  const moments = new Map<string, { callId: string; seconds: number | null; evidence: string | null }>()
  for (const row of momentsRes.data || []) {
    const key = `${row.issue_key}:${row.call_log_id}`
    if (!moments.has(key)) {
      moments.set(key, { callId: row.call_log_id, seconds: row.turn_seconds, evidence: row.evidence })
    }
  }

  const today = stats[0] || null
  const previous = stats.slice(1)

  // ------------------------------------------------- issue list, ranked

  const typeByKey = new Map(issueTypes.map((t) => [t.key, t]))
  const priorityRank: Record<string, number> = { P0: 0, P1: 1, P2: 2 }

  const issues = Object.entries((today?.issue_counts || {}) as Record<string, { flagged?: number; random?: number; pct?: number | null; call_ids?: string[] }>)
    .filter(([key]) => !typeByKey.get(key)?.is_positive)
    .map(([key, count]) => {
      // a night that checked and found none counts as 0%, not as a missing day
      const checked = previous.filter((d) => d.random_n > 0)
      const pcts = checked.map((d) => (d.issue_counts as Record<string, { pct?: number | null }>)?.[key]?.pct)
      const seenDays = pcts.filter((p) => typeof p === 'number').length
      const was = seenDays ? pcts.reduce<number>((a, p) => a + (p ?? 0), 0) / pcts.length : null
      const type = typeByKey.get(key)

      return {
        key,
        label: type?.label || key,
        category: type?.category || null,
        priority: type?.priority || 'P2',
        fixableBy: type?.fixable_by || null,
        detection: type?.detection || null,
        flagged: count.flagged || 0,
        random: count.random || 0,
        pct: count.pct ?? null,
        was: was === null ? null : Number(was.toFixed(4)),
        delta: count.pct != null && was !== null ? Number((count.pct - was).toFixed(4)) : null,
        isNew: seenDays === 0,
        callIds: count.call_ids || [],
        example: (count.call_ids || [])
          .map((id) => moments.get(`${key}:${id}`))
          .find(Boolean) ?? null,
      }
    })
    // by damage, not by raw count: a P0 on 10 calls beats a P2 on 40
    .sort((a, b) => (priorityRank[a.priority] - priorityRank[b.priority]) || ((b.pct ?? 0) - (a.pct ?? 0)))

  // -------------------------------------------- metrics, with last week

  const metricKeys = new Set<string>()
  for (const day of stats) for (const k of Object.keys(day.metrics || {})) metricKeys.add(k)

  const metrics = [...metricKeys]
    .map((key) => {
      const now = (today?.metrics as Record<string, { type?: string; rate?: number; n?: number; top?: unknown[] }>)?.[key]
      if (now?.type !== 'rate') return null
      const past = previous
        .map((d) => (d.metrics as Record<string, { rate?: number }>)?.[key]?.rate)
        .filter((r): r is number => typeof r === 'number')
      const was = past.length ? past.reduce((a, b) => a + b, 0) / past.length : null
      return {
        key,
        rate: now.rate ?? null,
        n: now.n ?? 0,
        was: was === null ? null : Number(was.toFixed(4)),
        delta: now.rate != null && was !== null ? Number((now.rate - was).toFixed(4)) : null,
      }
    })
    .filter(Boolean)

  // ---------------------------------------------------- trend, per issue

  const trendDays = [...stats].reverse()
  const topKeys = issues.slice(0, 5).map((i) => i.key)
  const trend = trendDays.map((d) => {
    const point: Record<string, unknown> = { date: d.run_date, sampled: d.calls_sampled }
    for (const key of topKeys) {
      point[key] = (d.issue_counts as Record<string, { pct?: number | null }>)?.[key]?.pct ?? 0
    }
    return point
  })

  const lastRun = runs.find((r) => r.stage === 'insight') || runs[0] || null

  const currentInsight = insights.find((i) => i.status === 'open') || null
  const { data: askedRows } = currentInsight
    ? await qaDb.from('qa_notifications').select('id').eq('agent_id', agentId).eq('insight_id', currentInsight.id).eq('kind', 'review_request').limit(1)
    : { data: null }

  return NextResponse.json({
    agent: {
      id: access.agent.id,
      name: access.agent.display_name || access.agent.name,
      projectId: access.projectId,
    },
    canWrite: access.canWrite,
    qaConfig: access.agent.qa_config ?? null,
    // null when QA has never run for this agent — the page shows a setup state
    today: today
      ? {
          date: today.run_date,
          callsTotal: today.calls_total,
          sampled: today.calls_sampled,
          flagged: today.flagged_n,
          random: today.random_n,
        }
      : null,
    lastRun: lastRun
      ? { date: lastRun.run_date, status: lastRun.status, callsSeen: lastRun.calls_seen, finishedAt: lastRun.finished_at, error: lastRun.error }
      : null,
    currentInsight,
    reviewRequested: (askedRows?.length ?? 0) > 0,
    insights,
    issues,
    metrics,
    trend,
    trendKeys: topKeys.map((k) => ({ key: k, label: typeByKey.get(k)?.label || k })),
    knownDispositions,
  })
})
