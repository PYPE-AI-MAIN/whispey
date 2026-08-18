-- Fixes the Disk I/O budget depletion caused by refresh_call_summary() running
-- REFRESH MATERIALIZED VIEW CONCURRENTLY on a cron, which re-scanned the whole
-- of pype_voice_call_logs every run (~757M blocks read/run per
-- pg_stat_statements). See RCA: Supabase Disk I/O Budget Depletion.
--
-- Replaces the full refresh with a targeted rebuild of only the
-- (agent_id, call_date) pairs touched in a recent window, into a plain table.
-- A materialized view cannot do this — REFRESH always recomputes the entire
-- view — which is why call_summary_daily is a table.
--
-- Does NOT touch call_summary_materialized or refresh_call_summary(); the cron
-- job is repointed at the new function instead (Step 5 below). Confirmed that
-- Metabase does not read the old view.
--
-- ===========================================================================
-- TUNING — both knobs live in call_summary_config. Never edit a function body
-- to change them. One call sets either or both, and applies the cron schedule:
--
--   SELECT * FROM set_call_summary_config(p_window => interval '2 days');
--   SELECT * FROM set_call_summary_config(p_schedule => '*/15 * * * *');
--   SELECT * FROM set_call_summary_config(interval '1 day', '*/30 * * * *');
--
-- Current values:  SELECT * FROM call_summary_config;
-- Defaults below:  window = 1 day, schedule = every 30 minutes.
-- ===========================================================================
--
-- WHY A WINDOW AND NOT A TIGHT WATERMARK — measured on live data:
--   * created_at is stamped at call START but the row only lands at call END.
--     Longest call in 30d = 1862s (31 min), so a short window drops long calls.
--   * total_llm_cost / total_tts_cost / total_stt_cost are written by a
--     SEPARATE UPDATE after the row (src/app/api/logs/call-logs/route.ts:511),
--     so a day summarised too early would keep stale costs.
--   * A day's row stops being rebuilt once its calls age out of the window, so
--     the window must exceed the cost-landing lag (measured avg 6m22s).
--   A 1-day window rebuilds each day ~48 times before it ages out, and
--   measurement confirmed 0 rows older than 1 day were updated within the last
--   day. Anything beyond that is handled by the Recalculate button.
--
-- COST: ~5,350 calls/day, so a 1-day window is ~5,350 rows per run versus
-- ~700K scanned today. Served by the existing idx_call_logs_agent_created and
-- idx_call_logs_created_at — no new index required.
--
-- Safe to re-run.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Tuning knobs. Single source of truth for the refresh window and the cron
--    schedule.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS call_summary_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  refresh_window interval NOT NULL DEFAULT interval '1 day',
  cron_schedule  text     NOT NULL DEFAULT '*/30 * * * *'
);

-- Read only by the refresh functions (which run as definer) and by whoever
-- tunes it via SQL. RLS on with no policies = deny by default, so it is not
-- exposed through PostgREST to anon/authenticated keys.
ALTER TABLE call_summary_config ENABLE ROW LEVEL SECURITY;

INSERT INTO call_summary_config (id) VALUES (true) ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Summary table. Column set verified against the live view via
--    pg_attribute — 13 columns, including total_billing_minutes /
--    total_billing_seconds which the overview API selects.
--    One row per agent per day, enforced by the unique constraint (the
--    rebuild deletes then re-inserts each affected pair).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS call_summary_daily (
  agent_id uuid NOT NULL,
  call_date date NOT NULL,
  calls bigint,
  total_seconds bigint,
  total_minutes numeric,
  avg_latency double precision,
  unique_customers bigint,
  successful_calls bigint,
  success_rate numeric,
  total_billing_minutes numeric,
  total_billing_seconds double precision,
  telecom_cost numeric,
  total_cost numeric(16, 2),
  CONSTRAINT call_summary_daily_agent_date_key UNIQUE (agent_id, call_date)
);

-- Only service_role reads this (the overview API uses the service-role
-- client). RLS on with no policies = deny by default, so it is not exposed
-- through PostgREST to anon/authenticated keys.
ALTER TABLE call_summary_daily ENABLE ROW LEVEL SECURITY;

-- One-time backfill from the current view. Explicit column list so a column
-- order difference cannot silently misalign values. Guarded because staging
-- environments may not have the view at all.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'call_summary_materialized' AND relkind = 'm'
  ) THEN
    INSERT INTO call_summary_daily (
      agent_id, call_date, calls, total_seconds, total_minutes, avg_latency,
      unique_customers, successful_calls, success_rate, total_billing_minutes,
      total_billing_seconds, telecom_cost, total_cost
    )
    SELECT
      agent_id, call_date, calls, total_seconds, total_minutes, avg_latency,
      unique_customers, successful_calls, success_rate, total_billing_minutes,
      total_billing_seconds, telecom_cost, total_cost
    FROM call_summary_materialized
    ON CONFLICT (agent_id, call_date) DO NOTHING;
    RAISE NOTICE 'Backfilled call_summary_daily from call_summary_materialized';
  ELSE
    RAISE NOTICE 'call_summary_materialized not found — call_summary_daily starts empty. Run: SELECT rebuild_call_summary_daily(NULL, NULL);';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Shared aggregate, so the cron path and the manual path can never drift
