-- Removes the automated QA insights (qa_phase1.sql). DESTRUCTIVE and permanent.
-- Run only after the QA Audit release is live and the old lambda functions
-- (qaNightly, qaDeliver, qaRunNow, qaRunWorker) are gone, so nothing writes to
-- these tables any more. Not run automatically.

DROP TABLE IF EXISTS qa_notifications  CASCADE;
DROP TABLE IF EXISTS qa_subscriptions  CASCADE;
DROP TABLE IF EXISTS qa_review_items   CASCADE;
DROP TABLE IF EXISTS qa_insights       CASCADE;
DROP TABLE IF EXISTS qa_daily_stats    CASCADE;
DROP TABLE IF EXISTS qa_call_runs      CASCADE;
DROP TABLE IF EXISTS qa_call_issues    CASCADE;
DROP TABLE IF EXISTS qa_issue_types    CASCADE;

ALTER TABLE pype_voice_agents DROP COLUMN IF EXISTS qa_config;

-- The old job also left a `qa` key inside transcription_metrics on call logs.
-- It is harmless and nothing reads it now, so it is left in place: stripping it
-- would rewrite a very large table (pype_voice_call_logs, ~1M rows).
