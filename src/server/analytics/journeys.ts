/**
 * Reads behind the Journeys tab — Confluence "Analytics Phase 3 and 4 — Build
 * Spec" §3.5.3, §3.6. Writes go through the `ingest_journey_event` RPC
 * (`/api/journeys/events`); this file is read-only, same pooled connection as
 * the rest of analytics (`db.ts`).
 */
import { runQuery } from './db'

export type Campaign = {
  id: string
  key: string
  name: string | null
  steps: { step: string; label: string; channel: string }[]
  created_at: string
}

export type FunnelStep = {
  ordinality: number
  step_key: string
  label: string
  reached_count: number
}

export type JourneyEvent = {
  channel: string
  step: string | null
  action: string
  agent_id: string | null
  external_ref: string | null
  occurred_at: string
  // Whatever a source's own system tracks that doesn't fit the fixed columns
  // (a delivery_status, a retry count, ...) — carried through untouched so
  // nothing a team already has gets lost just because it isn't one of ours.
  payload: Record<string, unknown> | null
}

export type JourneySummary = {
  id: string
  identity_key: string
  status: string
  current_step: string | null
  outcome: string | null
  created_at: string
  updated_at: string
  events: JourneyEvent[]
}

/** §3.6.3's filters — channel/agent narrow to matching events, status/outcome narrow which journeys are in scope at all. */
export type JourneyFilters = {
  channel?: string
  status?: string
  outcome?: string
  agentId?: string
}

/** Shared by the funnel and recent-journeys routes so query-param parsing doesn't drift between them. */
export function parseJourneyFilters(searchParams: URLSearchParams): JourneyFilters {
  return {
    channel: searchParams.get('channel') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    outcome: searchParams.get('outcome') ?? undefined,
    agentId: searchParams.get('agentId') ?? undefined,
  }
}

export async function listCampaigns(projectId: string): Promise<Campaign[]> {
  return runQuery<Campaign>(
    `select id, key, name, steps, created_at
     from pype_campaigns
     where project_id = $1
     order by created_at desc`,
    [projectId]
  )
}

/**
 * §3.6.1's funnel, generic over any campaign's steps, with §3.6.2's rule
 * applied: the date range selects which journeys are in scope by
 * `created_at`, not which events fall inside the window.
 */
export async function getFunnel(
  projectId: string,
  campaignId: string,
  range: { from: string; to: string } | null,
  filters: JourneyFilters = {}
): Promise<{ steps: FunnelStep[]; journeyCount: number }> {
  const journeyScope = `project_id = $1 and campaign_id = $2
    and ($3::timestamptz is null or created_at >= $3)
    and ($4::timestamptz is null or created_at < $4)
    and ($5::text is null or status = $5)
    and ($6::text is null or outcome = $6)`
  const scopeParams = [projectId, campaignId, range?.from ?? null, range?.to ?? null, filters.status ?? null, filters.outcome ?? null]

  const [steps, journeyCount] = await Promise.all([
    runQuery<{ ordinality: number; step_key: string; label: string; reached_count: string }>(
      `with in_range_journeys as (
         select id from pype_journeys where ${journeyScope}
       ),
       steps as (
         -- "with ordinality as s" (one alias, two output columns) makes s a
         -- record of (elem, ord) rather than the jsonb element itself — s->>'x'
         -- fails with "operator does not exist: record ->> unknown". Naming
         -- both columns explicitly avoids it.
         select s.ord as ordinality, s.elem->>'step' as step_key, s.elem->>'label' as label
         from pype_campaigns, jsonb_array_elements(steps) with ordinality as s(elem, ord)
         where pype_campaigns.id = $2
       ),
       reached as (
         select e.step as step_key, count(distinct e.journey_id) as n
         from pype_journey_events e
         join in_range_journeys j on j.id = e.journey_id
         where ($7::text is null or e.channel = $7)
           and ($8::uuid is null or e.agent_id = $8)
         group by e.step
       )
       select steps.ordinality, steps.step_key, steps.label, coalesce(reached.n, 0) as reached_count
       from steps left join reached using (step_key)
       order by steps.ordinality`,
      [...scopeParams, filters.channel ?? null, filters.agentId ?? null]
    ),
    runQuery<{ n: string }>(`select count(*) as n from pype_journeys where ${journeyScope}`, scopeParams),
  ])

  return {
    steps: steps.map((s) => ({ ordinality: s.ordinality, step_key: s.step_key, label: s.label, reached_count: Number(s.reached_count) })),
    journeyCount: Number(journeyCount[0]?.n ?? 0),
  }
}

export type ActiveJourneysPoint = { day: string; active_count: number }

