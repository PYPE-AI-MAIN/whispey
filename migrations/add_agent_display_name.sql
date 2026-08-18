-- Human-editable label for an agent.
--
-- pype_voice_agents.name is IMMUTABLE: the backend agent identity is
-- `${name}_${id.replace(/-/g, '_')}` (agent folder / container name on the
-- PypeAPI VM), reconstructed at call time in ~18 places across the dashboard
-- and in the analytics Lambda (webhookOrchestrator, callLogProcessor).
-- Renaming `name` would orphan every one of those lookups, so renames land
-- here instead and only ever affect what humans see.
alter table pype_voice_agents
  add column if not exists display_name text;
