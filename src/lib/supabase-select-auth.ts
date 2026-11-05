import { createServiceRoleClient } from '@/lib/supabase-server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { isCallDataTable } from '@/server/data-plane'
import { NextResponse } from 'next/server'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Control-plane tables. Call-data tables are allowed through the data plane (isCallDataTable).
const CONTROL_PLANE_TABLES = new Set([
  'pype_voice_projects',
  'pype_voice_agents',
  'pype_voice_metric_groups',
  'pype_voice_custom_totals_configs',
])

export function isAllowedTable(table: string): boolean {
  return CONTROL_PLANE_TABLES.has(table) || isCallDataTable(table)
}

type Filter = { column: string; operator: string; value: unknown }

export type SelectAuthResult =
  | { ok: true; agentId?: string; projectId: string }
  | { ok: false; response: NextResponse }

const forbidden = (): SelectAuthResult => ({ ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) })

const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v)

async function authorizeProject(projectId: string, agentId?: string): Promise<SelectAuthResult> {
  const role = await getProjectRoleForApi(projectId)
  return role ? { ok: true, agentId, projectId } : forbidden()
}

/** Resolves the agent's project (control plane) and checks the caller's access. null = no such agent. */
async function authorizeAgent(agentId: string): Promise<SelectAuthResult | null> {
  const { data: agent } = await createServiceRoleClient()
    .from('pype_voice_agents')
    .select('project_id')
    .eq('id', agentId)
    .maybeSingle()
  return agent?.project_id ? authorizeProject(agent.project_id as string, agentId) : null
}

/**
 * Who may read `table`, and for which project. Call-data tables are never looked
 * up by row id (the row lives wherever the project's route says): they need an
 * agent or project hint, or an `agent_id` / `project_id` equality filter.
 */
export async function authorizeTableSelect(
  table: string,
  filters: Filter[] | undefined,
  authHint?: { agentId?: string; projectId?: string }
): Promise<SelectAuthResult> {
  if (isUuid(authHint?.agentId)) {
    return (await authorizeAgent(authHint.agentId)) ?? forbidden()
  }
  if (isUuid(authHint?.projectId)) return authorizeProject(authHint.projectId)

  for (const f of filters || []) {
    if (f.operator !== 'eq' || !isUuid(f.value)) continue
    if (f.column === 'agent_id') {
      const res = await authorizeAgent(f.value)
      if (res) return res
    } else if (f.column === 'project_id' || (table === 'pype_voice_projects' && f.column === 'id')) {
      return authorizeProject(f.value)
    }
  }

  const needsHint = isCallDataTable(table)
  return {
    ok: false,
    response: NextResponse.json(
      { error: needsHint ? 'Call data needs an agent or project hint' : 'Missing authorization context' },
      { status: 403 }
    ),
  }
}
