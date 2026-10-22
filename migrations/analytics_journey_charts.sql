-- Charts built on the Journeys tab, saved per project + campaign and shared by everyone on the project.
-- One row per chart (not one JSON blob per campaign) so two people adding charts at the same time
-- never overwrite each other.
--
-- RLS follows the pype_analytics_* / pype_journey_* convention: enabled, revoked from
-- anon/authenticated, granted to service_role, no policies — every read and write goes through
-- /api/journeys/charts on the service role.

create table if not exists pype_journey_charts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references pype_voice_projects(id),
  campaign_id uuid not null references pype_campaigns(id) on delete cascade,
  dimension text not null check (char_length(dimension) between 1 and 120),
  metric text not null check (metric in ('events', 'journeys')),
  kind text not null check (kind in ('bar', 'line', 'pie')),
  position int not null default 0,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists pype_journey_charts_campaign_idx
  on pype_journey_charts (project_id, campaign_id, position, created_at);

alter table pype_journey_charts enable row level security;
revoke all on pype_journey_charts from anon, authenticated;
grant all on pype_journey_charts to service_role;
