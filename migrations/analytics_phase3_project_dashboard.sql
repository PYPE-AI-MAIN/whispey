-- Confluence "Analytics Phase 3 and 4 — Build Spec" §3.2.1 / §3.5.
--
-- analytics_phase1.sql already added pype_analytics_dashboards.scope and its
-- CHECK constraint (scope = 'project' requires agent_id IS NULL), but only
-- indexed the agent-scoped case:
--
--   uq_analytics_dashboard_agent_shared ON (agent_id) WHERE scope = 'agent' AND visibility = 'shared'
--
-- Without the project-scoped counterpart, two people opening a project's
-- Explore tab for the first time at once can each insert a 'shared' project
-- dashboard, and the existing create-then-retry-on-conflict logic in
-- /api/analytics/dashboard (which assumes a unique index is what it's racing
-- against) would silently do nothing instead of catching the collision.
CREATE UNIQUE INDEX IF NOT EXISTS uq_analytics_dashboard_project_shared
  ON pype_analytics_dashboards (project_id)
  WHERE scope = 'project' AND visibility = 'shared';
