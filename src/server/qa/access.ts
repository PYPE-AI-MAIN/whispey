/**
 * Who may see or change QA data.
 *
 * QA adds no new permission concept. An agent's QA page is visible to whoever
 * can already see that agent — the same project role and the same
 * `visibleAgentIds` check the analytics canvas does — and the only things
 * gated further are the ones that change something: publishing a prompt
 * change, and managing who gets the email.
 */
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'

const supabase = createServiceRoleClient()

export type QaDenied = { denied: true; status: number; error: string }
export type QaAccess = {
  denied: false
  agent: { id: string; name: string; display_name: string | null; project_id: string; qa_config: Record<string, unknown> | null }
  projectId: string
  role: string
  canWrite: boolean
}

export type QaProjectAccess = {
  denied: false
  projectId: string
  agentIds: string[]
  role: string
  canWrite: boolean
}

/** Works for both the agent-scoped and project-scoped results. */
export function isQaDenied<T extends { denied: boolean }>(x: T): x is T & QaDenied {
  return x.denied === true
}

/**
 * Resolve an agent and confirm the caller may see it.
 *
 * Deliberately resolves the project from the agent rather than trusting a
 * project id in the URL — otherwise a caller could pass a project they belong
 * to alongside an agent they do not.
 */
export async function resolveAgentAccess(agentId: string): Promise<QaAccess | QaDenied> {
  if (!agentId) return { denied: true, status: 400, error: 'Missing agent id' }

  const { data: agent, error } = await supabase
    .from('pype_voice_agents')
    .select('id, name, display_name, project_id, qa_config')
    .eq('id', agentId)
    .maybeSingle()

  if (error || !agent) return { denied: true, status: 404, error: 'Agent not found' }

  const access = await getProjectRoleForApi(agent.project_id)
  if (!access?.role) return { denied: true, status: 403, error: 'You do not have access to this project' }

  const visible = access.visibility?.org?.visibleAgentIds
  // null means "every agent in the project"; an array is an allowlist
  if (Array.isArray(visible) && !visible.includes(agentId)) {
    return { denied: true, status: 403, error: 'You do not have access to this agent' }
  }

  return {
    denied: false,
    agent,
    projectId: agent.project_id,
    role: access.role,
    canWrite: access.role === 'owner' || access.role === 'admin',
  }
}

/** Project-level, for the org QA tab. Returns the agents this caller may see. */
export async function resolveProjectAccess(
  projectId: string,
): Promise<QaProjectAccess | QaDenied> {
  if (!projectId) return { denied: true, status: 400, error: 'Missing project id' }

  const access = await getProjectRoleForApi(projectId)
  if (!access?.role) return { denied: true, status: 403, error: 'You do not have access to this project' }

  const { data: agents } = await supabase
    .from('pype_voice_agents')
    .select('id')
    .eq('project_id', projectId)

  const all = (agents || []).map((a) => a.id)
  const visible = access.visibility?.org?.visibleAgentIds
  const agentIds = Array.isArray(visible) ? all.filter((id) => visible.includes(id)) : all

  return {
    denied: false,
    projectId,
    agentIds,
    role: access.role,
    canWrite: access.role === 'owner' || access.role === 'admin',
  }
}

export { supabase as qaDb }
