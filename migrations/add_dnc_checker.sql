-- Migration: DNC checker
-- Description: Per-agent automatic Do Not Call.
--   1. pype_voice_dnc_list gets a third scope, 'agent': the number is blocked for
--      that one agent only. Numbers the checker adds use source 'auto' and point
--      at the call where the caller asked.
--   2. pype_voice_agents gets dnc_checker_enabled (off for existing agents; the
--      app creates new agents with it on). The check itself is the field
--      extractor field `dnc_requested`, whose description is the editable prompt.
-- Date: 2026-10-15
-- Run on dev first. Safe to re-run.

-- ---------- 1. DNC list: agent scope ----------
ALTER TABLE public.pype_voice_dnc_list
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES public.pype_voice_agents(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS call_log_id uuid;

ALTER TABLE public.pype_voice_dnc_list DROP CONSTRAINT IF EXISTS pype_voice_dnc_list_scope_check;
ALTER TABLE public.pype_voice_dnc_list
  ADD CONSTRAINT pype_voice_dnc_list_scope_check CHECK (scope IN ('global', 'project', 'agent'));

ALTER TABLE public.pype_voice_dnc_list DROP CONSTRAINT IF EXISTS pype_voice_dnc_list_source_check;
ALTER TABLE public.pype_voice_dnc_list
  ADD CONSTRAINT pype_voice_dnc_list_source_check CHECK (source IN ('manual', 'csv', 'api', 'auto'));

-- global: no project, no agent · project: a project · agent: its agent and that agent's project
ALTER TABLE public.pype_voice_dnc_list DROP CONSTRAINT IF EXISTS dnc_scope_project_id;
ALTER TABLE public.pype_voice_dnc_list
  ADD CONSTRAINT dnc_scope_project_id CHECK (
    (scope = 'global'  AND project_id IS NULL     AND agent_id IS NULL) OR
    (scope = 'project' AND project_id IS NOT NULL AND agent_id IS NULL) OR
    (scope = 'agent'   AND project_id IS NOT NULL AND agent_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_dnc_agent ON public.pype_voice_dnc_list(agent_id) WHERE is_active;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_dnc_agent
    ON public.pype_voice_dnc_list(phone_e164, agent_id) WHERE is_active AND scope = 'agent';

COMMENT ON COLUMN public.pype_voice_dnc_list.agent_id IS
'For scope=agent: the only agent this number is blocked for.';
COMMENT ON COLUMN public.pype_voice_dnc_list.call_log_id IS
'For source=auto: the pype_voice_call_logs row where the caller asked not to be called.';

-- ---------- 2. Agent setting ----------
ALTER TABLE public.pype_voice_agents
  ADD COLUMN IF NOT EXISTS dnc_checker_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pype_voice_agents.dnc_checker_enabled IS
'After each call, add the caller''s +91 number to this agent''s DNC list when the field extractor answers dnc_requested = yes.';

-- To turn it on for every existing agent later:
-- UPDATE public.pype_voice_agents SET dnc_checker_enabled = true WHERE dnc_checker_enabled = false;
