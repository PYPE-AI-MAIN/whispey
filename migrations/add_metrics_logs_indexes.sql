-- Migration: Add indexes to pype_voice_metrics_logs for fast session lookups
-- Date: 2026-03-15
--
-- Problem: every observability page load was doing a full sequential scan of
-- pype_voice_metrics_logs because session_id had no index. On a large table
-- this caused 10–15 second query times.
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Each statement is idempotent (IF NOT EXISTS) so it is safe to re-run.

-- 1. Primary lookup index: per-session queries (the hot path on the observability page)
CREATE INDEX IF NOT EXISTS idx_metrics_logs_session_id
  ON public.pype_voice_metrics_logs (session_id);

-- 2. Ordering index: queries always ORDER BY unix_timestamp ASC
CREATE INDEX IF NOT EXISTS idx_metrics_logs_unix_timestamp
  ON public.pype_voice_metrics_logs (unix_timestamp);

-- 3. Composite index: covers both the filter and the sort in one index scan
--    (most useful once the table is large)
CREATE INDEX IF NOT EXISTS idx_metrics_logs_session_id_ts
  ON public.pype_voice_metrics_logs (session_id, unix_timestamp ASC);

-- Optional: if you use the agent-level fallback filter (session_id::text LIKE 'agentId%')
-- that cast prevents index use. The composite index above won't help that path, but it
-- is rarely hit when a session_id is present in the URL (the normal observability case).
