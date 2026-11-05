-- QA Audit: flagged-call tickets + weekly review requests.
-- Replaces the automated QA insights (qa_phase1.sql). Safe to run before the old
-- tables are dropped — see qa_insights_cleanup.sql for that, run it last.

CREATE TABLE IF NOT EXISTS qa_flag_tickets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_log_id        uuid NOT NULL,
  agent_id           uuid NOT NULL,
  project_id         uuid NOT NULL,
  flag_id            text NOT NULL,           -- id of the entry in transcription_metrics.flag
  reason             text NOT NULL,
  flagged_by_user_id text,
  flagged_by_email   text,
  flagged_at         timestamptz NOT NULL DEFAULT now(),
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'in_review', 'resolved')),
  resolution_note    text,
  resolved_by        text,
  resolved_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (call_log_id, flag_id)
);
CREATE INDEX IF NOT EXISTS qa_flag_tickets_agent_idx  ON qa_flag_tickets (agent_id, status, flagged_at DESC);
CREATE INDEX IF NOT EXISTS qa_flag_tickets_status_idx ON qa_flag_tickets (status, flagged_at DESC);

CREATE TABLE IF NOT EXISTS qa_weekly_reviews (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id             uuid NOT NULL,
  project_id           uuid NOT NULL,
  week_start           date NOT NULL,         -- Monday of the week to review
  week_end             date NOT NULL,         -- Sunday of that week
  requested_by_user_id text,
  requested_by_email   text,
  requested_at         timestamptz NOT NULL DEFAULT now(),
  status               text NOT NULL DEFAULT 'requested'
                       CHECK (status IN ('requested', 'in_progress', 'ready')),
  sheet_url            text,                  -- Google Sheet the QA team attached
  note                 text,
  ready_by             text,
  ready_at             timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, week_start)
);
CREATE INDEX IF NOT EXISTS qa_weekly_reviews_agent_idx  ON qa_weekly_reviews (agent_id, week_start DESC);
CREATE INDEX IF NOT EXISTS qa_weekly_reviews_status_idx ON qa_weekly_reviews (status, requested_at DESC);

-- Same convention as the old qa_* tables: every read and write goes through an
-- API route on the service role. Deny by default, no policy.
ALTER TABLE qa_flag_tickets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_weekly_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON qa_flag_tickets, qa_weekly_reviews FROM anon, authenticated;
GRANT  ALL ON qa_flag_tickets, qa_weekly_reviews TO service_role;

-- qa_touch_updated_at() is created by qa_phase1.sql. Recreate it here so this
-- file still works after the cleanup migration drops it.
CREATE OR REPLACE FUNCTION qa_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_qa_flag_tickets_touch ON qa_flag_tickets;
CREATE TRIGGER trg_qa_flag_tickets_touch
  BEFORE UPDATE ON qa_flag_tickets
  FOR EACH ROW EXECUTE FUNCTION qa_touch_updated_at();

DROP TRIGGER IF EXISTS trg_qa_weekly_reviews_touch ON qa_weekly_reviews;
CREATE TRIGGER trg_qa_weekly_reviews_touch
  BEFORE UPDATE ON qa_weekly_reviews
  FOR EACH ROW EXECUTE FUNCTION qa_touch_updated_at();
