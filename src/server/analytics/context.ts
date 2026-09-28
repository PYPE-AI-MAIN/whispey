/**
 * Everything an analytics request is allowed to see, resolved server-side —
 * Confluence "Analytics Phase 1 and 2 — Build Spec" §4.1, §9.
 *
 * Every analytics route starts here. Today visibility is applied in the browser
 * (`Overview.tsx` hides tiles the API already returned), which means the numbers
 * are on the wire whether or not they are on the screen. The query builder takes
 * its permissions from what this returns and from nothing else, so a request
 * written by a user — or later by a model — cannot widen them.
 */
import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { getProjectRoleForApi } from '@/lib/getProjectRoleForApi'
import { resolveColumnAccessForRequest } from '@/lib/agentCallLogSettingsStore'
import type { CallLogSettings } from '@/lib/callLogSettings'
import type { Ctx } from './buildQuery'

const supabase = createServiceRoleClient()

/**
 * Until each project carries its own zone (§6.5). A named zone, never a fixed
 * offset — the query builder converts with it and a fixed offset would be wrong
 * on either side of a DST change.
 */
const DEFAULT_TZ = 'Asia/Kolkata'

/** No single chart may scan more than this. Longer ranges are a deliberate export. */
const MAX_RANGE_DAYS = 400

/**
 * Overview visibility is stated per feature, not per column. These are the
 * columns each switch actually protects — the same names the Call Logs column
 * picker uses, so the two cannot disagree about who sees cost.
 */
const COLUMNS_BEHIND_VISIBILITY: Record<string, string[]> = {
  totalCost: ['total_cost', 'total_llm_cost', 'total_tts_cost', 'total_stt_cost'],
  billing: ['billing_duration_seconds'],
  responseTime: ['avg_latency', 'p50_latency'],
}

export type AnalyticsContext = {
  ctx: Ctx
  agent: { id: string; name: string; projectId: string; outcomeRanking: unknown; extractorPrompt: unknown }
  role: string
  downloadDisabled: boolean
}

/**
 * Resolves who is asking, which agents they may read, and which fields are
 * hidden from them. Returns a ready-to-send response instead of throwing, so
 * every route handles refusal the same way.
 */
export async function resolveAnalyticsContext(
  agentId: string,
  opts: { forDownload?: boolean } = {}
): Promise<AnalyticsContext | { errorResponse: NextResponse }> {
  const deny = (status: number, error: string) => ({ errorResponse: NextResponse.json({ error }, { status }) })

  const { userId } = await auth()
  if (!userId) return deny(401, 'Not signed in')

  const { data: agent } = await supabase
    .from('pype_voice_agents')
    .select('id, name, display_name, project_id, call_log_settings, outcome_ranking, field_extractor_prompt')
    .eq('id', agentId)
    .maybeSingle()
  if (!agent?.project_id) return deny(404, 'Agent not found')

  const access = await getProjectRoleForApi(agent.project_id)
  if (!access) return deny(403, 'Not a member of this project')

  // a member can be limited to particular agents; an empty list means none
  const visibleAgentIds = access.visibility.org.visibleAgentIds
  if (visibleAgentIds !== null && !visibleAgentIds.includes(agentId)) {
    return deny(403, 'No access to this agent')
  }

  const user = await currentUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress ?? null
  const { disallowedColumns } = await resolveColumnAccessForRequest({
    userId,
    userEmail,
    callLogSettings: agent.call_log_settings as CallLogSettings | null,
    isDownload: opts.forDownload === true,
  })

  // the part that is browser-only today: a tile switched off in the member's
  // visibility now also removes the column from the query
  const overview = access.visibility.agent.overview as unknown as Record<string, boolean>
  for (const [key, columns] of Object.entries(COLUMNS_BEHIND_VISIBILITY)) {
    if (overview[key] === false) columns.forEach((c) => disallowedColumns.add(c))
  }

  return {
    ctx: {
      projectId: agent.project_id,
      agentIds: [agentId],
      deniedFields: disallowedColumns,
      tz: DEFAULT_TZ,
      maxDays: MAX_RANGE_DAYS,
    },
    agent: {
      id: agent.id,
      name: agent.display_name || agent.name,
      projectId: agent.project_id,
      outcomeRanking: agent.outcome_ranking,
      // what the agent was told to extract — the definition the dispositions
      // already depend on, and which the field catalog used to ignore (§11.2)
      extractorPrompt: agent.field_extractor_prompt ?? null,
    },
    role: access.role,
    downloadDisabled: access.downloadDisabled,
  }
}

