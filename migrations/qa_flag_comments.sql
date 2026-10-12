-- QA Audit: comment thread on flagged-call tickets, an internal sheet + assignee
-- per ticket, and the in-app notification bell. Run before deploying.

ALTER TABLE qa_flag_tickets
  ADD COLUMN IF NOT EXISTS sheet_url      text,   -- internal only, never sent to customers
  ADD COLUMN IF NOT EXISTS assignee_email text;   -- @pypeai.com prompt engineer

CREATE TABLE IF NOT EXISTS qa_flag_comments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id    uuid NOT NULL REFERENCES qa_flag_tickets(id) ON DELETE CASCADE,
  author_email text NOT NULL,
  body         text NOT NULL DEFAULT '',
  attachments  jsonb NOT NULL DEFAULT '[]',      -- [{ key, name }] images in S3
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qa_flag_comments_ticket_idx ON qa_flag_comments (ticket_id, created_at);

CREATE TABLE IF NOT EXISTS qa_inbox (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email text NOT NULL,
  title           text NOT NULL,
  body            text,
  link            text NOT NULL,
  read_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS qa_inbox_recipient_idx ON qa_inbox (lower(recipient_email), created_at DESC);

-- Same convention as the other qa_* tables: API routes on the service role only.
ALTER TABLE qa_flag_comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_inbox  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON qa_flag_comments, qa_inbox FROM anon, authenticated;
GRANT  ALL ON qa_flag_comments, qa_inbox TO service_role;
