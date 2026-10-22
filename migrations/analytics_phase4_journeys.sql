-- Confluence "Analytics Phase 3 and 4 — Build Spec" §3.2.2 / §3.3.2 / §3.3.3.
--
-- A journey's step sequence is data (pype_campaigns.steps), not columns — this
-- schema is generic over any campaign, voice-only or cross-channel.
--
-- Two tables instead of one: pype_journeys is a small, always-current snapshot
-- ("what's this person's state right now"); pype_journey_events is an
-- append-only log ("what actually happened, in order"). Collapsing them would
-- force a choice between racy in-place mutation and scanning full history on
-- every read — this design avoids both.
--
-- RLS follows the exact convention already used for pype_analytics_* tables
-- (analytics_phase1.sql): enabled, revoked from anon/authenticated, granted to
-- service_role, no policies — every read and write goes through an API route
-- on the service role, so nothing else should reach these tables at all.

create table pype_campaigns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references pype_voice_projects(id),
  key text not null,
  name text, -- filled in later; not required to start receiving events
  steps jsonb not null default '[]', -- display only, self-describing — see ingest_journey_event below
  terminal_outcomes jsonb,
  created_at timestamptz default now(),
  unique (project_id, key)
);

create table pype_journeys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references pype_voice_projects(id),
  campaign_id uuid not null references pype_campaigns(id),
  identity_key text not null,
  status text not null default 'active',
  current_step text,
  next_action_at timestamptz,
  outcome text,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (project_id, campaign_id, identity_key)
);

create table pype_journey_events (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references pype_journeys(id),
  channel text not null,
  step text,
  action text not null,
  agent_id uuid,
  external_ref text,
  payload jsonb,
  occurred_at timestamptz not null default now()
);
create index on pype_journey_events (journey_id, occurred_at);
create index on pype_journey_events (channel, step);

-- One row per (token, minute) that had traffic — self-limiting in size, no
-- Redis/Upstash needed. bump_journey_rate_limit() below is the only writer.
create table pype_journey_ingest_rate_limit (
  token_hash text not null,
  minute_bucket timestamptz not null,
  count int not null default 1,
  primary key (token_hash, minute_bucket)
);

alter table pype_campaigns enable row level security;
alter table pype_journeys enable row level security;
alter table pype_journey_events enable row level security;
alter table pype_journey_ingest_rate_limit enable row level security;
revoke all on pype_campaigns, pype_journeys, pype_journey_events, pype_journey_ingest_rate_limit from anon, authenticated;
grant all on pype_campaigns, pype_journeys, pype_journey_events, pype_journey_ingest_rate_limit to service_role;

-- Auto-creates the campaign and journey on first use. Written as one Postgres
-- function, not application-code select-then-insert, so concurrent requests
-- for a brand-new campaign_key/identity_key serialize on the unique-index
-- upserts (ON CONFLICT blocks until the other writer commits) instead of racing.
create or replace function ingest_journey_event(
  p_project_id uuid,
  p_campaign_key text,
  p_identity_key text,
  p_channel text,
  p_step text,
  p_action text,
  p_agent_id uuid default null,
  p_external_ref text default null,
  p_outcome text default null,
  p_payload jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
as $$
declare
  v_campaign_id uuid;
  v_journey_id uuid;
  v_step_known boolean;
begin
  insert into pype_campaigns (project_id, key, steps)
  values (p_project_id, p_campaign_key, '[]'::jsonb)
  on conflict (project_id, key) do nothing;

  select id into v_campaign_id from pype_campaigns
  where project_id = p_project_id and key = p_campaign_key;

  select exists (
    select 1 from pype_campaigns, jsonb_array_elements(steps) s
    where pype_campaigns.id = v_campaign_id and s->>'step' = p_step
  ) into v_step_known;

  if not v_step_known then
    update pype_campaigns
    set steps = steps || jsonb_build_array(jsonb_build_object('step', p_step, 'label', p_step, 'channel', p_channel))
    where id = v_campaign_id;
  end if;

  insert into pype_journeys (project_id, campaign_id, identity_key)
  values (p_project_id, v_campaign_id, p_identity_key)
  on conflict (project_id, campaign_id, identity_key) do nothing;

  select id into v_journey_id from pype_journeys
  where project_id = p_project_id and campaign_id = v_campaign_id and identity_key = p_identity_key;

  insert into pype_journey_events (journey_id, channel, step, action, agent_id, external_ref, payload)
  values (v_journey_id, p_channel, p_step, p_action, p_agent_id, p_external_ref, p_payload);

  update pype_journeys
  set current_step = p_step,
      outcome = coalesce(p_outcome, outcome),
      status = case when p_outcome is not null then 'completed' else status end,
      updated_at = now()
  where id = v_journey_id;

  return v_journey_id;
end;
$$;

-- Called once per request by POST /api/journeys/events, before the insert.
-- The route rejects once the returned count clears its threshold.
create or replace function bump_journey_rate_limit(p_token_hash text) returns int
language sql
security definer
as $$
  insert into pype_journey_ingest_rate_limit (token_hash, minute_bucket, count)
  values (p_token_hash, date_trunc('minute', now()), 1)
  on conflict (token_hash, minute_bucket)
  do update set count = pype_journey_ingest_rate_limit.count + 1
  returning count;
$$;
