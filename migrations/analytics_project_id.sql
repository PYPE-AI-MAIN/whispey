-- project_id on pype_voice_call_logs — Confluence "Analytics Phase 1 and 2 —
-- Build Spec" §6.2.
--
-- Today every tenant-scoped query joins through pype_voice_agents to find out
-- which project a call belongs to. Carrying it on the row removes the join and,
-- more importantly, gives the planner a cheap first predicate on a 958k-row
-- table. It also stops being a convenience and becomes a security requirement
-- once a model is allowed to build requests.
--
-- This file is safe and fast: adding a nullable column with no default does not
-- rewrite the table. The backfill is a separate file on purpose — it touches
-- every row and must not run inside a migration transaction.

BEGIN;

ALTER TABLE pype_voice_call_logs
  ADD COLUMN IF NOT EXISTS project_id uuid;

COMMENT ON COLUMN pype_voice_call_logs.project_id IS
  'Which project owns this call. Filled by trigger on insert; see migrations/analytics_project_id_backfill.sql for existing rows.';

-- Every new row fills itself in.
--
-- A trigger rather than a change to the ingest route: there is more than one
-- writer (the Next.js route, the analytics lambda, replays), and patching only
-- the path we know about leaves the others writing NULL — which would look like
-- missing data in every chart rather than like a bug.
CREATE OR REPLACE FUNCTION pype_call_logs_set_project_id() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.project_id IS NULL AND NEW.agent_id IS NOT NULL THEN
    SELECT a.project_id INTO NEW.project_id
    FROM   pype_voice_agents a
    WHERE  a.id = NEW.agent_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_call_logs_set_project_id ON pype_voice_call_logs;
CREATE TRIGGER trg_call_logs_set_project_id
  BEFORE INSERT OR UPDATE OF agent_id ON pype_voice_call_logs
  FOR EACH ROW EXECUTE FUNCTION pype_call_logs_set_project_id();

COMMIT;

-- The index every chart will use. CONCURRENTLY so ingest keeps working while it
-- builds, which means it cannot be inside a transaction.
-- Run this AFTER the backfill, or it indexes a column of nulls.
--
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_project_agent_started
--     ON pype_voice_call_logs (project_id, agent_id, call_started_at);
