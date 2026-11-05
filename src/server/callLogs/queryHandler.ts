/**
 * The paged call-log query behind both /api/agents/[id]/call-logs/query and
 * /api/projects/[id]/call-logs/query. The routes differ only in how the caller is
 * scoped (by agent or by project); everything after that is shared. The rows come
 * from the project's data plane, which also owns the 13-argument RPC fallback.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { redactTagsFromCallLogsForViewer } from '@/lib/redactCallLogsTagsForViewer'
import type { CallLog } from '@/types/logs'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { filterSelectColumns, stripDisallowedColumns, isAgentDownloadDisabledForUser } from '@/lib/callLogSettings'
import { resolveColumnAccessForRequest } from '@/lib/agentCallLogSettingsStore'
import { rethrowDataPlane, type PlaneSource } from '@/server/data-plane'

export type QueryScope = { kind: 'agent'; agentId: string } | { kind: 'project'; projectId: string }

type Access = NonNullable<Awaited<ReturnType<typeof getProjectRoleForApi>>>
type Resolved = { agentRow: { project_id: string; call_log_settings: any }; access: Access; agentId: string }

const deny = (error: string, status: number) => NextResponse.json({ error }, { status })

async function lookupAgent(agentId: string) {
  const { data, error } = await createServiceRoleClient()
    .from('pype_voice_agents')
    .select('project_id, call_log_settings')
    .eq('id', agentId)
    .maybeSingle()
  return error ? null : data
}

/** Scope-specific checks, in the order each route always applied them. */
async function resolveScope(scope: QueryScope, body: Record<string, unknown>, projectAccess: Access | null): Promise<Resolved | NextResponse> {
  const agentId = body.p_agent_id as string | undefined
  if (scope.kind === 'project') return resolveProjectScope(scope.projectId, projectAccess!, agentId)
  if (!agentId || agentId !== scope.agentId) return deny('p_agent_id must match route agent id', 400)
  const agentRow = await lookupAgent(agentId)
  if (!agentRow?.project_id) return deny('Forbidden', 403)
  const access = await getProjectRoleForApi(agentRow.project_id as string)
  return access ? { agentRow, access, agentId } : deny('Forbidden', 403)
}

async function resolveProjectScope(projectId: string, access: Access, agentId: string | undefined): Promise<Resolved | NextResponse> {
  if (!agentId) return deny('p_agent_id required', 400)
  const agentRow = await lookupAgent(agentId)
  return agentRow && agentRow.project_id === projectId ? { agentRow, access, agentId } : deny('Forbidden', 403)
}

function dataArgs(body: Record<string, unknown>, agentId: string, p_select: unknown) {
  return {
    p_agent_id: agentId,
    p_pre_distinct_filters: body.p_pre_distinct_filters ?? [],
    p_post_distinct_filters: body.p_post_distinct_filters ?? [],
    p_select,
    p_order_by_column: body.p_order_by_column ?? 'created_at',
    p_order_ascending: body.p_order_ascending ?? false,
    p_limit: body.p_limit ?? 50,
    p_offset: body.p_offset ?? 0,
    p_distinct_column: body.p_distinct_column ?? null,
    p_distinct_json_field: body.p_distinct_json_field ?? null,
    p_distinct_order: body.p_distinct_order ?? 'asc',
    p_date_from: body.p_date_from ?? null,
    p_date_to: body.p_date_to ?? null,
  }
}

/** Download rules: the project may disable them, and so may the agent's per-user settings. */
function downloadDenied(isDownload: boolean, access: Access, callLogSettings: any, isSuperAdmin: boolean, userEmail: string | null): string | null {
  if (!isDownload) return null
  if (access.downloadDisabled) return 'Downloads are disabled for this project'
  return isAgentDownloadDisabledForUser(callLogSettings, isSuperAdmin, userEmail) ? 'Downloads are disabled for this user on this agent' : null
}

async function fetchRows(dp: PlaneSource, projectId: string, args: ReturnType<typeof dataArgs>, user: { clerkId: string; email: string | null }) {
  try {
    const plane = await dp.forProject(projectId)
    return (await plane.callData.queryCallLogs(args, user)) as CallLog[]
  } catch (e) {
    rethrowDataPlane(e)
    console.error('get_call_logs_with_distinct:', e)
    return deny(e instanceof Error ? e.message : 'Unknown error', 500)
  }
}

export async function handleCallLogsQuery(dp: PlaneSource, request: NextRequest, scope: QueryScope) {
  const { userId } = await auth()
  const user = await currentUser()
  if (!userId) return deny('Unauthorized', 401)

  // The project route has always checked access before reading the body.
  const projectAccess = scope.kind === 'project' ? await getProjectRoleForApi(scope.projectId) : null
  if (scope.kind === 'project' && !projectAccess) return deny('Forbidden', 403)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return deny('Invalid JSON', 400)
  }

  const resolved = await resolveScope(scope, body, projectAccess)
  if (resolved instanceof NextResponse) return resolved
  const { agentRow, access, agentId } = resolved

  const isDownload = body.p_purpose === 'download'
  const userEmail = user?.emailAddresses?.[0]?.emailAddress ?? null
  const { isSuperAdmin, disallowedColumns } = await resolveColumnAccessForRequest({
    userId,
    userEmail,
    callLogSettings: agentRow.call_log_settings,
    isDownload,
  })
  const denied = downloadDenied(isDownload, access, agentRow.call_log_settings, isSuperAdmin, userEmail)
  if (denied) return deny(denied, 403)

  const p_select = filterSelectColumns(body.p_select ?? '*', disallowedColumns)
  const fetched = await fetchRows(dp, agentRow.project_id, dataArgs(body, agentId, p_select), { clerkId: userId, email: userEmail })
  if (fetched instanceof NextResponse) return fetched

  const rows = access.role === 'viewer' ? redactTagsFromCallLogsForViewer(fetched) : fetched
  return NextResponse.json({ data: stripDisallowedColumns(rows, disallowedColumns) })
}
