-- Migration: Add flag_rules column to pype_voice_agents
-- Description: Per-agent call-flagging rules, configurable from the UI. Additive only —
-- existing agents get NULL, no behavior change until an agent opts in.
-- Date: 2026-08-17

ALTER TABLE public.pype_voice_agents
ADD COLUMN IF NOT EXISTS flag_rules JSONB DEFAULT NULL;

COMMENT ON COLUMN public.pype_voice_agents.flag_rules IS
'Per-agent call-flagging configuration. Shape:
{
  "enabled": boolean,
  "rules": [
    {
      "id": string,
      "reason": string | null,        -- optional label shown in the flag tooltip; defaults to the matched field name
      "conditions": [                  -- ANDed within a rule
        {
          "source": "field_extractor" | "call_log",  -- default "field_extractor"
          "matchType": "exact" | "starts_with" | "ends_with" | "contains",  -- default "exact"
          "field": string,              -- exact key name, or the prefix/suffix/substring text when matchType != "exact"
          "operator": "equals" | "not_equals" | "greater_than" | "less_than",  -- default "equals"
          "value": string | number
        }
      ]
    }
  ]                                     -- rules are ORed together
}
"call_log" source fields are restricted to an explicit allowlist enforced in the API layer.';

-- Example: replicating SH_Inbound''s current hardcoded "task_incomplete" check
-- {
--   "enabled": true,
--   "rules": [
--     {
--       "id": "task-incomplete",
--       "reason": "task_incomplete",
--       "conditions": [
--         { "field": "is_task_complete", "operator": "equals", "value": "0" },
--         { "field": "is_user_in_call", "operator": "equals", "value": "1" }
--       ]
--     }
--   ]
-- }
