-- Migration: Prevent duplicate conversation turns in pype_voice_metrics_logs
-- Date: 2026-08-06
--
-- Problem: the ingestion Lambda's call_ended handler inserts conversation turns
-- unconditionally on every invocation (services/database/databaseService.mjs
-- insertConversationTurns -> plain .insert(turns), no dedup). S3 event
-- notifications are AWS's documented at-least-once delivery -- the same
-- call_ended event can legitimately re-invoke the Lambda for one real call.
-- pype_voice_call_logs already resolves retries to the same row (existingStarted
-- lookup + update, see handler.mjs), but the turns insert has no equivalent
-- guard, so a retry doubles every turn for that session (same session_id, same
-- trace_id per row -- exactly what shows up as "Turns (6)" for a 3-turn call).
--
-- Fix: a real unique constraint, enforced by the database, so the fix holds no
-- matter what triggers a future retry -- not just the S3-redelivery case we
-- know about today. Combined with an upsert (see handler.mjs change), a retry
-- becomes a no-op instead of a duplicate insert.
--
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).

-- 1. Clean up any duplicates already sitting in the table from past retries,
--    keeping the earliest row per (session_id, turn_id). `id` is a UUID, not
--    a sequential integer, so it carries no insert-order information -- must
--    tie-break on created_at instead. On an exact created_at tie, `id` is
--    only used as a final, arbitrary tie-breaker (never as the primary key).
DELETE FROM public.pype_voice_metrics_logs a
USING public.pype_voice_metrics_logs b
WHERE a.session_id IS NOT NULL
  AND a.turn_id IS NOT NULL
  AND a.session_id = b.session_id
  AND a.turn_id = b.turn_id
  AND (a.created_at, a.id) > (b.created_at, b.id);

-- 2. Enforce it going forward. NULLs in session_id/turn_id are never considered
--    equal by a standard unique constraint, so this can't wrongly block rows
--    that legitimately have no turn_id.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_metrics_logs_session_turn
  ON public.pype_voice_metrics_logs (session_id, turn_id);
