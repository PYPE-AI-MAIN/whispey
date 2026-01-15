-- Migration: Add max_concurrency to campaign_config
-- Description: Allows per-project configuration of maximum campaign concurrency
-- Date: 2026-01-15

-- Example: Set max_concurrency for a specific project
-- Replace 'your-project-id' with actual project UUID

-- Set max_concurrency to 20 for a specific project
UPDATE public.pype_voice_projects
SET campaign_config = COALESCE(campaign_config, '{}'::jsonb) || '{"max_concurrency": 20}'::jsonb
WHERE id = 'your-project-id';

-- Set max_concurrency to 10 for another project
-- UPDATE public.pype_voice_projects
-- SET campaign_config = COALESCE(campaign_config, '{}'::jsonb) || '{"max_concurrency": 10}'::jsonb
-- WHERE id = 'another-project-id';

-- View all projects with their max_concurrency
SELECT 
  id,
  name,
  campaign_config->>'max_concurrency' as max_concurrency,
  campaign_config
FROM public.pype_voice_projects
WHERE is_active = true;

-- Set default max_concurrency for all projects that don't have it
-- UPDATE public.pype_voice_projects
-- SET campaign_config = COALESCE(campaign_config, '{}'::jsonb) || '{"max_concurrency": 5}'::jsonb
-- WHERE campaign_config->>'max_concurrency' IS NULL OR campaign_config IS NULL;