--    apart. p_agent_id NULL = all agents (cron); non-NULL = one agent.
--    p_since NULL = full history (Recalculate).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rebuild_call_summary_daily(
  p_agent_id uuid DEFAULT NULL,
  p_since timestamp DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_from timestamp;
  v_to   timestamp;
BEGIN
  -- Transaction-scoped, so it is released on commit OR error. Two overlapping
  -- rebuilds touching the same (agent_id, call_date) would otherwise collide
  -- on the unique constraint.
  PERFORM pg_advisory_xact_lock(hashtext('call_summary_daily_rebuild'));

  -- ON COMMIT DROP only fires at commit, so a second call inside the same
  -- transaction would hit "relation _affected already exists". pg_cron gives
  -- each run its own transaction, but batch calls and manual multi-statement
  -- runs do not.
  DROP TABLE IF EXISTS _affected;

  -- Branch rather than using (p_x IS NULL OR col = p_x): an OR against a
  -- parameter forces one plan that must satisfy both branches, which makes
  -- the planner fall back to a sequential scan. Separate statements each get
  -- an index-driven plan.
  -- NULL created_at is excluded implicitly — NULL >= anything is never true.
  IF p_agent_id IS NULL THEN
    CREATE TEMP TABLE _affected ON COMMIT DROP AS
      SELECT DISTINCT agent_id, DATE(created_at) AS call_date
      FROM pype_voice_call_logs
      WHERE created_at >= COALESCE(p_since, '-infinity'::timestamp);
  ELSE
    CREATE TEMP TABLE _affected ON COMMIT DROP AS
      SELECT DISTINCT agent_id, DATE(created_at) AS call_date
      FROM pype_voice_call_logs
      WHERE agent_id = p_agent_id
        AND created_at >= COALESCE(p_since, '-infinity'::timestamp);
  END IF;

  -- Date bounds of the work, used to put a real range predicate on the
  -- aggregate below. Without it the only date condition is
  -- DATE(l.created_at) inside the join, which no index can serve, so every
  -- run would read the entire table.
  SELECT min(call_date)::timestamp, (max(call_date) + 1)::timestamp
  INTO v_from, v_to
  FROM _affected;

  IF v_from IS NULL THEN
    RETURN;  -- nothing changed in the window
  END IF;

  DELETE FROM call_summary_daily cs
  USING _affected a
  WHERE cs.agent_id = a.agent_id AND cs.call_date = a.call_date;

  -- The window above chooses WHICH day-rows to rebuild; each one is then
  -- recomputed from ALL of that day's calls, so counts, ratios and averages
  -- are full-day values, never partial-window values.
  INSERT INTO call_summary_daily (
    agent_id, call_date, calls, total_seconds, total_minutes, avg_latency,
    unique_customers, successful_calls, success_rate, total_billing_minutes,
    total_billing_seconds, telecom_cost, total_cost
  )
  SELECT
    l.agent_id,
    DATE(l.created_at),
    COUNT(*),
    SUM(l.duration_seconds),
    ROUND(SUM(l.duration_seconds)::numeric / 60, 0),
    AVG(l.avg_latency),
    COUNT(DISTINCT l.call_id),
    COUNT(*) FILTER (WHERE l.call_ended_reason = 'completed'),
    ROUND(
      (COUNT(*) FILTER (WHERE l.call_ended_reason = 'completed')::numeric / NULLIF(COUNT(*), 0)) * 100,
      2
    ),
    -- ROUND(SUM(...)) — sum first, then round to nearest. NOT
    -- SUM(CEIL(per row)), which over-counts short calls. Matches the live
    -- view definition exactly (verified via pg_get_viewdef).
    ROUND(SUM(l.billing_duration_seconds)::numeric / 60, 0),
    SUM(l.billing_duration_seconds),
    SUM(CEIL(l.duration_seconds::numeric / 60)) FILTER (WHERE l.call_ended_reason = 'completed') * 0.70,
    (
      COALESCE(SUM(l.total_llm_cost) FILTER (WHERE l.call_ended_reason = 'completed'), 0)
      + COALESCE(SUM(l.total_tts_cost) FILTER (WHERE l.call_ended_reason = 'completed'), 0)
      + COALESCE(SUM(l.total_stt_cost) FILTER (WHERE l.call_ended_reason = 'completed'), 0)
      + SUM(CEIL(l.duration_seconds::numeric / 60)) FILTER (WHERE l.call_ended_reason = 'completed') * 0.70
    )::numeric(16, 2)
  FROM pype_voice_call_logs l
  JOIN _affected a
    ON a.agent_id = l.agent_id AND a.call_date = DATE(l.created_at)
  WHERE l.created_at >= v_from        -- indexable bound; the join condition
    AND l.created_at <  v_to          -- alone cannot restrict the scan
    AND l.agent_id = COALESCE(p_agent_id, l.agent_id)
  GROUP BY l.agent_id, DATE(l.created_at);
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Cron path: every agent, window read from call_summary_config.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_call_summary_daily()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_window interval;
BEGIN
  SELECT refresh_window INTO v_window FROM call_summary_config;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'call_summary_config row missing — cannot determine refresh window';
  END IF;

  PERFORM rebuild_call_summary_daily(NULL, localtimestamp - v_window);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Manual path (Recalculate button): one agent, full history. Covers
--    reprocessing, manual edits and deletes older than the cron window — the
--    cron can only add or replace day-rows, never remove one whose calls were
--    all deleted, so the full delete here is deliberate.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalculate_call_summary_daily(p_agent_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_agent_id IS NULL THEN
    RAISE EXCEPTION 'p_agent_id is required';
  END IF;

  DELETE FROM call_summary_daily WHERE agent_id = p_agent_id;
  PERFORM rebuild_call_summary_daily(p_agent_id, NULL);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. The single tuning entry point. Updates the stored config AND applies the
--    schedule to the live cron job in one call.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_call_summary_config(
  p_window interval DEFAULT NULL,
  p_schedule text DEFAULT NULL
)
RETURNS TABLE (window_setting interval, schedule_setting text)
LANGUAGE plpgsql
AS $$
DECLARE
  v_jobid bigint;
  v_schedule text;
BEGIN
  UPDATE call_summary_config c
  SET refresh_window = COALESCE(p_window, c.refresh_window),
      cron_schedule  = COALESCE(p_schedule, c.cron_schedule);

  SELECT c.cron_schedule INTO v_schedule FROM call_summary_config c;

  SELECT j.jobid INTO v_jobid
  FROM cron.job j
  WHERE j.command LIKE '%refresh_call_summary_daily%'
  LIMIT 1;

  IF v_jobid IS NULL THEN
    RAISE NOTICE 'No cron job calling refresh_call_summary_daily() found; schedule stored but not applied';
  ELSE
    PERFORM cron.alter_job(v_jobid, schedule => v_schedule);
  END IF;

  RETURN QUERY SELECT c.refresh_window, c.cron_schedule FROM call_summary_config c;
END;
$$;

-- SECURITY DEFINER + PostgREST would otherwise let any logged-in user invoke
-- these for any agent_id, bypassing the owner/admin check in the API route.
REVOKE EXECUTE ON FUNCTION rebuild_call_summary_daily(uuid, timestamp)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION refresh_call_summary_daily()                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION recalculate_call_summary_daily(uuid)          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION set_call_summary_config(interval, text)       FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION recalculate_call_summary_daily(uuid)          TO service_role;

COMMIT;

-- ---------------------------------------------------------------------------
-- 7. CUTOVER — run separately, after the app is deployed and the parity check
--    passes. This is the step that actually stops the Disk I/O drain.
--    Finds the job by command rather than hardcoding id 10, so it works on
--    staging (different id, or no job yet) as well as production.
-- ---------------------------------------------------------------------------
-- DO $$
-- DECLARE
--   v_jobid bigint;
--   v_schedule text;
-- BEGIN
--   SELECT cron_schedule INTO v_schedule FROM call_summary_config;
--
--   SELECT jobid INTO v_jobid FROM cron.job
--   WHERE command ILIKE '%refresh_call_summary%'
--     AND command NOT ILIKE '%_daily%'
--   LIMIT 1;
--
--   IF v_jobid IS NULL THEN
--     PERFORM cron.schedule('refresh-call-summary-daily', v_schedule,
--                           'SELECT refresh_call_summary_daily();');
--     RAISE NOTICE 'No existing job found; scheduled a new one';
--   ELSE
--     PERFORM cron.alter_job(v_jobid,
--                            command  => 'SELECT refresh_call_summary_daily();',
--                            schedule => v_schedule);
--     RAISE NOTICE 'Repointed cron job % to refresh_call_summary_daily()', v_jobid;
--   END IF;
-- END $$;

-- ---------------------------------------------------------------------------
-- 8. After 10-15 days of clean running, and after confirming no Metabase saved
--    question depends on it, drop the old pre-aggregation layer.
--    NOTE: pg_stat_statements shows Metabase sync/fingerprint queries against
--    this view. Those are harmless, but check for saved questions first.
-- ---------------------------------------------------------------------------
-- DROP MATERIALIZED VIEW IF EXISTS call_summary_materialized CASCADE;
-- DROP FUNCTION IF EXISTS refresh_call_summary();

-- ---------------------------------------------------------------------------
-- ROLLBACK — see migrations/rollback_incremental_call_summary_refresh.sql
-- ---------------------------------------------------------------------------
