import { mintServiceToken } from '@/lib/serviceToken';
// app/api/agents/update-status/[agentName]/route.ts
//
// Polled by the frontend after POST /api/agents/save-and-deploy returns its
// immediate "update_started" response. The actual stop/start cycle runs in
// the background on the voice backend (see server.py's update_agent_config),
// so this just reads its live progress — cheap and fast on every call, which
// is what lets the frontend keep polling without hitting any request timeout.
import { NextRequest, NextResponse } from 'next/server'
import {
  isPypeUpstreamUnreachable,
  pypeApiAbortSignal,
} from '@/lib/pypeApiFetch'
import { resolveApiBaseUrlForAgent } from '@/lib/getProjectRoleForApi'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentName: string }> }
) {
  try {
    const { agentName } = await params

    if (!agentName?.trim()) {
      return NextResponse.json({ error: 'Agent name is required' }, { status: 400 })
    }

    const urlResult = await resolveApiBaseUrlForAgent(agentName)
    if ('errorResponse' in urlResult) return urlResult.errorResponse
    const { apiUrl: apiBaseUrl } = urlResult

    const apiKey =
      process.env.PYPEAI_X_API_KEY ||
      process.env.NEXT_PUBLIC_X_API_KEY ||
      'pype-api-v1'

    const url = `${apiBaseUrl}/agent_config/${encodeURIComponent(agentName)}/update_status`
    let response: Response
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey, 'Authorization': 'Bearer ' + mintServiceToken(),
        },
        signal: pypeApiAbortSignal(),
      })
    } catch (fetchErr: unknown) {
      if (isPypeUpstreamUnreachable(fetchErr)) {
        return NextResponse.json(
          { status: 'unreachable', agent_name: agentName },
          { status: 200 }
        )
      }
      throw fetchErr
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      return NextResponse.json(
        { error: 'Failed to fetch update status', details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch update status', details: error?.message },
      { status: 500 }
    )
  }
}
