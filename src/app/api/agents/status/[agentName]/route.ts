import { mintServiceToken } from '@/lib/serviceToken';
// app/api/agents/status/[agentName]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import {
  requireApiBaseUrl,
  isPypeUpstreamUnreachable,
  pypeApiAbortSignal,
} from '@/lib/pypeApiFetch'
import { getDeploymentTargetFromAgentBackendName } from '@/lib/getProjectRoleForApi'

interface AgentStatusResponse {
  is_active: boolean
  worker_running: boolean
  worker_pid?: number
  inbound_ready?: boolean
  [key: string]: any // Allow for additional fields
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentName: string }> }
) {
  try {
    // Await params in Next.js 15+
    const { agentName } = await params

    // Validate agent name
    if (!agentName || !agentName.trim()) {
      return NextResponse.json(
        { error: 'Agent name is required' },
        { status: 400 }
      )
    }

    // Which backend this agent actually lives on — resolved from its own
    // persisted record, not trusted from the client.
    const deploymentTarget = await getDeploymentTargetFromAgentBackendName(agentName)

    const urlResult = requireApiBaseUrl(deploymentTarget)
    if ('errorResponse' in urlResult) return urlResult.errorResponse
    const { apiUrl: apiBaseUrl } = urlResult

    const apiKey =
      process.env.PYPEAI_X_API_KEY ||
      process.env.NEXT_PUBLIC_X_API_KEY ||
      'pype-api-v1'

    // Call backend API
    const url = `${apiBaseUrl}/agent_status/${encodeURIComponent(agentName)}`
    let response: Response
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey, 'Authorization': 'Bearer ' + mintServiceToken()
        },
        signal: pypeApiAbortSignal(),
      })
    } catch (fetchErr: unknown) {
      if (isPypeUpstreamUnreachable(fetchErr)) {
        return NextResponse.json({
          is_active: false,
          worker_running: false,
          inbound_ready: false,
          backend_unavailable: true,
        })
      }
      throw fetchErr
    }

    // Handle non-OK responses
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`Backend API error: ${response.status} - ${errorText}`)
      
      return NextResponse.json(
        { 
          error: 'Failed to check agent status',
          details: errorText
        },
        { status: response.status }
      )
    }

    // Parse and return the response
    const data: AgentStatusResponse = await response.json()

    return NextResponse.json(data)

  } catch (error) {
    console.error('Error in agent status API route:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

