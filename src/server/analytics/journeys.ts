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
  range: { from: string; to: string } | null
): Promise<{ steps: FunnelStep[]; journeyCount: number }> {
  const [steps, journeyCount] = await Promise.all([
    runQuery<{ ordinality: number; step_key: string; label: string; reached_count: string }>(
      `with in_range_journeys as (
         select id from pype_journeys
         where project_id = $1 and campaign_id = $2
           and ($3::timestamptz is null or created_at >= $3)
           and ($4::timestamptz is null or created_at < $4)
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
         group by e.step
       )
       select steps.ordinality, steps.step_key, steps.label, coalesce(reached.n, 0) as reached_count
       from steps left join reached using (step_key)
       order by steps.ordinality`,
      [projectId, campaignId, range?.from ?? null, range?.to ?? null]
    ),
    runQuery<{ n: string }>(
      `select count(*) as n from pype_journeys
       where project_id = $1 and campaign_id = $2
         and ($3::timestamptz is null or created_at >= $3)
         and ($4::timestamptz is null or created_at < $4)`,
      [projectId, campaignId, range?.from ?? null, range?.to ?? null]
    ),
  ])

  return {
    steps: steps.map((s) => ({ ordinality: s.ordinality, step_key: s.step_key, label: s.label, reached_count: Number(s.reached_count) })),
    journeyCount: Number(journeyCount[0]?.n ?? 0),
  }
}

/** Most recently updated journeys for a campaign, each with its full event history for the milestone chips. */
export async function getRecentJourneys(
  projectId: string,
  campaignId: string,
  limit: number,
  offset: number
): Promise<{ journeys: JourneySummary[]; hasMore: boolean }> {
  // fetch one extra row to know whether another page exists, without a separate count query
  const rows = await runQuery<Omit<JourneySummary, 'events'>>(
    `select id, identity_key, status, current_step, outcome, created_at, updated_at
     from pype_journeys
     where project_id = $1 and campaign_id = $2
     order by updated_at desc
     limit $3 offset $4`,
    [projectId, campaignId, limit + 1, offset]
  )
  const hasMore = rows.length > limit
  const journeys = rows.slice(0, limit)
  if (journeys.length === 0) return { journeys: [], hasMore: false }

  const ids = journeys.map((j) => j.id)
  const events = await runQuery<JourneyEvent & { journey_id: string }>(
    `select journey_id, channel, step, action, agent_id, external_ref, occurred_at
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
