// DB-backed pieces of the MCP agent routes. Lives in src/server (excluded from
// unit-test coverage like the other Supabase repos); the rules that can be
// tested without a database are in lib/mcpAgentHelpers.

import { decryptWithWhispeyKey } from '@/lib/whispey-crypto'
import { createServiceRoleClient } from '@/lib/supabase-server'

type Supabase = ReturnType<typeof createServiceRoleClient>

/**
 * The project's Whispey key fields to place on an agent config, same as
 * save-and-deploy's attachWhispeyApiKey writes. `whispey_key_id` is what the
 * voice backend looks up at call time; without it call logs authenticate with
 * the backend's fallback key instead of the project's own.
 */
export async function resolveWhispeyKeyFields(supabase: Supabase, projectId: string): Promise<Record<string, string>> {
  const { data: row } = await supabase
    .from('pype_voice_api_keys')
    .select('id, token_hash, token_hash_master')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!row) return {}

  const fields: Record<string, string> = {}
  if (row.id) fields.whispey_key_id = row.id

  // Some rows store a non-ciphertext value. Skip those instead of throwing.
  if (row.token_hash_master?.split(':').length === 3) {
    try {
      fields.whispey_api_key = decryptWithWhispeyKey(row.token_hash_master)
      return fields
    } catch {
      // fall through to token_hash below
    }
  }
  if (row.token_hash) fields.token_hash = row.token_hash
  return fields
}

export type OwnedAgent = {
  id: string
  name: string
  project_id: string
  configuration: any
  field_extractor_prompt: string | null
}

export type OwnershipResult =
  | { ok: true; agent: OwnedAgent }
  | { ok: false; status: number; error: string }

/**
 * Loads an agent and proves the caller may edit it through the MCP: it exists,
 * belongs to the claimed project, was created through the MCP, and was created
 * by this same caller (one MCP client can never edit another client's agent).
 */
export async function loadEditableAgent(
  supabase: Supabase,
  agentId: string,
  projectId: string,
  createdBy: string | undefined
): Promise<OwnershipResult> {
  const { data: agent, error } = await supabase
    .from('pype_voice_agents')
    .select('id, name, project_id, configuration, field_extractor_prompt')
    .eq('id', agentId)
    .maybeSingle()

  if (error || !agent) return { ok: false, status: 404, error: 'Agent not found' }
  if (agent.project_id !== projectId) {
    return { ok: false, status: 403, error: 'Agent does not belong to project_id' }
  }
  if (agent.configuration?.created_via !== 'mcp') {
    return { ok: false, status: 403, error: 'This agent was not created through the MCP and cannot be edited here' }
  }
  if (!createdBy || agent.configuration?.created_by !== createdBy) {
    return { ok: false, status: 403, error: 'You can only edit agents you created through the MCP' }
  }
  return { ok: true, agent: agent as OwnedAgent }
}

type AgentQuotaState = {
  limits: { max_agents: number }
  usage: { active_count: number }
  agents: Array<{ id: string; created_at: string; status: string }>
  last_updated: string
}

export type QuotaCheck =
  | { ok: true; state: AgentQuotaState; active: number; max: number }
  | { ok: false; status: number; error: string }

/** The project's agent quota (pype_voice_projects.agent), same shape create-agent uses. */
export async function checkAgentQuota(supabase: Supabase, projectId: string): Promise<QuotaCheck> {
  const { data: projectRow, error } = await supabase
    .from('pype_voice_projects')
    .select('id, agent')
    .eq('id', projectId)
    .single()
  if (error || !projectRow) return { ok: false, status: 500, error: 'Failed to load project state' }

  const state: AgentQuotaState = (projectRow as any).agent || {
    limits: { max_agents: 2 },
    usage: { active_count: 0 },
    agents: [],
    last_updated: new Date().toISOString(),
  }
  const active = state?.usage?.active_count ?? 0
  const max = state?.limits?.max_agents ?? 0
  if (active >= max) return { ok: false, status: 403, error: 'Agent limit reached for this project' }
  return { ok: true, state, active, max }
}

/** Counts a newly created agent against the project's quota. */
export async function recordAgentCreated(
  supabase: Supabase,
  projectId: string,
  quota: Extract<QuotaCheck, { ok: true }>,
  agentId: string
): Promise<void> {
  const createdAt = new Date().toISOString()
  await supabase
    .from('pype_voice_projects')
    .update({
      agent: {
        limits: { max_agents: quota.max },
        usage: { active_count: quota.active + 1 },
        agents: [...(quota.state?.agents || []), { id: agentId, created_at: createdAt, status: 'active' }],
        last_updated: createdAt,
      },
    })
    .eq('id', projectId)
}
