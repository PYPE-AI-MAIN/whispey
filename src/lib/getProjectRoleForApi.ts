/**
 * Server-only: get current user's role for a project. Use in API routes to enforce viewer restrictions.
 * Returns role from pype_voice_email_project_mapping (Supabase). Viewer => restrict access to config/knowledge/etc.
 */
import { auth, currentUser } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function getProjectRoleForApi(projectId: string): Promise<{ role: string } | null> {
  const { userId } = await auth()
  const user = await currentUser()
  if (!userId || !projectId) return null

  const userEmail = user?.emailAddresses?.[0]?.emailAddress
  const { data: mapping, error } = await supabase
    .from('pype_voice_email_project_mapping')
    .select('role, is_active')
    .eq('project_id', projectId)
    .or(`clerk_id.eq.${userId},email.ilike.${userEmail}`)
    .or('is_active.is.null,is_active.eq.true')
    .maybeSingle()

  if (error || !mapping) return null
  const role = ['user', 'member', 'viewer'].includes(mapping.role) ? 'viewer' : mapping.role
  return { role }
}

/** Returns true if current user is viewer (or not a member) for the project. */
export async function isViewerForProject(projectId: string): Promise<boolean> {
  const result = await getProjectRoleForApi(projectId)
  return result ? result.role === 'viewer' : true
}

/**
 * Resolve project_id from agent backend name (e.g. "Test_a2e7a0fa_c64c_4840_a063_dad5a3df685e").
 * Backend name format: {agentName}_{uuid_with_underscores}. We parse UUID and look up agent.
 */
export async function getProjectIdFromAgentBackendName(agentBackendName: string): Promise<string | null> {
  if (!agentBackendName?.trim()) return null
  const parts = agentBackendName.trim().split('_')
  if (parts.length < 5) return null
  const uuidPart = parts.slice(-5).join('-')
  const { data: row } = await supabase
    .from('pype_voice_agents')
    .select('project_id')
    .eq('id', uuidPart)
    .maybeSingle()
  return row?.project_id ?? null
}
