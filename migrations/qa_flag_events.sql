-- Journey of a flagged call: flagged -> status changes -> assignment. Comments live in qa_flag_comments.
CREATE TABLE IF NOT EXISTS qa_flag_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES qa_flag_tickets(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('flagged', 'status', 'assigned')),
  actor_email text,
  detail      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qa_flag_events_ticket_idx ON qa_flag_events (ticket_id, created_at);

ALTER TABLE qa_flag_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON qa_flag_events FROM anon, authenticated;
GRANT  ALL ON qa_flag_events TO service_role;
