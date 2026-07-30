// app/api/agents/stop_agent/route.ts - CORRECTED VERSION
import { NextRequest, NextResponse } from 'next/server'
import { pypeAgentControlHeaders } from '@/lib/pypeApiFetch'
import { resolveApiBaseUrlForAgent } from '@/lib/getProjectRoleForApi'

export async function POST(request: NextRequest) {
  try {
    // Parse the request body to get the agent_name
    const body = await request.json()
    const { agent_name } = body

    if (!agent_name) {
      return NextResponse.json(
        { error: 'agent_name is required' },
        { status: 400 }
      )
    }

    // Which backend this agent actually lives on — resolved from its own
    // persisted record, not trusted from the client.
    const urlResult = await resolveApiBaseUrlForAgent(agent_name)
    if ('errorResponse' in urlResult) return urlResult.errorResponse
    const { apiUrl } = urlResult

    console.log(`Stopping agent: ${agent_name}`)
    // FIXED: Use the correct backend endpoint /stop_agent (not /api/stop_agent)
    console.log(`Proxying request to: ${apiUrl}/stop_agent`)

    // FIXED: Call the correct backend endpoint
    const response = await fetch(`${apiUrl}/stop_agent`, {
      method: 'POST',
      headers: {
        ...pypeAgentControlHeaders(),
        'User-Agent': 'NextJS-Proxy'
      },
      body: JSON.stringify({ agent_name })
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      console.error(`Backend API error: ${response.status} ${response.statusText} - ${errorText}`)
      return NextResponse.json(
        { error: `Failed to stop agent: ${response.status} - ${errorText}` },
        { status: response.status }
      )
    }

    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      const textResponse = await response.text()
      console.error('Non-JSON response from backend:', textResponse.substring(0, 200))
      return NextResponse.json(
        { error: 'Backend returned non-JSON response' },
        { status: 502 }
      )
    }

    const data = await response.json()
    console.log('Agent stop response:', data)
    
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('Stop agent proxy error:', error)
    return NextResponse.json(
      { error: 'Failed to stop agent', details: error.message },
      { status: 500 }
    )
  }
}