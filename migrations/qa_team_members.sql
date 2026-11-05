-- QA Audit roster, managed from the super admin page instead of env vars.
-- role 'qa' may update tickets (in addition to QA_TEAM_EMAILS); role
-- 'prompt_engineer' can be assigned a flag and is tagged on Slack when it goes in review.
CREATE TABLE IF NOT EXISTS qa_team_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  email      text NOT NULL,
  role       text NOT NULL CHECK (role IN ('qa', 'prompt_engineer')),
  slack_id   text,                              -- Slack member ID, e.g. U0AJMAJ5694
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS qa_team_members_email_role_idx ON qa_team_members (lower(email), role);

ALTER TABLE qa_team_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON qa_team_members FROM anon, authenticated;
GRANT  ALL ON qa_team_members TO service_role;
