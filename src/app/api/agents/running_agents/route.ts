// Create: app/api/agents/running_agents/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getPypeApiBaseUrlForServer, isPypeUpstreamUnreachable, pypeApiAbortSignal, pypeAgentControlHeaders, type DeploymentTarget } from '@/lib/pypeApiFetch'
import { extractAgentIdFromBackendName, getDeploymentTargetsForAgentIds } from '@/lib/getProjectRoleForApi'

/**
 * Fetches /running_agents from one backend. Agents run on either the classic
 * VM or the docker VM, so the dashboard's running/stopped dot has to merge
 * both — querying only one silently reports the other backend's agents as
 * stopped. Returns [] on any failure (unreachable, non-2xx, non-JSON) so one
 * backend being down doesn't blank out the other's results.
 */
async function fetchRunningAgentsFrom(target: DeploymentTarget): Promise<unknown[]> {
  const apiUrl = getPypeApiBaseUrlForServer(target)
  if (!apiUrl) return []

  try {
    const response = await fetch(`${apiUrl}/running_agents`, {
      method: 'GET',
      headers: {
        ...pypeAgentControlHeaders(),
        'User-Agent': 'NextJS-Proxy'
      },
      signal: pypeApiAbortSignal(),
    })

    if (!response.ok) {
      console.error(`[Running Agents] ${target} backend error: ${response.status} ${response.statusText}`)
      return []
    }

    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      console.error(`[Running Agents] ${target} backend returned non-JSON response`)
      return []
    }

    const data = await response.json()
    return Array.isArray(data) ? data : []
  } catch (fetchErr: unknown) {
    if (!isPypeUpstreamUnreachable(fetchErr)) {
      console.error(`[Running Agents] ${target} backend fetch failed:`, fetchErr)
    }
    return []
  }
}

function isLiveEntry(entry: any): boolean {
  return !!entry?.pid || entry?.status === 'running'
}

type TaggedEntry = { entry: any; source: DeploymentTarget }

/**
 * The classic backend lists every agent name it has ever seen, even ones that
 * actually run on the docker VM — so an agent can appear in both lists at
 * once (classic: stale "needs_restart", docker: real "running"). Trusting
 * whichever entry merely "looks live" is unsafe: it would also pick a
 * spurious live-looking entry from the wrong backend over a correct "stopped"
 * from the agent's real one. Instead, resolve each agent's actual
 * deployment_target from the DB and only trust the entry that came from that
 * backend. Falls back to the liveness heuristic only when an agent's id can't
 * be resolved (e.g. malformed/legacy names).
 */
async function mergeRunningAgents(...lists: { entries: unknown[]; source: DeploymentTarget }[]): Promise<unknown[]> {
  const tagged: TaggedEntry[] = []
  for (const { entries, source } of lists) {
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object' || !('agent_name' in entry)) continue
      tagged.push({ entry, source })
    }
  }

  const agentIds = [...new Set(
    tagged.map(t => extractAgentIdFromBackendName((t.entry as any).agent_name)).filter((id): id is string => !!id)
  )]
  const targetByAgentId = await getDeploymentTargetsForAgentIds(agentIds)

  const byName = new Map<string, TaggedEntry>()
  for (const t of tagged) {
    const name = (t.entry as any).agent_name
    const agentId = extractAgentIdFromBackendName(name)
    const authoritativeTarget = agentId ? targetByAgentId.get(agentId) : undefined
    const existing = byName.get(name)

    if (!existing) {
      byName.set(name, t)
      continue
    }
    if (authoritativeTarget) {
      if (t.source === authoritativeTarget) byName.set(name, t)
    } else if (isLiveEntry(t.entry) && !isLiveEntry(existing.entry)) {
      byName.set(name, t)
    }
  }
  return [...byName.values()].map(t => t.entry)
}

export async function GET(_request: NextRequest) {
  try {
    const [classicAgents, dockerAgents] = await Promise.all([
      fetchRunningAgentsFrom('classic'),
      fetchRunningAgentsFrom('docker'),
    ])

    const merged = await mergeRunningAgents(
      { entries: classicAgents, source: 'classic' },
      { entries: dockerAgents, source: 'docker' }
    )
    return NextResponse.json(merged)
  } catch (error: any) {
    console.error('Running agents proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch running agents', details: error.message },
      { status: 500 }
    )
  }
}