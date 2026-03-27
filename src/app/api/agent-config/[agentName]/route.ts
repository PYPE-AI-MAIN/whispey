import { NextRequest, NextResponse } from "next/server"
import { getProjectIdFromAgentBackendName, isViewerForProject } from '@/lib/getProjectRoleForApi'
import {
  getPypeApiBaseUrlForServer,
  isPypeUpstreamUnreachable,
  pypeApiAbortSignal,
} from '@/lib/pypeApiFetch'

const DEGRADED_AGENT_CONFIG = {
  backendUnavailable: true as const,
  backendUnavailableMessage:
    "Voice backend did not respond. Set PYPEAI_API_URL (recommended for local dev, e.g. http://127.0.0.1:8000) or fix NEXT_PUBLIC_PYPEAI_API_URL, then restart the dev server.",
  agent: { assistant: [] as unknown[] },
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const pathSegments = url.pathname.split("/")
    const agentName = pathSegments[pathSegments.length - 1]

    if (!agentName) {
      return NextResponse.json({ message: "Agent name is required" }, { status: 400 })
    }

    const projectId = await getProjectIdFromAgentBackendName(agentName)
    if (projectId && (await isViewerForProject(projectId))) {
      return NextResponse.json({ message: "Forbidden: viewers cannot access agent config" }, { status: 403 })
    }

    const baseUrl = getPypeApiBaseUrlForServer()
    if (!baseUrl) {
      return NextResponse.json(
        { message: "Missing PYPEAI_API_URL or NEXT_PUBLIC_PYPEAI_API_URL" },
        { status: 500 },
      )
    }

    const apiUrl = `${baseUrl}/agent_config/${encodeURIComponent(agentName)}`
    let response: Response
    try {
      response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "pype-api-v1",
        },
        signal: pypeApiAbortSignal(),
      })
    } catch (fetchErr: unknown) {
      if (isPypeUpstreamUnreachable(fetchErr)) {
        return NextResponse.json(DEGRADED_AGENT_CONFIG, { status: 200 })
      }
      throw fetchErr
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "")
      return NextResponse.json(
        {
          message: `Failed to fetch agent config: ${response.status} ${response.statusText}`,
          error: errorText || undefined,
        },
        { status: response.status },
      )
    }

    const data = await response.json().catch(async () => {
      // fallback for non-JSON content
      const raw = await response.text().catch(() => "")
      return raw ? JSON.parse(raw) : null
    })

    return NextResponse.json(data, { status: 200 })
  } catch (err: any) {
    return NextResponse.json(
      { message: "Unexpected error fetching agent config", error: err?.message },
      { status: 500 },
    )
  }
}
