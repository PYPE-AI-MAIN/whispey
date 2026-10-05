-- Pi — session history and per-user usage audit.
--
-- One row per chat session; the whole conversation (messages + tool calls)
-- is stored as a JSON blob in one column — the same shape Prompt Forge
-- already uses for its own sessions (pype_voice_promptforge_sessions.messages),
-- so there's no separate turns table here either.
--
-- user_id/user_email are populated for real on every write (Prompt Forge
-- reserved a created_by column for this and never actually wrote to it —
-- "who is using Pi, and for what" is a real requirement here, not an
-- afterthought), which is what lets a project admin see who has been asking
-- Pi to do what, without a separate audit-log table.
--
-- Safe to run more than once.

BEGIN;

CREATE TABLE IF NOT EXISTS pi_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES pype_voice_projects(id) ON DELETE CASCADE,
  user_id     text NOT NULL,
  user_email  text NOT NULL,
  title       text NOT NULL DEFAULT 'New chat',
  messages    jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- "my chats": one user's sessions in one project, most recent first
CREATE INDEX IF NOT EXISTS pi_sessions_user_idx
  ON pi_sessions (project_id, user_id, updated_at DESC);

-- "team activity" (admin-only): every session in a project, most recent first
CREATE INDEX IF NOT EXISTS pi_sessions_project_idx
  ON pi_sessions (project_id, updated_at DESC);

COMMIT;
