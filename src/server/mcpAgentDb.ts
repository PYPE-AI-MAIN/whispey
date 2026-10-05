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
  if (row.token_hash_master && row.token_hash_master.split(':').length === 3) {
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

export type OwnedAgent = { id: string; name: string; project_id: string; configuration: any }

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
    .select('id, name, project_id, configuration')
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