/**
 * Distinct journeys with at least one event on each day in range — the
 * "active people" trend behind the funnel snapshot. Zero-filled server-side
 * (`generate_series`) so a quiet day draws as 0, not a gap in the line.
 */
export async function getActiveJourneysOverTime(
  projectId: string,
  campaignId: string,
  range: { from: string; to: string },
  filters: JourneyFilters = {}
): Promise<ActiveJourneysPoint[]> {
  const rows = await runQuery<{ day: string; active_count: string }>(
    `with days as (
       select generate_series($3::date, $4::date - interval '1 day', interval '1 day')::date as day
     ),
     active as (
       select date_trunc('day', e.occurred_at)::date as day, count(distinct e.journey_id) as n
       from pype_journey_events e
       join pype_journeys j on j.id = e.journey_id
       where j.project_id = $1 and j.campaign_id = $2
         and e.occurred_at >= $3 and e.occurred_at < $4
         and ($5::text is null or e.channel = $5)
         and ($6::uuid is null or e.agent_id = $6)
       group by day
     )
     select days.day, coalesce(active.n, 0) as active_count
     from days left join active using (day)
     order by days.day`,
    [projectId, campaignId, range.from, range.to, filters.channel ?? null, filters.agentId ?? null]
  )
  return rows.map((r) => ({ day: r.day, active_count: Number(r.active_count) }))
}

/** What the filter dropdowns offer for a campaign — real values seen so far, not a fixed enum. */
export async function getFilterOptions(
  projectId: string,
  campaignId: string
): Promise<{ channels: string[]; statuses: string[]; outcomes: string[] }> {
  const [channels, statuses, outcomes] = await Promise.all([
    runQuery<{ channel: string }>(
      `select distinct e.channel from pype_journey_events e
       join pype_journeys j on j.id = e.journey_id
       where j.project_id = $1 and j.campaign_id = $2
       order by e.channel`,
      [projectId, campaignId]
    ),
    runQuery<{ status: string }>(
      `select distinct status from pype_journeys where project_id = $1 and campaign_id = $2 order by status`,
      [projectId, campaignId]
    ),
    runQuery<{ outcome: string }>(
      `select distinct outcome from pype_journeys where project_id = $1 and campaign_id = $2 and outcome is not null order by outcome`,
      [projectId, campaignId]
    ),
  ])
  return { channels: channels.map((c) => c.channel), statuses: statuses.map((s) => s.status), outcomes: outcomes.map((o) => o.outcome) }
}

/** Most recently updated journeys for a campaign, each with its full event history for the milestone chips. */
export async function getRecentJourneys(
  projectId: string,
  campaignId: string,
  limit: number,
  offset: number,
  filters: JourneyFilters = {}
): Promise<{ journeys: JourneySummary[]; hasMore: boolean }> {
  // fetch one extra row to know whether another page exists, without a separate count query
  const rows = await runQuery<Omit<JourneySummary, 'events'>>(
    `select id, identity_key, status, current_step, outcome, created_at, updated_at
     from pype_journeys j
     where project_id = $1 and campaign_id = $2
       and ($5::text is null or status = $5)
       and ($6::text is null or outcome = $6)
       and (
         ($7::text is null and $8::uuid is null) or exists (
           select 1 from pype_journey_events e
           where e.journey_id = j.id
             and ($7::text is null or e.channel = $7)
             and ($8::uuid is null or e.agent_id = $8)
         )
       )
     order by updated_at desc
     limit $3 offset $4`,
    [projectId, campaignId, limit + 1, offset, filters.status ?? null, filters.outcome ?? null, filters.channel ?? null, filters.agentId ?? null]
  )
  const hasMore = rows.length > limit
  const journeys = rows.slice(0, limit)
  if (journeys.length === 0) return { journeys: [], hasMore: false }

  const ids = journeys.map((j) => j.id)
  const events = await runQuery<JourneyEvent & { journey_id: string }>(
    `select journey_id, channel, step, action, agent_id, external_ref, occurred_at, payload
     from pype_journey_events
     where journey_id = any($1::uuid[])
     order by occurred_at asc`,
    [ids]
  )

  const byJourney = new Map<string, JourneyEvent[]>()
  for (const { journey_id, ...event } of events) {
    const list = byJourney.get(journey_id) ?? []
    list.push(event)
    byJourney.set(journey_id, list)
  }

  return { journeys: journeys.map((j) => ({ ...j, events: byJourney.get(j.id) ?? [] })), hasMore }
}

