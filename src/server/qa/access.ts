/**
 * Who may see or change QA Audit data.
 *
 * Customers see the flagged calls and weekly reviews of agents they can already
 * see (same project role and `visibleAgentIds` check as the rest of the app).
 * Only the QA team changes anything: ticket status, resolution notes and the
 * weekly sheet link. The QA team is the emails in QA_TEAM_EMAILS plus the
 * platform admins in PYPE_ADMINS, and works across every project.
 */
import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { isPlatformAdmin } from '@/lib/isPlatformAdmin'

const supabase = createServiceRoleClient()

export type QaDenied = { denied: true; status: number; error: string }
export type QaAccess = {
  denied: false
  agent: { id: string; name: string; display_name: string | null; project_id: string }
  projectId: string
  /** QA team: may update tickets and attach the weekly sheet. */
  canManage: boolean
  userId: string
  email: string
}

export function isQaDenied<T extends { denied: boolean }>(x: T): x is T & QaDenied {
  return x.denied === true
}

function isQaTeamEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const team = process.env.QA_TEAM_EMAILS?.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean) || []
  return team.includes(email.toLowerCase()) || isPlatformAdmin(email)
}

/**
 * Resolve an agent and confirm the caller may see it.
 *
 * The project is resolved from the agent rather than trusted from the URL —
 * otherwise a caller could pass a project they belong to alongside an agent
 * they do not.
 */
export async function resolveAgentAccess(agentId: string): Promise<QaAccess | QaDenied> {
  if (!agentId) return { denied: true, status: 400, error: 'Missing agent id' }

  const { userId } = await auth()
  if (!userId) return { denied: true, status: 401, error: 'Unauthorized' }
  const email = (await currentUser())?.emailAddresses?.[0]?.emailAddress ?? ''

  const { data: agent, error } = await supabase
    .from('pype_voice_agents')
    .select('id, name, display_name, project_id')
    .eq('id', agentId)
    .maybeSingle()
  if (error || !agent) return { denied: true, status: 404, error: 'Agent not found' }

  const canManage = isQaTeamEmail(email)
  if (!canManage) {
    const access = await getProjectRoleForApi(agent.project_id)
    if (!access?.role) return { denied: true, status: 403, error: 'You do not have access to this project' }
    const visible = access.visibility?.org?.visibleAgentIds
    // null means "every agent in the project"; an array is an allowlist
    if (Array.isArray(visible) && !visible.includes(agentId)) {
      return { denied: true, status: 403, error: 'You do not have access to this agent' }
    }
  }

  return { denied: false, agent, projectId: agent.project_id, canManage, userId, email }
}

export { supabase as qaDb }
