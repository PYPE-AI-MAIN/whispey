/**
 * Server-only: get current user's role and visibility for a project. Use in API routes to enforce viewer restrictions.
 * Returns role and effective visibility from pype_voice_email_project_mapping.permissions (Supabase).
 */
import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getEffectiveVisibility } from '@/types/visibility'
import type { MemberVisibility } from '@/types/visibility'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { requireApiBaseUrl } from '@/lib/pypeApiFetch'
import { isPlatformAdmin } from '@/lib/isPlatformAdmin'

const supabase = createServiceRoleClient()

/**
 * Match rule for who a mapping row belongs to. Platform admins (PYPE_ADMINS)
 * keep the original, unrestricted "clerk_id OR email" match — same access as
 * they've always had. Everyone else only matches by their own clerk_id, or by
 * email when the row is a genuinely unclaimed invite (clerk_id is null) that
 * was created within the new-domain approval flow (granted_via='new_domain').
 * This is what stops an old-domain account's access from silently carrying
 * over to a different login that happens to share the same email.
 */
export function projectMembershipMatch(userId: string, userEmail: string | undefined, admin: boolean): string {
  if (admin) return `clerk_id.eq.${userId},email.ilike.${userEmail}`
  return `clerk_id.eq.${userId},and(clerk_id.is.null,email.ilike.${userEmail},granted_via.eq.new_domain)`
}

export async function getProjectRoleForApi(projectId: string): Promise<{ role: string; visibility: MemberVisibility; downloadDisabled: boolean } | null> {
  const { userId } = await auth()
  const user = await currentUser()
  if (!userId || !projectId) return null

  const userEmail = user?.emailAddresses?.[0]?.emailAddress
  // .limit(1) before .maybeSingle(): an admin's match is deliberately broad
  // (clerk_id OR email), so one admin can legitimately have more than one
  // mapping row for the same project across different clerk_ids (account
  // history, migrations). .maybeSingle() errors — not just returns null —
  // on more than one match, which would otherwise turn "yes, a member" into
  // a false 403 the moment that history exists.
  const { data: mapping, error } = await supabase
    .from('pype_voice_email_project_mapping')
    .select('role, permissions, is_active')
    .eq('project_id', projectId)
    .or(projectMembershipMatch(userId, userEmail, isPlatformAdmin(userEmail)))
    .or('is_active.is.null,is_active.eq.true')
    .limit(1)
    .maybeSingle()

  if (error || !mapping) return null
  const role = ['user', 'member', 'viewer'].includes(mapping.role) ? 'viewer' : mapping.role
  const permissions = mapping.permissions as { visibility?: MemberVisibility; download_disabled?: boolean } | null
  const visibility = getEffectiveVisibility(role, permissions?.visibility)
  return { role, visibility, downloadDisabled: permissions?.download_disabled === true }
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
/**
 * Backend agent names are `${name}_${id.replace(/-/g, '_')}` — the agent's
 * UUID with hyphens swapped for underscores, appended to its display name.
 * Reverses that to recover the original UUID (5 hyphen-separated segments).
 */
export function extractAgentIdFromBackendName(agentBackendName: string): string | null {
  if (!agentBackendName?.trim()) return null
  const parts = agentBackendName.trim().split('_')
  if (parts.length < 5) return null
  return parts.slice(-5).join('-')
}

export async function getProjectIdFromAgentBackendName(agentBackendName: string): Promise<string | null> {
  const agentId = extractAgentIdFromBackendName(agentBackendName)
  if (!agentId) return null
  const { data: row } = await supabase
    .from('pype_voice_agents')
    .select('project_id')
    .eq('id', agentId)
    .maybeSingle()
  return row?.project_id ?? null
}

/**
 * Which backend a given agent (by its full backend name) actually lives on.
 * Defaults to 'classic' when unset (agents created before deployment_target
 * was persisted) or when the agent can't be found at all.
 */
export async function getDeploymentTargetFromAgentBackendName(agentBackendName: string): Promise<'classic' | 'docker'> {
  const agentId = extractAgentIdFromBackendName(agentBackendName)
  if (!agentId) return 'classic'
  const { data: row } = await supabase
    .from('pype_voice_agents')
    .select('configuration')
    .eq('id', agentId)
    .maybeSingle()
  return row?.configuration?.deployment_target === 'docker' ? 'docker' : 'classic'
}

/**
 * Resolves the backend base URL for whichever target an agent actually lives
 * on, or a ready-to-return error response if it's not configured. Collapses
 * the deploymentTarget-lookup + requireApiBaseUrl pair repeated across every
 * route that proxies to an agent's backend.
 */
/**
 * Bulk version of getDeploymentTargetFromAgentBackendName — one query for
 * many agent ids instead of one round-trip per agent. Used by
 * /api/agents/running_agents to resolve the authoritative backend for every
 * agent in a single merged status list.
 */
export async function getDeploymentTargetsForAgentIds(
  agentIds: string[]
): Promise<Map<string, 'classic' | 'docker'>> {
  const targets = new Map<string, 'classic' | 'docker'>()
  if (agentIds.length === 0) return targets

  const { data: rows } = await supabase
    .from('pype_voice_agents')
    .select('id, configuration')
    .in('id', agentIds)

  for (const row of rows ?? []) {
    targets.set(row.id, row.configuration?.deployment_target === 'docker' ? 'docker' : 'classic')
  }
  return targets
}

export async function resolveApiBaseUrlForAgent(
  agentBackendName: string
): Promise<{ apiUrl: string } | { errorResponse: Response }> {
  const deploymentTarget = await getDeploymentTargetFromAgentBackendName(agentBackendName)
  return requireApiBaseUrl(deploymentTarget)
}

/**
 * Ready-to-return 403 if the current user is a viewer on the project that
 * owns this agent, or null to continue. Collapses the
 * getProjectIdFromAgentBackendName + isViewerForProject pair repeated across
 * every route that mutates an agent's knowledge base or config.
 */
export async function rejectIfViewer(
  agentBackendName: string,
  forbiddenMessage: string
): Promise<NextResponse | null> {
  const projectId = await getProjectIdFromAgentBackendName(agentBackendName)
  if (projectId && (await isViewerForProject(projectId))) {
    return NextResponse.json({ error: forbiddenMessage }, { status: 403 })
  }
  return null
}
