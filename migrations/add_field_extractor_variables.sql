-- Migration: Add field_extractor_variables column to pype_voice_agents
-- Description: Adds support for dynamic variable mapping in field extractor prompts
-- Date: 2026-01-15

-- Add the new column
ALTER TABLE public.pype_voice_agents 
ADD COLUMN IF NOT EXISTS field_extractor_variables JSONB DEFAULT '{}'::jsonb;

-- Add a comment to document the column
COMMENT ON COLUMN public.pype_voice_agents.field_extractor_variables IS 
'Dynamic variable mappings for field extractor. Format: {"variable_name": "column_path"} where column_path can be "metadata.field", "dynamic_variables.field", or direct column names. Variables are referenced in prompts using {{variable_name}} syntax.';

-- Example data structure:
-- {
--   "customer_name": "metadata.name",
--   "order_id": "dynamic_variables.order_id",
--   "call_duration": "duration_seconds",
--   "sentiment": "metadata.sentiment_score"
-- }
