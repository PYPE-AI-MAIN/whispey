-- Automated Call QA — Confluence "Automated Call QA — Design".
--
-- Six tables and one column. The engine that writes them lives in
-- pype-voice-analytics-lambda (services/qa/*); this repo owns the schema
-- because every other analytics migration already does.
--
-- Shape of a night, per agent:
--   sampler  -> 200 calls (100 flagged + 100 random, topped up)
--   stage A  -> qa_call_issues rows, one per issue found on a call
--   roll-up  -> one qa_daily_stats row, so "down 4 on last week" is a lookup
--   stage B  -> at most one qa_insights row, and only when it is worth one
--
-- Safe to run more than once.

BEGIN;

-- ------------------------------------------------------------- the taxonomy

-- The fixed list of issue names. Both repos READ this table — the lambda to
-- build the judge prompt, the dashboard to render labels and filters. It is
-- deliberately not a constant in either, so we do not repeat the
-- flagRulesEngine.mjs / flagRulesValidation.ts "keep both in sync by comment"
-- arrangement.
CREATE TABLE IF NOT EXISTS qa_issue_types (
  key         text PRIMARY KEY,
  label       text NOT NULL,
  category    text NOT NULL CHECK (category IN
                ('platform','prompt','disposition','config_voice','language','asr','user')),
  priority    text NOT NULL CHECK (priority IN ('P0','P1','P2')),
  -- how we find it. 'rule' costs nothing; 'llm' is stage A; 'audio' needs the
  -- recording and only ever runs on a call a human asked to review.
  detection   text NOT NULL CHECK (detection IN ('rule','llm','audio')),
  -- who can actually fix it. Drives whether stage B writes a prompt patch.
  fixable_by  text NOT NULL CHECK (fixable_by IN ('prompt','pype','customer')),
  -- Bindu's list includes "nothing wrong here" markers (asr_good, smooth call).
  -- They are kept so the taxonomy stays at 66, but they are never counted as
  -- problems and never reach an insight.
  is_positive boolean NOT NULL DEFAULT false,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE qa_issue_types IS
  'The 66 issue names from the QA design doc. Source of truth for both the lambda judge and the dashboard UI.';

-- ------------------------------------------------------- what we found, per call

CREATE TABLE IF NOT EXISTS qa_call_issues (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_log_id  uuid NOT NULL REFERENCES pype_voice_call_logs(id) ON DELETE CASCADE,
  agent_id     uuid NOT NULL,
  project_id   uuid,
  issue_key    text NOT NULL REFERENCES qa_issue_types(key),
  -- 'rule' and 'llm' are written by the night job; 'human' by a reviewer who
  -- found something the machine missed.
  source       text NOT NULL CHECK (source IN ('rule','llm','audio','human')),
  -- which half of the sample this call came from. Percentages in an insight are
  -- computed from 'random' only — the flagged half is not a fair sample.
  sample_arm   text CHECK (sample_arm IN ('flagged','random')),
  turn_index   int,
  evidence     text,              -- one quoted line from the transcript
  confidence   numeric(3,2),      -- 0.00-1.00, null for rule hits (always certain)
  status       text NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open','confirmed','rejected')),
  confirmed_by text,
  confirmed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- one row per (call, issue, source): a rule and the judge may both find the
-- same thing, and we want to know that they agreed.
CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_call_issue
  ON qa_call_issues (call_log_id, issue_key, source);

-- every rollup is "how many calls had this issue, over this window"
CREATE INDEX IF NOT EXISTS idx_qa_call_issues_agent_issue
  ON qa_call_issues (agent_id, issue_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_call_issues_project
  ON qa_call_issues (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_call_issues_call
  ON qa_call_issues (call_log_id);

-- --------------------------------------------- what we checked, and what it cost

-- The sampler's ledger. Also stops a re-run double-charging us for a night
-- that already completed.
CREATE TABLE IF NOT EXISTS qa_call_runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    uuid NOT NULL,
  run_date    date NOT NULL,
  stage       text NOT NULL CHECK (stage IN ('rules','judge','insight')),
  status      text NOT NULL DEFAULT 'running'
                CHECK (status IN ('running','done','failed','skipped')),
  calls_seen  int  NOT NULL DEFAULT 0,
  model       text,
  cost_usd    numeric(10,4),
  error       text,
  started_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_call_run
  ON qa_call_runs (agent_id, run_date, stage);

-- ------------------------------------------------------- yesterday's numbers

-- One row per agent per day. This is the only reason "task completion is down
-- 4 points on last week" is cheap — stage B reads these rows, it never
-- re-reads old calls.
--
-- metrics: the agent's OWN field-extractor keys, e.g.
--   {"task_complete": {"rate": 0.78, "n": 100}, "final_disposition": {...}}
-- Key names are not declared anywhere here; they come from that agent's
-- field_extractor_prompt, which is the source of truth.
CREATE TABLE IF NOT EXISTS qa_daily_stats (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      uuid NOT NULL,
  project_id    uuid,
  run_date      date NOT NULL,
  calls_total   int NOT NULL DEFAULT 0,   -- how many the agent actually made
  calls_sampled int NOT NULL DEFAULT 0,
  flagged_n     int NOT NULL DEFAULT 0,
  random_n      int NOT NULL DEFAULT 0,
  -- issue_key -> {"flagged": n, "random": n}. Percentages use the random leg.
  issue_counts  jsonb NOT NULL DEFAULT '{}'::jsonb,
  metrics       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_daily_stats
  ON qa_daily_stats (agent_id, run_date);
CREATE INDEX IF NOT EXISTS idx_qa_daily_stats_lookup
  ON qa_daily_stats (agent_id, run_date DESC);

-- --------------------------------------------------------------- the insight

CREATE TABLE IF NOT EXISTS qa_insights (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      uuid NOT NULL,
  project_id    uuid,
  run_date      date NOT NULL,
  severity      text NOT NULL DEFAULT 'info'
                  CHECK (severity IN ('info','attention','urgent')),
  headline      text NOT NULL,
  -- [{"text": "...", "issue_key": "...", "calls": 14, "pct": 0.14, "call_ids": [...]}]
  bullets       jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- this period beside last, already resolved so the UI does no maths
  metrics       jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- [{"section": "...", "remove": [...], "add": [...], "why": "...", "call_ids": [...]}]
  suggested_prompt_patch jsonb,
  -- which trigger fired: new | big | moved | drop | back
  trigger       text,
  status        text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','acknowledged','actioned','dismissed')),
  -- set when a prompt change was published off the back of this insight, so
  -- the next insight can say whether it worked
  acted_version_id uuid,
  acted_at      timestamptz,
  delivered_at  timestamptz,       -- null until the 10:00-19:00 window opens
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- at most one insight per agent per day (guardrail, enforced not just prompted)
CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_insight_agent_day
  ON qa_insights (agent_id, run_date);
CREATE INDEX IF NOT EXISTS idx_qa_insights_agent
  ON qa_insights (agent_id, run_date DESC);
CREATE INDEX IF NOT EXISTS idx_qa_insights_project_open
  ON qa_insights (project_id, status, run_date DESC);

-- ------------------------------------------------------------ the listen list

CREATE TABLE IF NOT EXISTS qa_review_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id  uuid REFERENCES qa_insights(id) ON DELETE CASCADE,
  agent_id    uuid NOT NULL,
  project_id  uuid,
  call_log_id uuid NOT NULL REFERENCES pype_voice_call_logs(id) ON DELETE CASCADE,
  -- why this call is on the list, in words. No reason, no listening.
  reason      text NOT NULL,
  rank        int  NOT NULL DEFAULT 0,
  requested_by text,
  assigned_to text,
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','in_review','done','skipped')),
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_review_items_queue
  ON qa_review_items (status, rank, created_at);
CREATE INDEX IF NOT EXISTS idx_qa_review_items_insight
  ON qa_review_items (insight_id);

-- ----------------------------------------------------- who gets told, and how

CREATE TABLE IF NOT EXISTS qa_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- any address. Not necessarily a Whispey user — a hospital ops lead who
  -- never logs in still gets the mail.
  email       text NOT NULL,
  project_id  uuid NOT NULL,
  agent_id    uuid,                        -- null = every agent in the project
  cadence     text NOT NULL DEFAULT 'as_it_happens'
                CHECK (cadence IN ('as_it_happens','daily','weekly','campaign_end')),
  -- 'insights' or 'insights_and_prompts'
  contents    text NOT NULL DEFAULT 'insights'
                CHECK (contents IN ('insights','insights_and_prompts')),
  active      boolean NOT NULL DEFAULT true,
  created_by  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_subscription
  ON qa_subscriptions (email, project_id, COALESCE(agent_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_qa_subscriptions_scope
  ON qa_subscriptions (project_id, agent_id) WHERE active;

CREATE TABLE IF NOT EXISTS qa_notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL,
  agent_id    uuid,
  insight_id  uuid REFERENCES qa_insights(id) ON DELETE CASCADE,
  -- who sees it in-app. null = everyone on the project who can see the agent.
  user_email  text,
  kind        text NOT NULL DEFAULT 'insight'
                CHECK (kind IN ('insight','review_request')),
  title       text NOT NULL,
  body        text,
  link        text,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_notifications_unread
  ON qa_notifications (project_id, created_at DESC) WHERE read_at IS NULL;

-- ------------------------------------------------------------- per-agent knobs

-- Sits beside field_extractor, metrics and flag_rules — fetchAgentConfig in the
-- lambda selects all of them in one go.
--
-- Deliberately does NOT hold key names or descriptions. Those live in
-- field_extractor_prompt and differ agent by agent; duplicating them here would
-- create a second source of truth that silently drifts.
ALTER TABLE pype_voice_agents
  ADD COLUMN IF NOT EXISTS qa_config jsonb;

COMMENT ON COLUMN pype_voice_agents.qa_config IS
  'QA: {"enabled":true,"sample_size":200,"flagged_share":0.5,"normal_call_seconds":120,"max_utterance_words":60,"latency_ms":3000,"silence_ms":5000,"send_window":["10:00","19:00"],"timezone":"Asia/Kolkata"}. Key names come from field_extractor_prompt, never from here.';

-- -------------------------------------------------------------------- access

-- Same convention as pype_analytics_*: every read and write goes through an API
-- route or the lambda on the service role. Nothing reaches these with the anon
-- key, so deny by default and add no policy.
ALTER TABLE qa_issue_types    ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_call_issues    ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_call_runs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_daily_stats    ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_insights       ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_review_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_notifications  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON qa_issue_types, qa_call_issues, qa_call_runs, qa_daily_stats,
              qa_insights, qa_review_items, qa_subscriptions, qa_notifications
  FROM anon, authenticated;
GRANT  ALL ON qa_issue_types, qa_call_issues, qa_call_runs, qa_daily_stats,
              qa_insights, qa_review_items, qa_subscriptions, qa_notifications
  TO   service_role;

-- ------------------------------------------------------------------ updated_at

CREATE OR REPLACE FUNCTION qa_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_qa_insights_touch ON qa_insights;
CREATE TRIGGER trg_qa_insights_touch
  BEFORE UPDATE ON qa_insights
  FOR EACH ROW EXECUTE FUNCTION qa_touch_updated_at();

-- ------------------------------------------------------------- seed: the 66
--
-- Bindu's "Automated Call QA" §4.1-4.7. Five rows differ from her Auto? column
-- and match her own summary table instead — bot_silence, call_not_closed,
-- high_latency, blank_asr and user_slow_response are rule checks here, because
-- pype_voice_metrics_logs already stores per-turn timings. That leaves exactly
-- the five she describes as "all about how the voice sounds" needing audio.

INSERT INTO qa_issue_types (key, label, category, priority, detection, fixable_by, is_positive) VALUES
  -- platform (P0) — 9
  ('bot_silence',                  'Bot silence',                     'platform','P0','rule', 'pype',    false),
  ('transfer_failure',             'Transfer failure',                'platform','P0','rule', 'pype',    false),
  ('call_not_closed',              'Call not closed',                 'platform','P0','rule', 'pype',    false),
  ('missing_call_data',            'Missing call data',               'platform','P0','rule', 'pype',    false),
  ('high_latency',                 'High latency',                    'platform','P0','rule', 'pype',    false),
  ('response_repetition_platform', 'Response repetition (platform)',  'platform','P0','rule', 'pype',    false),
  ('undefined_scenario',           'Undefined scenario',              'platform','P0','llm',  'prompt',  false),
  ('im_break',                     'Opening message break',           'platform','P0','llm',  'pype',    false),
  ('audio_distortion',             'Audio distortion',                'platform','P0','audio','pype',    false),

  -- prompt (P0) — 22
  ('agent_hallucination',          'Agent hallucination',             'prompt','P0','llm',  'prompt', false),
  ('scenario_not_defined',         'Scenario not defined',            'prompt','P0','llm',  'prompt', false),
  ('flow_jump',                    'Flow jump',                       'prompt','P0','llm',  'prompt', false),
  ('wrong_flow',                   'Wrong flow',                      'prompt','P0','llm',  'prompt', false),
  ('response_looping',             'Response looping',                'prompt','P0','llm',  'prompt', false),
  ('response_repetition',          'Response repetition',             'prompt','P0','llm',  'prompt', false),
  ('no_memory_retention',          'No memory retention',             'prompt','P0','llm',  'prompt', false),
  ('no_fallback_probing',          'No fallback probing',             'prompt','P0','llm',  'prompt', false),
  ('variable_missed',              'Variable missed',                 'prompt','P0','rule', 'prompt', false),
  ('wrong_variable',               'Wrong variable',                  'prompt','P0','llm',  'prompt', false),
  ('wrong_entity',                 'Wrong entity',                    'prompt','P0','llm',  'prompt', false),
  ('conditional_skip_not_working', 'Conditional skip not working',    'prompt','P0','llm',  'prompt', false),
  ('merged_consecutive_queries',   'Merged consecutive queries',      'prompt','P0','llm',  'prompt', false),
  ('agent_disconnected',           'Agent disconnected early',        'prompt','P0','rule', 'prompt', false),
  ('wrong_tool_output',            'Wrong tool output',               'prompt','P0','llm',  'pype',   false),
  ('wrong_tool_variable',          'Wrong tool variable',             'prompt','P0','llm',  'prompt', false),
  ('in_scope_wrong_transfer',      'In-scope wrong transfer',         'prompt','P0','llm',  'prompt', false),
  ('long_utterance',               'Long utterance / robotic script', 'prompt','P0','rule', 'prompt', false),
  ('incorrect_grammar',            'Incorrect grammar',               'prompt','P0','llm',  'prompt', false),
  ('missing_contextual_probing',   'Missing contextual probing',      'prompt','P0','llm',  'prompt', false),
  ('static_responses',             'Static responses',                'prompt','P0','llm',  'prompt', false),
  ('entity_mispronunciation',      'Entity mispronunciation',         'prompt','P0','audio','pype',   false),

  -- disposition (P0) — 4
  ('wrong_disposition',            'Wrong disposition',               'disposition','P0','llm', 'prompt', false),
  ('no_disposition',               'No disposition',                  'disposition','P0','rule','prompt', false),
  ('disposition_spelling_error',   'Disposition not in allowed list', 'disposition','P0','rule','prompt', false),
  ('disposition_not_defined',      'Disposition not defined',         'disposition','P0','llm', 'prompt', false),

  -- config + voice quality (P1) — 7
  ('background_noise_as_input',    'Background noise taken as input', 'config_voice','P1','rule', 'pype', false),
  ('rate_of_speech',               'Rate of speech',                  'config_voice','P1','llm',  'pype', false),
  ('interruption_failure',         'Interruption failure',            'config_voice','P1','llm',  'pype', false),
  ('smooth_call_human_like',       'Smooth call — human like',        'config_voice','P1','llm',  'pype', true),
  ('mix_of_human_and_robot',       'Mix of human and robot',          'config_voice','P1','audio','pype', false),
  ('poor_pronunciation',           'Poor pronunciation',              'config_voice','P1','audio','pype', false),
  ('robotic_voice',                'Robotic voice',                   'config_voice','P1','audio','pype', false),

  -- language (P1) — 6
  ('language_mix_failure',         'Language mix failure',            'language','P1','llm','prompt', false),
  ('different_language_agent',     'Agent spoke the wrong language',  'language','P1','llm','prompt', false),
  ('improper_language_mixing',     'Improper language mixing',        'language','P1','llm','prompt', false),
  ('non_conversational_language',  'Non-conversational language',     'language','P1','llm','prompt', false),
  ('accent_handling_issue',        'Accent handling issue',           'language','P1','llm','pype',   false),
  ('smooth_call_language',         'Smooth call — language',          'language','P1','llm','pype',   true),

  -- ASR (P2) — 7
  ('blank_asr',                    'Blank ASR',                       'asr','P2','rule','pype', false),
  ('junk_asr',                     'Incorrect / junk ASR',            'asr','P2','llm', 'pype', false),
  ('entities_missing_incorrect',   'Entities missing or incorrect',   'asr','P2','llm', 'pype', false),
  ('asr_output_other_language',    'ASR output in another language',  'asr','P2','llm', 'pype', false),
  ('partial_asr',                  'Partial ASR',                     'asr','P2','llm', 'pype', false),
  ('unigrams_missing',             'Unigrams missing or incorrect',   'asr','P2','llm', 'pype', false),
  ('asr_good',                     'ASR good',                        'asr','P2','llm', 'pype', true),

  -- user-side (P2) — 11. Tagged separately so they are never counted against
  -- the agent; without this the numbers look worse than they are.
  ('no_user_input',                'No user input',                   'user','P2','rule','customer', false),
  ('voicemail',                    'Voicemail',                       'user','P2','llm', 'customer', false),
  ('mid_call_drop',                'Mid-call drop',                   'user','P2','rule','customer', false),
  ('user_different_language',      'User spoke an unsupported language','user','P2','llm','customer', false),
  ('side_conversation',            'Side conversation',               'user','P2','llm', 'customer', false),
  ('call_on_hold',                 'Call on hold',                    'user','P2','llm', 'customer', false),
  ('user_slow_response',           'Slow user response',              'user','P2','rule','customer', false),
  ('frequent_interruption',        'Frequent interruption',           'user','P2','rule','customer', false),
  ('out_of_scope_request',         'Out-of-scope request',            'user','P2','llm', 'customer', false),
  ('foul_language',                'Foul language',                   'user','P2','rule','customer', false),
  ('unclear_speech',               'Unclear speech',                  'user','P2','llm', 'customer', false)
ON CONFLICT (key) DO UPDATE SET
  label      = EXCLUDED.label,
  category   = EXCLUDED.category,
  priority   = EXCLUDED.priority,
  detection  = EXCLUDED.detection,
  fixable_by = EXCLUDED.fixable_by,
  is_positive= EXCLUDED.is_positive;

COMMIT;
