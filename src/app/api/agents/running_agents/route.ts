// Create: app/api/agents/running_agents/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getPypeApiBaseUrlForServer, isPypeUpstreamUnreachable, pypeApiAbortSignal, pypeAgentControlHeaders, type DeploymentTarget } from '@/lib/pypeApiFetch'

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

export async function GET(_request: NextRequest) {
  try {
    const [classicAgents, dockerAgents] = await Promise.all([
      fetchRunningAgentsFrom('classic'),
      fetchRunningAgentsFrom('docker'),
    ])

    return NextResponse.json([...classicAgents, ...dockerAgents])
  } catch (error: any) {
    console.error('Running agents proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch running agents', details: error.message },
      { status: 500 }
    )
  }
}