export function isDenied<T extends object>(r: T | { errorResponse: NextResponse }): r is { errorResponse: NextResponse } {
  return 'errorResponse' in r
}

export type ProjectAnalyticsContext = {
  ctx: Ctx
  projectId: string
  role: string
  downloadDisabled: boolean
}

/**
 * The project-scoped sibling of resolveAnalyticsContext — Confluence "Analytics
 * Phase 3 and 4 — Build Spec" §3.4. `ctx.agentIds` is every agent in the project
 * the caller may see, instead of one.
 *
 * There is no single agent's outcome_ranking, call_log_settings, or
 * field_extractor_prompt to return here — those stay single-agent concepts.
 * A column is hidden project-wide if ANY visible agent's settings hide it
 * (an aggregate touching that agent's rows shouldn't leak the column through
 * the sum), and the overview-visibility toggles are already project-level
 * (`getEffectiveVisibility` is resolved from project membership, not per agent).
 */
export async function resolveProjectAnalyticsContext(
  projectId: string,
  opts: { forDownload?: boolean } = {}
): Promise<ProjectAnalyticsContext | { errorResponse: NextResponse }> {
  const deny = (status: number, error: string) => ({ errorResponse: NextResponse.json({ error }, { status }) })

  const { userId } = await auth()
  if (!userId) return deny(401, 'Not signed in')

  const access = await getProjectRoleForApi(projectId)
  if (!access) return deny(403, 'Not a member of this project')

  const { data: agents } = await supabase
    .from('pype_voice_agents')
    .select('id, call_log_settings')
    .eq('project_id', projectId)
  if (!agents?.length) return deny(404, 'Project not found')

  // a member can be limited to particular agents; an empty list means none
  const visibleAgentIds = access.visibility.org.visibleAgentIds
  const visibleAgents = visibleAgentIds === null ? agents : agents.filter((a) => visibleAgentIds.includes(a.id))
  if (visibleAgents.length === 0) return deny(403, 'No visible agents in this project')

  const user = await currentUser()
  const userEmail = user?.emailAddresses?.[0]?.emailAddress ?? null

  const disallowedColumns = new Set<string>()
  for (const agent of visibleAgents) {
    const { disallowedColumns: agentDisallowed } = await resolveColumnAccessForRequest({
      userId,
      userEmail,
      callLogSettings: agent.call_log_settings as CallLogSettings | null,
      isDownload: opts.forDownload === true,
    })
    agentDisallowed.forEach((c) => disallowedColumns.add(c))
  }

  const overview = access.visibility.agent.overview as unknown as Record<string, boolean>
  for (const [key, columns] of Object.entries(COLUMNS_BEHIND_VISIBILITY)) {
    if (overview[key] === false) columns.forEach((c) => disallowedColumns.add(c))
  }

  return {
    ctx: {
      projectId,
      agentIds: visibleAgents.map((a) => a.id),
      deniedFields: disallowedColumns,
      tz: DEFAULT_TZ,
      maxDays: MAX_RANGE_DAYS,
    },
    projectId,
    role: access.role,
    downloadDisabled: access.downloadDisabled,
  }
}

/**
 * The agent's outcome order, best first (§10.6). A chart saves
 * `ranking_ref: 'agent'` and the order is resolved here on every request, which
 * is what makes reordering the list update every chart at once.
 */
export function outcomeOrderFor(outcomeRanking: unknown): string[] | undefined {
  if (!outcomeRanking || typeof outcomeRanking !== 'object') return undefined
  const order = (outcomeRanking as { order?: unknown }).order
  if (!Array.isArray(order)) return undefined
  return order.filter((v): v is string => typeof v === 'string')
}
