-- Migration: DNC (Do Not Call) list
-- Description: Numbers that must never be dialed. Scope is either 'global'
--              (applies to every project) or 'project' (applies to one project).
--              A number is blocked for a call when an ACTIVE row matches its
--              normalized E.164 form AND (scope='global' OR project_id = the
--              call's project). Deletes are soft (is_active=false) for audit.
-- Date: 2026-07-22

CREATE TABLE IF NOT EXISTS public.pype_voice_dnc_list (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164   text NOT NULL,                       -- normalized match key, e.g. +919876543210
  phone_raw    text,                                -- exactly what was entered
  scope        text NOT NULL CHECK (scope IN ('global', 'project')),
  project_id   uuid REFERENCES public.pype_voice_projects(id) ON DELETE CASCADE,
  reason       text,
  source       text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'csv', 'api')),
  added_by     text NOT NULL,                       -- clerk user email / id
  is_active    boolean NOT NULL DEFAULT true,       -- soft delete
  created_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,

  -- scope='project' must carry a project_id; scope='global' must not.
  CONSTRAINT dnc_scope_project_id CHECK (
    (scope = 'project' AND project_id IS NOT NULL) OR
    (scope = 'global'  AND project_id IS NULL)
  )
);

-- Fast lookup on the match key (the hot path for every dispatch check).
CREATE INDEX IF NOT EXISTS idx_dnc_phone_e164
  ON public.pype_voice_dnc_list (phone_e164)
  WHERE is_active;

-- Speeds up per-project listing/filtering in the admin UI.
CREATE INDEX IF NOT EXISTS idx_dnc_project
  ON public.pype_voice_dnc_list (project_id)
  WHERE is_active;

-- No duplicate ACTIVE entries for the same number within the same scope.
-- Two partial unique indexes because NULL project_id (global) needs its own rule.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_dnc_global
  ON public.pype_voice_dnc_list (phone_e164)
  WHERE is_active AND scope = 'global';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_dnc_project
  ON public.pype_voice_dnc_list (phone_e164, project_id)
  WHERE is_active AND scope = 'project';

-- ── Verify ────────────────────────────────────────────────────────────────
-- SELECT phone_e164, scope, project_id, is_active FROM public.pype_voice_dnc_list ORDER BY created_at DESC;
