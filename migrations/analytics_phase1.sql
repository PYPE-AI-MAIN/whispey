-- Analytics phase 1 — Confluence "Analytics Phase 1 and 2 — Build Spec" §6.1.
--
-- Three tables: a dashboard, the charts on it, and what we know about each
-- agent's fields. The agent's Overview page IS its dashboard — one row per
-- agent, created on first visit and seeded with starter charts.
--
-- Safe to run more than once.

BEGIN;

-- ---------------------------------------------------------------- dashboards

CREATE TABLE IF NOT EXISTS pype_analytics_dashboards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL,
  agent_id    uuid NULL,                      -- NULL once scope = 'project'
  scope       text NOT NULL DEFAULT 'agent'   CHECK (scope IN ('agent', 'project')),
  visibility  text NOT NULL DEFAULT 'shared'  CHECK (visibility IN ('shared', 'private')),
  owner_email text,                           -- only meaningful when private
  name        text NOT NULL,
  defaults    jsonb NOT NULL DEFAULT '{}'::jsonb,  -- the saved filter state
  -- bumped on every save; a stale write is rejected rather than silently
  -- overwriting whoever saved in between
  version     int  NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dashboard_scope_has_agent
    CHECK ((scope = 'agent' AND agent_id IS NOT NULL) OR (scope = 'project' AND agent_id IS NULL))
);

-- one shared dashboard per agent: the Overview page. Private ones are per person.
CREATE UNIQUE INDEX IF NOT EXISTS uq_analytics_dashboard_agent_shared
  ON pype_analytics_dashboards (agent_id)
  WHERE scope = 'agent' AND visibility = 'shared';

CREATE INDEX IF NOT EXISTS idx_analytics_dashboards_project
  ON pype_analytics_dashboards (project_id, agent_id);

-- ------------------------------------------------------------------ widgets

CREATE TABLE IF NOT EXISTS pype_analytics_widgets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id uuid NOT NULL REFERENCES pype_analytics_dashboards(id) ON DELETE CASCADE,
  title        text NOT NULL,
  -- how it is drawn, and nothing else. A new chart type is a renderer; it never
  -- reaches the query builder.
  kind         text NOT NULL DEFAULT 'bar',
  spec         jsonb NOT NULL,                -- §7, validated by zod both ways
  layout       jsonb NOT NULL DEFAULT '{"width":"half"}'::jsonb,
  position     int  NOT NULL DEFAULT 0,
  live         boolean NOT NULL DEFAULT false,
  -- a starter chart we ship. Editing one copies it for that client, so anyone
  -- who never edits keeps getting our improvements.
  is_seeded    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_widgets_dashboard
  ON pype_analytics_widgets (dashboard_id, position);

-- ------------------------------------------------------- the field catalog

-- What each agent actually produces: the human name, the type, how true/false
-- is written, which values mean empty, and how often the field is filled in.
-- It powers the field picker, the filter chips and the outcome-order editor —
-- without it the UI would sample the call log on every page load.
--
-- It helps people find fields; it never restricts them. A field missing from
-- here still works.
CREATE TABLE IF NOT EXISTS pype_analytics_fields (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL,
  agent_id       uuid,
  source         text NOT NULL DEFAULT 'voice',   -- voice | whatsapp | journeys
  col            text NOT NULL,                   -- metadata | transcription_metrics | metrics
  path           text[] NOT NULL,
  label          text NOT NULL,                   -- shown in the UI; the path never is
  value_type     text,                            -- boolean|text|number|enum|date|json
  encoding       text,                            -- native | json_string
  boolean_encoding text,                          -- one_zero | true_false | yes_no | y_n
  json_shape     text,                            -- scalar | object | array
  element_paths  jsonb,
  sentinels      jsonb,                           -- which values mean empty, for this field
  enum_values    jsonb,                           -- category lists, and the outcome-order editor
  is_identity_candidate boolean NOT NULL DEFAULT false,
  -- types are worked out, not confirmed, until a person checks
  type_confirmed boolean NOT NULL DEFAULT false,
  cardinality_est int,
  coverage_pct   numeric,                         -- shown next to every field in the picker
  blank_count    int, empty_count int,
  corrupt_count  int, unparseable_count int,
  name_normalised text,                           -- 'summary ' sits next to 'summary'
  is_dimension   boolean NOT NULL DEFAULT true,
  alias_of       uuid REFERENCES pype_analytics_fields(id) ON DELETE SET NULL,
  first_seen_at  timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz NOT NULL DEFAULT now()  -- drives "field no longer produced"
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_analytics_fields_identity
  ON pype_analytics_fields (project_id, coalesce(agent_id, '00000000-0000-0000-0000-000000000000'::uuid), source, col, path);

CREATE INDEX IF NOT EXISTS idx_analytics_fields_lookup
  ON pype_analytics_fields (project_id, agent_id, source);

-- --------------------------------------------------------- outcome ordering

-- Which outcome beats which, set once per agent (§10.6). Today that order is
-- copied into eight separate Metabase queries; here, reordering it updates
-- every chart, drill-down and export at once.
ALTER TABLE pype_voice_agents
  ADD COLUMN IF NOT EXISTS outcome_ranking jsonb;

COMMENT ON COLUMN pype_voice_agents.outcome_ranking IS
  'Analytics: {"field": {"col": "...", "path": [...]}, "order": ["best", ..., "worst"]}. Changing it changes past numbers too.';

-- -------------------------------------------------------------------- access

-- Every read and write goes through our API routes on the service role. Nothing
-- reaches these tables with the anon key, so deny by default and add no policy.
ALTER TABLE pype_analytics_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE pype_analytics_widgets    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pype_analytics_fields     ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON pype_analytics_dashboards, pype_analytics_widgets, pype_analytics_fields
  FROM anon, authenticated;
GRANT  ALL ON pype_analytics_dashboards, pype_analytics_widgets, pype_analytics_fields
  TO   service_role;

-- ------------------------------------------------------------ updated_at

CREATE OR REPLACE FUNCTION pype_analytics_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_analytics_dashboards_touch ON pype_analytics_dashboards;
CREATE TRIGGER trg_analytics_dashboards_touch
  BEFORE UPDATE ON pype_analytics_dashboards
  FOR EACH ROW EXECUTE FUNCTION pype_analytics_touch_updated_at();

DROP TRIGGER IF EXISTS trg_analytics_widgets_touch ON pype_analytics_widgets;
CREATE TRIGGER trg_analytics_widgets_touch
  BEFORE UPDATE ON pype_analytics_widgets
  FOR EACH ROW EXECUTE FUNCTION pype_analytics_touch_updated_at();

COMMIT;
