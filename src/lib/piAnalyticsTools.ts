import { callVolumeTrendSpec } from '@/lib/piAnalyticsRecipes'

export type PiQueryRunner = (
  projectId: string,
  args: { agent_id?: string; spec: Record<string, unknown> }
) => Promise<{ success: boolean; result: any }>

const COMPLETION_KEY_RE = /goal|complete|completion|outcome|resolved|task|success|achieved/i

function fieldRef(row: { col: string; path?: string[] | null }) {
  return row.path?.length ? { col: row.col, path: row.path } : { col: row.col }
}

function summarizeTrend(rows: { bucket: unknown; value: unknown }[]) {
  const points = rows
    .filter((r) => r.bucket != null && r.value != null)
    .map((r) => ({ day: String(r.bucket).slice(0, 10), count: Number(r.value) || 0 }))
  const total = points.reduce((s, p) => s + p.count, 0)
  const avg = points.length ? Math.round(total / points.length) : 0
  const half = Math.floor(points.length / 2)
  const firstHalf = points.slice(0, half).reduce((s, p) => s + p.count, 0)
  const secondHalf = points.slice(half).reduce((s, p) => s + p.count, 0)
  let trend: 'up' | 'down' | 'flat' = 'flat'
  if (secondHalf > firstHalf * 1.05) trend = 'up'
  else if (secondHalf < firstHalf * 0.95) trend = 'down'
  return { total_calls: total, avg_per_day: avg, trend, daily: points }
}

export async function runCallVolumeTrend(
  projectId: string,
  query: PiQueryRunner,
  args: { days?: number; agent_id?: string }
) {
  const days = Math.min(Math.max(Number.isFinite(Number(args.days)) ? Number(args.days) : 30, 1), 90)
  const out = await query(projectId, {
    agent_id: args.agent_id,
    spec: callVolumeTrendSpec(days),
  })
  if (!out.success) return out
  const rows = (out.result?.data ?? []) as { bucket: unknown; value: unknown }[]
  return {
    success: true,
    result: {
      period_days: days,
      ...summarizeTrend(rows),
      raw: rows,
    },
  }
}

export async function runCompletionInsights(
  projectId: string,
  query: PiQueryRunner,
  listFields: (projectId: string, args: { agent_id?: string }) => Promise<{ success: boolean; result: any }>,
  args: { days?: number; agent_id?: string }
) {
  const days = Math.min(Math.max(Number.isFinite(Number(args.days)) ? Number(args.days) : 7, 1), 60)
  const listed = await listFields(projectId, { agent_id: args.agent_id })
  if (!listed.success) return listed

  const fields = (listed.result?.fields ?? []) as Array<{
    col: string
    path?: string[] | null
    label?: string
    value_type?: string
    boolean_encoding?: string
    coverage_pct?: number
    description?: string | null
  }>

  // the field_extractor description the client actually wrote beats a guess from
  // the column name — a field named "status" with description "did the patient
  // confirm the appointment" is a completion signal a name-only regex would miss
  const candidates = fields
    .filter((f) => COMPLETION_KEY_RE.test([f.label, f.description, ...(f.path ?? []), f.col].join(' ')))
    .sort((a, b) => (b.coverage_pct ?? 0) - (a.coverage_pct ?? 0))
    .slice(0, 5)

  const volume = await query(projectId, {
    agent_id: args.agent_id,
    spec: { spec_version: 1, source: 'voice', agg: { fn: 'count' }, range: { days } },
  })

  const rates: Array<{ label: string; field: ReturnType<typeof fieldRef>; rate_pct: number | null; n_rows?: number }> = []
  for (const f of candidates) {
    const ref = fieldRef(f)
    const rate = await query(projectId, {
      agent_id: args.agent_id,
      spec: {
        spec_version: 1,
        source: 'voice',
        agg: {
          fn: 'rate',
          field: {
            ...ref,
            ...(f.boolean_encoding ? { boolean_encoding: f.boolean_encoding } : {}),
          },
          denominator: 'field_present',
        },
        range: { days },
      },
    })
    if (!rate.success) continue
    const row = Array.isArray(rate.result?.data) ? rate.result.data[0] : rate.result?.data
    const value = row?.value ?? row?.value_0
    rates.push({
      label: f.label ?? [...(f.path ?? []), f.col].join('.'),
      field: ref,
      rate_pct: value == null ? null : Math.round(Number(value) * 1000) / 10,
      n_rows: row?.n_rows,
    })
  }

  const totalCalls = volume.success
    ? Number(volume.result?.data?.[0]?.value ?? volume.result?.data?.value ?? 0)
    : null

  return {
    success: true,
    result: {
      period_days: days,
      total_calls: totalCalls,
      completion_metrics: rates,
      note:
        rates.length === 0
          ? 'No completion-style extractor fields found in analytics yet — add dispositions like goal_achieved or call_outcome on agents, then wait for calls to be processed.'
          : undefined,
    },
  }
}

export const PI_MANDATORY_ANALYTICS_TOOLS_DOC = `
MANDATORY TOOLS (do not use query_analytics for these):
- Call volume / trend / "how many calls" → get_call_volume_trend (never dimension on timestamps; never call_start_time).
- Task completion / goal / outcome / "how is completion" → get_completion_insights (searches extractor fields automatically).
- create_agent with only a name → still call create_agent; server fills default prompt and voice if omitted.

Never describe query mistakes to the user — use the mandatory tools and answer with numbers.
`.trim()