/**
 * The Journeys tab's own mini chart builder — deliberately separate from
 * Explore's canvas/query engine (`buildQuery.ts`), which is hardcoded to
 * `pype_voice_call_logs` and shared by other charts. A campaign's shape is
 * unknowable ahead of time (any source, any `step`/`channel` vocabulary, any
 * `payload` keys), so the breakdown field list is discovered from real data
 * instead of a fixed enum.
 */
export type ChartDimension = { key: string; label: string }

const FIXED_DIMENSIONS: Record<string, { expr: string; label: string }> = {
  channel: { expr: 'e.channel', label: 'Channel' },
  step: { expr: 'e.step', label: 'Step' },
  action: { expr: 'e.action', label: 'Action' },
  status: { expr: 'j.status', label: 'Journey status' },
  outcome: { expr: 'j.outcome', label: 'Outcome' },
  agent_id: { expr: 'e.agent_id::text', label: 'Agent' },
}

const PAYLOAD_PREFIX = 'payload.'

/** Fixed dimensions, plus whatever keys this campaign's own events actually carry in `payload`. */
export async function getChartDimensions(projectId: string, campaignId: string): Promise<ChartDimension[]> {
  const rows = await runQuery<{ key: string }>(
    `select distinct jsonb_object_keys(e.payload) as key
     from pype_journey_events e
     join pype_journeys j on j.id = e.journey_id
     where j.project_id = $1 and j.campaign_id = $2 and e.payload is not null
     order by key
     limit 50`,
    [projectId, campaignId]
  )
  const fixed = Object.entries(FIXED_DIMENSIONS).map(([key, v]) => ({ key, label: v.label }))
  const payloadKeys = rows.map((r) => ({ key: `${PAYLOAD_PREFIX}${r.key}`, label: r.key }))
  return [...fixed, { key: '__time__', label: 'Time (daily)' }, ...payloadKeys]
}

export type ChartMetric = 'events' | 'journeys'
export type CustomChartPoint = { bucket: string; value: number }

/**
 * A dimension is either a whitelisted SQL fragment (never raw user input as an
 * identifier) or a `payload.<key>` — the key travels as a bound parameter into
 * `->>`, which reads it as a value, not an identifier, so this stays injection-safe
 * even though the key itself is arbitrary, source-supplied text.
 */
export async function getCustomChart(
  projectId: string,
  campaignId: string,
  dimension: string,
  metric: ChartMetric,
  range: { from: string; to: string },
  filters: JourneyFilters = {}
): Promise<CustomChartPoint[]> {
  const metricExpr = metric === 'journeys' ? 'count(distinct e.journey_id)' : 'count(*)'
  const baseParams = [projectId, campaignId, range.from, range.to, filters.channel ?? null, filters.agentId ?? null, filters.status ?? null, filters.outcome ?? null]
  const baseWhere = `j.project_id = $1 and j.campaign_id = $2
     and j.created_at >= $3 and j.created_at < $4
     and ($5::text is null or e.channel = $5)
     and ($6::uuid is null or e.agent_id = $6)
     and ($7::text is null or j.status = $7)
     and ($8::text is null or j.outcome = $8)`

  if (dimension === '__time__') {
    const rows = await runQuery<{ bucket: string; value: string }>(
      `with days as (
         select generate_series($3::date, $4::date - interval '1 day', interval '1 day')::date as day
       ),
       counted as (
         select date_trunc('day', e.occurred_at)::date as day, ${metricExpr} as value
         from pype_journey_events e
         join pype_journeys j on j.id = e.journey_id
         where ${baseWhere}
         group by day
       )
       select days.day::text as bucket, coalesce(counted.value, 0) as value
       from days left join counted using (day)
       order by days.day`,
      baseParams
    )
    return rows.map((r) => ({ bucket: r.bucket, value: Number(r.value) }))
  }

  const isPayload = dimension.startsWith(PAYLOAD_PREFIX)
  const fixed = FIXED_DIMENSIONS[dimension]
  if (!isPayload && !fixed) throw new Error(`Unknown chart dimension: ${dimension}`)

  const dimExpr = isPayload ? `e.payload->>$9` : fixed.expr
  const params = isPayload ? [...baseParams, dimension.slice(PAYLOAD_PREFIX.length)] : baseParams

  const rows = await runQuery<{ bucket: string | null; value: string }>(
    `select ${dimExpr} as bucket, ${metricExpr} as value
     from pype_journey_events e
     join pype_journeys j on j.id = e.journey_id
     where ${baseWhere}
     group by bucket
     order by value desc
     limit 20`,
    params
  )
  return rows.map((r) => ({ bucket: r.bucket ?? '(empty)', value: Number(r.value) }))
}
