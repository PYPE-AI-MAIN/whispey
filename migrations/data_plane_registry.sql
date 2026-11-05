-- DRAFT, NOT APPLIED (PE-390). Needs a human yes before it runs anywhere.
-- Data-plane registry: where each project's call data, recordings, DNC and QA tickets live.
-- No route row for a project means Pype (today's behaviour). Once a route exists any
-- failure is an error, never a fallback. Secrets are stored by reference (ARN), never as values.

CREATE TABLE IF NOT EXISTS data_destinations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL UNIQUE,
  kind               text NOT NULL CHECK (kind IN ('pype_supabase', 'postgrest')),
  config             jsonb NOT NULL DEFAULT '{}'::jsonb,   -- non-secret: base_url, audience, role
  secret_ref         text,                                 -- ARN of the signing key; never returned by any API or logged
  schema_version     int NOT NULL DEFAULT 1,
  status             text NOT NULL DEFAULT 'unverified',
  last_health_at     timestamptz,
  last_health_detail jsonb,
  created_by         text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_destination_routes (
  project_id     uuid NOT NULL REFERENCES pype_voice_projects(id) ON DELETE CASCADE,
  data_type      text NOT NULL CHECK (data_type IN ('call_data', 'recordings', 'campaigns', 'dnc', 'qa')),
  destination_id uuid NOT NULL REFERENCES data_destinations(id),
  state          text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'paused')),
  version        int NOT NULL DEFAULT 1,
  effective_from timestamptz,
  PRIMARY KEY (project_id, data_type)
);

-- Campaigns accept only a Pype destination until the campaign store phase.
CREATE OR REPLACE FUNCTION data_destination_routes_check() RETURNS trigger AS $$
BEGIN
  IF NEW.data_type = 'campaigns'
     AND (SELECT kind FROM data_destinations WHERE id = NEW.destination_id) <> 'pype_supabase' THEN
    RAISE EXCEPTION 'campaigns can only be routed to a pype_supabase destination';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS data_destination_routes_check ON data_destination_routes;
CREATE TRIGGER data_destination_routes_check
  BEFORE INSERT OR UPDATE ON data_destination_routes
  FOR EACH ROW EXECUTE FUNCTION data_destination_routes_check();

CREATE TABLE IF NOT EXISTS data_destination_audit (
  id          bigserial PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  actor_email text,
  action      text NOT NULL,
  project_id  uuid,
  data_type   text,
  before      jsonb,
  after       jsonb,
  dry_run     boolean NOT NULL DEFAULT false
);

-- Service role only (the dashboard server and the admin panel). The dashboard never exposes secret_ref.
ALTER TABLE data_destinations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_destination_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_destination_audit  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON data_destinations, data_destination_routes, data_destination_audit FROM anon, authenticated;
GRANT  ALL ON data_destinations, data_destination_routes, data_destination_audit TO service_role;
GRANT  USAGE, SELECT ON SEQUENCE data_destination_audit_id_seq TO service_role;
