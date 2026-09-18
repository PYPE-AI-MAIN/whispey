-- Campaign Flows: reusable multi-step designs built in the campaign-flows
-- builder. graph is stored as jsonb straight from React Flow's own
-- {nodes, edges} shape — no relational normalization, since nothing outside
-- this feature needs to query into individual nodes/edges.
CREATE TABLE public.campaign_flows (
    flow_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.pype_voice_projects(id) ON DELETE CASCADE,
    agent_id uuid REFERENCES public.pype_voice_agents(id) ON DELETE SET NULL,
    name text NOT NULL,
    description text,
    status text NOT NULL DEFAULT 'draft',
    n8n_workflow_id text,
    graph jsonb NOT NULL,
    -- Bumped whenever FlowNodeConfig/BranchCondition's shape changes in a way
    -- that isn't just additive — gives old rows saved under a previous shape
    -- something to branch on at load time, instead of assuming today's shape
    -- forever.
    schema_version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX campaign_flows_project_id_idx ON public.campaign_flows (project_id);

-- No policies defined: this table is only ever touched server-side via the
-- service-role client (same as every other pype_voice_* table's access
-- pattern), so RLS here just means "the anon/authenticated key can never
-- touch this table," with zero effect on the app's own access.
ALTER TABLE public.campaign_flows ENABLE ROW LEVEL SECURITY;
