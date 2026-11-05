// Who may use Prompt Forge, and who may change a given session.
//
// Same rule as the page guard (GET /api/projects/[id]/me): a signed-in member
// of the project whose permissions include `promptforge`, or a superadmin /
// prompter. Sessions are visible to everyone with that access; only their
// creator can change them. Sessions saved before owners were recorded have no
// creator and stay editable by anyone with access.

import { NextResponse } from 'next/server'
import { auth, clerkClient, currentUser } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { projectMembershipMatch } from '@/lib/getProjectRoleForApi'
import { isPlatformAdmin } from '@/lib/isPlatformAdmin'

export interface ForgeUser {
  userId: string
  email: string | null
}

const deny = (status: number, error: string) => ({ response: NextResponse.json({ error }, { status }) })

/** The signed-in user if they may use Prompt Forge in this project, else a ready error response. */
export async function requireForgeUser(projectId: string | null | undefined): Promise<{ user: ForgeUser } | { response: NextResponse }> {
  const { userId } = await auth()
  if (!userId) return deny(401, 'Unauthorized')
  if (!projectId) return deny(400, 'projectId is required')

  const clerkUser = await currentUser()
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? null
  const supabase = createServiceRoleClient()
  const [{ data: mapping }, { data: userRow }] = await Promise.all([
    supabase
      .from('pype_voice_email_project_mapping')
      .select('permissions')
      .eq('project_id', projectId)
      .or(projectMembershipMatch(userId, email ?? undefined, isPlatformAdmin(email ?? undefined)))
      .or('is_active.is.null,is_active.eq.true')
      .limit(1)
      .maybeSingle(),
    supabase.from('pype_voice_users').select('roles').eq('clerk_id', userId).maybeSingle(),
  ])

  const globalRole: string = userRow?.roles?.globalRole ?? 'user'
  const globalPermissions: string[] = userRow?.roles?.permissions ?? []
  const superAccess = globalRole === 'superadmin' || globalRole === 'prompter' || globalPermissions.includes('promptforge')
  const projectAccess = (mapping?.permissions as Record<string, unknown> | null)?.promptforge === true
  if (!superAccess && !projectAccess) return deny(403, 'Prompt Forge is not enabled for you in this project')

  return { user: { userId, email } }
}

/** The agent exists and belongs to the project (so a session can't be pointed at another project's agent). */
export async function agentInProject(agentId: string, projectId: string): Promise<boolean> {
  const { data } = await createServiceRoleClient()
    .from('pype_voice_agents')
    .select('id')
    .eq('id', agentId)
    .eq('project_id', projectId)
    .maybeSingle()
  return !!data
}

/** Loads a session and checks the caller may see it; `edit` also requires being its owner. */
export async function loadForgeSession(sessionId: string, opts: { edit?: boolean } = {}) {
  const supabase = createServiceRoleClient()
  const { data: session, error } = await supabase
    .from('pype_voice_promptforge_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle()
  if (error) return deny(500, error.message)
  if (!session) return deny(404, 'Session not found')

  const access = await requireForgeUser(session.project_id)
  if ('response' in access) return access
  const canEdit = !session.created_by || session.created_by === access.user.userId
  if (opts.edit && !canEdit) return deny(403, 'Only the person who created this session can change it')
  return { session, user: access.user, canEdit }
}

/** Email for each owner id, to show who a session belongs to. Unknown ids are left out. */
export async function ownerEmails(userIds: Array<string | null | undefined>): Promise<Record<string, string>> {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))]
  if (!ids.length) return {}
  try {
    const client = await clerkClient()
    const { data } = await client.users.getUserList({ userId: ids, limit: ids.length })
    return Object.fromEntries(data.map((u) => [u.id, u.emailAddresses?.[0]?.emailAddress ?? '']).filter(([, e]) => e))
  } catch {
    return {}
  }
}

/** The working-draft fields a session's owner may change, and that a version snapshots. */
export const SESSION_FIELDS = [
  'name', 'system_prompt', 'variables', 'tools', 'messages', 'model', 'provider', 'temperature', 'first_message_mode', 'first_message',
] as const
export const SNAPSHOT_FIELDS = SESSION_FIELDS.filter((f) => f !== 'name')

export function pickFields<T extends readonly string[]>(body: Record<string, unknown>, fields: T): Record<string, unknown> {
  return Object.fromEntries(fields.filter((f) => f in body).map((f) => [f, body[f]]))
}
